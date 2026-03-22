import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { calculateProjectDelays, summarizeDelays, getDelayStatusColor, type ProjectDelay } from "@/utils/projectDelays";
import { DELAY_THRESHOLDS, isValidEmail } from "@/config/defaults";
import { PullDataPanel } from "@/components/shared/PullDataPanel";
import {
  Clock, AlertTriangle, CheckCircle, XCircle, Building2,
  Bell, Mail, TrendingDown, BarChart3, Calendar, ArrowRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell
} from "recharts";

const ProjectDelays = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) { navigate("/auth"); return; }

      const { data } = await supabase
        .from("projects")
        .select("*")
        .in("status", ["active", "paused"])
        .order("created_at", { ascending: false });

      if (data) setProjects(data);
    } catch (err) {
      toast.error("Erro ao carregar projetos");
    } finally {
      setIsLoading(false);
    }
  };

  const delays: ProjectDelay[] = useMemo(() => calculateProjectDelays(projects), [projects]);

  const filtered = filter === "all" ? delays : delays.filter(d => d.status === filter);

  const summary = useMemo(() => summarizeDelays(delays), [delays]);

  const chartData = filtered.slice(0, 10).map(d => ({
    name: d.project.name.length > 20 ? d.project.name.substring(0, 20) + "…" : d.project.name,
    esperado: Math.round(d.expectedProgress),
    real: Math.round(d.actualProgress),
    atraso: Math.round(d.delayPercent),
  }));

  const getStatusBadge = (status: ProjectDelay["status"]) => {
    switch (status) {
      case "on_track": return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />No prazo</Badge>;
      case "warning": return <Badge className="bg-warning text-warning-foreground"><AlertTriangle className="h-3 w-3 mr-1" />Atenção</Badge>;
      case "critical": return <Badge className="bg-destructive text-destructive-foreground"><XCircle className="h-3 w-3 mr-1" />Crítico</Badge>;
      case "overdue": return <Badge className="bg-red-900 text-white"><Clock className="h-3 w-3 mr-1" />Vencido</Badge>;
    }
  };

  const getBarColor = getDelayStatusColor;

  const handleSaveAlertConfig = async () => {
    if (!alertEmail.trim()) { toast.error("Informe um e-mail"); return; }
    if (!isValidEmail(alertEmail)) { toast.error("E-mail inválido"); return; }
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) return;

    const { error } = await supabase.from("alertas_config").insert([{
      user_id: session.session.user.id,
      tipo_alerta: "atraso_cronograma",
      condicao: { threshold_percent: DELAY_THRESHOLDS.alertThresholdPercent },
      destinatarios: [alertEmail],
      ativo: emailAlerts,
    }]);

    if (error) { toast.error("Erro ao salvar configuração"); return; }
    toast.success("Alerta de atraso configurado!");
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 flex items-center justify-center">
            <Clock className="h-12 w-12 animate-pulse text-muted-foreground" />
          </main>
        </div>

      <PullDataPanel currentModule="obras" />
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold font-mono flex items-center gap-2">
                <Clock className="h-8 w-8 text-red-600" /> Atrasos de Projeto
              </h1>
              <p className="text-muted-foreground mt-1">Monitore desvios entre progresso esperado e real de cada obra</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Total", value: summary.total, color: "text-info", bg: "bg-info/10" },
                { label: "No Prazo", value: summary.onTrack, color: "text-success", bg: "bg-success/10" },
                { label: "Atenção", value: summary.warning, color: "text-warning", bg: "bg-warning/10" },
                { label: "Crítico", value: summary.critical, color: "text-destructive", bg: "bg-destructive/10" },
                { label: "Vencido", value: summary.overdue, color: "text-red-900", bg: "bg-red-100 dark:bg-red-950/50" },
              ].map(s => (
                <Card key={s.label} className={s.bg}>
                  <CardContent className="pt-4 pb-4 text-center">
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
              <Label>Filtrar:</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="on_track">No Prazo</SelectItem>
                  <SelectItem value="warning">Atenção</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Progresso vs Esperado</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <RechartsTooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="esperado" fill="#94a3b8" name="Esperado" barSize={12} />
                      <Bar dataKey="real" fill="#3b82f6" name="Real" barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento por Projeto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Projeto</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Término</TableHead>
                        <TableHead>Esperado</TableHead>
                        <TableHead>Real</TableHead>
                        <TableHead>Atraso</TableHead>
                        <TableHead>Dias</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(d => (
                        <TableRow key={d.project.id} className={d.status === "critical" || d.status === "overdue" ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                          <TableCell className="font-medium max-w-[200px] truncate">{d.project.name}</TableCell>
                          <TableCell className="text-sm">{new Date(d.project.start_date).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-sm">{d.project.end_date ? new Date(d.project.end_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={d.expectedProgress} className="w-16 h-2" />
                              <span className="text-xs">{Math.round(d.expectedProgress)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={d.actualProgress} className="w-16 h-2" />
                              <span className="text-xs">{Math.round(d.actualProgress)}%</span>
                            </div>
                          </TableCell>
                          <TableCell className={d.delayPercent > 10 ? "text-destructive font-bold" : ""}>{Math.round(d.delayPercent)}%</TableCell>
                          <TableCell className={d.delayDays > 30 ? "text-destructive font-bold" : ""}>{d.delayDays}d</TableCell>
                          <TableCell>{getStatusBadge(d.status)}</TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Nenhum projeto encontrado com este filtro.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Alert Config */}
            <Card className="border-l-4 border-l-warning">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-warning" /> Configurar Alertas de Atraso</CardTitle>
                <CardDescription>Receba notificações quando um projeto ultrapassar o limite de atraso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                  <Label>Ativar alertas por e-mail</Label>
                </div>
                {emailAlerts && (
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={alertEmail}
                      onChange={e => setAlertEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleSaveAlertConfig}>
                      <Mail className="h-4 w-4 mr-1" /> Salvar Alerta
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Alertas são disparados quando o desvio de progresso supera {DELAY_THRESHOLDS.alertThresholdPercent}%. Para configurações avançadas, acesse a página de Alertas.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default ProjectDelays;
