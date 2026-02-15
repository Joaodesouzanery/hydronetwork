import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Users, Package, FileText, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface UserMetrics {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  total_projects: number;
  total_employees: number;
  total_materials: number;
  total_rdos: number;
  total_material_requests: number;
  last_activity: string | null;
}

const UserMetrics = () => {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, loading: roleLoading } = useUserRole();
  const [metrics, setMetrics] = useState<UserMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    totalUsers: 0,
    totalProjects: 0,
    totalEmployees: 0,
    totalMaterials: 0,
  });

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin) {
      toast.error("Acesso negado. Apenas super administradores podem acessar esta página.");
      navigate("/dashboard");
    }
  }, [isSuperAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadMetrics();
    }
  }, [isSuperAdmin]);

  const loadMetrics = async () => {
    try {
      setLoading(true);

      // Call edge function to get metrics (requires super admin)
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-metrics`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao carregar métricas');
      }

      const data = await response.json();
      
      console.log("Metrics loaded:", data);
      
      setMetrics(data.metrics);
      setTotals(data.totals);
    } catch (error) {
      console.error("Error loading metrics:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  if (roleLoading || !isSuperAdmin) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-xl font-semibold">Métricas de Usuários</h1>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.totalUsers}</div>
                <p className="text-xs text-muted-foreground">Usuários cadastrados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Projetos</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.totalProjects}</div>
                <p className="text-xs text-muted-foreground">Projetos criados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Funcionários</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.totalEmployees}</div>
                <p className="text-xs text-muted-foreground">Funcionários cadastrados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Materiais</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.totalMaterials}</div>
                <p className="text-xs text-muted-foreground">Materiais cadastrados</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metrics Table */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas Detalhadas por Usuário</CardTitle>
              <CardDescription>
                Visualize o uso de recursos de cada usuário do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Building2 className="h-4 w-4" />
                          Projetos
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4" />
                          Funcionários
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Package className="h-4 w-4" />
                          Materiais
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <FileText className="h-4 w-4" />
                          RDOs
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          Pedidos
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Última Atividade
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map((metric) => (
                      <TableRow key={metric.user_id}>
                        <TableCell className="font-medium">{metric.email}</TableCell>
                        <TableCell>
                          <Badge variant={metric.role === 'admin' ? 'default' : 'secondary'}>
                            {metric.role === 'admin' ? 'Administrador' : 'Usuário'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{metric.total_projects}</TableCell>
                        <TableCell className="text-center">{metric.total_employees}</TableCell>
                        <TableCell className="text-center">{metric.total_materials}</TableCell>
                        <TableCell className="text-center">{metric.total_rdos}</TableCell>
                        <TableCell className="text-center">{metric.total_material_requests}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(metric.last_activity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default UserMetrics;
