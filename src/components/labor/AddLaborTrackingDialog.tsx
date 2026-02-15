import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface AddLaborTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddLaborTrackingDialog({ open, onOpenChange }: AddLaborTrackingDialogProps) {
  const [formData, setFormData] = useState({
    project_id: "",
    employee_id: "",
    worker_name: "",
    category: "",
    work_date: new Date().toISOString().split("T")[0],
    entry_time: "",
    exit_time: "",
    activity_description: "",
    hourly_rate: "",
    company_name: "",
  });

  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").order("name");
      return data;
    },
    enabled: !!session,
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("*").order("name");
      return data;
    },
    enabled: !!session,
  });

  const calculateHoursAndCost = () => {
    if (formData.entry_time && formData.exit_time && formData.hourly_rate) {
      const [entryHour, entryMinute] = formData.entry_time.split(":").map(Number);
      const [exitHour, exitMinute] = formData.exit_time.split(":").map(Number);

      const entryMinutes = entryHour * 60 + entryMinute;
      const exitMinutes = exitHour * 60 + exitMinute;
      const hoursWorked = (exitMinutes - entryMinutes) / 60;

      const hourlyRate = parseFloat(formData.hourly_rate);
      const totalCost = hoursWorked * hourlyRate;

      return { hours_worked: hoursWorked, total_cost: totalCost };
    }
    return { hours_worked: null, total_cost: null };
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { hours_worked, total_cost } = calculateHoursAndCost();

      const { error } = await supabase.from("labor_tracking").insert([
        {
          ...data,
          hours_worked,
          total_cost,
          created_by_user_id: session?.user.id,
        },
      ]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labor_tracking"] });
      toast.success("Apontamento registrado com sucesso!");
      onOpenChange(false);
      setFormData({
        project_id: "",
        employee_id: "",
        worker_name: "",
        category: "",
        work_date: new Date().toISOString().split("T")[0],
        entry_time: "",
        exit_time: "",
        activity_description: "",
        hourly_rate: "",
        company_name: "",
      });
    },
    onError: () => {
      toast.error("Erro ao registrar apontamento");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Apontamento de Mão de Obra</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project_id">Projeto *</Label>
              <Select
                value={formData.project_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, project_id: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="work_date">Data *</Label>
              <Input
                id="work_date"
                type="date"
                value={formData.work_date}
                onChange={(e) =>
                  setFormData({ ...formData, work_date: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="worker_name">Nome do Trabalhador *</Label>
              <Input
                id="worker_name"
                value={formData.worker_name}
                onChange={(e) =>
                  setFormData({ ...formData, worker_name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pedreiro">Pedreiro</SelectItem>
                  <SelectItem value="servente">Servente</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="eletricista">Eletricista</SelectItem>
                  <SelectItem value="encanador">Encanador</SelectItem>
                  <SelectItem value="pintor">Pintor</SelectItem>
                  <SelectItem value="carpinteiro">Carpinteiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="entry_time">Entrada *</Label>
              <Input
                id="entry_time"
                type="time"
                value={formData.entry_time}
                onChange={(e) =>
                  setFormData({ ...formData, entry_time: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exit_time">Saída</Label>
              <Input
                id="exit_time"
                type="time"
                value={formData.exit_time}
                onChange={(e) =>
                  setFormData({ ...formData, exit_time: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Custo/Hora (R$)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) =>
                  setFormData({ ...formData, hourly_rate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employee_id">Funcionário Cadastrado</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, employee_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Empresa</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) =>
                  setFormData({ ...formData, company_name: e.target.value })
                }
                placeholder="Nome da empresa"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity_description">Atividade Executada</Label>
            <Textarea
              id="activity_description"
              value={formData.activity_description}
              onChange={(e) =>
                setFormData({ ...formData, activity_description: e.target.value })
              }
              rows={3}
              placeholder="Descreva a atividade realizada..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Registrando..." : "Registrar Apontamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
