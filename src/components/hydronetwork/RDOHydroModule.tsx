import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Edit, FileText, MapPin, BarChart3, List, Map as MapIcon, Download, Upload, ArrowUpDown } from "lucide-react";
import {
  RDO, ExecutedService, SegmentProgress, ServiceUnit, RDOStatus, SystemType,
  generateId, saveRDOs, loadRDOs, deleteRDO, validateRDO, calculateDashboardMetrics, getStatusColor, exportRDOsToCSV
} from "@/engine/rdo";
import { PontoTopografico, parseTopographyFile, parseTopographyCSV } from "@/engine/reader";
import { Trecho, createTrechosFromTopography } from "@/engine/domain";
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
  onPontosChange?: (pontos: PontoTopografico[]) => void;
  onTrechosChange?: (trechos: Trecho[]) => void;
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

// ── Equipment types ──
interface Equipment {
  id: string;
  nome: string;
  tipo: string;
  placa: string;
  proprietario: string;
  custoHora: number;
  status: "disponivel" | "em_uso" | "manutencao" | "indisponivel";
}

import { supabase } from "@/lib/supabase";

const EQUIPMENT_STORAGE_KEY = "hydronetwork_rdo_equipments";

function loadEquipments(): Equipment[] {
  try {
    const raw = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveEquipments(equips: Equipment[]) {
  localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(equips));
  // Sync to Supabase
  syncEquipmentsToSupabase(equips).catch(() => {});
}

async function syncEquipmentsToSupabase(equips: Equipment[]) {
  for (const e of equips) {
    await supabase.from("hydro_equipments").upsert({
      id: e.id,
      nome: e.nome,
      tipo: e.tipo,
      placa: e.placa,
      proprietario: e.proprietario,
      custo_hora: e.custoHora,
      status: e.status,
    }, { onConflict: "id" });
  }
}

async function loadEquipmentsFromSupabase(): Promise<Equipment[]> {
  try {
    const { data, error } = await supabase.from("hydro_equipments").select("*").order("created_at");
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map((e: any) => ({
        id: e.id, nome: e.nome, tipo: e.tipo, placa: e.placa || "",
        proprietario: e.proprietario || "", custoHora: Number(e.custo_hora),
        status: e.status as Equipment["status"],
      }));
    }
  } catch { /* fallback */ }
  return loadEquipments();
}

export const RDOHydroModule = ({ pontos, trechos, rdos, setRdos, onPontosChange, onTrechosChange }: RDOHydroModuleProps) => {
  const [view, setView] = useState<"dashboard" | "list" | "new" | "map" | "financial" | "equipamentos">("dashboard");
  const [financials, setFinancials] = useState<FinancialEntry[]>(MOCK_FINANCIALS);
  const [equipments, setEquipments] = useState<Equipment[]>(loadEquipments());
  const [showAddEquipment, setShowAddEquipment] = useState(false);

  // Load equipment from Supabase on mount
  useEffect(() => {
    loadEquipmentsFromSupabase().then(eqs => {
      if (eqs.length > 0) setEquipments(eqs);
    });
  }, []);
  const [newEquip, setNewEquip] = useState<Partial<Equipment>>({ tipo: "Retroescavadeira", status: "disponivel", custoHora: 0 });
  const [curvaSView, setCurvaSView] = useState<"financeiro" | "fisico" | "ambos">("ambos");
  const [segFilterRede, setSegFilterRede] = useState<string>("all");
  const [segFilterStatus, setSegFilterStatus] = useState<string>("all");
  const [segFilterFrente, setSegFilterFrente] = useState<string>("all");
  const [segFilterLote, setSegFilterLote] = useState<string>("all");
  const [segSearch, setSegSearch] = useState("");
  // Manual completion overrides: trechoId → boolean (concluido)
  const [manualCompletion, setManualCompletion] = useState<Record<string, boolean>>({});
  // Financial sorting
  const [financialSortField, setFinancialSortField] = useState<"date" | "category" | "value">("date");
  const [financialSortDir, setFinancialSortDir] = useState<"asc" | "desc">("desc");
  const topoInputRef = useRef<HTMLInputElement>(null);

  const handleTopoImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let pts: PontoTopografico[];
      if (ext === "csv" || ext === "txt") {
        const text = await file.text();
        pts = parseTopographyCSV(text);
      } else {
        pts = await parseTopographyFile(file);
      }
      if (pts.length < 2) { toast.error("Mínimo de 2 pontos necessários."); return; }
      const segs = createTrechosFromTopography(pts, 200, "PVC");
      onPontosChange?.(pts);
      onTrechosChange?.(segs);
      toast.success(`Topografia importada: ${pts.length} pontos, ${segs.length} trechos.`);
    } catch (err: any) { toast.error(err.message || "Erro ao importar topografia."); }
    if (topoInputRef.current) topoInputRef.current.value = "";
  }, [onPontosChange, onTrechosChange]);

  const metrics = calculateDashboardMetrics(rdos);

  // Build segments from real trechos if available, otherwise use mock
  const activeSegments = trechos.length > 0
    ? trechos.map((t, i) => {
        const allSegs = rdos.flatMap(r => r.segments);
        const trechoName = t.nomeTrecho || `${t.idInicio}-${t.idFim}`;
        const matching = allSegs.filter(s =>
          s.segmentName === trechoName || s.segmentName === `${t.idInicio}-${t.idFim}` || s.segmentName === t.idInicio
        );
        const executed = matching.reduce((sum, s) => sum + s.executedBefore + s.executedToday, 0);
        // Use manual network type from trecho if available, otherwise infer from tipoRede
        const system: "agua" | "esgoto" | "drenagem" = t.tipoRedeManual === "agua" ? "agua"
          : t.tipoRedeManual === "drenagem" ? "drenagem"
          : t.tipoRedeManual === "recalque" ? "agua"
          : "esgoto";
        return { id: trechoName, system, planned: t.comprimento, executed, frente: t.frenteServico || "", lote: t.lote || "", rede: t.tipoRedeManual || "" };
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

  // Top services: aggregate from real RDOs, fallback to mock if no RDOs
  const topServices = useMemo(() => {
    if (rdos.length === 0) {
      return [
        { name: "Escavação mecanizada", qty: 1250, unit: "m³", planned: 0 },
        { name: "Assentamento DN200", qty: 405, unit: "m", planned: 0 },
        { name: "Reaterro compactado", qty: 980, unit: "m³", planned: 0 },
        { name: "Escoramento", qty: 650, unit: "m²", planned: 0 },
      ];
    }
    // Aggregate services from all RDOs
    const serviceMap = new Map<string, { qty: number; unit: string }>();
    for (const rdo of rdos) {
      for (const svc of rdo.services) {
        const key = svc.serviceName;
        const existing = serviceMap.get(key);
        if (existing) {
          existing.qty += svc.quantity;
        } else {
          serviceMap.set(key, { qty: svc.quantity, unit: svc.unit });
        }
      }
    }
    // Try to load planning productivity for planned quantities
    let planningServices: Record<string, number> = {};
    try {
      const raw = localStorage.getItem("hydronetwork_saved_plans");
      if (raw) {
        const plans = JSON.parse(raw);
        if (plans.length > 0) {
          const latest = plans[plans.length - 1];
          if (latest.productivity) {
            for (const p of latest.productivity) {
              planningServices[p.servico] = p.produtividade;
            }
          }
        }
      }
    } catch { /* ignore */ }

    return Array.from(serviceMap.entries())
      .map(([name, { qty, unit }]) => ({ name, qty, unit, planned: planningServices[name] || 0 }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [rdos]);

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
          { key: "equipamentos", label: "🚜 Equipamentos" },
        ].map(({ key, label }) => (
          <Button key={key} variant={view === key ? "default" : "outline"} size="sm" onClick={() => setView(key as any)}>{label}</Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => toast.info("Importar trechos planejados")}>📥 Importar Planejamento</Button>
        {onPontosChange && onTrechosChange && (
          <>
            <Button variant="outline" size="sm" onClick={() => topoInputRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Importar Topografia
            </Button>
            <input ref={topoInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={handleTopoImport} />
          </>
        )}
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
              <CardHeader>
                <CardTitle>📈 Avanço Diário (Acumulado)</CardTitle>
                <CardDescription className="text-xs">
                  Fonte: {trechos.length > 0 ? `${activeSegments.length} trechos da topografia carregada` : "dados de exemplo (mock)"} 
                  {rdos.length > 0 ? ` + ${rdos.length} RDOs registrados` : ""}.
                  Valores acumulados calculados a partir dos metros executados por trecho.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <RechartsTooltip formatter={(value: number) => [`${value} m`, "Executado"]} />
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
            <CardHeader>
              <CardTitle>🏆 Serviços Mais Executados</CardTitle>
              <CardDescription className="text-xs">
                {rdos.length > 0
                  ? `Dados agregados de ${rdos.length} RDOs registrados`
                  : "Dados de exemplo (registre RDOs para dados reais)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topServices.map((s, i) => {
                  const maxQty = topServices[0]?.qty || 1;
                  const barWidth = Math.max(5, (s.qty / maxQty) * 100);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{s.name}</span>
                        <Badge variant="outline">{s.qty.toLocaleString("pt-BR")} {s.unit}</Badge>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${barWidth}%` }} />
                      </div>
                      {s.planned > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Planejado: {s.planned.toLocaleString("pt-BR")} {s.unit} ({((s.qty / s.planned) * 100).toFixed(0)}%)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Segment detail table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>📏 Detalhamento por Trecho</CardTitle>
                <div className="flex gap-2 flex-wrap items-center">
                  <Input
                    placeholder="Buscar trecho..."
                    value={segSearch}
                    onChange={e => setSegSearch(e.target.value)}
                    className="h-8 w-40 text-xs"
                  />
                  <Select value={segFilterRede} onValueChange={setSegFilterRede}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Rede" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Redes</SelectItem>
                      <SelectItem value="agua">💧 Agua</SelectItem>
                      <SelectItem value="esgoto">🚰 Esgoto</SelectItem>
                      <SelectItem value="drenagem">🌧️ Drenagem</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={segFilterStatus} onValueChange={setSegFilterStatus}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="nao_iniciado">Nao Iniciado</SelectItem>
                      <SelectItem value="em_execucao">Em Execucao</SelectItem>
                      <SelectItem value="concluido">Concluido</SelectItem>
                    </SelectContent>
                  </Select>
                  {(() => {
                    const frentes = [...new Set(activeSegments.map(s => s.frente).filter(Boolean))];
                    if (frentes.length === 0) return null;
                    return (
                      <Select value={segFilterFrente} onValueChange={setSegFilterFrente}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Frente" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas Frentes</SelectItem>
                          {frentes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                  {(() => {
                    const lotes = [...new Set(activeSegments.map(s => s.lote).filter(Boolean))];
                    if (lotes.length === 0) return null;
                    return (
                      <Select value={segFilterLote} onValueChange={setSegFilterLote}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Lote" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos Lotes</SelectItem>
                          {lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Concluído</TableHead>
                    <TableHead>Trecho</TableHead>
                    <TableHead>Sistema</TableHead>
                    <TableHead>Frente</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Planejado (m)</TableHead>
                    <TableHead>Executado (m)</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSegments
                    .filter(seg => {
                      if (segFilterRede !== "all" && seg.system !== segFilterRede) return false;
                      if (segFilterFrente !== "all" && seg.frente !== segFilterFrente) return false;
                      if (segFilterLote !== "all" && seg.lote !== segFilterLote) return false;
                      const pct = seg.planned > 0 ? (seg.executed / seg.planned) * 100 : 0;
                      const isManualDone = manualCompletion[seg.id] === true;
                      const effectivePct = isManualDone ? 100 : pct;
                      if (segFilterStatus === "nao_iniciado" && effectivePct > 0) return false;
                      if (segFilterStatus === "em_execucao" && (effectivePct <= 0 || effectivePct >= 100)) return false;
                      if (segFilterStatus === "concluido" && effectivePct < 100) return false;
                      if (segSearch && !seg.id.toLowerCase().includes(segSearch.toLowerCase()) && !(seg.frente || "").toLowerCase().includes(segSearch.toLowerCase())) return false;
                      return true;
                    })
                    .map(seg => {
                    const pct = seg.planned > 0 ? (seg.executed / seg.planned) * 100 : 0;
                    const isManualDone = manualCompletion[seg.id] === true;
                    const effectiveStatus = isManualDone ? "Concluido" : pct >= 100 ? "Concluido" : pct > 0 ? "Em Execucao" : "Nao Iniciado";
                    const statusColor = effectiveStatus === "Concluido" ? "bg-green-500" : pct > 0 ? "bg-orange-500" : "bg-red-500";
                    const sysIcon = seg.system === "agua" ? "💧" : seg.system === "esgoto" ? "🚰" : "🌧️";
                    return (
                      <TableRow key={seg.id} className={isManualDone && pct < 100 ? "bg-green-500/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={isManualDone || pct >= 100}
                            onCheckedChange={(checked) => {
                              setManualCompletion(prev => ({ ...prev, [seg.id]: checked === true }));
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{seg.id}</TableCell>
                        <TableCell>{sysIcon} {seg.system}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{seg.frente || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{seg.lote || "-"}</TableCell>
                        <TableCell>{seg.planned.toFixed(2)}</TableCell>
                        <TableCell>{seg.executed.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(isManualDone ? 100 : pct, 100)}%`, backgroundColor: effectiveStatus === "Concluido" ? "#22c55e" : pct > 0 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                            <span className="text-xs">{isManualDone ? "100,0" : fmt(pct)}%</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge className={`${statusColor} text-white`}>{effectiveStatus}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
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
                          <TableHead className="cursor-pointer select-none" onClick={() => { setFinancialSortField("date"); setFinancialSortDir(financialSortField === "date" && financialSortDir === "asc" ? "desc" : "asc"); }}>
                            <div className="flex items-center gap-1">Data <ArrowUpDown className="h-3 w-3" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => { setFinancialSortField("category"); setFinancialSortDir(financialSortField === "category" && financialSortDir === "asc" ? "desc" : "asc"); }}>
                            <div className="flex items-center gap-1">Categoria <ArrowUpDown className="h-3 w-3" /></div>
                          </TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right cursor-pointer select-none" onClick={() => { setFinancialSortField("value"); setFinancialSortDir(financialSortField === "value" && financialSortDir === "asc" ? "desc" : "asc"); }}>
                            <div className="flex items-center gap-1 justify-end">Valor <ArrowUpDown className="h-3 w-3" /></div>
                          </TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...financials].sort((a, b) => {
                          const dir = financialSortDir === "asc" ? 1 : -1;
                          if (financialSortField === "date") return dir * a.date.localeCompare(b.date);
                          if (financialSortField === "category") return dir * a.category.localeCompare(b.category);
                          if (financialSortField === "value") return dir * (a.value - b.value);
                          return 0;
                        }).map(f => (
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

      {/* EQUIPAMENTOS VIEW */}
      {view === "equipamentos" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span>🚜</span> Equipamentos ({equipments.length})
                </CardTitle>
                <Button size="sm" onClick={() => setShowAddEquipment(!showAddEquipment)}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Equipamento
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddEquipment && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-4 space-y-3">
                    <p className="font-semibold text-sm">Novo Equipamento</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Nome/Identificação *</Label>
                        <Input placeholder="Ex: Retro CAT 320" value={newEquip.nome || ""} onChange={e => setNewEquip({ ...newEquip, nome: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select value={newEquip.tipo || "Retroescavadeira"} onValueChange={v => setNewEquip({ ...newEquip, tipo: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Retroescavadeira", "Escavadeira Hidráulica", "Compactador", "Caminhão Basculante", "Caminhão Pipa", "Bomba Submersa", "Bomba de Esgotamento", "Rolo Compactador", "Placa Vibratória", "Serra Circular", "Betoneira", "Gerador", "Guindaste", "Motosserra", "Outro"].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Placa/Patrimônio</Label>
                        <Input placeholder="Ex: ABC-1234" value={newEquip.placa || ""} onChange={e => setNewEquip({ ...newEquip, placa: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Proprietário</Label>
                        <Input placeholder="Próprio / Locadora XYZ" value={newEquip.proprietario || ""} onChange={e => setNewEquip({ ...newEquip, proprietario: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Custo/Hora (R$)</Label>
                        <Input type="number" step={0.01} value={newEquip.custoHora || 0} onChange={e => setNewEquip({ ...newEquip, custoHora: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Status</Label>
                        <Select value={newEquip.status || "disponivel"} onValueChange={v => setNewEquip({ ...newEquip, status: v as Equipment["status"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disponivel">Disponível</SelectItem>
                            <SelectItem value="em_uso">Em Uso</SelectItem>
                            <SelectItem value="manutencao">Manutenção</SelectItem>
                            <SelectItem value="indisponivel">Indisponível</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => {
                        if (!newEquip.nome?.trim()) { toast.error("Informe o nome do equipamento."); return; }
                        const equip: Equipment = {
                          id: crypto.randomUUID(),
                          nome: newEquip.nome!,
                          tipo: newEquip.tipo || "Outro",
                          placa: newEquip.placa || "",
                          proprietario: newEquip.proprietario || "",
                          custoHora: newEquip.custoHora || 0,
                          status: newEquip.status as Equipment["status"] || "disponivel",
                        };
                        const updated = [...equipments, equip];
                        setEquipments(updated);
                        saveEquipments(updated);
                        setNewEquip({ tipo: "Retroescavadeira", status: "disponivel", custoHora: 0 });
                        setShowAddEquipment(false);
                        toast.success(`Equipamento "${equip.nome}" adicionado!`);
                      }}>
                        <Plus className="h-4 w-4 mr-1" /> Adicionar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddEquipment(false)}>Cancelar</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {equipments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum equipamento cadastrado. Clique em "Adicionar Equipamento" para começar.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-blue-600">{equipments.length}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-green-600">{equipments.filter(e => e.status === "disponivel").length}</div><div className="text-xs text-muted-foreground">Disponíveis</div></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-yellow-600">{equipments.filter(e => e.status === "em_uso").length}</div><div className="text-xs text-muted-foreground">Em Uso</div></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-red-600">{equipments.filter(e => e.status === "manutencao" || e.status === "indisponivel").length}</div><div className="text-xs text-muted-foreground">Manutenção/Indisp.</div></CardContent></Card>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Placa</TableHead>
                        <TableHead>Proprietário</TableHead>
                        <TableHead>Custo/Hora</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipments.map(equip => (
                        <TableRow key={equip.id}>
                          <TableCell className="font-medium">{equip.nome}</TableCell>
                          <TableCell className="text-sm">{equip.tipo}</TableCell>
                          <TableCell className="text-sm">{equip.placa || "-"}</TableCell>
                          <TableCell className="text-sm">{equip.proprietario || "-"}</TableCell>
                          <TableCell className="text-sm">{equip.custoHora > 0 ? fmtCurrency(equip.custoHora) : "-"}</TableCell>
                          <TableCell>
                            <Select value={equip.status} onValueChange={v => {
                              const updated = equipments.map(e => e.id === equip.id ? { ...e, status: v as Equipment["status"] } : e);
                              setEquipments(updated);
                              saveEquipments(updated);
                            }}>
                              <SelectTrigger className="h-7 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="disponivel">Disponível</SelectItem>
                                <SelectItem value="em_uso">Em Uso</SelectItem>
                                <SelectItem value="manutencao">Manutenção</SelectItem>
                                <SelectItem value="indisponivel">Indisponível</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              const updated = equipments.filter(e => e.id !== equip.id);
                              setEquipments(updated);
                              saveEquipments(updated);
                              toast.success("Equipamento removido.");
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
