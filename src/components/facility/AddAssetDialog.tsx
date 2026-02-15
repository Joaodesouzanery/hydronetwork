import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Asset {
  id: string;
  name: string;
  type: string;
  detailed_location?: string;
  tower?: string;
  floor?: string;
  sector?: string;
  coordinates?: string;
  main_responsible?: string;
  technical_notes?: string;
  project_id?: string;
}

interface AddAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset | null;
  onSuccess: () => void;
}

export const AddAssetDialog = ({
  open,
  onOpenChange,
  asset,
  onSuccess,
}: AddAssetDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    detailed_location: "",
    tower: "",
    floor: "",
    sector: "",
    coordinates: "",
    main_responsible: "",
    technical_notes: "",
    project_id: "",
  });

  useEffect(() => {
    if (open) {
      fetchProjects();
      if (asset) {
        setFormData({
          name: asset.name || "",
          type: asset.type || "",
          detailed_location: asset.detailed_location || "",
          tower: asset.tower || "",
          floor: asset.floor || "",
          sector: asset.sector || "",
          coordinates: asset.coordinates || "",
          main_responsible: asset.main_responsible || "",
          technical_notes: asset.technical_notes || "",
          project_id: asset.project_id || "",
        });
      } else {
        resetForm();
      }
    }
  }, [open, asset]);

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
      console.error("Error fetching projects:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      detailed_location: "",
      tower: "",
      floor: "",
      sector: "",
      coordinates: "",
      main_responsible: "",
      technical_notes: "",
      project_id: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha o nome e o tipo do ativo.",
      });
      return;
    }

    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado");

      const dataToSave = {
        ...formData,
        created_by_user_id: user.id,
        project_id: formData.project_id || null,
      };

      let error;
      if (asset) {
        const { error: updateError } = await supabase
          .from("assets_catalog")
          .update(dataToSave)
          .eq("id", asset.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("assets_catalog")
          .insert([dataToSave]);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: asset ? "Ativo atualizado" : "Ativo adicionado",
        description: asset
          ? "O ativo foi atualizado com sucesso."
          : "O ativo foi adicionado ao catálogo.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar ativo",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {asset ? "Editar Ativo" : "Adicionar Ativo"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="space-y-4 pr-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Ativo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ex: Casa de bombas"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipamento">Equipamento</SelectItem>
                    <SelectItem value="área física">Área Física</SelectItem>
                    <SelectItem value="sistema">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Projeto</Label>
              <Select
                value={formData.project_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, project_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto (opcional)" />
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
              <Label htmlFor="detailed_location">Localização Detalhada</Label>
              <Input
                id="detailed_location"
                value={formData.detailed_location}
                onChange={(e) =>
                  setFormData({ ...formData, detailed_location: e.target.value })
                }
                placeholder="Ex: Subsolo 2"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tower">Torre</Label>
                <Input
                  id="tower"
                  value={formData.tower}
                  onChange={(e) =>
                    setFormData({ ...formData, tower: e.target.value })
                  }
                  placeholder="Ex: A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="floor">Andar</Label>
                <Input
                  id="floor"
                  value={formData.floor}
                  onChange={(e) =>
                    setFormData({ ...formData, floor: e.target.value })
                  }
                  placeholder="Ex: 5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sector">Setor</Label>
                <Input
                  id="sector"
                  value={formData.sector}
                  onChange={(e) =>
                    setFormData({ ...formData, sector: e.target.value })
                  }
                  placeholder="Ex: Norte"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coordinates">Coordenadas GPS</Label>
              <Input
                id="coordinates"
                value={formData.coordinates}
                onChange={(e) =>
                  setFormData({ ...formData, coordinates: e.target.value })
                }
                placeholder="Ex: -23.550520, -46.633308"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="main_responsible">Responsável Principal</Label>
              <Input
                id="main_responsible"
                value={formData.main_responsible}
                onChange={(e) =>
                  setFormData({ ...formData, main_responsible: e.target.value })
                }
                placeholder="Nome do responsável"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="technical_notes">Observações Técnicas</Label>
              <Textarea
                id="technical_notes"
                value={formData.technical_notes}
                onChange={(e) =>
                  setFormData({ ...formData, technical_notes: e.target.value })
                }
                placeholder="Informações técnicas, especificações, etc."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : asset ? "Atualizar" : "Adicionar"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
