import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Package,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function OperationalDashboard() {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["dashboard-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      return data;
    },
    enabled: !!session,
  });

  const { data: occurrences } = useQuery({
    queryKey: ["dashboard-occurrences"],
    queryFn: async () => {
      const { data } = await supabase
        .from("occurrences")
        .select("*")
        .eq("status", "aberta");
      return data;
    },
    enabled: !!session,
  });

  const { data: tasks } = useQuery({
    queryKey: ["dashboard-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_tasks")
        .select("*, employees(name)")
        .neq("status", "concluida");
      return data;
    },
    enabled: !!session,
  });

  const { data: purchaseRequests } = useQuery({
    queryKey: ["dashboard-purchases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_requests")
        .select("*")
        .eq("status", "pendente");
      return data;
    },
    enabled: !!session,
  });

  const activeProjects = projects?.filter((p) => p.status === "active") || [];
  const openOccurrences = occurrences?.length || 0;
  const pendingTasks = tasks?.length || 0;
  const pendingPurchases = purchaseRequests?.length || 0;

  // Agrupar tarefas por responsável
  const tasksByResponsible = tasks?.reduce((acc: any, task) => {
    const responsible = task.employees?.name || "Sem responsável";
    if (!acc[responsible]) {
      acc[responsible] = 0;
    }
    acc[responsible]++;
    return acc;
  }, {});

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Dashboard Operacional</h1>
            <p className="text-muted-foreground">
              Visão consolidada do status das obras
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Projetos Ativos
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeProjects.length}</div>
                <p className="text-xs text-muted-foreground">
                  {projects?.length || 0} projetos no total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Ocorrências Abertas
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{openOccurrences}</div>
                <p className="text-xs text-muted-foreground">
                  Requerem atenção imediata
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tarefas Pendentes
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingTasks}</div>
                <p className="text-xs text-muted-foreground">
                  Em execução ou aguardando
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Compras Pendentes
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingPurchases}</div>
                <p className="text-xs text-muted-foreground">
                  Aguardando aprovação
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Projetos em Andamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeProjects.slice(0, 5).map((project) => (
                    <div key={project.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{project.name}</span>
                        <Badge variant="secondary">
                          {project.status || "active"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Avanço estimado</span>
                          <span>65%</span>
                        </div>
                        <Progress value={65} />
                      </div>
                    </div>
                  ))}

                  {activeProjects.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum projeto ativo
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tarefas por Responsável</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(tasksByResponsible || {}).map(
                    ([responsible, count]: [string, any]) => (
                      <div
                        key={responsible}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm">{responsible}</span>
                        <Badge variant="outline">{count} tarefas</Badge>
                      </div>
                    )
                  )}

                  {!tasksByResponsible ||
                    (Object.keys(tasksByResponsible).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma tarefa pendente
                      </p>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Alertas Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {openOccurrences > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <div>
                        <p className="font-medium">
                          {openOccurrences} ocorrências abertas
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Requerem análise e correção
                        </p>
                      </div>
                    </div>
                  )}
                  {pendingPurchases > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Clock className="h-4 w-4 text-orange-500 mt-0.5" />
                      <div>
                        <p className="font-medium">
                          {pendingPurchases} compras pendentes
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Aguardando aprovação
                        </p>
                      </div>
                    </div>
                  )}
                  {pendingTasks > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5" />
                      <div>
                        <p className="font-medium">
                          {pendingTasks} tarefas em andamento
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Acompanhe o progresso
                        </p>
                      </div>
                    </div>
                  )}

                  {openOccurrences === 0 &&
                    pendingPurchases === 0 &&
                    pendingTasks === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum alerta no momento
                      </p>
                    )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumo Financeiro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Orçamento Total</span>
                    <span className="text-sm font-medium">R$ 0,00</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Custo Realizado</span>
                    <span className="text-sm font-medium">R$ 0,00</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Diferença</span>
                    <span className="text-sm font-medium text-green-600">
                      R$ 0,00 (0%)
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Dados financeiros serão calculados automaticamente com base
                      nos registros de materiais e mão de obra
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
