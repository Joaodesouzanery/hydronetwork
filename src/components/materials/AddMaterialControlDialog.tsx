import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface AddMaterialControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddMaterialControlDialog = ({ open, onOpenChange, onSuccess }: AddMaterialControlDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [serviceFronts, setServiceFronts] = useState<Array<{ id: string; name: string }>>([]);
  const [inventoryItems, setInventoryItems] = useState<Array<{ id: string; material_name: string; unit: string | null; quantity_available: number }>>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("");
  const [formData, setFormData] = useState({
    projectId: "",
    serviceFrontId: "",
    materialName: "",
    quantityUsed: "",
    unit: "",
    usageDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  useEffect(() => {
    if (formData.projectId) {
      fetchServiceFronts(formData.projectId);
      fetchInventoryItems(formData.projectId);
    }
  }, [formData.projectId]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar projetos: " + error.message);
    }
  };

  const fetchServiceFronts = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from("service_fronts")
        .select("id, name")
        .eq("project_id", projectId)
        .order("name");

      if (error) throw error;
      setServiceFronts(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar frentes: " + error.message);
    }
  };

  const fetchInventoryItems = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("id, material_name, unit, quantity_available")
        .eq("project_id", projectId)
        .gt("quantity_available", 0)
        .order("material_name");

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar inventário: " + error.message);
    }
  };

  const handleSelectInventoryItem = (itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) {
      setSelectedInventoryId(itemId);
      setFormData({
        ...formData,
        materialName: item.material_name,
        unit: item.unit || "un" // Default to "un" if unit is null
      });
      toast.success(`Material "${item.material_name}" selecionado do almoxarifado`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações adicionais para garantir que campos obrigatórios não estejam vazios
    if (!formData.projectId || !formData.serviceFrontId || !formData.materialName || !formData.quantityUsed) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Validação específica para unit - não pode ser string vazia
    if (!formData.unit || formData.unit.trim() === "") {
      toast.error("A unidade do material é obrigatória");
      return;
    }

    setIsLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const quantityUsed = parseFloat(formData.quantityUsed);

      // Register material control
      const { error: controlError } = await supabase.from("material_control").insert({
        project_id: formData.projectId,
        service_front_id: formData.serviceFrontId,
        material_name: formData.materialName,
        quantity_used: quantityUsed,
        unit: formData.unit.trim(),
        usage_date: formData.usageDate,
        recorded_by_user_id: userData.user.id,
      });

      if (controlError) throw controlError;

      // If material is from inventory, update stock and create movement
      if (selectedInventoryId) {
        const inventoryItem = inventoryItems.find(i => i.id === selectedInventoryId);
        if (inventoryItem) {
          if (quantityUsed > inventoryItem.quantity_available) {
            toast.error(`Quantidade em estoque insuficiente. Disponível: ${inventoryItem.quantity_available}`);
            setIsLoading(false);
            return;
          }

          // Update inventory quantity
          const newQuantity = inventoryItem.quantity_available - quantityUsed;
          const { error: updateError } = await supabase
            .from("inventory")
            .update({ quantity_available: newQuantity })
            .eq("id", selectedInventoryId);

          if (updateError) throw updateError;

          // Create inventory movement
          const { error: movementError } = await supabase
            .from("inventory_movements")
            .insert({
              inventory_id: selectedInventoryId,
              movement_type: "saida",
              quantity: quantityUsed,
              reason: "Consumo registrado no controle de material",
              reference_type: "material_control",
              created_by_user_id: userData.user.id,
            });

          if (movementError) throw movementError;

          toast.success("Consumo registrado e estoque atualizado!");
        }
      } else {
        toast.success("Consumo registrado com sucesso!");
      }

      onOpenChange(false);
      onSuccess();
      setFormData({
        projectId: "",
        serviceFrontId: "",
        materialName: "",
        quantityUsed: "",
        unit: "",
        usageDate: new Date().toISOString().split("T")[0],
      });
      setSelectedInventoryId("");
    } catch (error: any) {
      toast.error("Erro ao registrar consumo: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Registrar Consumo de Material</DialogTitle>
          <DialogDescription>Registre o material utilizado no projeto</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="space-y-4 py-4 overflow-y-auto px-1">
            <div className="space-y-2">
              <Label htmlFor="usageDate">Data de Uso *</Label>
              <Input
                id="usageDate"
                type="date"
                value={formData.usageDate}
                onChange={(e) => setFormData({ ...formData, usageDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Projeto *</Label>
              <Select value={formData.projectId} onValueChange={(value) => setFormData({ ...formData, projectId: value, serviceFrontId: "" })}>
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
              <Label htmlFor="serviceFront">Frente de Serviço *</Label>
              <Select value={formData.serviceFrontId} onValueChange={(value) => setFormData({ ...formData, serviceFrontId: value })} disabled={!formData.projectId}>
                <SelectTrigger id="serviceFront">
                  <SelectValue placeholder="Selecione a frente" />
                </SelectTrigger>
                <SelectContent>
                  {serviceFronts.map((front) => (
                    <SelectItem key={front.id} value={front.id}>
                      {front.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {inventoryItems.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="inventoryItem">Buscar no Almoxarifado</Label>
                <Select onValueChange={handleSelectInventoryItem} disabled={!formData.projectId} value={selectedInventoryId}>
                  <SelectTrigger id="inventoryItem">
                    <SelectValue placeholder="Selecione um material do estoque" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.material_name} - Disponível: {item.quantity_available} {item.unit || ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecione do almoxarifado para dar baixa automática no estoque
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="materialName">Material *</Label>
              <Input
                id="materialName"
                value={formData.materialName}
                onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
                placeholder="Nome do material"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantityUsed">Quantidade *</Label>
                <Input
                  id="quantityUsed"
                  type="number"
                  step="0.01"
                  value={formData.quantityUsed}
                  onChange={(e) => setFormData({ ...formData, quantityUsed: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidade *</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="m, kg, un"
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Registrar Consumo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
