import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface AddTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

export const AddTargetDialog = ({ open, onOpenChange, projectId, onSuccess }: AddTargetDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [serviceFronts, setServiceFronts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    service_front_id: "",
    service_id: "",
    target_quantity: "",
    target_date: new Date().toISOString().split('T')[0],
    employee_id: ""
  });

  useEffect(() => {
    if (open && projectId) {
      loadServiceFronts();
      loadServices();
      loadEmployees();
    }
  }, [open, projectId]);

  const loadServiceFronts = async () => {
    const { data } = await supabase
      .from('service_fronts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (data) setServiceFronts(data);
  };

  const loadServices = async () => {
    const { data } = await supabase
      .from('services_catalog')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setServices(data);
  };

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });
    
    if (data) setEmployees(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.service_front_id || !formData.service_id || !formData.target_quantity) {
      toast.error("Preencha todos os campos");
      return;
    }

    setIsLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from('production_targets')
        .insert([{
          service_front_id: formData.service_front_id,
          service_id: formData.service_id,
          target_quantity: parseFloat(formData.target_quantity),
          target_date: formData.target_date,
          employee_id: formData.employee_id || null,
          created_by_user_id: session?.user.id
        }]);

      if (error) throw error;

      toast.success("Planejado adicionado com sucesso!");
      setFormData({
        service_front_id: "",
        service_id: "",
        target_quantity: "",
        target_date: new Date().toISOString().split('T')[0],
        employee_id: ""
      });
      onSuccess();
      
    } catch (error: any) {
      toast.error("Erro ao adicionar planejado: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Planejado</DialogTitle>
          <DialogDescription>
            Defina uma meta de produção para uma frente de serviço
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="service_front">Frente de Serviço *</Label>
              <Select 
                value={formData.service_front_id} 
                onValueChange={(value) => setFormData({ ...formData, service_front_id: value })}
              >
                <SelectTrigger id="service_front">
                  <SelectValue placeholder="Selecione a frente" />
                </SelectTrigger>
                <SelectContent>
                  {serviceFronts.map(front => (
                    <SelectItem key={front.id} value={front.id}>
                      {front.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service">Serviço *</Label>
              <Select 
                value={formData.service_id} 
                onValueChange={(value) => setFormData({ ...formData, service_id: value })}
              >
                <SelectTrigger id="service">
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({service.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade Planejada *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={formData.target_quantity}
                onChange={(e) => setFormData({ ...formData, target_quantity: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee">Colaborador (opcional)</Label>
              <Select 
                value={formData.employee_id} 
                onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
              >
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} {emp.role ? `- ${emp.role}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};