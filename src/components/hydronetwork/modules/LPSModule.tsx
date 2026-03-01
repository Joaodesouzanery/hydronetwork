/**
 * LPS Module — Last Planner System
 * Abas: Dashboard, Lookahead, Semanal, PPC, Restrições, Lean, Analytics
 */
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  BarChart3, Target, Calendar, ShieldAlert, TrendingUp, TrendingDown, Minus,
  Plus, Trash2, Check, X, AlertTriangle, Save, Eye, ChevronRight, ChevronDown, Info, Circle, Tag,
  Shield, LineChart as LineChartIcon,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell, PieChart, Pie, LineChart, Line,
} from "recharts";
import {
  LPSData, LPSConstraint, LookaheadTask, WeeklyCommitment, WeeklyTask, PPCRecord,
  ConstraintCategory, ConstraintStatus, NonCompletionCause, TaskStatus, TagMetric,
  CONSTRAINT_LABELS, CAUSE_LABELS,
  createLPSData, createLookaheadTask, createConstraint, createWeeklyCommitment, createWeeklyTask,
  calculatePPC, calculateLPSMetrics, LPSMetrics,
  saveLPSData, loadLPSData,
  getLookaheadWeeks, getWeekId, getWeekMonday,
} from "@/engine/lps";
import { Trecho } from "@/engine/domain";
import { PontoTopografico } from "@/engine/reader";

const LeanConstraintsContent = lazy(() =>
  import("@/components/lean-constraints/LeanConstraintsContent").then(m => ({ default: m.LeanConstraintsContent }))
);
const LeanDashboardContent = lazy(() =>
  import("@/components/lean-constraints/LeanDashboardContent").then(m => ({ default: m.LeanDashboardContent }))
);

const LazyFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
  </div>
);

interface LPSModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
}

const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6"];

export function LPSModule({ pontos, trechos }: LPSModuleProps) {
  const [data, setData] = useState<LPSData>(() => loadLPSData() || createLPSData("HydroNetwork"));
  const [activeTab, setActiveTab] = useState("dashboard");

  const metrics = useMemo(() => calculateLPSMetrics(data), [data]);

  const save = (updated: LPSData) => {
    setData(updated);
    saveLPSData(updated);
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="dashboard" className="text-xs gap-1"><BarChart3 className="h-3 w-3" /> Dashboard</TabsTrigger>
          <TabsTrigger value="lookahead" className="text-xs gap-1"><Eye className="h-3 w-3" /> Lookahead</TabsTrigger>
          <TabsTrigger value="semanal" className="text-xs gap-1"><Calendar className="h-3 w-3" /> Semanal</TabsTrigger>
          <TabsTrigger value="ppc" className="text-xs gap-1"><Target className="h-3 w-3" /> PPC</TabsTrigger>
          <TabsTrigger value="restricoes" className="text-xs gap-1"><ShieldAlert className="h-3 w-3" /> Restrições</TabsTrigger>
          <TabsTrigger value="lean" className="text-xs gap-1"><Shield className="h-3 w-3" /> Lean</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1"><LineChartIcon className="h-3 w-3" /> Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab metrics={metrics} data={data} />
        </TabsContent>
        <TabsContent value="lookahead">
          <LookaheadTab data={data} trechos={trechos} onSave={save} />
        </TabsContent>
        <TabsContent value="semanal">
          <WeeklyTab data={data} trechos={trechos} onSave={save} />
        </TabsContent>
        <TabsContent value="ppc">
          <PPCTab data={data} onSave={save} />
        </TabsContent>
        <TabsContent value="restricoes">
          <ConstraintsTab data={data} onSave={save} metrics={metrics} />
        </TabsContent>
        <TabsContent value="lean">
          <Suspense fallback={<LazyFallback />}>
            <LeanConstraintsContent />
          </Suspense>
        </TabsContent>
        <TabsContent value="analytics">
          <Suspense fallback={<LazyFallback />}>
            <LeanDashboardContent />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════ DASHBOARD TAB ═══════════════════════ */

function DashboardTab({ metrics, data }: { metrics: LPSMetrics; data: LPSData }) {
  const trendIcon = metrics.ppcTrend === "up"
    ? <TrendingUp className="h-4 w-4 text-green-500" />
    : metrics.ppcTrend === "down"
    ? <TrendingDown className="h-4 w-4 text-red-500" />
    : <Minus className="h-4 w-4 text-gray-400" />;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{metrics.currentPPC}%</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
              PPC Atual {trendIcon}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{metrics.avgPPC}%</div>
            <div className="text-xs text-muted-foreground mt-1">PPC Médio</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{metrics.openConstraints}</div>
            <div className="text-xs text-muted-foreground mt-1">Restrições Abertas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{data.lookaheadTasks.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Tarefas Lookahead</div>
          </CardContent>
        </Card>
      </div>

      {/* PPC Chart */}
      {metrics.weeklyPPCData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução PPC Semanal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics.weeklyPPCData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="weekId" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <RechartsTooltip />
                <ReferenceLine y={data.config.targetPPC} stroke="#ef4444" strokeDasharray="5 5" label={{ value: `Meta ${data.config.targetPPC}%`, fill: "#ef4444", fontSize: 10 }} />
                <Line type="monotone" dataKey="ppc" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="PPC (%)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Causes Pareto */}
        {metrics.topCauses.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Pareto - Causas de Não-Conclusão</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={metrics.topCauses} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 9 }} width={140} />
                  <RechartsTooltip />
                  <Bar dataKey="count" name="Ocorrências">
                    {metrics.topCauses.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Constraints by Category */}
        {metrics.constraintsByCategory.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Restrições por Categoria</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={metrics.constraintsByCategory}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ label, count }) => `${label}: ${count}`}
                    labelLine={false}
                  >
                    {metrics.constraintsByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty state */}
      {data.ppcRecords.length === 0 && data.lookaheadTasks.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Info className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">Nenhum dado LPS ainda</h3>
            <p className="text-sm text-muted-foreground">
              Comece adicionando tarefas no <strong>Lookahead</strong>, crie compromissos na aba <strong>Semanal</strong>
              e acompanhe o <strong>PPC</strong> ao longo das semanas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════ LOOKAHEAD TAB ═══════════════════════ */

function LookaheadTab({ data, trechos, onSave }: { data: LPSData; trechos: Trecho[]; onSave: (d: LPSData) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ trechoKey: "", descricao: "", frenteServico: "Frente 1", equipe: "Equipe 1", semana: 1, metros: 0, prioridade: "media" as "alta" | "media" | "baixa" });

  const weeks = getLookaheadWeeks(new Date(), data.config.lookaheadWeeks);

  const addTask = () => {
    if (!newTask.descricao.trim()) { toast.error("Descrição obrigatória"); return; }
    const task = createLookaheadTask({
      trechoKey: newTask.trechoKey || "geral",
      descricao: newTask.descricao,
      frenteServico: newTask.frenteServico,
      equipe: newTask.equipe,
      semana: newTask.semana,
      metrosPlanejados: newTask.metros,
      prioridade: newTask.prioridade,
    });
    const updated = { ...data, lookaheadTasks: [...data.lookaheadTasks, task] };
    onSave(updated);
    setShowAdd(false);
    setNewTask({ trechoKey: "", descricao: "", frenteServico: "Frente 1", equipe: "Equipe 1", semana: 1, metros: 0, prioridade: "media" });
    toast.success("Tarefa adicionada ao Lookahead");
  };

  const removeTask = (id: string) => {
    const updated = { ...data, lookaheadTasks: data.lookaheadTasks.filter(t => t.id !== id) };
    onSave(updated);
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    const updated = {
      ...data,
      lookaheadTasks: data.lookaheadTasks.map(t => t.id === id ? { ...t, status } : t),
    };
    onSave(updated);
  };

  const statusColors: Record<TaskStatus, string> = {
    livre: "bg-green-100 text-green-700",
    restrita: "bg-red-100 text-red-700",
    em_andamento: "bg-blue-100 text-blue-700",
    concluida: "bg-gray-100 text-gray-500",
    nao_concluida: "bg-orange-100 text-orange-700",
  };

  const statusLabels: Record<TaskStatus, string> = {
    livre: "Livre", restrita: "Restrita", em_andamento: "Em Andamento", concluida: "Concluída", nao_concluida: "Não Concluída",
  };

  const prioridadeColors: Record<string, string> = {
    alta: "bg-red-500", media: "bg-yellow-500", baixa: "bg-green-500",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" /> Lookahead — Médio Prazo ({data.config.lookaheadWeeks} semanas)</CardTitle>
              <CardDescription>Planejamento das próximas {data.config.lookaheadWeeks} semanas com identificação de restrições</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-3 w-3 mr-1" /> Adicionar Tarefa</Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Week headers */}
          <div className="grid gap-4">
            {weeks.map((week, wi) => {
              const weekTasks = data.lookaheadTasks.filter(t => t.semana === wi + 1);
              return (
                <div key={week.weekId} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{week.label}</h4>
                    <Badge variant="outline" className="text-xs">{weekTasks.length} tarefas</Badge>
                  </div>
                  {weekTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma tarefa planejada</p>
                  ) : (
                    <div className="space-y-1">
                      {weekTasks.map(task => (
                        <div key={task.id} className="flex items-center justify-between bg-muted/40 rounded p-2 text-xs">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`w-2 h-2 rounded-full ${prioridadeColors[task.prioridade]}`} title={`Prioridade: ${task.prioridade}`} />
                            <span className="font-medium truncate">{task.descricao}</span>
                            <Badge variant="outline" className="text-[10px]">{task.frenteServico}</Badge>
                            <Badge variant="outline" className="text-[10px]">{task.equipe}</Badge>
                            {task.metrosPlanejados > 0 && <span className="text-muted-foreground">{task.metrosPlanejados}m</span>}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Select value={task.status} onValueChange={(v) => updateTaskStatus(task.id, v as TaskStatus)}>
                              <SelectTrigger className={`h-6 text-[10px] w-28 ${statusColors[task.status]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(statusLabels) as TaskStatus[]).map(s => (
                                  <SelectItem key={s} value={s} className="text-xs">{statusLabels[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTask(task.id)}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Task Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Tarefa — Lookahead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Descrição *</Label>
              <Input value={newTask.descricao} onChange={e => setNewTask({ ...newTask, descricao: e.target.value })} placeholder="Ex: Assentamento PVC DN200 — Rua A" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Trecho (chave)</Label>
                <Select value={newTask.trechoKey} onValueChange={v => setNewTask({ ...newTask, trechoKey: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar trecho" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral</SelectItem>
                    {trechos.slice(0, 50).map((t, i) => (
                      <SelectItem key={i} value={`${t.idInicio}-${t.idFim}`} className="text-xs">
                        {t.nomeTrecho || `${t.idInicio} - ${t.idFim}`} ({t.comprimento.toFixed(1)}m){t.frenteServico ? ` [${t.frenteServico}]` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Semana</Label>
                <Select value={String(newTask.semana)} onValueChange={v => setNewTask({ ...newTask, semana: Number(v) })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => (
                      <SelectItem key={i} value={String(i + 1)} className="text-xs">Semana {i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Frente de Serviço</Label>
                <Input className="h-8 text-xs" value={newTask.frenteServico} onChange={e => setNewTask({ ...newTask, frenteServico: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Equipe</Label>
                <Input className="h-8 text-xs" value={newTask.equipe} onChange={e => setNewTask({ ...newTask, equipe: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Metros Plan.</Label>
                <Input type="number" className="h-8 text-xs" value={newTask.metros} onChange={e => setNewTask({ ...newTask, metros: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={newTask.prioridade} onValueChange={v => setNewTask({ ...newTask, prioridade: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta" className="text-xs">Alta</SelectItem>
                  <SelectItem value="media" className="text-xs">Média</SelectItem>
                  <SelectItem value="baixa" className="text-xs">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button size="sm" onClick={addTask}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════ WEEKLY TAB ═══════════════════════ */

function WeeklyTab({ data, trechos, onSave }: { data: LPSData; trechos: Trecho[]; onSave: (d: LPSData) => void }) {
  const currentWeekId = getWeekId(new Date());
  const [selectedWeek, setSelectedWeek] = useState(currentWeekId);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ descricao: "", trechoKey: "geral", frenteServico: "Frente 1", equipe: "Equipe 1", metros: 0 });

  const commitment = data.weeklyCommitments.find(c => c.weekId === selectedWeek);

  const createWeek = () => {
    if (commitment) return;
    const wc = createWeeklyCommitment(new Date(), data.config.workDays);
    // Pull libre tasks from lookahead week 1
    const week1Tasks = data.lookaheadTasks.filter(t => t.semana === 1 && (t.status === "livre" || t.status === "em_andamento"));
    wc.tasks = week1Tasks.map(lt => createWeeklyTask({
      lookaheadTaskId: lt.id,
      trechoKey: lt.trechoKey,
      descricao: lt.descricao,
      frenteServico: lt.frenteServico,
      equipe: lt.equipe,
      metrosComprometidos: lt.metrosPlanejados,
    }));
    const updated = { ...data, weeklyCommitments: [...data.weeklyCommitments, wc] };
    onSave(updated);
    toast.success(`Compromisso semanal criado com ${wc.tasks.length} tarefas`);
  };

  const addManualTask = () => {
    if (!commitment) return;
    if (!newTask.descricao.trim()) { toast.error("Descrição obrigatória"); return; }
    const wt = createWeeklyTask({
      trechoKey: newTask.trechoKey,
      descricao: newTask.descricao,
      frenteServico: newTask.frenteServico,
      equipe: newTask.equipe,
      metrosComprometidos: newTask.metros,
    });
    const updatedCommitment = { ...commitment, tasks: [...commitment.tasks, wt], updatedAt: new Date().toISOString() };
    const updated = { ...data, weeklyCommitments: data.weeklyCommitments.map(c => c.weekId === selectedWeek ? updatedCommitment : c) };
    onSave(updated);
    setShowAddTask(false);
    setNewTask({ descricao: "", trechoKey: "geral", frenteServico: "Frente 1", equipe: "Equipe 1", metros: 0 });
    toast.success("Tarefa adicionada ao plano semanal");
  };

  const toggleTaskComplete = (taskId: string) => {
    if (!commitment) return;
    const updatedTasks = commitment.tasks.map(t =>
      t.id === taskId ? { ...t, concluida: !t.concluida, metrosRealizados: !t.concluida ? t.metrosComprometidos : 0 } : t
    );
    const updatedCommitment = { ...commitment, tasks: updatedTasks, updatedAt: new Date().toISOString() };
    const updated = { ...data, weeklyCommitments: data.weeklyCommitments.map(c => c.weekId === selectedWeek ? updatedCommitment : c) };
    onSave(updated);
  };

  const updateTaskMetros = (taskId: string, metros: number) => {
    if (!commitment) return;
    const updatedTasks = commitment.tasks.map(t => t.id === taskId ? { ...t, metrosRealizados: metros } : t);
    const updatedCommitment = { ...commitment, tasks: updatedTasks, updatedAt: new Date().toISOString() };
    const updated = { ...data, weeklyCommitments: data.weeklyCommitments.map(c => c.weekId === selectedWeek ? updatedCommitment : c) };
    onSave(updated);
  };

  const updateTaskCause = (taskId: string, cause: NonCompletionCause | "") => {
    if (!commitment) return;
    const updatedTasks = commitment.tasks.map(t =>
      t.id === taskId ? { ...t, causaNaoConclusao: cause || undefined } : t
    );
    const updatedCommitment = { ...commitment, tasks: updatedTasks, updatedAt: new Date().toISOString() };
    const updated = { ...data, weeklyCommitments: data.weeklyCommitments.map(c => c.weekId === selectedWeek ? updatedCommitment : c) };
    onSave(updated);
  };

  const removeTask = (taskId: string) => {
    if (!commitment) return;
    const updatedCommitment = { ...commitment, tasks: commitment.tasks.filter(t => t.id !== taskId), updatedAt: new Date().toISOString() };
    const updated = { ...data, weeklyCommitments: data.weeklyCommitments.map(c => c.weekId === selectedWeek ? updatedCommitment : c) };
    onSave(updated);
  };

  const completedCount = commitment?.tasks.filter(t => t.concluida).length || 0;
  const totalCount = commitment?.tasks.length || 0;
  const weekPPC = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Available weeks to select from
  const availableWeeks = data.weeklyCommitments.map(c => c.weekId);
  if (!availableWeeks.includes(currentWeekId)) availableWeeks.push(currentWeekId);
  availableWeeks.sort();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Planejamento Semanal</CardTitle>
              <CardDescription>Compromissos e acompanhamento da semana</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableWeeks.map(w => (
                    <SelectItem key={w} value={w} className="text-xs">
                      {w} {w === currentWeekId ? "(atual)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!commitment && (
                <Button size="sm" onClick={createWeek}><Plus className="h-3 w-3 mr-1" /> Criar Semana</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!commitment ? (
            <div className="text-center py-8">
              <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum compromisso para {selectedWeek}.</p>
              <p className="text-xs text-muted-foreground mt-1">Clique em "Criar Semana" para puxar as tarefas livres do Lookahead.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Week summary */}
              <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">PPC da Semana: {weekPPC}%</span>
                    <span className="text-xs text-muted-foreground">{completedCount}/{totalCount} concluídas</span>
                  </div>
                  <Progress value={weekPPC} className="h-2" />
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowAddTask(true)}><Plus className="h-3 w-3 mr-1" /> Tarefa</Button>
              </div>

              {/* Task table */}
              {commitment.tasks.length > 0 ? (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Frente</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead className="text-right">Comprom.</TableHead>
                        <TableHead className="text-right">Realiz.</TableHead>
                        <TableHead>Causa</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commitment.tasks.map(task => (
                        <TableRow key={task.id} className={task.concluida ? "bg-green-50/50" : ""}>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleTaskComplete(task.id)}>
                              {task.concluida ? <Check className="h-3 w-3 text-green-600" /> : <X className="h-3 w-3 text-gray-400" />}
                            </Button>
                          </TableCell>
                          <TableCell className={`text-xs font-medium ${task.concluida ? "line-through text-muted-foreground" : ""}`}>
                            {task.descricao}
                          </TableCell>
                          <TableCell className="text-xs">{task.frenteServico}</TableCell>
                          <TableCell className="text-xs">{task.equipe}</TableCell>
                          <TableCell className="text-right text-xs">{task.metrosComprometidos}m</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number" className="h-6 w-16 text-xs text-right" value={task.metrosRealizados}
                              onChange={e => updateTaskMetros(task.id, Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            {!task.concluida && (
                              <Select value={task.causaNaoConclusao || ""} onValueChange={v => updateTaskCause(task.id, v as NonCompletionCause | "")}>
                                <SelectTrigger className="h-6 text-[10px] w-32"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="" className="text-xs">—</SelectItem>
                                  {(Object.keys(CAUSE_LABELS) as NonCompletionCause[]).map(c => (
                                    <SelectItem key={c} value={c} className="text-xs">{CAUSE_LABELS[c]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTask(task.id)}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa nesta semana. Adicione manualmente ou crie a semana a partir do Lookahead.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add manual task dialog */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Tarefa Semanal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Descrição *</Label>
              <Input value={newTask.descricao} onChange={e => setNewTask({ ...newTask, descricao: e.target.value })} placeholder="Descrição da tarefa" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Frente</Label>
                <Input className="h-8 text-xs" value={newTask.frenteServico} onChange={e => setNewTask({ ...newTask, frenteServico: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Equipe</Label>
                <Input className="h-8 text-xs" value={newTask.equipe} onChange={e => setNewTask({ ...newTask, equipe: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Metros</Label>
                <Input type="number" className="h-8 text-xs" value={newTask.metros} onChange={e => setNewTask({ ...newTask, metros: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddTask(false)}>Cancelar</Button>
            <Button size="sm" onClick={addManualTask}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════ PPC TAB ═══════════════════════ */

function PPCTab({ data, onSave }: { data: LPSData; onSave: (d: LPSData) => void }) {
  const calculateCurrentWeekPPC = () => {
    const currentWeekId = getWeekId(new Date());
    const commitment = data.weeklyCommitments.find(c => c.weekId === currentWeekId);
    if (!commitment || commitment.tasks.length === 0) {
      toast.error("Nenhuma tarefa na semana atual para calcular PPC");
      return;
    }
    // Check if already calculated
    if (data.ppcRecords.find(r => r.weekId === currentWeekId)) {
      toast.error("PPC da semana atual já foi calculado. Exclua o registro anterior para recalcular.");
      return;
    }
    const record = calculatePPC(commitment);
    const updated = { ...data, ppcRecords: [...data.ppcRecords, record] };
    onSave(updated);
    toast.success(`PPC da semana ${currentWeekId}: ${record.ppc}%`);
  };

  const deleteRecord = (id: string) => {
    const updated = { ...data, ppcRecords: data.ppcRecords.filter(r => r.id !== id) };
    onSave(updated);
    toast.success("Registro PPC excluído");
  };

  const updateTargetPPC = (value: number) => {
    const updated = { ...data, config: { ...data.config, targetPPC: value } };
    onSave(updated);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" /> PPC — Percentual de Planos Concluídos</CardTitle>
              <CardDescription>Acompanhe a eficácia do planejamento semanal</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Label className="text-xs">Meta:</Label>
                <Input type="number" className="h-7 w-16 text-xs" value={data.config.targetPPC}
                  onChange={e => updateTargetPPC(Number(e.target.value))} min={0} max={100} />
                <span className="text-xs">%</span>
              </div>
              <Button size="sm" onClick={calculateCurrentWeekPPC}>
                <BarChart3 className="h-3 w-3 mr-1" /> Calcular PPC Semana Atual
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.ppcRecords.length > 0 ? (
            <div className="space-y-4">
              {/* PPC Chart */}
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.ppcRecords}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekId" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <RechartsTooltip formatter={(v: number) => [`${v}%`, "PPC"]} />
                  <Legend />
                  <ReferenceLine y={data.config.targetPPC} stroke="#ef4444" strokeDasharray="5 5" label={{ value: `Meta ${data.config.targetPPC}%`, fill: "#ef4444", fontSize: 10 }} />
                  <Bar dataKey="ppc" name="PPC (%)" fill="#3b82f6">
                    {data.ppcRecords.map((r, i) => (
                      <Cell key={i} fill={r.ppc >= data.config.targetPPC ? "#10b981" : r.ppc >= 60 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* PPC Records table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semana</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-center">Comprometidas</TableHead>
                    <TableHead className="text-center">Concluídas</TableHead>
                    <TableHead className="text-center">PPC</TableHead>
                    <TableHead>Principal Causa</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.ppcRecords].reverse().map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium text-xs">{record.weekId}</TableCell>
                      <TableCell className="text-xs">{new Date(record.weekStart).toLocaleDateString("pt-BR")} — {new Date(record.weekEnd).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-center text-xs">{record.totalCommitments}</TableCell>
                      <TableCell className="text-center text-xs">{record.completedCommitments}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={record.ppc >= data.config.targetPPC ? "bg-green-600" : record.ppc >= 60 ? "bg-yellow-600" : "bg-red-600"}>
                          {record.ppc}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.causes.length > 0 ? CAUSE_LABELS[record.causes[0].cause] : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRecord(record.id)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum registro PPC ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">Crie compromissos na aba "Semanal" e calcule o PPC ao final de cada semana.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════ CONSTRAINTS TAB ═══════════════════════ */

const TAG_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4", "#84cc16", "#e11d48", "#0ea5e9", "#a855f7"];
function getTagColor(tag: string, allTags: string[]): string {
  const idx = allTags.indexOf(tag);
  return TAG_COLORS[idx >= 0 ? idx % TAG_COLORS.length : 0];
}

function ConstraintsTab({ data, onSave, metrics }: { data: LPSData; onSave: (d: LPSData) => void; metrics: LPSMetrics }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"all" | ConstraintStatus>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const defaultForm = {
    taskId: "", category: "projeto" as ConstraintCategory,
    description: "", responsavel: "", prazo: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    notes: "", tema: "", impacto: "", acoes: [] as string[], tags: [] as string[],
  };
  const [newConstraint, setNewConstraint] = useState(defaultForm);
  const [newAcao, setNewAcao] = useState("");
  const [newTag, setNewTag] = useState("");

  // Filter constraints by status and tag
  const filtered = data.constraints.filter(c => {
    if (filter !== "all" && c.status !== filter) return false;
    if (tagFilter !== "all" && !(c.tags || []).includes(tagFilter)) return false;
    return true;
  });

  const addConstraint = () => {
    if (!newConstraint.description.trim()) { toast.error("Descrição obrigatória"); return; }
    const constraint = createConstraint({
      taskId: newConstraint.taskId || "geral",
      category: newConstraint.category,
      description: newConstraint.description,
      responsavel: newConstraint.responsavel,
      prazoRemocao: newConstraint.prazo,
      notes: newConstraint.notes || undefined,
      tema: newConstraint.tema,
      impacto: newConstraint.impacto,
      acoes: newConstraint.acoes,
      tags: newConstraint.tags,
    });
    const updated = { ...data, constraints: [...data.constraints, constraint] };
    onSave(updated);
    setShowAdd(false);
    setNewConstraint(defaultForm);
    setNewAcao("");
    setNewTag("");
    toast.success("Restrição registrada");
  };

  const addAcao = () => {
    if (!newAcao.trim()) return;
    setNewConstraint({ ...newConstraint, acoes: [...newConstraint.acoes, newAcao.trim()] });
    setNewAcao("");
  };

  const removeAcao = (idx: number) => {
    setNewConstraint({ ...newConstraint, acoes: newConstraint.acoes.filter((_, i) => i !== idx) });
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag || newConstraint.tags.includes(tag)) return;
    setNewConstraint({ ...newConstraint, tags: [...newConstraint.tags, tag] });
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    setNewConstraint({ ...newConstraint, tags: newConstraint.tags.filter(t => t !== tag) });
  };

  const updateConstraintStatus = (id: string, status: ConstraintStatus) => {
    const updated = {
      ...data,
      constraints: data.constraints.map(c =>
        c.id === id ? { ...c, status, resolvedAt: status === "resolvida" ? new Date().toISOString() : c.resolvedAt } : c
      ),
    };
    onSave(updated);
  };

  const deleteConstraint = (id: string) => {
    const updated = { ...data, constraints: data.constraints.filter(c => c.id !== id) };
    onSave(updated);
    if (expandedId === id) setExpandedId(null);
  };

  const statusColors: Record<ConstraintStatus, string> = {
    identificada: "bg-red-100 text-red-700",
    em_resolucao: "bg-yellow-100 text-yellow-700",
    resolvida: "bg-green-100 text-green-700",
  };

  const statusLabels: Record<ConstraintStatus, string> = {
    identificada: "Identificada", em_resolucao: "Em Resolução", resolvida: "Resolvida",
  };

  const statusIndicator: Record<ConstraintStatus, { color: string; label: string }> = {
    identificada: { color: "text-red-500", label: "Não removida" },
    em_resolucao: { color: "text-yellow-500", label: "Em resolução" },
    resolvida: { color: "text-green-500", label: "Removida" },
  };

  // Suggested tags from existing constraints
  const suggestedTags = metrics.allTags.filter(t => !newConstraint.tags.includes(t));

  return (
    <div className="space-y-4">
      {/* Stacked BarChart by Tags */}
      {metrics.constraintsByTag.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> Restrições por Tag</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.constraintsByTag} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="tag" type="category" tick={{ fontSize: 10 }} width={120} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="identificada" stackId="a" name="Identificada" fill="#ef4444" />
                <Bar dataKey="em_resolucao" stackId="a" name="Em Resolução" fill="#f59e0b" />
                <Bar dataKey="resolvida" stackId="a" name="Resolvida" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Análise de Restrições</CardTitle>
              <CardDescription>Identifique e acompanhe a remoção de restrições</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={v => setFilter(v as any)}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todas</SelectItem>
                  <SelectItem value="identificada" className="text-xs">Identificadas</SelectItem>
                  <SelectItem value="em_resolucao" className="text-xs">Em Resolução</SelectItem>
                  <SelectItem value="resolvida" className="text-xs">Resolvidas</SelectItem>
                </SelectContent>
              </Select>
              {metrics.allTags.length > 0 && (
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Tag" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas as tags</SelectItem>
                    {metrics.allTags.map(t => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-3 w-3 mr-1" /> Nova Restrição</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline">{data.constraints.length} total</Badge>
            <Badge className="bg-red-100 text-red-700">{data.constraints.filter(c => c.status === "identificada").length} identificadas</Badge>
            <Badge className="bg-yellow-100 text-yellow-700">{data.constraints.filter(c => c.status === "em_resolucao").length} em resolução</Badge>
            <Badge className="bg-green-100 text-green-700">{data.constraints.filter(c => c.status === "resolvida").length} resolvidas</Badge>
          </div>

          {filtered.length > 0 ? (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6"></TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(constraint => {
                    const overdue = constraint.status !== "resolvida" && new Date(constraint.prazoRemocao) < new Date();
                    const isExpanded = expandedId === constraint.id;
                    const si = statusIndicator[constraint.status];
                    return (
                      <>
                        <TableRow key={constraint.id} className={`cursor-pointer ${overdue ? "bg-red-50/50" : ""} ${isExpanded ? "border-b-0" : ""}`} onClick={() => setExpandedId(isExpanded ? null : constraint.id)}>
                          <TableCell className="px-1">
                            {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{CONSTRAINT_LABELS[constraint.category]}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium max-w-[180px] truncate">{constraint.description}</TableCell>
                          <TableCell className="text-xs">{constraint.responsavel || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <span className={overdue ? "text-red-600 font-medium" : ""}>
                              {new Date(constraint.prazoRemocao).toLocaleDateString("pt-BR")}
                              {overdue && <AlertTriangle className="h-3 w-3 inline ml-1 text-red-500" />}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {(constraint.tags || []).map(tag => (
                                <span key={tag} className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: getTagColor(tag, metrics.allTags) }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <Circle className={`h-2.5 w-2.5 fill-current ${si.color}`} />
                              <Select value={constraint.status} onValueChange={v => updateConstraintStatus(constraint.id, v as ConstraintStatus)}>
                                <SelectTrigger className={`h-6 text-[10px] w-28 ${statusColors[constraint.status]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(statusLabels) as ConstraintStatus[]).map(s => (
                                    <SelectItem key={s} value={s} className="text-xs">{statusLabels[s]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); deleteConstraint(constraint.id); }}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {/* Expanded detail panel */}
                        {isExpanded && (
                          <TableRow key={`${constraint.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={8} className="p-4">
                              <div className="space-y-3">
                                {constraint.tema && (
                                  <div>
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tema</span>
                                    <p className="text-sm font-medium mt-0.5">{constraint.tema}</p>
                                  </div>
                                )}
                                {constraint.impacto && (
                                  <div>
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Impacto</span>
                                    <p className="text-xs mt-0.5 text-muted-foreground">{constraint.impacto}</p>
                                  </div>
                                )}
                                {(constraint.acoes || []).length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações Necessárias</span>
                                    <ul className="mt-1 space-y-1">
                                      {constraint.acoes!.map((acao, i) => (
                                        <li key={i} className="flex items-center gap-2 text-xs">
                                          {constraint.status === "resolvida"
                                            ? <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                            : <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          }
                                          {acao}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {constraint.notes && (
                                  <div>
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Observações</span>
                                    <p className="text-xs mt-0.5 text-muted-foreground">{constraint.notes}</p>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 pt-1">
                                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status LPS:</span>
                                  <span className={`text-xs font-semibold flex items-center gap-1 ${si.color}`}>
                                    <Circle className="h-2.5 w-2.5 fill-current" />
                                    {si.label}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter === "all" && tagFilter === "all" ? "Nenhuma restrição registrada." : "Nenhuma restrição encontrada com os filtros selecionados."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add constraint dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Restrição</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tema</Label>
              <Input className="h-8 text-xs" value={newConstraint.tema} onChange={e => setNewConstraint({ ...newConstraint, tema: e.target.value })} placeholder="Ex: Definição Técnica da Remoção – EEE Criadores" />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={newConstraint.category} onValueChange={v => setNewConstraint({ ...newConstraint, category: v as ConstraintCategory })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CONSTRAINT_LABELS) as ConstraintCategory[]).map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{CONSTRAINT_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Descrição / Restrição *</Label>
              <Textarea value={newConstraint.description} onChange={e => setNewConstraint({ ...newConstraint, description: e.target.value })} placeholder="Descreva a restrição" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Impacto</Label>
              <Textarea value={newConstraint.impacto} onChange={e => setNewConstraint({ ...newConstraint, impacto: e.target.value })} placeholder="Ex: Bloqueia avanço de projeto executivo, orçamento e liberação de frente" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Responsável</Label>
                <Input className="h-8 text-xs" value={newConstraint.responsavel} onChange={e => setNewConstraint({ ...newConstraint, responsavel: e.target.value })} placeholder="Ex: Sala Técnica / Engenharia" />
              </div>
              <div>
                <Label className="text-xs">Prazo de Remoção</Label>
                <Input type="date" className="h-8 text-xs" value={newConstraint.prazo} onChange={e => setNewConstraint({ ...newConstraint, prazo: e.target.value })} />
              </div>
            </div>

            {/* Ações Necessárias */}
            <div>
              <Label className="text-xs">Ações Necessárias</Label>
              <div className="flex gap-1 mt-1">
                <Input className="h-7 text-xs flex-1" value={newAcao} onChange={e => setNewAcao(e.target.value)} placeholder="Ex: Revisar traçado em servidão"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAcao(); } }} />
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={addAcao}><Plus className="h-3 w-3" /></Button>
              </div>
              {newConstraint.acoes.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {newConstraint.acoes.map((acao, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                      <Circle className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1">{acao}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeAcao(i)}>
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tags */}
            <div>
              <Label className="text-xs">Tags</Label>
              <div className="flex gap-1 mt-1">
                <div className="relative flex-1">
                  <Input className="h-7 text-xs" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Adicionar tag..."
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    list="tag-suggestions" />
                  {suggestedTags.length > 0 && (
                    <datalist id="tag-suggestions">
                      {suggestedTags.map(t => <option key={t} value={t} />)}
                    </datalist>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={addTag}><Tag className="h-3 w-3" /></Button>
              </div>
              {newConstraint.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {newConstraint.tags.map(tag => (
                    <Badge key={tag} className="text-[10px] gap-1 cursor-pointer" style={{ backgroundColor: getTagColor(tag, [...metrics.allTags, ...newConstraint.tags]) }}
                      onClick={() => removeTag(tag)}>
                      {tag} <X className="h-2 w-2" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Observações</Label>
              <Input className="h-8 text-xs" value={newConstraint.notes} onChange={e => setNewConstraint({ ...newConstraint, notes: e.target.value })} placeholder="Notas adicionais (opcional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setNewConstraint(defaultForm); }}>Cancelar</Button>
            <Button size="sm" onClick={addConstraint}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
