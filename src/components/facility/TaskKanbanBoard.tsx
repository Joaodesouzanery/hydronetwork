import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Package, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Task {
  id: string;
  task_type: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  deadline?: string;
  asset_id?: string;
  assigned_to_employee_id?: string;
  created_at: string;
  assets_catalog?: {
    name: string;
  };
  employees?: {
    name: string;
  };
}

interface TaskKanbanBoardProps {
  tasks: Task[];
  onTaskUpdate: () => void;
  onTaskClick: (task: Task) => void;
}

const statusColumns = [
  { key: "pendente", label: "Pendente", color: "bg-slate-100" },
  { key: "em_processo", label: "Em Processo", color: "bg-blue-100" },
  { key: "em_verificacao", label: "Em Verificação", color: "bg-yellow-100" },
  { key: "concluida", label: "Concluída", color: "bg-green-100" },
];

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case "urgente":
      return "destructive";
    case "alta":
      return "default";
    case "média":
      return "secondary";
    default:
      return "outline";
  }
};

export const TaskKanbanBoard = ({
  tasks,
  onTaskUpdate,
  onTaskClick,
}: TaskKanbanBoardProps) => {
  const { toast } = useToast();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStatus: string) => {
    if (!draggedTask) return;

    try {
      const { error } = await supabase
        .from("maintenance_tasks")
        .update({ status: newStatus })
        .eq("id", draggedTask.id);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Tarefa movida para ${statusColumns.find((c) => c.key === newStatus)?.label}`,
      });

      onTaskUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar status",
        description: error.message,
      });
    } finally {
      setDraggedTask(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {statusColumns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.key);

        return (
          <div
            key={column.key}
            className="space-y-4"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.key)}
          >
            <div className={`${column.color} p-4 rounded-lg`}>
              <h3 className="font-semibold">
                {column.label} ({columnTasks.length})
              </h3>
            </div>

            <div className="space-y-3 min-h-[400px]">
              {columnTasks.map((task) => (
                <Card
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task)}
                  className="cursor-move hover:shadow-lg transition-shadow"
                  onClick={() => onTaskClick(task)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <CardTitle className="text-sm font-medium">
                        {task.title}
                      </CardTitle>
                      <Badge variant={task.task_type === "preventiva" ? "secondary" : "outline"} className="text-xs">
                        {task.task_type === "preventiva" ? "Preventiva" : "Corretiva"}
                      </Badge>
                    </div>
                    {task.priority && (
                      <Badge
                        variant={getPriorityColor(task.priority)}
                        className="w-fit"
                      >
                        {task.priority}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-2">
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    {task.assets_catalog && (
                      <div className="flex items-center gap-2 text-xs">
                        <Package className="h-3 w-3" />
                        <span className="text-muted-foreground">
                          {task.assets_catalog.name}
                        </span>
                      </div>
                    )}

                    {task.employees && (
                      <div className="flex items-center gap-2 text-xs">
                        <User className="h-3 w-3" />
                        <span className="text-muted-foreground">
                          {task.employees.name}
                        </span>
                      </div>
                    )}

                    {task.deadline && (
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="h-3 w-3" />
                        <span className="text-muted-foreground">
                          {format(new Date(task.deadline), "dd/MM/yyyy")}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {columnTasks.length === 0 && (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  Nenhuma tarefa
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
