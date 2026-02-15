import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  project_id: z.string().optional(),
  team_name: z.string().optional(),
  report_date: z.date().optional(),
  address: z.string().optional(),
  address_complement: z.string().optional(),
  client_name: z.string().optional(),
  water_meter_number: z.string().optional(),
  os_number: z.string().optional(),
  service_type: z.string().optional(),
  service_category: z.string().optional(),
  connection_type: z.string().optional(),
  observations: z.string().optional(),
  materials_used: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ConnectionReport {
  id: string;
  team_name: string;
  report_date: string;
  address: string;
  address_complement: string | null;
  client_name: string;
  water_meter_number: string;
  os_number: string;
  service_type: string;
  service_category: string | null;
  connection_type: string | null;
  observations: string | null;
  materials_used: any[] | null;
  photos_urls: string[];
  logo_url: string | null;
  project_id: string | null;
}

interface EditConnectionReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ConnectionReport | null;
}

export function EditConnectionReportDialog({
  open,
  onOpenChange,
  report,
}: EditConnectionReportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [logo, setLogo] = useState<File | null>(null);
  const [existingLogo, setExistingLogo] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!session,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: "",
      team_name: "",
      report_date: new Date(),
      address: "",
      address_complement: "",
      client_name: "",
      water_meter_number: "",
      os_number: "",
      service_type: "",
      service_category: "",
      connection_type: "",
      observations: "",
      materials_used: "",
    },
  });

  useEffect(() => {
    if (report && open) {
      const materialsStr = report.materials_used && Array.isArray(report.materials_used) 
        ? report.materials_used.map(m => `"${m}"`).join(', ') 
        : "";
      
      form.reset({
        project_id: report.project_id || "",
        team_name: report.team_name || "",
        report_date: report.report_date ? new Date(report.report_date) : new Date(),
        address: report.address || "",
        address_complement: report.address_complement || "",
        client_name: report.client_name || "",
        water_meter_number: report.water_meter_number || "",
        os_number: report.os_number || "",
        service_type: report.service_type || "",
        service_category: report.service_category || "",
        connection_type: report.connection_type || "",
        observations: report.observations || "",
        materials_used: materialsStr,
      });
      setExistingPhotos(report.photos_urls || []);
      setExistingLogo(report.logo_url || null);
      setPhotos([]);
      setLogo(null);
    }
  }, [report, open, form]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files);
      setPhotos((prev) => [...prev, ...newPhotos]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogo(e.target.files[0]);
    }
  };

  const removeLogo = () => {
    setLogo(null);
  };

  const removeExistingLogo = () => {
    setExistingLogo(null);
  };

  const uploadLogo = async (userId: string): Promise<string | null> => {
    if (!logo) return existingLogo;

    try {
      const fileExt = logo.name.split(".").pop();
      const fileName = `${userId}/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("connection-report-photos")
        .upload(fileName, logo);

      if (uploadError) throw uploadError;

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("connection-report-photos")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry

      if (signedUrlError) throw signedUrlError;
      const publicUrl = signedUrlData.signedUrl;

      return publicUrl;
    } catch (error) {
      console.error("Error uploading logo:", error);
      throw error;
    }
  };

  const uploadPhotos = async (userId: string): Promise<string[]> => {
    if (photos.length === 0) return existingPhotos;

    setUploadingPhotos(true);
    const uploadedUrls: string[] = [...existingPhotos];

    try {
      for (const photo of photos) {
        const fileExt = photo.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}-${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("connection-report-photos")
          .upload(fileName, photo);

        if (uploadError) throw uploadError;

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from("connection-report-photos")
          .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry

        if (signedUrlError) throw signedUrlError;
        const publicUrl = signedUrlData.signedUrl;

        uploadedUrls.push(publicUrl);
      }

      return uploadedUrls;
    } catch (error) {
      console.error("Error uploading photos:", error);
      throw error;
    } finally {
      setUploadingPhotos(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!session?.user?.id || !report) throw new Error("No user session or report");

      const logoUrl = await uploadLogo(session.user.id);
      const photoUrls = await uploadPhotos(session.user.id);

      // Parse materials_used
      let materialsArray = [];
      if (values.materials_used) {
        try {
          // Try to parse as JSON array first
          materialsArray = JSON.parse(`[${values.materials_used}]`);
        } catch {
          // If parsing fails, split by comma and clean up
          materialsArray = values.materials_used
            .split(',')
            .map(m => m.trim().replace(/^["']|["']$/g, ''))
            .filter(m => m.length > 0);
        }
      }

      const { error } = await supabase
        .from("connection_reports")
        .update({
          project_id: values.project_id || null,
          team_name: values.team_name || null,
          report_date: values.report_date ? format(values.report_date, "yyyy-MM-dd") : null,
          address: values.address || null,
          address_complement: values.address_complement || null,
          client_name: values.client_name || null,
          water_meter_number: values.water_meter_number || null,
          os_number: values.os_number || null,
          service_type: values.service_type || null,
          service_category: values.service_category || null,
          connection_type: values.connection_type || null,
          observations: values.observations || null,
          materials_used: materialsArray,
          photos_urls: photoUrls,
          logo_url: logoUrl,
        })
        .eq("id", report.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection-reports"] });
      toast({
        title: "Sucesso!",
        description: "Relatório de ligação atualizado com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar relatório de ligação.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Relatório de Ligação</DialogTitle>
          <DialogDescription>
            Atualize as informações do relatório de ligação abaixo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projeto (Opcional)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "none" ? "" : v)} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um projeto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum projeto</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="team_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Equipe (Opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Equipe A" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="report_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data do Relatório (Opcional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Selecione a data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Logo da Empresa (Opcional)</FormLabel>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("logo-upload-edit")?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {logo || existingLogo ? "Alterar Logo" : "Adicionar Logo"}
                </Button>
                <input
                  id="logo-upload-edit"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>
              {existingLogo && !logo && (
                <div className="relative w-32 h-32 border rounded">
                  <img
                    src={existingLogo}
                    alt="Logo atual"
                    className="w-full h-full object-contain p-2"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={removeExistingLogo}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {logo && (
                <div className="relative w-32 h-32 border rounded">
                  <img
                    src={URL.createObjectURL(logo)}
                    alt="Nova logo"
                    className="w-full h-full object-contain p-2"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={removeLogo}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço (Opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Rua, número" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address_complement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Complemento do Endereço (Opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Apto, bloco, etc." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Cliente (Opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome completo do cliente" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="water_meter_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do Hidrômetro (Opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: 123456789" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="os_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número da OS (Opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: OS-2024-001" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="service_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Serviço (Opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Instalação, Manutenção, etc." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="service_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ligação Água ou Esgoto (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="agua">Água</SelectItem>
                      <SelectItem value="esgoto">Esgoto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="connection_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Ligação (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="avulsa">Avulsa</SelectItem>
                      <SelectItem value="intra_1">Intra 1</SelectItem>
                      <SelectItem value="intra_2">Intra 2</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Fotos do Relatório (Opcional)</FormLabel>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("photo-upload-edit")?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Adicionar Mais Fotos
                </Button>
                <input
                  id="photo-upload-edit"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
              {existingPhotos.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Fotos atuais:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {existingPhotos.map((photoUrl, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photoUrl}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-24 object-cover rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => removeExistingPhoto(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {photos.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Novas fotos:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Nova foto ${index + 1}`}
                          className="w-full h-24 object-cover rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => removePhoto(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="materials_used"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Materiais Utilizados (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder='Digite os materiais no formato: "Material 1", "Material 2", "Material 3"'
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Observações adicionais sobre o serviço..."
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending || uploadingPhotos}
              >
                {updateMutation.isPending || uploadingPhotos ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadingPhotos ? "Enviando fotos..." : "Atualizando..."}
                  </>
                ) : (
                  "Atualizar Relatório"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
