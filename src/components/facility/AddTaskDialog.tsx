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
import { Plus, Trash2 } from "lucide-react";

interface Task {
  id: string;
  task_type: string;
  title: string;
  description?: string;
  asset_id?: string;
  project_id?: string;
  assigned_to_employee_id?: string;
  status: string;
  priority?: string;
  classification?: string;
  service_type?: string;
  service_subtype?: string;
  deadline?: string;
}

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  defaultTaskType?: "preventiva" | "corretiva";
  onSuccess: () => void;
}

export const AddTaskDialog = ({
  open,
  onOpenChange,
  task,
  defaultTaskType = "preventiva",
  onSuccess,
}: AddTaskDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [checklistItems, setChecklistItems] = useState<string[]>([""]);
  const [formData, setFormData] = useState({
    task_type: defaultTaskType as string,
    title: "",
    description: "",
    asset_id: "",
    project_id: "",
    assigned_to_employee_id: "",
    status: "pendente",
    priority: "",
    classification: "",
    service_type: "",
    service_subtype: "",
    deadline: "",
  });

  useEffect(() => {
    if (open) {
      fetchData();
      if (task) {
        setFormData({
          task_type: (task.task_type || defaultTaskType) as string,
          title: task.title || "",
          description: task.description || "",
          asset_id: task.asset_id || "",
          project_id: task.project_id || "",
          assigned_to_employee_id: task.assigned_to_employee_id || "",
          status: task.status || "pendente",
          priority: task.priority || "",
          classification: task.classification || "",
          service_type: task.service_type || "",
          service_subtype: task.service_subtype || "",
          deadline: task.deadline || "",
        });
        loadChecklistItems(task.id);
      } else {
        resetForm();
      }
    }
  }, [open, task, defaultTaskType]);

  const fetchData = async () => {
    try {
      const [projectsRes, assetsRes, employeesRes] = await Promise.all([
        supabase.from("projects").select("id, name").eq("status", "active").order("name"),
        supabase.from("assets_catalog").select("id, name, type").order("name"),
        supabase.from("employees").select("id, name").eq("status", "active").order("name"),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (assetsRes.error) throw assetsRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setProjects(projectsRes.data || []);
      setAssets(assetsRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
    }
  };

  const loadChecklistItems = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from("task_checklist_items")
        .select("description")
        .eq("task_id", taskId)
        .order("created_at");

      if (error) throw error;
      
      if (data && data.length > 0) {
        setChecklistItems(data.map((item) => item.description));
      }
    } catch (error: any) {
      console.error("Error loading checklist:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      task_type: defaultTaskType,
      title: "",
      description: "",
      asset_id: "",
      project_id: "",
      assigned_to_employee_id: "",
      status: "pendente",
      priority: "",
      classification: "",
      service_type: "",
      service_subtype: "",
      deadline: "",
    });
    setChecklistItems([""]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.task_type) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha o título e o tipo da tarefa.",
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
        asset_id: formData.asset_id || null,
        assigned_to_employee_id: formData.assigned_to_employee_id || null,
      };

      let taskId: string;
      if (task) {
        const { error: updateError } = await supabase
          .from("maintenance_tasks")
          .update(dataToSave)
          .eq("id", task.id);
        
        if (updateError) throw updateError;
        taskId = task.id;

        // Delete existing checklist items
        await supabase
          .from("task_checklist_items")
          .delete()
          .eq("task_id", taskId);
      } else {
        const { data: newTask, error: insertError } = await supabase
          .from("maintenance_tasks")
          .insert([dataToSave])
          .select()
          .single();

        if (insertError) throw insertError;
        taskId = newTask.id;
      }

      // Save checklist items for preventiva tasks
      if (formData.task_type === "preventiva") {
        const validItems = checklistItems.filter((item) => item.trim() !== "");
        if (validItems.length > 0) {
          const checklistData = validItems.map((description) => ({
            task_id: taskId,
            description,
          }));

          const { error: checklistError } = await supabase
            .from("task_checklist_items")
            .insert(checklistData);

          if (checklistError) throw checklistError;
        }
      }

      toast({
        title: task ? "Tarefa atualizada" : "Tarefa criada",
        description: task
          ? "A tarefa foi atualizada com sucesso."
          : "A tarefa foi criada com sucesso.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar tarefa",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, ""]);
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, value: string) => {
    const newItems = [...checklistItems];
    newItems[index] = value;
    setChecklistItems(newItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {task ? "Editar Tarefa" : "Nova Tarefa"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="space-y-4 pr-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task_type">Tipo de Tarefa *</Label>
                <Select
                  value={formData.task_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, task_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva</SelectItem>
                    <SelectItem value="corretiva">Corretiva</SelectItem>
                    <SelectItem value="acompanhamento">Acompanhamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_processo">Em Processo</SelectItem>
                    <SelectItem value="em_verificacao">Em Verificação</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Título da tarefa"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descreva os detalhes da tarefa"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project">Projeto</Label>
                <Select
                  value={formData.project_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, project_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
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
                <Label htmlFor="asset">Ativo/Local</Label>
                <Select
                  value={formData.asset_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, asset_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name} ({asset.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assigned">Responsável</Label>
                <Select
                  value={formData.assigned_to_employee_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assigned_to_employee_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Prazo</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="média">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_type">Tipo de Serviço</Label>
                <Select
                  value={formData.service_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, service_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="civil">Civil</SelectItem>
                    <SelectItem value="elétrica">Elétrica</SelectItem>
                    <SelectItem value="hidráulica">Hidráulica</SelectItem>
                    <SelectItem value="mecânica">Mecânica</SelectItem>
                    <SelectItem value="pintura">Pintura</SelectItem>
                    <SelectItem value="limpeza">Limpeza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.task_type === "preventiva" && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Checklist de Subtarefas</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addChecklistItem}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Item
                  </Button>
                </div>
                <div className="space-y-2">
                  {checklistItems.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={item}
                        onChange={(e) =>
                          updateChecklistItem(index, e.target.value)
                        }
                        placeholder={`Item ${index + 1}`}
                      />
                      {checklistItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeChecklistItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : task ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
