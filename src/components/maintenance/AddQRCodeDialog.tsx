import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface AddQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddQRCodeDialog = ({ open, onOpenChange, onSuccess }: AddQRCodeDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [formData, setFormData] = useState({
    projectId: "",
    locationName: "",
    locationDescription: "",
  });

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar projetos: " + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.projectId || !formData.locationName) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      // Generate unique QR code data
      const qrCodeData = `${window.location.origin}/maintenance-request?qr=${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const { error } = await supabase.from("maintenance_qr_codes").insert({
        project_id: formData.projectId,
        location_name: formData.locationName,
        location_description: formData.locationDescription || null,
        qr_code_data: qrCodeData,
        created_by_user_id: userData.user.id,
      });

      if (error) throw error;

      toast.success("QR Code criado com sucesso!");
      onOpenChange(false);
      onSuccess();
      setFormData({
        projectId: "",
        locationName: "",
        locationDescription: "",
      });
    } catch (error: any) {
      toast.error("Erro ao criar QR Code: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo QR Code de Manutenção</DialogTitle>
          <DialogDescription>
            Crie um QR Code para um local específico da obra
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project">Projeto *</Label>
            <Select
              value={formData.projectId}
              onValueChange={(value) => setFormData({ ...formData, projectId: value })}
            >
              <SelectTrigger id="project">
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationName">Nome do Local *</Label>
            <Input
              id="locationName"
              value={formData.locationName}
              onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
              placeholder="Ex: Sala de Estar, Banheiro, etc."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationDescription">Descrição (Opcional)</Label>
            <Textarea
              id="locationDescription"
              value={formData.locationDescription}
              onChange={(e) => setFormData({ ...formData, locationDescription: e.target.value })}
              placeholder="Informações adicionais sobre o local"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Criando..." : "Criar QR Code"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
