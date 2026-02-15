import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface AddMaterialRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddMaterialRequestDialog = ({ open, onOpenChange, onSuccess }: AddMaterialRequestDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [serviceFronts, setServiceFronts] = useState<Array<{ id: string; name: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [inventoryItems, setInventoryItems] = useState<Array<{ id: string; material_name: string; unit: string | null; quantity_available: number }>>([]);
  const [formData, setFormData] = useState({
    projectId: "",
    serviceFrontId: "",
    employeeId: "",
    requestorName: "",
    materialName: "",
    quantity: "",
    unit: "",
    neededDate: "",
    usageLocation: "",
    requestDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  useEffect(() => {
    if (formData.projectId) {
      fetchServiceFronts(formData.projectId);
      fetchEmployees(formData.projectId);
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

  const fetchEmployees = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name")
        .eq("project_id", projectId)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar funcionários: " + error.message);
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
    if (!formData.projectId || !formData.serviceFrontId || !formData.materialName || !formData.quantity || !formData.requestorName) {
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

      const { error } = await supabase.from("material_requests").insert({
        project_id: formData.projectId,
        service_front_id: formData.serviceFrontId,
        requested_by_employee_id: formData.employeeId || null,
        requestor_name: formData.requestorName,
        material_name: formData.materialName,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit.trim(),
        needed_date: formData.neededDate || null,
        usage_location: formData.usageLocation || null,
        request_date: formData.requestDate,
        requested_by_user_id: userData.user.id,
        status: "pendente",
      });

      if (error) throw error;

      toast.success("Pedido de material criado com sucesso!");
      onOpenChange(false);
      onSuccess();
      setFormData({
        projectId: "",
        serviceFrontId: "",
        employeeId: "",
        requestorName: "",
        materialName: "",
        quantity: "",
        unit: "",
        neededDate: "",
        usageLocation: "",
        requestDate: new Date().toISOString().split("T")[0],
      });
    } catch (error: any) {
      toast.error("Erro ao criar pedido: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Novo Pedido de Material</DialogTitle>
          <DialogDescription>Solicite materiais para o projeto</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="space-y-4 py-4 overflow-y-auto px-1">
            <div className="space-y-2">
              <Label htmlFor="requestDate">Data do Pedido *</Label>
              <Input
                id="requestDate"
                type="date"
                value={formData.requestDate}
                onChange={(e) => setFormData({ ...formData, requestDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Projeto *</Label>
              <Select value={formData.projectId} onValueChange={(value) => setFormData({ ...formData, projectId: value, serviceFrontId: "", employeeId: "" })}>
                <SelectTrigger id="project">
                  <SelectValue placeholder={projects.length === 0 ? "Nenhum projeto encontrado" : "Selecione o projeto"} />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      Nenhum projeto disponível. Crie um projeto primeiro.
                    </div>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceFront">Frente de Serviço *</Label>
              <Select value={formData.serviceFrontId} onValueChange={(value) => setFormData({ ...formData, serviceFrontId: value })} disabled={!formData.projectId}>
                <SelectTrigger id="serviceFront">
                  <SelectValue placeholder={!formData.projectId ? "Selecione um projeto primeiro" : serviceFronts.length === 0 ? "Nenhuma frente encontrada" : "Selecione a frente"} />
                </SelectTrigger>
                <SelectContent>
                  {serviceFronts.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      Nenhuma frente de serviço disponível para este projeto.
                    </div>
                  ) : (
                    serviceFronts.map((front) => (
                      <SelectItem key={front.id} value={front.id}>
                        {front.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestorName">Nome do Solicitante *</Label>
              <Input
                id="requestorName"
                value={formData.requestorName}
                onChange={(e) => setFormData({ ...formData, requestorName: e.target.value })}
                placeholder="Nome de quem está solicitando"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee">Funcionário Solicitante (Opcional)</Label>
              <Select value={formData.employeeId} onValueChange={(value) => setFormData({ ...formData, employeeId: value })} disabled={!formData.projectId}>
                <SelectTrigger id="employee">
                  <SelectValue placeholder={!formData.projectId ? "Selecione um projeto primeiro" : "Selecione o funcionário (opcional)"} />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      Nenhum funcionário cadastrado neste projeto.
                    </div>
                  ) : (
                    employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {inventoryItems.length > 0 && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="inventoryItem">Buscar no Almoxarifado</Label>
                <Select onValueChange={handleSelectInventoryItem} disabled={!formData.projectId}>
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
                  Selecione um material do almoxarifado para preencher automaticamente
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
                <Label htmlFor="quantity">Quantidade *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
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

            <div className="space-y-2">
              <Label htmlFor="neededDate">Prazo (Quando Precisa)</Label>
              <Input
                id="neededDate"
                type="date"
                value={formData.neededDate}
                onChange={(e) => setFormData({ ...formData, neededDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usageLocation">Onde Vai Ser Usado</Label>
              <Input
                id="usageLocation"
                value={formData.usageLocation}
                onChange={(e) => setFormData({ ...formData, usageLocation: e.target.value })}
                placeholder="Local de utilização"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Criar Pedido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
