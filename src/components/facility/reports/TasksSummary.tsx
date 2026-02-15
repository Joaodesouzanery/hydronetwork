import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";

interface TasksSummaryProps {
  tasks: any[];
}

export function TasksSummary({ tasks }: TasksSummaryProps) {
  const stats = {
    completed: tasks.filter((t) => t.status === "concluída").length,
    inProgress: tasks.filter((t) => t.status === "em_processo").length,
    pending: tasks.filter((t) => t.status === "pendente").length,
    verification: tasks.filter((t) => t.status === "em_verificacao").length,
  };

  const preventiveTasks = tasks.filter((t) => t.task_type === "preventiva");
  const correctiveTasks = tasks.filter((t) => t.task_type === "corretiva");

  const pendingReasons = tasks
    .filter((t) => t.pending_reason)
    .reduce((acc: any, task) => {
      const reason = task.pending_reason;
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Ordens de Serviço</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Concluídas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-sm text-muted-foreground">Em Processo</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.verification}</p>
                <p className="text-sm text-muted-foreground">Em Verificação</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Preventivas</span>
                <Badge variant="outline">{preventiveTasks.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Corretivas</span>
                <Badge variant="outline">{correctiveTasks.length}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Motivos de Pendência</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(pendingReasons).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(pendingReasons).map(([reason, count]: [string, any]) => (
                  <div key={reason} className="flex justify-between items-center">
                    <span className="text-sm">{reason}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma pendência registrada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {preventiveTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Checklist de Preventivas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {preventiveTasks.map((task) => (
                <div key={task.id} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{task.title}</h4>
                    <Badge variant={task.status === "concluída" ? "default" : "secondary"}>
                      {task.status}
                    </Badge>
                  </div>
                  {task.task_checklist_items && task.task_checklist_items.length > 0 && (
                    <div className="space-y-1 ml-4">
                      {task.task_checklist_items.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <CheckCircle2
                            className={cn(
                              "h-4 w-4",
                              item.is_completed ? "text-green-500" : "text-gray-300"
                            )}
                          />
                          <span className={item.is_completed ? "line-through text-muted-foreground" : ""}>
                            {item.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
