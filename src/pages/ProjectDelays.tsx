import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { toast } from "sonner";
import {
  Clock, AlertTriangle, CheckCircle, TrendingDown, Bell, Mail,
  ArrowLeft, Plus, Trash2, Calendar, BarChart3
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from "recharts";

interface ProjectDelay {
  id: string;
  projectName: string;
  plannedStart: string;
  plannedEnd: string;
  actualProgress: number;
  expectedProgress: number;
  delayDays: number;
  status: "on_track" | "warning" | "critical" | "completed";
  milestones: Milestone[];
}

interface Milestone {
  id: string;
  name: string;
  plannedDate: string;
  actualDate?: string;
  completed: boolean;
}

interface DelayAlert {
  id: string;
  projectId: string;
  projectName: string;
  message: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
  emailSent: boolean;
  dismissed: boolean;
}

const STORAGE_KEY = "construdata_project_delays";
const ALERTS_KEY = "construdata_delay_alerts";

const ProjectDelays = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectDelay[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [alerts, setAlerts] = useState<DelayAlert[]>(() => {
    const saved = localStorage.getItem(ALERTS_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [showForm, setShowForm] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [newProject, setNewProject] = useState({
    projectName: "",
    plannedStart: new Date().toISOString().split("T")[0],
    plannedEnd: "",
    actualProgress: 0,
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  }, [alerts]);

  const calculateExpectedProgress = (start: string, end: string): number => {
    const now = new Date();
    const s = new Date(start);
    const e = new Date(end);
    const total = e.getTime() - s.getTime();
    if (total <= 0) return 100;
    const elapsed = now.getTime() - s.getTime();
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const calculateDelayDays = (plannedEnd: string, actualProgress: number, expectedProgress: number): number => {
    if (actualProgress >= expectedProgress) return 0;
    const end = new Date(plannedEnd);
    const start = new Date();
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const progressGap = expectedProgress - actualProgress;
    return Math.max(0, Math.round((progressGap / 100) * totalDays));
  };

  const getStatus = (actual: number, expected: number): ProjectDelay["status"] => {
    if (actual >= 100) return "completed";
    const gap = expected - actual;
    if (gap <= 5) return "on_track";
    if (gap <= 15) return "warning";
    return "critical";
  };

  const handleAddProject = () => {
    if (!newProject.projectName || !newProject.plannedEnd) {
      toast.error("Preencha nome e data de término");
      return;
    }
    const expected = calculateExpectedProgress(newProject.plannedStart, newProject.plannedEnd);
    const delay = calculateDelayDays(newProject.plannedEnd, newProject.actualProgress, expected);
    const status = getStatus(newProject.actualProgress, expected);

    const project: ProjectDelay = {
      id: crypto.randomUUID(),
      projectName: newProject.projectName,
      plannedStart: newProject.plannedStart,
      plannedEnd: newProject.plannedEnd,
      actualProgress: newProject.actualProgress,
      expectedProgress: expected,
      delayDays: delay,
      status,
      milestones: [],
    };
    setProjects(prev => [...prev, project]);

    // Generate alert if delayed
    if (status === "warning" || status === "critical") {
      const alert: DelayAlert = {
        id: crypto.randomUUID(),
        projectId: project.id,
        projectName: project.projectName,
        message: `Projeto "${project.projectName}" está ${delay} dias atrasado (${newProject.actualProgress}% real vs ${expected}% esperado)`,
        severity: status === "critical" ? "critical" : "warning",
        createdAt: new Date().toISOString(),
        emailSent: false,
        dismissed: false,
      };
      setAlerts(prev => [...prev, alert]);
      toast.warning(`⚠️ Alerta: ${alert.message}`);
    }

    setNewProject({ projectName: "", plannedStart: new Date().toISOString().split("T")[0], plannedEnd: "", actualProgress: 0 });
    setShowForm(false);
    toast.success("Projeto adicionado ao acompanhamento de atrasos");
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setAlerts(prev => prev.filter(a => a.projectId !== id));
    toast.success("Projeto removido");
  };

  const handleUpdateProgress = (id: string, progress: number) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== id) return p;
      const expected = calculateExpectedProgress(p.plannedStart, p.plannedEnd);
      const delay = calculateDelayDays(p.plannedEnd, progress, expected);
      const status = getStatus(progress, expected);
      return { ...p, actualProgress: progress, expectedProgress: expected, delayDays: delay, status };
    }));
  };

  const handleDismissAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  };

  const handleSendEmailAlert = async (alert: DelayAlert) => {
    if (!alertEmail) {
      toast.error("Configure um email para alertas");
      return;
    }
    try {
      await supabase.functions.invoke("send-production-report", {
        body: { email: alertEmail, subject: `Alerta de Atraso: ${alert.projectName}`, body: alert.message },
      });
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, emailSent: true } : a));
      toast.success(`Email enviado para ${alertEmail}`);
    } catch {
      toast.error("Erro ao enviar email — verifique a configuração");
    }
  };

  const loadDemo = () => {
    const demoProjects: ProjectDelay[] = [
      {
        id: crypto.randomUUID(), projectName: "Itapetininga — Rede Água/Esgoto",
        plannedStart: "2025-03-01", plannedEnd: "2025-12-31", actualProgress: 35,
        expectedProgress: 70, delayDays: 45, status: "critical", milestones: [],
      },
      {
        id: crypto.randomUUID(), projectName: "Sorocaba — ETA Fase 2",
        plannedStart: "2025-06-01", plannedEnd: "2026-06-01", actualProgress: 55,
        expectedProgress: 60, delayDays: 8, status: "warning", milestones: [],
      },
      {
        id: crypto.randomUUID(), projectName: "Campinas — Drenagem Norte",
        plannedStart: "2025-01-15", plannedEnd: "2025-08-15", actualProgress: 88,
        expectedProgress: 85, delayDays: 0, status: "on_track", milestones: [],
      },
    ];
    setProjects(demoProjects);
    toast.success("Demo carregado com 3 projetos");
  };

  const activeAlerts = alerts.filter(a => !a.dismissed);
  const criticalCount = projects.filter(p => p.status === "critical").length;
  const warningCount = projects.filter(p => p.status === "warning").length;
  const onTrackCount = projects.filter(p => p.status === "on_track").length;

  const chartData = projects.map(p => ({
    name: p.projectName.length > 20 ? p.projectName.substring(0, 20) + "..." : p.projectName,
    "Progresso Real": p.actualProgress,
    "Progresso Esperado": p.expectedProgress,
    "Atraso (dias)": p.delayDays,
  }));

  const statusBadge = (status: ProjectDelay["status"]) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-600">Concluído</Badge>;
      case "on_track": return <Badge className="bg-blue-600">No Prazo</Badge>;
      case "warning": return <Badge className="bg-yellow-500 text-black">Atenção</Badge>;
      case "critical": return <Badge className="bg-red-600">Crítico</Badge>;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Clock className="h-8 w-8 text-orange-600" /> Atraso de Obra
                </h1>
                <p className="text-muted-foreground mt-1">Acompanhe atrasos, tome decisões e receba alertas</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={loadDemo}>Demo</Button>
                <Button onClick={() => setShowForm(!showForm)}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Projeto
                </Button>
              </div>
            </div>

            {/* Alert Banner */}
            {activeAlerts.length > 0 && (
              <Card className="border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/10">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-red-600" />
                      <span className="font-bold text-red-700 dark:text-red-400">{activeAlerts.length} Alerta(s) Ativo(s)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input placeholder="Email para alertas" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} className="w-60 h-8" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {activeAlerts.slice(0, 5).map(a => (
                      <div key={a.id} className="flex items-center justify-between bg-background/80 rounded px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${a.severity === "critical" ? "text-red-600" : "text-yellow-600"}`} />
                          <span>{a.message}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleSendEmailAlert(a)} disabled={a.emailSent}>
                            <Mail className="h-3 w-3 mr-1" /> {a.emailSent ? "Enviado" : "Email"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDismissAlert(a.id)}>Dispensar</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{projects.length}</div>
                <p className="text-xs text-muted-foreground">Total Projetos</p>
              </CardContent></Card>
              <Card className="border-l-4 border-l-red-500"><CardContent className="pt-4 text-center">
                <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </CardContent></Card>
              <Card className="border-l-4 border-l-yellow-500"><CardContent className="pt-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">{warningCount}</div>
                <p className="text-xs text-muted-foreground">Atenção</p>
              </CardContent></Card>
              <Card className="border-l-4 border-l-green-500"><CardContent className="pt-4 text-center">
                <div className="text-3xl font-bold text-green-600">{onTrackCount}</div>
                <p className="text-xs text-muted-foreground">No Prazo</p>
              </CardContent></Card>
            </div>

            {/* Add Form */}
            {showForm && (
              <Card>
                <CardHeader><CardTitle>Novo Projeto para Acompanhamento</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label>Nome do Projeto</Label><Input value={newProject.projectName} onChange={e => setNewProject(p => ({ ...p, projectName: e.target.value }))} /></div>
                    <div><Label>Progresso Atual (%)</Label><Input type="number" min={0} max={100} value={newProject.actualProgress} onChange={e => setNewProject(p => ({ ...p, actualProgress: Number(e.target.value) }))} /></div>
                    <div><Label>Início Previsto</Label><Input type="date" value={newProject.plannedStart} onChange={e => setNewProject(p => ({ ...p, plannedStart: e.target.value }))} /></div>
                    <div><Label>Término Previsto</Label><Input type="date" value={newProject.plannedEnd} onChange={e => setNewProject(p => ({ ...p, plannedEnd: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddProject}>Adicionar</Button>
                    <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chart */}
            {projects.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Progresso vs Esperado</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="Progresso Real" fill="#3b82f6" />
                      <Bar dataKey="Progresso Esperado" fill="#e2e8f0" />
                      <Bar dataKey="Atraso (dias)" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Projects Table */}
            {projects.length > 0 ? (
              <Card>
                <CardHeader><CardTitle>Projetos Monitorados</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Término</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Esperado</TableHead>
                      <TableHead>Atraso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {projects.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.projectName}</TableCell>
                          <TableCell className="text-xs">{new Date(p.plannedStart).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-xs">{new Date(p.plannedEnd).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={p.actualProgress} className="w-20 h-2" />
                              <Input type="number" min={0} max={100} value={p.actualProgress} className="w-16 h-7 text-xs"
                                onChange={e => handleUpdateProgress(p.id, Number(e.target.value))} />
                            </div>
                          </TableCell>
                          <TableCell>{p.expectedProgress}%</TableCell>
                          <TableCell className={p.delayDays > 0 ? "text-red-600 font-bold" : "text-green-600"}>
                            {p.delayDays > 0 ? `${p.delayDays} dias` : "—"}
                          </TableCell>
                          <TableCell>{statusBadge(p.status)}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteProject(p.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum projeto sendo monitorado</p>
                  <p className="text-sm text-muted-foreground">Adicione um projeto ou carregue o demo</p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default ProjectDelays;
