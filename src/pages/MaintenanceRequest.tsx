import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface QRCodeData {
  id: string;
  location_name: string;
  location_description?: string;
  is_active: boolean;
  projects: { name: string };
}

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_CONTACT_LENGTH = 100;

export default function MaintenanceRequest() {
  const [searchParams] = useSearchParams();
  const qrParam = searchParams.get("qr");
  const [qrCodeData, setQrCodeData] = useState<QRCodeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    requesterName: "",
    requesterContact: "",
    issueDescription: "",
    urgencyLevel: "normal",
  });

  useEffect(() => {
    if (qrParam) {
      fetchQRCodeData();
    } else {
      setIsLoading(false);
    }
  }, [qrParam]);

  const fetchQRCodeData = async () => {
    try {
      const qrCodeUrl = `${window.location.origin}/maintenance-request?qr=${qrParam}`;
      
      const { data, error } = await supabase
        .from("maintenance_qr_codes")
        .select(`
          id,
          location_name,
          location_description,
          is_active,
          projects (name)
        `)
        .eq("qr_code_data", qrCodeUrl)
        .single();

      if (error) throw error;
      setQrCodeData(data);
    } catch (error: any) {
      toast.error("QR Code inválido ou não encontrado");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setPhotos((prev) => [...prev, ...newFiles].slice(0, 5)); // Max 5 photos
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotosViaEdgeFunction = async (qrCodeId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const photo of photos) {
      // Request signed upload URL from edge function
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
        'maintenance-request-upload',
        {
          body: {
            action: 'get_upload_url',
            qr_code_id: qrCodeId,
            file_name: photo.name,
          },
        }
      );

      if (uploadError || !uploadData?.signedUploadUrl) {
        throw new Error(uploadData?.error || 'Erro ao obter URL de upload');
      }

      // Upload photo using signed URL
      const uploadResponse = await fetch(uploadData.signedUploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': photo.type,
        },
        body: photo,
      });

      if (!uploadResponse.ok) {
        throw new Error('Erro ao fazer upload da foto');
      }

      uploadedUrls.push(uploadData.publicUrl);
    }

    return uploadedUrls;
  };

  const validateForm = (): boolean => {
    if (!formData.requesterName.trim()) {
      toast.error("Nome é obrigatório");
      return false;
    }
    if (formData.requesterName.length > MAX_NAME_LENGTH) {
      toast.error(`Nome muito longo (máximo ${MAX_NAME_LENGTH} caracteres)`);
      return false;
    }
    if (!formData.issueDescription.trim()) {
      toast.error("Descrição do problema é obrigatória");
      return false;
    }
    if (formData.issueDescription.length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Descrição muito longa (máximo ${MAX_DESCRIPTION_LENGTH} caracteres)`);
      return false;
    }
    if (formData.requesterContact && formData.requesterContact.length > MAX_CONTACT_LENGTH) {
      toast.error(`Contato muito longo (máximo ${MAX_CONTACT_LENGTH} caracteres)`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!qrCodeData) {
      toast.error("QR Code inválido");
      return;
    }

    if (!qrCodeData.is_active) {
      toast.error("Este QR Code está desativado");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload photos via edge function (with rate limiting)
      const photoUrls = await uploadPhotosViaEdgeFunction(qrCodeData.id);

      // Create maintenance request via edge function (with rate limiting and sanitization)
      const { data, error } = await supabase.functions.invoke(
        'maintenance-request-upload',
        {
          body: {
            action: 'create_request',
            qr_code_id: qrCodeData.id,
            maintenance_request: {
              requester_name: formData.requesterName.trim(),
              requester_contact: formData.requesterContact.trim() || null,
              issue_description: formData.issueDescription.trim(),
              urgency_level: formData.urgencyLevel,
              photos_urls: photoUrls,
            },
          },
        }
      );

      if (error) {
        throw new Error(error.message || 'Erro ao enviar solicitação');
      }

      if (data?.error) {
        // Handle rate limiting errors
        if (data.error.includes('rate limit') || data.error.includes('Limite')) {
          toast.error("Você atingiu o limite de solicitações. Tente novamente mais tarde.");
        } else {
          toast.error(data.error);
        }
        return;
      }

      setIsSubmitted(true);
      toast.success("Solicitação enviada com sucesso!");
    } catch (error: any) {
      const message = error.message || "Erro ao enviar solicitação";
      if (message.includes('rate limit') || message.includes('Limite')) {
        toast.error("Você atingiu o limite de solicitações. Tente novamente mais tarde.");
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <QrCode className="h-12 w-12 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!qrParam || !qrCodeData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              QR Code Inválido
            </CardTitle>
            <CardDescription>
              O QR Code escaneado não é válido ou expirou
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!qrCodeData.is_active) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
              QR Code Desativado
            </CardTitle>
            <CardDescription>
              Este QR Code foi desativado e não está aceitando novas solicitações
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              Solicitação Enviada!
            </CardTitle>
            <CardDescription>
              Sua solicitação de manutenção foi recebida com sucesso. A equipe responsável será notificada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Local:</strong> {qrCodeData.location_name}</p>
              <p><strong>Projeto:</strong> {qrCodeData.projects.name}</p>
              {qrCodeData.location_description && (
                <p className="text-muted-foreground">{qrCodeData.location_description}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-6 w-6" />
              Solicitação de Manutenção
            </CardTitle>
            <CardDescription>
              <div className="mt-2 space-y-1">
                <p><strong>Local:</strong> {qrCodeData.location_name}</p>
                <p><strong>Projeto:</strong> {qrCodeData.projects.name}</p>
                {qrCodeData.location_description && (
                  <p className="text-muted-foreground">{qrCodeData.location_description}</p>
                )}
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="requesterName">Seu Nome *</Label>
                <Input
                  id="requesterName"
                  value={formData.requesterName}
                  onChange={(e) => setFormData({ ...formData, requesterName: e.target.value })}
                  placeholder="Nome completo"
                  maxLength={MAX_NAME_LENGTH}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {formData.requesterName.length}/{MAX_NAME_LENGTH}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requesterContact">Telefone ou Email (Opcional)</Label>
                <Input
                  id="requesterContact"
                  value={formData.requesterContact}
                  onChange={(e) => setFormData({ ...formData, requesterContact: e.target.value })}
                  placeholder="Para contato, se necessário"
                  maxLength={MAX_CONTACT_LENGTH}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgencyLevel">Urgência *</Label>
                <Select
                  value={formData.urgencyLevel}
                  onValueChange={(value) => setFormData({ ...formData, urgencyLevel: value })}
                >
                  <SelectTrigger id="urgencyLevel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="issueDescription">Descrição do Problema *</Label>
                <Textarea
                  id="issueDescription"
                  value={formData.issueDescription}
                  onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
                  placeholder="Descreva o problema encontrado..."
                  rows={4}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {formData.issueDescription.length}/{MAX_DESCRIPTION_LENGTH}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photos">Fotos (até 5)</Label>
                <Input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  disabled={photos.length >= 5}
                />
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1"
                          onClick={() => removePhoto(index)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
