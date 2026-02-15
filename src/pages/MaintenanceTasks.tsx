import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, ListTodo, ArrowLeft, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddTaskDialog } from "@/components/facility/AddTaskDialog";
import { TaskKanbanBoard } from "@/components/facility/TaskKanbanBoard";
import { TutorialDialog } from "@/components/shared/TutorialDialog";

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

const MaintenanceTasks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
    loadTasks();
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select(`
          *,
          assets_catalog (
            name
          ),
          employees (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar tarefas",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusCount = (status: string) => {
    return tasks.filter((t) => t.status === status).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ListTodo className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Painel de Tarefas</h1>
              <p className="text-muted-foreground">
                Gerencie manutenções preventivas e corretivas
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTutorial(true)}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Tutorial
            </Button>
            <Button onClick={() => {
              setSelectedTask(null);
              setShowAddDialog(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Tarefa
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Tarefas
              </CardTitle>
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {getStatusCount("pendente")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Processo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {getStatusCount("em_processo")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {getStatusCount("concluida")}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <TaskKanbanBoard
            tasks={tasks}
            onTaskUpdate={loadTasks}
            onTaskClick={(task) => {
              setSelectedTask(task);
              setShowAddDialog(true);
            }}
          />
        </div>
      </div>

      <AddTaskDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        task={selectedTask}
        defaultTaskType="preventiva"
        onSuccess={loadTasks}
      />

      <TutorialDialog
        open={showTutorial}
        onOpenChange={setShowTutorial}
        title="Tutorial: Tarefas de Manutenção"
        steps={[
          {
            title: "Criar Nova Tarefa",
            description: "Clique em 'Nova Tarefa' e escolha entre Manutenção Preventiva ou Corretiva. Preencha título, descrição, prioridade e prazo."
          },
          {
            title: "Atribuir Tarefas",
            description: "Você pode atribuir tarefas a funcionários específicos ou deixar sem atribuição. Selecione também o ativo relacionado se necessário."
          },
          {
            title: "Gerenciar Status",
            description: "As tarefas são organizadas em colunas: Pendente, Em Processo, Aguardando e Concluída. Arraste entre colunas ou clique para editar."
          },
          {
            title: "Filtrar por Tipo",
            description: "Cada tarefa mostra um badge indicando se é Preventiva ou Corretiva, facilitando a organização."
          }
        ]}
      />
    </div>
  );
};

export default MaintenanceTasks;
