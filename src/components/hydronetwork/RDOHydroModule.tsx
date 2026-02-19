import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Edit, FileText, MapPin, BarChart3, List, Map as MapIcon, Download, Upload } from "lucide-react";
import {
  RDO, ExecutedService, SegmentProgress, ServiceUnit, RDOStatus, SystemType,
  generateId, saveRDOs, loadRDOs, deleteRDO, validateRDO, calculateDashboardMetrics, getStatusColor, exportRDOsToCSV
} from "@/engine/rdo";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from "recharts";
import { RDOProgressMap } from "./RDOProgressMap";
import { RDOFormComplete } from "./RDOFormComplete";
import { downloadRDODXF } from "@/lib/rdoDxfExporter";
import { downloadDXF } from "@/lib/dxfExporter";

interface RDOHydroModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  rdos: RDO[];
  setRdos: (rdos: RDO[]) => void;
}

const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtCurrency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Mock financial entries
interface FinancialEntry {
  id: string;
  date: string;
  category: string;
  categoryIcon: string;
  description: string;
  value: number;
  type: "despesa" | "receita";
}

const MOCK_FINANCIALS: FinancialEntry[] = [
  { id: "1", date: "2024-01-15", category: "Mão de Obra", categoryIcon: "👷", description: "Mão de obra janeiro", value: -45000, type: "despesa" },
  { id: "2", date: "2024-01-20", category: "Materiais", categoryIcon: "📦", description: "Tubulação PVC DN150", value: -28500, type: "despesa" },
  { id: "3", date: "2024-01-25", category: "Equipamentos", categoryIcon: "🚜", description: "Aluguel retroescavadeira", value: -12000, type: "despesa" },
  { id: "4", date: "2024-02-01", category: "Mão de Obra", categoryIcon: "👷", description: "Mão de obra fevereiro", value: -48000, type: "despesa" },
  { id: "5", date: "2024-02-10", category: "Materiais", categoryIcon: "📦", description: "PVs concreto armado", value: -35000, type: "despesa" },
  { id: "6", date: "2024-02-15", category: "Transporte", categoryIcon: "🚛", description: "Transporte materiais", value: -8500, type: "despesa" },
  { id: "7", date: "2024-02-20", category: "Equipamentos", categoryIcon: "🚜", description: "Compactador de solo", value: -6500, type: "despesa" },
  { id: "8", date: "2024-03-01", category: "Mão de Obra", categoryIcon: "👷", description: "Mão de obra março", value: -52000, type: "despesa" },
  { id: "9", date: "2024-03-05", category: "Materiais", categoryIcon: "📦", description: "Conexões e peças", value: -18500, type: "despesa" },
  { id: "10", date: "2024-03-10", category: "Administrativo", categoryIcon: "📋", description: "Custos administrativos", value: -15000, type: "despesa" },
];

const MOCK_SEGMENTS = [
  { id: "TRE-001", system: "esgoto" as const, planned: 150, executed: 0 },
  { id: "TRE-002", system: "esgoto" as const, planned: 200, executed: 50 },
  { id: "TRE-003", system: "esgoto" as const, planned: 175, executed: 175 },
  { id: "TRA-001", system: "agua" as const, planned: 120, executed: 80 },
  { id: "TRA-002", system: "agua" as const, planned: 180, executed: 0 },
  { id: "TRD-001", system: "drenagem" as const, planned: 250, executed: 100 },
];

export const RDOHydroModule = ({ pontos, trechos, rdos, setRdos }: RDOHydroModuleProps) => {
  const [view, setView] = useState<"dashboard" | "list" | "new" | "map" | "financial">("dashboard");
  const [financials, setFinancials] = useState<FinancialEntry[]>(MOCK_FINANCIALS);
  const [curvaSView, setCurvaSView] = useState<"financeiro" | "fisico" | "ambos">("ambos");

  const metrics = calculateDashboardMetrics(rdos);

  // Build segments from real trechos if available, otherwise use mock
  const activeSegments = trechos.length > 0
    ? trechos.map((t, i) => {
        const allSegs = rdos.flatMap(r => r.segments);
        const matching = allSegs.filter(s =>
          s.segmentName === `${t.idInicio}-${t.idFim}` || s.segmentName === t.idInicio
        );
        const executed = matching.reduce((sum, s) => sum + s.executedBefore + s.executedToday, 0);
        const system = (i % 3 === 0 ? "agua" : i % 3 === 1 ? "esgoto" : "drenagem") as "agua" | "esgoto" | "drenagem";
        return { id: `${t.idInicio}-${t.idFim}`, system, planned: t.comprimento, executed };
      })
    : MOCK_SEGMENTS;

  // Calculate totals from segments
  const totalPlanned = activeSegments.reduce((s, seg) => s + seg.planned, 0);
  const totalExecuted = activeSegments.reduce((s, seg) => s + seg.executed, 0);
  const progressPercent = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

  // System progress
  const systemProgress = (sys: string) => {
    const segs = activeSegments.filter(s => s.system === sys);
    const planned = segs.reduce((s, seg) => s + seg.planned, 0);
    const executed = segs.reduce((s, seg) => s + seg.executed, 0);
    return { planned, executed, percent: planned > 0 ? (executed / planned) * 100 : 0 };
  };
  const aguaP = systemProgress("agua");
  const esgotoP = systemProgress("esgoto");
  const drenagemP = systemProgress("drenagem");

  // Donut data
  const concluidos = activeSegments.filter(s => s.executed >= s.planned && s.executed > 0).length;
  const emExecucao = activeSegments.filter(s => s.executed > 0 && s.executed < s.planned).length;
  const naoIniciados = activeSegments.filter(s => s.executed === 0).length;
  const donutData = [
    { name: "Concluído", value: concluidos, color: "#22c55e" },
    { name: "Em Execução", value: emExecucao, color: "#f59e0b" },
    { name: "Não Iniciado", value: naoIniciados, color: "#ef4444" },
  ];

  // Top services
  const topServices = [
    { name: "Escavação mecanizada", qty: 1250, unit: "m³" },
    { name: "Assentamento DN200", qty: 405, unit: "m" },
    { name: "Reaterro compactado", qty: 980, unit: "m³" },
    { name: "Escoramento", qty: 650, unit: "m²" },
  ];

  // EVM
  const BAC = 850000;
  const EV = 380000;
  const AC = 365000;
  const PV = 425000;
  const CPI = EV / AC;
  const SPI = EV / PV;
  const CV = EV - AC;
  const SV = EV - PV;
  const EAC = BAC / CPI;
  const ETC = EAC - AC;
  const VAC = BAC - EAC;
  const TCPI = (BAC - EV) / (BAC - AC);

  // Curva S data
  const curvaSData = [
    { month: "Jan", pv: 5, ev: 4.5, ac: 4.2 },
    { month: "Fev", pv: 15, ev: 13, ac: 14 },
    { month: "Mar", pv: 30, ev: 25, ac: 27 },
    { month: "Abr", pv: 50, ev: 44.7, ac: 42.9 },
    { month: "Mai", pv: 70, ev: null, ac: null },
    { month: "Jun", pv: 85, ev: null, ac: null },
    { month: "Jul", pv: 95, ev: null, ac: null },
    { month: "Ago", pv: 100, ev: null, ac: null },
  ];

  // Daily chart
  const dailyData = Array.from({ length: 30 }, (_, i) => ({
    day: `D${i + 1}`,
    executado: Math.min(totalExecuted, Math.round(totalExecuted * ((i + 1) / 30) + Math.random() * 20)),
  }));

  // Cost by category
  const costByCategory = [
    { name: "Mão de Obra", value: 145000, color: "#3b82f6" },
    { name: "Materiais", value: 82000, color: "#22c55e" },
    { name: "Equipamentos", value: 18500, color: "#f59e0b" },
    { name: "Transporte", value: 8500, color: "#8b5cf6" },
    { name: "Administrativo", value: 15000, color: "#ef4444" },
  ];

  return (
    <div className="space-y-4">
      {/* Header Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: "📋", label: "Total de RDOs", value: rdos.length, color: "text-blue-600" },
          { icon: "✅", label: "Progresso Geral", value: `${fmt(progressPercent)}%`, color: "text-green-600" },
          { icon: "📏", label: "Metros Executados", value: `${totalExecuted}m`, color: "text-orange-600" },
          { icon: "📅", label: "RDOs Hoje", value: rdos.filter(r => r.date === new Date().toISOString().split("T")[0]).length, color: "text-purple-600" },
        ].map((c, i) => (
          <Card key={i}>
            <CardContent className="pt-4 text-center">
              <span className="text-2xl">{c.icon}</span>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "new", label: "➕ Novo RDO" },
          { key: "dashboard", label: "📊 Dashboard" },
          { key: "list", label: "📃 Lista de RDOs" },
          { key: "map", label: "🗺️ Mapa de Avanço" },
          { key: "financial", label: "💰 Financeiro" },
        ].map(({ key, label }) => (
          <Button key={key} variant={view === key ? "default" : "outline"} size="sm" onClick={() => setView(key as any)}>{label}</Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => toast.info("Importar trechos planejados")}>📥 Importar Planejamento</Button>
        <Button variant="outline" size="sm" onClick={() => {
          if (trechos.length === 0) { toast.error("Sem dados para exportar"); return; }
          downloadRDODXF(pontos, trechos, rdos);
          toast.success("DXF do RDO exportado!");
        }}>📐 Exportar DXF</Button>
        <Button variant="outline" size="sm" onClick={() => {
          if (trechos.length === 0) { toast.error("Sem dados para exportar"); return; }
          downloadDXF(pontos, trechos);
          toast.success("DXF da rede exportado!");
        }}>📁 DXF Rede</Button>
      </div>

      {/* DASHBOARD VIEW */}
      {view === "dashboard" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4 text-center"><div className="text-sm text-muted-foreground">Total Planejado</div><div className="text-2xl font-bold text-blue-600">{totalPlanned} m</div><div className="text-xs text-muted-foreground">Extensão total da rede</div></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><div className="text-sm text-muted-foreground">Total Executado</div><div className="text-2xl font-bold text-green-600">{totalExecuted} m</div><div className="text-xs text-muted-foreground">Extensão já executada</div></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><div className="text-sm text-muted-foreground">Restante</div><div className="text-2xl font-bold text-orange-600">{totalPlanned - totalExecuted} m</div><div className="text-xs text-muted-foreground">A ser executado</div></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><div className="text-sm text-muted-foreground">Progresso</div><div className="text-2xl font-bold text-purple-600">{fmt(progressPercent)}%</div><Progress value={progressPercent} className="mt-2" /></CardContent></Card>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily chart */}
            <Card>
              <CardHeader><CardTitle>📈 Avanço Diário (Acumulado)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <RechartsTooltip />
                    <Area type="monotone" dataKey="executado" name="Executado (m)" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Donut */}
            <Card>
              <CardHeader><CardTitle>🥧 Status dos Trechos</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* System progress */}
          <Card>
            <CardHeader><CardTitle>📊 Progresso por Sistema</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { icon: "💧", label: "Água", data: aguaP, color: "#60a5fa" },
                { icon: "🚰", label: "Esgoto", data: esgotoP, color: "#22c55e" },
                { icon: "🌧️", label: "Drenagem", data: drenagemP, color: "#f59e0b" },
              ].map((sys, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{sys.icon} {sys.label}</span>
                    <span className="text-sm font-bold">{fmt(sys.data.percent)}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(sys.data.percent, 100)}%`, backgroundColor: sys.color }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{sys.data.executed} / {sys.data.planned} m</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top services */}
          <Card>
            <CardHeader><CardTitle>🏆 Serviços Mais Executados</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topServices.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{s.name}</span>
                    <Badge variant="outline">{s.qty.toLocaleString("pt-BR")} {s.unit}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Segment detail table */}
          <Card>
            <CardHeader><CardTitle>📏 Detalhamento por Trecho</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trecho</TableHead>
                    <TableHead>Sistema</TableHead>
                    <TableHead>Planejado (m)</TableHead>
                    <TableHead>Executado (m)</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSegments.map(seg => {
                    const pct = seg.planned > 0 ? (seg.executed / seg.planned) * 100 : 0;
                    const status = pct >= 100 ? "Concluído" : pct > 0 ? "Em Execução" : "Não Iniciado";
                    const statusColor = pct >= 100 ? "bg-green-500" : pct > 0 ? "bg-orange-500" : "bg-red-500";
                    const sysIcon = seg.system === "agua" ? "💧" : seg.system === "esgoto" ? "🚰" : "🌧️";
                    return (
                      <TableRow key={seg.id}>
                        <TableCell className="font-medium">{seg.id}</TableCell>
                        <TableCell>{sysIcon} {seg.system}</TableCell>
                        <TableCell>{seg.planned.toFixed(2)}</TableCell>
                        <TableCell>{seg.executed.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= 100 ? "#22c55e" : pct > 0 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                            <span className="text-xs">{fmt(pct)}%</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge className={`${statusColor} text-white`}>{status}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FINANCIAL VIEW */}
      {(view === "dashboard" || view === "financial") && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>💰 Controle Financeiro da Obra</CardTitle>
              <CardDescription>Acompanhe o desempenho financeiro com indicadores EVM (Earned Value Management).</CardDescription>
            </CardHeader>
            <CardContent>
              {/* EVM Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card><CardContent className="pt-3 text-center"><span className="text-lg">📋</span><div className="text-xl font-bold">{fmtCurrency(BAC)}</div><div className="text-xs text-muted-foreground">Orçamento Total (BAC)</div></CardContent></Card>
                <Card><CardContent className="pt-3 text-center"><span className="text-lg">✓</span><div className="text-xl font-bold text-green-600">{fmtCurrency(EV)}</div><div className="text-xs text-muted-foreground">Valor Agregado (EV)</div></CardContent></Card>
                <Card><CardContent className="pt-3 text-center"><span className="text-lg">💸</span><div className="text-xl font-bold text-orange-600">{fmtCurrency(AC)}</div><div className="text-xs text-muted-foreground">Custo Real (AC)</div></CardContent></Card>
                <Card><CardContent className="pt-3 text-center"><span className="text-lg">📊</span><div className="text-xl font-bold text-blue-600">{fmtCurrency(PV)}</div><div className="text-xs text-muted-foreground">Valor Planejado (PV)</div></CardContent></Card>
              </div>

              {/* Performance indicators */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-3">
                    <div className="text-xs text-muted-foreground">CPI (Custo)</div>
                    <div className={`text-2xl font-bold ${CPI >= 1 ? "text-green-600" : "text-red-600"}`}>{CPI.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">EV / AC</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500">
                  <CardContent className="pt-3">
                    <div className="text-xs text-muted-foreground">SPI (Prazo)</div>
                    <div className={`text-2xl font-bold ${SPI >= 1 ? "text-green-600" : "text-red-600"}`}>{SPI.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">EV / PV</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="pt-3">
                    <div className="text-xs text-muted-foreground">CV (Variação Custo)</div>
                    <div className={`text-xl font-bold ${CV >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtCurrency(CV)}</div>
                    <div className="text-xs text-muted-foreground">EV - AC</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500">
                  <CardContent className="pt-3">
                    <div className="text-xs text-muted-foreground">SV (Variação Prazo)</div>
                    <div className={`text-xl font-bold ${SV >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtCurrency(SV)}</div>
                    <div className="text-xs text-muted-foreground">EV - PV</div>
                  </CardContent>
                </Card>
              </div>

              {/* Projections */}
              <Card className="mb-6">
                <CardHeader><CardTitle className="text-base">🎯 Projeções</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><div className="text-xs text-muted-foreground">EAC (Estimativa)</div><div className="text-lg font-bold">{fmtCurrency(EAC)}</div><div className="text-xs text-muted-foreground">Custo estimado final</div></div>
                    <div><div className="text-xs text-muted-foreground">ETC (A Completar)</div><div className="text-lg font-bold">{fmtCurrency(ETC)}</div><div className="text-xs text-muted-foreground">Custo restante</div></div>
                    <div><div className="text-xs text-muted-foreground">VAC (Variação)</div><div className={`text-lg font-bold ${VAC >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtCurrency(VAC)}</div><div className="text-xs text-muted-foreground">BAC - EAC</div></div>
                    <div><div className="text-xs text-muted-foreground">TCPI</div><div className="text-lg font-bold">{TCPI.toFixed(2)}</div><div className="text-xs text-muted-foreground">Desempenho necessário</div></div>
                  </div>
                </CardContent>
              </Card>

              {/* Curva S */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">📈 Curva S - Avanço Físico-Financeiro</CardTitle>
                    <div className="flex gap-1">
                      {(["financeiro", "fisico", "ambos"] as const).map(v => (
                        <Button key={v} size="sm" variant={curvaSView === v ? "default" : "outline"} onClick={() => setCurvaSView(v)}>
                          {v === "financeiro" ? "Financeiro" : v === "fisico" ? "Físico (%)" : "Ambos"}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={curvaSData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <RechartsTooltip formatter={(v: any) => v !== null ? `${Number(v).toFixed(1)}%` : "—"} />
                      <Legend />
                      {(curvaSView === "ambos" || curvaSView === "financeiro") && (
                        <Line type="monotone" dataKey="pv" name="Planejado (PV)" stroke="#3b82f6" strokeDasharray="5 5" dot />
                      )}
                      {(curvaSView === "ambos" || curvaSView === "fisico") && (
                        <Line type="monotone" dataKey="ev" name="Valor Agregado (EV)" stroke="#22c55e" strokeWidth={2} dot />
                      )}
                      {(curvaSView === "ambos" || curvaSView === "financeiro") && (
                        <Line type="monotone" dataKey="ac" name="Custo Real (AC)" stroke="#ef4444" strokeWidth={2} dot />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Financial entries table */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">💵 Lançamentos Financeiros</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toast.info("Adicionar lançamento")}><Plus className="h-4 w-4 mr-1" /> Novo Lançamento</Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info("Importar Excel")}><Upload className="h-4 w-4 mr-1" /> Importar Excel</Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info("Exportar relatório")}><Download className="h-4 w-4 mr-1" /> Exportar Relatório</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financials.map(f => (
                          <TableRow key={f.id}>
                            <TableCell className="text-sm">{new Date(f.date).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell><span className="mr-1">{f.categoryIcon}</span>{f.category}</TableCell>
                            <TableCell className="text-sm">{f.description}</TableCell>
                            <TableCell className="text-right font-mono text-sm text-red-600">{fmtCurrency(f.value)}</TableCell>
                            <TableCell><Badge variant="outline">Despesa</Badge></TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast.info("Editar")}><Edit className="h-3 w-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setFinancials(financials.filter(x => x.id !== f.id))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Cost by category chart */}
              <Card>
                <CardHeader><CardTitle className="text-base">📊 Custos por Categoria</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={costByCategory} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${fmtCurrency(value)}`}>
                        {costByCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <RechartsTooltip formatter={(v: number) => fmtCurrency(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <Card>
          <CardHeader><CardTitle>📋 RDOs ({rdos.length})</CardTitle></CardHeader>
          <CardContent>
            {rdos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum RDO cadastrado. Clique em "Novo RDO" para começar.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Serviços</TableHead>
                    <TableHead>Trechos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rdos.map(rdo => (
                    <TableRow key={rdo.id}>
                      <TableCell>{new Date(rdo.date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{rdo.projectName}</TableCell>
                      <TableCell>{rdo.services.length}</TableCell>
                      <TableCell>{rdo.segments.length}</TableCell>
                      <TableCell><Badge style={{ backgroundColor: getStatusColor(rdo.status), color: "white" }}>{rdo.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => {
                            const csv = exportRDOsToCSV([rdo]);
                            const blob = new Blob([csv], { type: "text/csv" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = `rdo-${rdo.date}.csv`;
                            a.click(); URL.revokeObjectURL(url);
                            toast.success("RDO exportado!");
                          }}><Download className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { setRdos(deleteRDO(rdos, rdo.id)); toast.success("RDO excluído."); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* MAP VIEW */}
      {view === "map" && <RDOProgressMap pontos={pontos} trechos={trechos} rdos={rdos} />}

      {/* NEW RDO FORM */}
      {view === "new" && <RDOFormComplete rdos={rdos} setRdos={setRdos} trechos={trechos} onComplete={() => setView("list")} />}
    </div>
  );
};
