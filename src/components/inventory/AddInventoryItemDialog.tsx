import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface InventoryItem {
  id: string;
  project_id: string;
  material_name: string;
  material_code: string | null;
  category: string | null;
  unit: string | null;
  quantity_available: number;
  minimum_stock: number;
  location: string | null;
  supplier: string | null;
  unit_cost: number;
  notes: string | null;
}

interface AddInventoryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  onSuccess: () => void;
}

export const AddInventoryItemDialog = ({ open, onOpenChange, item, onSuccess }: AddInventoryItemDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [formData, setFormData] = useState({
    projectId: "",
    materialName: "",
    category: "",
    unit: "",
    quantityAvailable: "",
    minimumStock: "",
    location: "",
    supplier: "",
    unitCost: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchProjects();
      if (item) {
        setFormData({
          projectId: item.project_id,
          materialName: item.material_name,
          category: item.category || "",
          unit: item.unit || "",
          quantityAvailable: item.quantity_available.toString(),
          minimumStock: item.minimum_stock.toString(),
          location: item.location || "",
          supplier: item.supplier || "",
          unitCost: item.unit_cost.toString(),
          notes: item.notes || "",
        });
      } else {
        resetForm();
      }
    }
  }, [open, item]);

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

  const resetForm = () => {
    setFormData({
      projectId: "",
      materialName: "",
      category: "",
      unit: "",
      quantityAvailable: "0",
      minimumStock: "0",
      location: "",
      supplier: "",
      unitCost: "0",
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.materialName) {
      toast.error("Preencha o nome do material");
      return;
    }

    setIsLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const dataToSave = {
        project_id: formData.projectId || null,
        material_name: formData.materialName,
        category: formData.category || null,
        unit: formData.unit || null,
        quantity_available: parseFloat(formData.quantityAvailable) || 0,
        minimum_stock: parseFloat(formData.minimumStock) || 0,
        location: formData.location || null,
        supplier: formData.supplier || null,
        unit_cost: parseFloat(formData.unitCost) || 0,
        notes: formData.notes || null,
        created_by_user_id: userData.user.id,
      };

      if (item) {
        const { error } = await supabase
          .from("inventory")
          .update(dataToSave)
          .eq("id", item.id);

        if (error) throw error;
        toast.success("Material atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("inventory")
          .insert(dataToSave);

        if (error) throw error;
        toast.success("Material adicionado com sucesso!");
      }

      onSuccess();
      resetForm();
    } catch (error: any) {
      toast.error("Erro ao salvar material: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const commonCategories = [
    "Cimento e Argamassa",
    "Areia e Brita",
    "Ferragens",
    "Madeira",
    "Elétrico",
    "Hidráulico",
    "Ferramentas",
    "EPI",
    "Acabamento",
    "Outros"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Editar Material" : "Novo Material"}</DialogTitle>
          <DialogDescription>
            {item ? "Atualize as informações do material" : "Adicione um novo material ao almoxarifado"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="project">Projeto</Label>
              <Select value={formData.projectId} onValueChange={(value) => setFormData({ ...formData, projectId: value })}>
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

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="materialName">Nome do Material</Label>
              <Input
                id="materialName"
                value={formData.materialName}
                onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
                placeholder="Ex: Cimento CP II"
              />
              <p className="text-xs text-muted-foreground">
                O código será gerado automaticamente
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {commonCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unidade</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="Ex: kg, m, un, saco"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantityAvailable">Quantidade Disponível</Label>
              <Input
                id="quantityAvailable"
                type="number"
                step="0.01"
                value={formData.quantityAvailable}
                onChange={(e) => setFormData({ ...formData, quantityAvailable: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimumStock">Estoque Mínimo</Label>
              <Input
                id="minimumStock"
                type="number"
                step="0.01"
                value={formData.minimumStock}
                onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Define quando este material será considerado de estoque baixo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Localização</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ex: Prateleira A-3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Fornecedor</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                placeholder="Nome do fornecedor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitCost">Custo Unitário (R$)</Label>
              <Input
                id="unitCost"
                type="number"
                step="0.01"
                value={formData.unitCost}
                onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informações adicionais sobre o material"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : item ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
