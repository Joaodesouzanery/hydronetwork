import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from "react";
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
import {
  Plus, Trash2, Edit, FileText, MapPin, BarChart3, List, Map as MapIcon, Download, Upload, ArrowUpDown,
  ClipboardList, CheckCircle2, Calendar, TrendingUp, DollarSign, Droplets, CloudRain, Target, Wrench,
  Ruler, PieChart as PieChartIcon, Trophy, ArrowDownToLine, FolderOpen, Truck, Users, Package, Thermometer,
} from "lucide-react";
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
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

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

// Financial entries stored in localStorage
interface FinancialEntry {
  id: string;
  date: string;
  category: string;
  description: string;
  value: number;
  type: "despesa" | "receita";
}

const FINANCIAL_STORAGE_KEY = "hydronetwork_rdo_financials";

function loadFinancials(): FinancialEntry[] {
  try {
    const raw = localStorage.getItem(FINANCIAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveFinancialsToStorage(entries: FinancialEntry[]) {
  localStorage.setItem(FINANCIAL_STORAGE_KEY, JSON.stringify(entries));
}

const CATEGORY_ICONS: Record<string, ReactNode> = {
  "Mão de Obra": <Users className="h-4 w-4 inline-block" />,
  "Materiais": <Package className="h-4 w-4 inline-block" />,
  "Equipamentos": <Truck className="h-4 w-4 inline-block" />,
  "Transporte": <Truck className="h-4 w-4 inline-block" />,
  "Administrativo": <ClipboardList className="h-4 w-4 inline-block" />,
  "Outros": <DollarSign className="h-4 w-4 inline-block" />,
};

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

async function getEquipUserId(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

async function syncEquipmentsToSupabase(equips: Equipment[]) {
  const userId = await getEquipUserId();
  for (const e of equips) {
    await supabase.from("hydro_equipments").upsert({
      id: e.id,
      user_id: userId || undefined,
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
    const userId = await getEquipUserId();
    let query = supabase.from("hydro_equipments").select("*").order("created_at");
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
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
  const [financials, setFinancials] = useState<FinancialEntry[]>(() => loadFinancials());
  const [showAddFinancial, setShowAddFinancial] = useState(false);
  const [newFinancial, setNewFinancial] = useState<Partial<FinancialEntry>>({ category: "Materiais", type: "despesa" });
  const [budgetBAC, setBudgetBAC] = useState<number>(() => {
    try { const raw = localStorage.getItem("hydronetwork_rdo_bac"); return raw ? JSON.parse(raw) : 0; } catch { return 0; }
  });
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

  // Build segments from real trechos data only
  const activeSegments = trechos.map((t) => {
    const allSegs = rdos.flatMap(r => r.segments);
    const trechoName = t.nomeTrecho || `${t.idInicio}-${t.idFim}`;
    const matching = allSegs.filter(s =>
      s.segmentName === trechoName || s.segmentName === `${t.idInicio}-${t.idFim}` || s.segmentName === t.idInicio
    );
    const executed = matching.reduce((sum, s) => sum + s.executedBefore + s.executedToday, 0);
    const system: "agua" | "esgoto" | "drenagem" = t.tipoRedeManual === "agua" ? "agua"
      : t.tipoRedeManual === "drenagem" ? "drenagem"
      : t.tipoRedeManual === "recalque" ? "agua"
      : "esgoto";
    return { id: trechoName, system, planned: t.comprimento, executed, frente: t.frenteServico || "", lote: t.lote || "", rede: t.tipoRedeManual || "" };
  });

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
      return [];
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

  // Save financials to localStorage when they change
  useEffect(() => { saveFinancialsToStorage(financials); }, [financials]);
  useEffect(() => { localStorage.setItem("hydronetwork_rdo_bac", JSON.stringify(budgetBAC)); }, [budgetBAC]);

  // EVM from real data - AC = total of financial entries (absolute), EV/PV from progress
  const AC = useMemo(() => financials.reduce((s, f) => s + Math.abs(f.value), 0), [financials]);
  const BAC = budgetBAC > 0 ? budgetBAC : AC > 0 ? AC * (100 / Math.max(progressPercent, 1)) : 0;
  const EV = BAC * (progressPercent / 100);
  const PV = useMemo(() => {
    if (BAC <= 0) return 0;
    // PV based on elapsed calendar proportion if we have RDO dates
    if (rdos.length < 2) return BAC * (progressPercent / 100);
    const dates = rdos.map(r => new Date(r.date).getTime()).sort((a, b) => a - b);
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const elapsed = lastDate - firstDate;
    if (elapsed <= 0) return BAC * (progressPercent / 100);
    // Assume linear planning
    const totalDurationEstimate = elapsed / Math.max(progressPercent / 100, 0.01);
    const elapsedRatio = elapsed / totalDurationEstimate;
    return BAC * Math.min(elapsedRatio, 1);
  }, [BAC, rdos, progressPercent]);
  const CPI = AC > 0 ? EV / AC : 0;
  const SPI = PV > 0 ? EV / PV : 0;
  const CV = EV - AC;
  const SV = EV - PV;
  const EAC = CPI > 0 ? BAC / CPI : 0;
  const ETC = EAC > 0 ? EAC - AC : 0;
  const VAC = BAC - EAC;
  const TCPI = (BAC - AC) > 0 ? (BAC - EV) / (BAC - AC) : 0;

  // Curva S data from real financial entries by month
  const curvaSData = useMemo(() => {
    if (financials.length === 0 && rdos.length === 0) return [];
    // Build monthly data from financials
    const monthMap = new Map<string, { ac: number; ev: number }>();
    for (const f of financials) {
      const m = f.date.slice(0, 7); // YYYY-MM
      const entry = monthMap.get(m) || { ac: 0, ev: 0 };
      entry.ac += Math.abs(f.value);
      monthMap.set(m, entry);
    }
    // Build monthly execution from RDOs
    for (const rdo of rdos) {
      const m = rdo.date.slice(0, 7);
      const execThisRDO = rdo.segments.reduce((s, seg) => s + seg.executedToday, 0);
      const entry = monthMap.get(m) || { ac: 0, ev: 0 };
      entry.ev += execThisRDO;
      monthMap.set(m, entry);
    }
    const months = Array.from(monthMap.keys()).sort();
    if (months.length === 0) return [];
    let cumAC = 0;
    let cumEV = 0;
    return months.map((m, i) => {
      const data = monthMap.get(m)!;
      cumAC += data.ac;
      cumEV += data.ev;
      const acPct = BAC > 0 ? (cumAC / BAC) * 100 : 0;
      const evPct = totalPlanned > 0 ? (cumEV / totalPlanned) * 100 : 0;
      const pvPct = months.length > 0 ? ((i + 1) / months.length) * 100 : 0;
      const label = new Date(m + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      return { month: label, pv: Math.min(pvPct, 100), ev: Math.min(evPct, 100), ac: Math.min(acPct, 100) };
    });
  }, [financials, rdos, BAC, totalPlanned]);

  // Daily chart from real RDO execution data
  const dailyData = useMemo(() => {
    if (rdos.length === 0) return [];
    const dayMap = new Map<string, number>();
    for (const rdo of rdos) {
      const execToday = rdo.segments.reduce((s, seg) => s + seg.executedToday, 0);
      const svcQty = rdo.services.reduce((s, svc) => s + svc.quantity, 0);
      const existing = dayMap.get(rdo.date) || 0;
      dayMap.set(rdo.date, existing + execToday + svcQty);
    }
    const days = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    return days.map(([date, qty]) => {
      cumulative += qty;
      return { day: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), executado: cumulative };
    });
  }, [rdos]);

  // Cost by category from real financial entries
  const CATEGORY_COLORS: Record<string, string> = { "Mão de Obra": "#3b82f6", "Materiais": "#22c55e", "Equipamentos": "#f59e0b", "Transporte": "#8b5cf6", "Administrativo": "#ef4444", "Outros": "#6b7280" };
  const costByCategory = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const f of financials) {
      const cat = f.category || "Outros";
      catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(f.value));
    }
    return Array.from(catMap.entries()).map(([name, value]) => ({
      name, value, color: CATEGORY_COLORS[name] || "#6b7280",
    }));
  }, [financials]);

  // ── PDF Export with ALL dashboards ──
  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString("pt-BR");
    let y = 15;

    // Title
    doc.setFontSize(18);
    doc.text("Relatorio Diario de Obra - RDO Hydro", 14, y); y += 8;
    doc.setFontSize(10);
    doc.text(`Gerado em: ${now}`, 14, y); y += 10;

    // Summary
    doc.setFontSize(14);
    doc.text("Resumo Geral", 14, y); y += 6;
    (doc as any).autoTable({
      startY: y,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total de RDOs", String(rdos.length)],
        ["Progresso Geral", `${fmt(progressPercent)}%`],
        ["Metros Executados", `${totalExecuted.toFixed(2)} m`],
        ["Total Planejado", `${totalPlanned.toFixed(2)} m`],
        ["Restante", `${(totalPlanned - totalExecuted).toFixed(2)} m`],
      ],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Progress by system
    doc.setFontSize(14);
    doc.text("Progresso por Sistema", 14, y); y += 6;
    (doc as any).autoTable({
      startY: y,
      head: [["Sistema", "Planejado (m)", "Executado (m)", "Progresso (%)"]],
      body: [
        ["Agua", aguaP.planned.toFixed(2), aguaP.executed.toFixed(2), `${fmt(aguaP.percent)}%`],
        ["Esgoto", esgotoP.planned.toFixed(2), esgotoP.executed.toFixed(2), `${fmt(esgotoP.percent)}%`],
        ["Drenagem", drenagemP.planned.toFixed(2), drenagemP.executed.toFixed(2), `${fmt(drenagemP.percent)}%`],
      ],
      theme: "grid",
      headStyles: { fillColor: [34, 197, 94] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Segment detail
    if (activeSegments.length > 0) {
      doc.addPage();
      y = 15;
      doc.setFontSize(14);
      doc.text("Detalhamento por Trecho", 14, y); y += 6;
      (doc as any).autoTable({
        startY: y,
        head: [["Trecho", "Sistema", "Planejado (m)", "Executado (m)", "Progresso (%)", "Status"]],
        body: activeSegments.map(seg => {
          const pct = seg.planned > 0 ? (seg.executed / seg.planned) * 100 : 0;
          const status = pct >= 100 ? "Concluido" : pct > 0 ? "Em Execucao" : "Nao Iniciado";
          return [seg.id, seg.system, seg.planned.toFixed(2), seg.executed.toFixed(2), `${fmt(pct)}%`, status];
        }),
        theme: "grid",
        headStyles: { fillColor: [139, 92, 246] },
        styles: { fontSize: 8 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Top services
    if (topServices.length > 0) {
      if (y > 220) { doc.addPage(); y = 15; }
      doc.setFontSize(14);
      doc.text("Servicos Mais Executados", 14, y); y += 6;
      (doc as any).autoTable({
        startY: y,
        head: [["Servico", "Quantidade", "Unidade"]],
        body: topServices.map(s => [s.name, s.qty.toFixed(2), s.unit]),
        theme: "grid",
        headStyles: { fillColor: [245, 158, 11] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Financial summary (EVM)
    if (BAC > 0 || AC > 0) {
      doc.addPage();
      y = 15;
      doc.setFontSize(14);
      doc.text("Controle Financeiro (EVM)", 14, y); y += 6;
      (doc as any).autoTable({
        startY: y,
        head: [["Indicador", "Valor"]],
        body: [
          ["Orcamento Total (BAC)", fmtCurrency(BAC)],
          ["Valor Agregado (EV)", fmtCurrency(EV)],
          ["Custo Real (AC)", fmtCurrency(AC)],
          ["Valor Planejado (PV)", fmtCurrency(PV)],
          ["CPI (Desempenho Custo)", CPI.toFixed(2)],
          ["SPI (Desempenho Prazo)", SPI.toFixed(2)],
          ["Variacao Custo (CV)", fmtCurrency(CV)],
          ["Variacao Prazo (SV)", fmtCurrency(SV)],
          ["Estimativa Final (EAC)", fmtCurrency(EAC)],
          ["Custo Restante (ETC)", fmtCurrency(ETC)],
        ],
        theme: "grid",
        headStyles: { fillColor: [99, 102, 241] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Financial entries
    if (financials.length > 0) {
      if (y > 200) { doc.addPage(); y = 15; }
      doc.setFontSize(14);
      doc.text("Lancamentos Financeiros", 14, y); y += 6;
      (doc as any).autoTable({
        startY: y,
        head: [["Data", "Categoria", "Descricao", "Valor"]],
        body: financials.map(f => [
          new Date(f.date).toLocaleDateString("pt-BR"),
          f.category,
          f.description,
          fmtCurrency(f.value),
        ]),
        theme: "grid",
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 8 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // RDO list
    if (rdos.length > 0) {
      doc.addPage();
      y = 15;
      doc.setFontSize(14);
      doc.text("Lista de RDOs", 14, y); y += 6;
      (doc as any).autoTable({
        startY: y,
        head: [["Data", "Projeto", "Status", "Servicos", "Trechos", "Metros Exec."]],
        body: rdos.map(rdo => {
          const metros = rdo.segments.reduce((s, seg) => s + seg.executedBefore + seg.executedToday, 0);
          return [
            new Date(rdo.date).toLocaleDateString("pt-BR"),
            rdo.projectName,
            rdo.status,
            String(rdo.services.length),
            String(rdo.segments.length),
            metros.toFixed(2),
          ];
        }),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
      });

      // Detail for each RDO
      for (const rdo of rdos) {
        doc.addPage();
        y = 15;
        doc.setFontSize(14);
        doc.text(`RDO - ${new Date(rdo.date).toLocaleDateString("pt-BR")} - ${rdo.projectName}`, 14, y); y += 6;
        doc.setFontSize(10);
        doc.text(`Status: ${rdo.status} | Obra: ${rdo.obraName || "-"}`, 14, y); y += 5;
        if (rdo.notes) { doc.text(`Observacoes: ${rdo.notes}`, 14, y); y += 5; }
        if (rdo.occurrences) { doc.text(`Ocorrencias: ${rdo.occurrences}`, 14, y); y += 5; }
        y += 3;

        if (rdo.services.length > 0) {
          doc.text("Servicos Executados:", 14, y); y += 5;
          (doc as any).autoTable({
            startY: y,
            head: [["Servico", "Quantidade", "Unidade", "Equipamento", "Funcionario"]],
            body: rdo.services.map(s => [s.serviceName, s.quantity.toFixed(2), s.unit, s.equipment || "-", s.employeeName || "-"]),
            theme: "grid",
            styles: { fontSize: 8 },
          });
          y = (doc as any).lastAutoTable.finalY + 5;
        }

        if (rdo.segments.length > 0) {
          doc.text("Avanco por Trecho:", 14, y); y += 5;
          (doc as any).autoTable({
            startY: y,
            head: [["Trecho", "Sistema", "Planejado (m)", "Exec. Anterior (m)", "Exec. Hoje (m)", "Total (m)"]],
            body: rdo.segments.map(s => [s.segmentName, s.system, s.plannedTotal.toFixed(2), s.executedBefore.toFixed(2), s.executedToday.toFixed(2), (s.executedBefore + s.executedToday).toFixed(2)]),
            theme: "grid",
            styles: { fontSize: 8 },
          });
        }
      }
    }

    // Equipments
    if (equipments.length > 0) {
      doc.addPage();
      y = 15;
      doc.setFontSize(14);
      doc.text("Equipamentos", 14, y); y += 6;
      (doc as any).autoTable({
        startY: y,
        head: [["Nome", "Tipo", "Placa", "Proprietario", "Custo/Hora", "Status"]],
        body: equipments.map(e => [e.nome, e.tipo, e.placa || "-", e.proprietario || "-", e.custoHora > 0 ? fmtCurrency(e.custoHora) : "-", e.status]),
        theme: "grid",
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 8 },
      });
    }

    doc.save(`rdo-hydro-completo-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF completo exportado com todos os dashboards e informacoes!");
  }, [rdos, activeSegments, financials, equipments, totalPlanned, totalExecuted, progressPercent, aguaP, esgotoP, drenagemP, topServices, BAC, EV, AC, PV, CPI, SPI, CV, SV, EAC, ETC]);

  // ── Excel Export ──
  const handleExportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Summary
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Indicador: "Total de RDOs", Valor: rdos.length },
      { Indicador: "Progresso Geral (%)", Valor: progressPercent },
      { Indicador: "Metros Executados", Valor: totalExecuted },
      { Indicador: "Total Planejado", Valor: totalPlanned },
      { Indicador: "BAC (Orcamento)", Valor: BAC },
      { Indicador: "AC (Custo Real)", Valor: AC },
      { Indicador: "EV (Valor Agregado)", Valor: EV },
      { Indicador: "CPI", Valor: CPI },
      { Indicador: "SPI", Valor: SPI },
    ]), "Resumo");

    // Segments
    if (activeSegments.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        activeSegments.map(seg => {
          const pct = seg.planned > 0 ? (seg.executed / seg.planned) * 100 : 0;
          return { Trecho: seg.id, Sistema: seg.system, Frente: seg.frente, Lote: seg.lote, "Planejado (m)": seg.planned, "Executado (m)": seg.executed, "Progresso (%)": pct };
        })
      ), "Trechos");
    }

    // RDOs
    if (rdos.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        rdos.map(rdo => ({
          Data: rdo.date, Projeto: rdo.projectName, Status: rdo.status,
          Servicos: rdo.services.length, Trechos: rdo.segments.length,
          "Metros Exec.": rdo.segments.reduce((s, seg) => s + seg.executedBefore + seg.executedToday, 0),
          Observacoes: rdo.notes || "",
        }))
      ), "RDOs");
    }

    // Financials
    if (financials.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        financials.map(f => ({ Data: f.date, Categoria: f.category, Descricao: f.description, Valor: f.value, Tipo: f.type }))
      ), "Financeiro");
    }

    // Equipment
    if (equipments.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        equipments.map(e => ({ Nome: e.nome, Tipo: e.tipo, Placa: e.placa, Proprietario: e.proprietario, "Custo Hora": e.custoHora, Status: e.status }))
      ), "Equipamentos");
    }

    XLSX.writeFile(wb, `rdo-hydro-completo-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel exportado!");
  }, [rdos, activeSegments, financials, equipments, totalPlanned, totalExecuted, progressPercent, BAC, AC, EV, CPI, SPI]);

  return (
    <div className="space-y-4">
      {/* Header Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <ClipboardList className="h-6 w-6 inline-block text-blue-600" />, label: "Total de RDOs", value: rdos.length, color: "text-blue-600" },
          { icon: <CheckCircle2 className="h-6 w-6 inline-block text-green-600" />, label: "Progresso Geral", value: `${fmt(progressPercent)}%`, color: "text-green-600" },
          { icon: <Ruler className="h-6 w-6 inline-block text-orange-600" />, label: "Metros Executados", value: `${totalExecuted}m`, color: "text-orange-600" },
          { icon: <Calendar className="h-6 w-6 inline-block text-purple-600" />, label: "RDOs Hoje", value: rdos.filter(r => r.date === new Date().toISOString().split("T")[0]).length, color: "text-purple-600" },
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
          { key: "new", icon: <Plus className="h-4 w-4 inline-block mr-1" />, label: "Novo RDO" },
          { key: "dashboard", icon: <BarChart3 className="h-4 w-4 inline-block mr-1" />, label: "Dashboard" },
          { key: "list", icon: <FileText className="h-4 w-4 inline-block mr-1" />, label: "Lista de RDOs" },
          { key: "map", icon: <MapIcon className="h-4 w-4 inline-block mr-1" />, label: "Mapa de Avanço" },
          { key: "financial", icon: <DollarSign className="h-4 w-4 inline-block mr-1" />, label: "Financeiro" },
          { key: "equipamentos", icon: <Truck className="h-4 w-4 inline-block mr-1" />, label: "Equipamentos" },
        ].map(({ key, icon, label }) => (
          <Button key={key} variant={view === key ? "default" : "outline"} size="sm" onClick={() => setView(key as any)}>{icon}{label}</Button>
        ))}
        <Button variant="outline" size="sm" onClick={handleExportPDF}><Download className="h-4 w-4 inline-block mr-1" /> Exportar PDF</Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="h-4 w-4 inline-block mr-1" /> Exportar Excel</Button>
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
        }}><Ruler className="h-4 w-4 inline-block mr-1" /> Exportar DXF</Button>
        <Button variant="outline" size="sm" onClick={() => {
          if (trechos.length === 0) { toast.error("Sem dados para exportar"); return; }
          downloadDXF(pontos, trechos);
          toast.success("DXF da rede exportado!");
        }}><FolderOpen className="h-4 w-4 inline-block mr-1" /> DXF Rede</Button>
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
                <CardTitle><TrendingUp className="h-4 w-4 inline-block mr-1" /> Avanço Diário (Acumulado)</CardTitle>
                <CardDescription className="text-xs">
                  {trechos.length > 0 ? `Fonte: ${activeSegments.length} trechos da topografia carregada` : "Importe topografia para visualizar dados reais"}
                  {rdos.length > 0 ? ` + ${rdos.length} RDOs registrados` : ""}.
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
              <CardHeader><CardTitle><PieChartIcon className="h-4 w-4 inline-block mr-1" /> Status dos Trechos</CardTitle></CardHeader>
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
            <CardHeader><CardTitle><BarChart3 className="h-4 w-4 inline-block mr-1" /> Progresso por Sistema</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { icon: <Droplets className="h-4 w-4 inline-block mr-1 text-blue-400" />, label: "Água", data: aguaP, color: "#60a5fa" },
                { icon: <Droplets className="h-4 w-4 inline-block mr-1 text-green-500" />, label: "Esgoto", data: esgotoP, color: "#22c55e" },
                { icon: <CloudRain className="h-4 w-4 inline-block mr-1 text-amber-500" />, label: "Drenagem", data: drenagemP, color: "#f59e0b" },
              ].map((sys, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{sys.icon} {sys.label}</span>
                    <span className="text-sm font-bold">{fmt(sys.data.percent)}%</span>
                  </div>
                  <div className="w-full h-3 bg-muted overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${Math.min(sys.data.percent, 100)}%`, backgroundColor: sys.color }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{sys.data.executed} / {sys.data.planned} m</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top services */}
          <Card>
            <CardHeader>
              <CardTitle><Trophy className="h-4 w-4 inline-block mr-1" /> Serviços Mais Executados</CardTitle>
              <CardDescription className="text-xs">
                {rdos.length > 0
                  ? `Dados agregados de ${rdos.length} RDOs registrados`
                  : "Registre RDOs para visualizar dados reais"}
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
                      <div className="w-full h-2 bg-muted overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${barWidth}%` }} />
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
                <CardTitle><Ruler className="h-4 w-4 inline-block mr-1" /> Detalhamento por Trecho</CardTitle>
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
                      <SelectItem value="agua"><Droplets className="h-3 w-3 inline-block mr-1 text-blue-400" /> Agua</SelectItem>
                      <SelectItem value="esgoto"><Droplets className="h-3 w-3 inline-block mr-1 text-green-500" /> Esgoto</SelectItem>
                      <SelectItem value="drenagem"><CloudRain className="h-3 w-3 inline-block mr-1 text-amber-500" /> Drenagem</SelectItem>
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
                    const sysIcon = seg.system === "agua" ? <Droplets className="h-3 w-3 inline-block mr-1 text-blue-400" /> : seg.system === "esgoto" ? <Droplets className="h-3 w-3 inline-block mr-1 text-green-500" /> : <CloudRain className="h-3 w-3 inline-block mr-1 text-amber-500" />;
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
                            <div className="w-24 h-2 bg-muted overflow-hidden">
                              <div className="h-full" style={{ width: `${Math.min(isManualDone ? 100 : pct, 100)}%`, backgroundColor: effectiveStatus === "Concluido" ? "#22c55e" : pct > 0 ? "#f59e0b" : "#ef4444" }} />
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
              <CardTitle><DollarSign className="h-4 w-4 inline-block mr-1" /> Controle Financeiro da Obra</CardTitle>
              <CardDescription>Acompanhe o desempenho financeiro com indicadores EVM (Earned Value Management). Adicione lancamentos financeiros reais para calculos precisos.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* BAC input */}
              <div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded">
                <Label className="text-xs whitespace-nowrap">Orcamento Total (BAC) R$:</Label>
                <Input
                  type="number"
                  step={0.01}
                  className="h-8 w-48"
                  value={budgetBAC || ""}
                  placeholder="Informe o orcamento total"
                  onChange={e => setBudgetBAC(Number(e.target.value))}
                />
                <span className="text-xs text-muted-foreground">{financials.length === 0 ? "Adicione lancamentos financeiros para ver os indicadores EVM" : `${financials.length} lancamento(s) registrado(s)`}</span>
              </div>

              {/* Add financial form */}
              {showAddFinancial && (
                <Card className="border-primary/30 bg-primary/5 mb-4">
                  <CardContent className="pt-4 space-y-3">
                    <p className="font-semibold text-sm">Novo Lancamento Financeiro</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Data *</Label>
                        <Input type="date" value={newFinancial.date || ""} onChange={e => setNewFinancial({ ...newFinancial, date: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Categoria</Label>
                        <Select value={newFinancial.category || "Materiais"} onValueChange={v => setNewFinancial({ ...newFinancial, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Mão de Obra", "Materiais", "Equipamentos", "Transporte", "Administrativo", "Outros"].map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Descricao *</Label>
                        <Input placeholder="Ex: Tubulacao PVC" value={newFinancial.description || ""} onChange={e => setNewFinancial({ ...newFinancial, description: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Valor (R$) *</Label>
                        <Input type="number" step={0.01} placeholder="Ex: -15000" value={newFinancial.value || ""} onChange={e => setNewFinancial({ ...newFinancial, value: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => {
                        if (!newFinancial.date || !newFinancial.description || !newFinancial.value) { toast.error("Preencha data, descricao e valor."); return; }
                        const entry: FinancialEntry = {
                          id: crypto.randomUUID(),
                          date: newFinancial.date,
                          category: newFinancial.category || "Outros",
                          description: newFinancial.description,
                          value: newFinancial.value < 0 ? newFinancial.value : -Math.abs(newFinancial.value),
                          type: "despesa",
                        };
                        setFinancials([...financials, entry]);
                        setNewFinancial({ category: "Materiais", type: "despesa" });
                        setShowAddFinancial(false);
                        toast.success("Lancamento adicionado!");
                      }}>
                        <Plus className="h-4 w-4 mr-1" /> Adicionar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddFinancial(false)}>Cancelar</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* EVM Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card><CardContent className="pt-3 text-center"><span className="text-lg"><ClipboardList className="h-5 w-5 inline-block" /></span><div className="text-xl font-bold">{fmtCurrency(BAC)}</div><div className="text-xs text-muted-foreground">Orçamento Total (BAC)</div></CardContent></Card>
                <Card><CardContent className="pt-3 text-center"><span className="text-lg"><CheckCircle2 className="h-5 w-5 inline-block text-green-600" /></span><div className="text-xl font-bold text-green-600">{fmtCurrency(EV)}</div><div className="text-xs text-muted-foreground">Valor Agregado (EV)</div></CardContent></Card>
                <Card><CardContent className="pt-3 text-center"><span className="text-lg"><DollarSign className="h-5 w-5 inline-block text-orange-600" /></span><div className="text-xl font-bold text-orange-600">{fmtCurrency(AC)}</div><div className="text-xs text-muted-foreground">Custo Real (AC)</div></CardContent></Card>
                <Card><CardContent className="pt-3 text-center"><span className="text-lg"><BarChart3 className="h-5 w-5 inline-block text-blue-600" /></span><div className="text-xl font-bold text-blue-600">{fmtCurrency(PV)}</div><div className="text-xs text-muted-foreground">Valor Planejado (PV)</div></CardContent></Card>
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
                <CardHeader><CardTitle className="text-base"><Target className="h-4 w-4 inline-block mr-1" /> Projeções</CardTitle></CardHeader>
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
                    <CardTitle className="text-base"><TrendingUp className="h-4 w-4 inline-block mr-1" /> Curva S - Avanço Físico-Financeiro</CardTitle>
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
                    <CardTitle className="text-base"><DollarSign className="h-4 w-4 inline-block mr-1" /> Lançamentos Financeiros</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setShowAddFinancial(!showAddFinancial)}><Plus className="h-4 w-4 mr-1" /> Novo Lancamento</Button>
                      <Button size="sm" variant="outline" onClick={handleExportPDF}><Download className="h-4 w-4 mr-1" /> Exportar PDF</Button>
                      <Button size="sm" variant="outline" onClick={handleExportExcel}><Download className="h-4 w-4 mr-1" /> Exportar Excel</Button>
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
                            <TableCell><span className="mr-1">{CATEGORY_ICONS[f.category] || CATEGORY_ICONS["Outros"]}</span>{f.category}</TableCell>
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
                <CardHeader><CardTitle className="text-base"><BarChart3 className="h-4 w-4 inline-block mr-1" /> Custos por Categoria</CardTitle></CardHeader>
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
          <CardHeader><CardTitle><ClipboardList className="h-4 w-4 inline-block mr-1" /> RDOs ({rdos.length})</CardTitle></CardHeader>
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
                  <Truck className="h-4 w-4" /> Equipamentos ({equipments.length})
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
