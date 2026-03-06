import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar, Users, Zap, ClipboardList, AlertTriangle, Download, Upload,
  BarChart3, TrendingUp, Plus, Trash2, FileText, Save, FolderOpen,
  Copy, Edit, ChevronDown, ChevronUp, Pencil, Layers, Droplets, CloudRain, ArrowUp, Lightbulb
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine,
  Line, ComposedChart
} from "recharts";
import { PontoTopografico } from "@/engine/reader";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { Trecho, NetworkSummary } from "@/engine/domain";
import {
  generateFullSchedule, TeamConfig, DEFAULT_TEAM_CONFIG,
  ScheduleResult, DailySegment, generateCurveSData, generateHistogramData
} from "@/engine/planning";
import { exportToExcel as exportPlanningExcel } from "@/components/planning/planningExport";
import {
  SavedPlan, getSavedPlans, savePlan, generatePlanId, TrechoMetadata,
} from "@/engine/savedPlanning";
import { SavedPlansDialog } from "./SavedPlansDialog";
import { TrechoEditorPanel } from "./TrechoEditorPanel";

// ── Types ──
interface Holiday {
  date: string;
  name: string;
}

interface ProductivityEntry {
  servico: string;
  unidade: string;
  produtividade: number;
  fonte: string;
}

type GanttMode = "segment" | "trecho" | "trecho_activity";
type HistogramView = "daily" | "weekly" | "monthly";
type HistogramFilter = "all" | "labor" | "equipment" | "cost";
type WorkDays = 5 | 6 | 7;
type GroupingMode = "trecho" | "frente" | "lote" | "area" | "rede";

// ── Saved Planning Types ──
interface SavedPlanning {
  id: string;
  nome: string;
  criadoEm: string;
  atualizadoEm: string;
  numEquipes: number;
  teamConfig: TeamConfig;
  metrosDia: number;
  dataInicio: string;
  dataTermino: string;
  horasTrabalho: number;
  workDays: WorkDays;
  holidays: Holiday[];
  productivity: ProductivityEntry[];
  trechoOverrides: Record<string, TrechoOverride>;
  serviceNotes: ServiceNote[];
  totalMetros?: number;
  totalDias?: number;
  custoTotal?: number;
}

interface TrechoOverride {
  nome?: string;
  comprimento?: number;
  profundidade?: number;
  diametroMm?: number;
  produtividadeDia?: number;
  prioridade?: number;
}

interface ServiceNote {
  id: string;
  trechoIndex: number;
  trechoNome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  responsavel: string;
  status: "pendente" | "em_execucao" | "concluida" | "aprovada";
  servicos: string[];
  observacoes: string;
}

const SAVED_PLANS_KEY = "hydronetwork_saved_plans";

async function getPlanUserId(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

function loadSavedPlans(): SavedPlanning[] {
  try {
    const raw = localStorage.getItem(SAVED_PLANS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePlansToStorage(plans: SavedPlanning[]) {
  localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(plans));
  // Sync each plan to Supabase
  syncPlansToSupabase(plans).catch(() => {});
}

async function syncPlansToSupabase(plans: SavedPlanning[]) {
  const userId = await getPlanUserId();
  for (const p of plans) {
    await supabase.from("hydro_saved_plans").upsert({
      id: p.id,
      user_id: userId || undefined,
      nome: p.nome,
      descricao: "",
      num_equipes: p.numEquipes,
      team_config: p.teamConfig,
      metros_dia: p.metrosDia,
      horas_trabalho: p.horasTrabalho,
      work_days: p.workDays,
      data_inicio: p.dataInicio || null,
      data_termino: p.dataTermino || null,
      productivity: p.productivity,
      holidays: p.holidays,
      trecho_overrides: p.trechoOverrides,
      service_notes: p.serviceNotes,
      trecho_metadata: [],
      grouping_mode: "trecho",
      total_metros: p.totalMetros,
      total_dias: p.totalDias,
      custo_total: p.custoTotal,
    }, { onConflict: "id" });
  }
}

async function loadPlansFromSupabase(): Promise<SavedPlanning[] | null> {
  try {
    const userId = await getPlanUserId();
    let query = supabase
      .from("hydro_saved_plans")
      .select("*")
      .order("updated_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        criadoEm: r.created_at,
        atualizadoEm: r.updated_at,
        numEquipes: r.num_equipes,
        teamConfig: r.team_config,
        metrosDia: Number(r.metros_dia),
        dataInicio: r.data_inicio || "",
        dataTermino: r.data_termino || "",
        horasTrabalho: Number(r.horas_trabalho),
        workDays: r.work_days as WorkDays,
        holidays: r.holidays || [],
        productivity: r.productivity || [],
        trechoOverrides: r.trecho_overrides || {},
        serviceNotes: r.service_notes || [],
        totalMetros: r.total_metros ? Number(r.total_metros) : undefined,
        totalDias: r.total_dias ? Number(r.total_dias) : undefined,
        custoTotal: r.custo_total ? Number(r.custo_total) : undefined,
      }));
    }
  } catch {
    // fallback
  }
  return null;
}

function exportPlanAsJSON(plan: SavedPlanning) {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planejamento_${plan.nome.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importPlanFromJSON(file: File): Promise<SavedPlanning> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const plan = JSON.parse(reader.result as string);
        if (!plan.nome || !plan.numEquipes) throw new Error("Arquivo inválido");
        plan.id = crypto.randomUUID();
        plan.criadoEm = new Date().toISOString();
        plan.atualizadoEm = new Date().toISOString();
        resolve(plan);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

interface PlanningModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  networkSummary: NetworkSummary | null;
  scheduleResult: ScheduleResult | null;
  setScheduleResult: (r: ScheduleResult | null) => void;
}

// ── Default SINAPI/SEINFRA/TCPO productivity data ──
const DEFAULT_PRODUCTIVITY: ProductivityEntry[] = [
  { servico: "Assentamento tubo PVC DN200", unidade: "m", produtividade: 35, fonte: "SEINFRA" },
  { servico: "Reaterro compactado", unidade: "m³", produtividade: 25, fonte: "SINAPI" },
  { servico: "Escoramento contínuo", unidade: "m²", produtividade: 15, fonte: "TCPO" },
  { servico: "Lastro de brita", unidade: "m³", produtividade: 20, fonte: "SINAPI" },
  { servico: "Recomposição asfalto (CBUQ)", unidade: "m²", produtividade: 80, fonte: "SEINFRA" },
  { servico: "Poço de visita (PV) h≤2m", unidade: "un", produtividade: 1, fonte: "SINAPI" },
  { servico: "Poço de visita (PV) h>2m", unidade: "un", produtividade: 0.5, fonte: "SINAPI" },
  { servico: "Teste de estanqueidade", unidade: "m", produtividade: 200, fonte: "SEINFRA" },
];

const BRAZILIAN_HOLIDAYS_2026: Holiday[] = [
  { date: "2026-01-01", name: "Confraternização Universal" },
  { date: "2026-02-16", name: "Carnaval" },
  { date: "2026-02-17", name: "Carnaval" },
  { date: "2026-04-03", name: "Sexta-feira Santa" },
  { date: "2026-04-21", name: "Tiradentes" },
  { date: "2026-05-01", name: "Dia do Trabalho" },
  { date: "2026-06-04", name: "Corpus Christi" },
  { date: "2026-09-07", name: "Independência" },
  { date: "2026-10-12", name: "N.S. Aparecida" },
  { date: "2026-11-02", name: "Finados" },
  { date: "2026-11-15", name: "Proclamação da República" },
  { date: "2026-12-25", name: "Natal" },
];

const fmt = (n: number, d = 2) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtCurrency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PlanningModule({ pontos, trechos, networkSummary, scheduleResult, setScheduleResult }: PlanningModuleProps) {
  // ── Data Loading ──
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── Team Config ──
  const [numEquipes, setNumEquipes] = useState(2);
  const [teamConfig, setTeamConfig] = useState<TeamConfig>({ ...DEFAULT_TEAM_CONFIG });
  const [profManualMax, setProfManualMax] = useState(1.25);

  // ── Productivity ──
  const [metrosDia, setMetrosDia] = useState(12);
  const [ganttMode, setGanttMode] = useState<GanttMode>("segment");
  const [groupByProximity, setGroupByProximity] = useState(false);

  // ── Execution Period ──
  const [dataInicio, setDataInicio] = useState("2026-02-14");
  const [dataTermino, setDataTermino] = useState("");
  const [horasTrabalho, setHorasTrabalho] = useState(8);
  const [workDays, setWorkDays] = useState<WorkDays>(5);
  const [diasUteis, setDiasUteis] = useState<number | null>(null);

  // ── Holidays ──
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  // ── Productivity Table ──
  const [productivity, setProductivity] = useState<ProductivityEntry[]>([...DEFAULT_PRODUCTIVITY]);
  const [newServico, setNewServico] = useState("");
  const [newUnidade, setNewUnidade] = useState("m");
  const [newProd, setNewProd] = useState(10);
  const [newFonte, setNewFonte] = useState("SINAPI");

  // ── Histogram controls ──
  const [histView, setHistView] = useState<HistogramView>("daily");
  const [histFilter, setHistFilter] = useState<HistogramFilter>("all");

  // ── Saved Plans ──
  const [savedPlans, setSavedPlans] = useState<SavedPlanning[]>(loadSavedPlans());
  const [showSavedPlans, setShowSavedPlans] = useState(false);

  // Load from Supabase on mount (merge with localStorage)
  useEffect(() => {
    loadPlansFromSupabase().then(plans => {
      if (plans && plans.length > 0) {
        setSavedPlans(plans);
        localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(plans));
      }
    });
  }, []);
  const [savePlanName, setSavePlanName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [currentPlanName, setCurrentPlanName] = useState("");

  // ── Trecho Overrides (editable trechos in planning) ──
  const [trechoOverrides, setTrechoOverrides] = useState<Record<string, TrechoOverride>>({});
  const [trechoMetadata, setTrechoMetadata] = useState<TrechoMetadata[]>([]);
  const [showTrechoEditor, setShowTrechoEditor] = useState(false);

  // ── Grouping Mode ──
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("trecho");

  // ── Service Notes ──
  const [serviceNotes, setServiceNotes] = useState<ServiceNote[]>([]);
  const [showServiceNotes, setShowServiceNotes] = useState(false);
  const [editingNote, setEditingNote] = useState<ServiceNote | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);

  // ── Add Service Form ──
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);

  // ── Selected Gantt cell for interactivity ──
  const [selectedGanttCell, setSelectedGanttCell] = useState<{ trechoId: string; day: number } | null>(null);

  // ── Load platform data ──
  const handleLoadPlatformData = useCallback(() => {
    if (trechos.length === 0) {
      toast.error("Carregue dados na aba Topografia primeiro.");
      return;
    }
    setDataLoaded(true);
    toast.success("Dados carregados da plataforma!");
  }, [trechos]);

  // ── Calculate business days ──
  const calculateBusinessDays = useCallback(() => {
    if (!dataInicio || !dataTermino) { toast.error("Defina início e término."); return; }
    const start = new Date(dataInicio);
    const end = new Date(dataTermino);
    if (end <= start) { toast.error("Data de término deve ser posterior ao início."); return; }
    let count = 0;
    const current = new Date(start);
    const holidayDates = new Set(holidays.map(h => h.date));
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split("T")[0];
      const isWorkDay = workDays === 7 || (workDays === 6 ? dayOfWeek !== 0 : (dayOfWeek !== 0 && dayOfWeek !== 6));
      if (isWorkDay && !holidayDates.has(dateStr)) count++;
      current.setDate(current.getDate() + 1);
    }
    setDiasUteis(count);
    toast.success(`${count} dias úteis calculados.`);
  }, [dataInicio, dataTermino, workDays, holidays]);

  // ── Check active lean constraints ──
  const checkActiveConstraints = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;

      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .in('status', ['active'])
        .limit(1);

      if (!projects || projects.length === 0) return;

      // LPS constraint check uses localStorage — no Supabase query needed
    } catch {
      // Silently ignore constraint check errors
    }
  }, []);

  // ── Save/Load Plans ──
  const handleSavePlan = useCallback((name: string) => {
    const plan: SavedPlanning = {
      id: editingPlanId || crypto.randomUUID(),
      nome: name,
      criadoEm: editingPlanId ? savedPlans.find(p => p.id === editingPlanId)?.criadoEm || new Date().toISOString() : new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      numEquipes,
      teamConfig: { ...teamConfig },
      metrosDia,
      dataInicio,
      dataTermino,
      horasTrabalho,
      workDays,
      holidays: [...holidays],
      productivity: [...productivity],
      trechoOverrides: { ...trechoOverrides },
      serviceNotes: [...serviceNotes],
      totalMetros: trechos.reduce((s, t) => s + t.comprimento, 0),
      totalDias: scheduleResult?.totalDays,
      custoTotal: scheduleResult?.allSegments.reduce((s, seg) => s + seg.custoTotal, 0),
    };
    const updated = editingPlanId
      ? savedPlans.map(p => p.id === editingPlanId ? plan : p)
      : [...savedPlans, plan];
    setSavedPlans(updated);
    savePlansToStorage(updated);
    setEditingPlanId(plan.id);
    setShowSaveDialog(false);
    setSavePlanName("");
    toast.success(editingPlanId ? `Planejamento "${name}" atualizado!` : `Planejamento "${name}" salvo!`);
  }, [editingPlanId, savedPlans, numEquipes, teamConfig, metrosDia, dataInicio, dataTermino, horasTrabalho, workDays, holidays, productivity, trechoOverrides, serviceNotes, trechos, scheduleResult]);

  const handleLoadPlan = useCallback((plan: SavedPlanning | SavedPlan) => {
    // Support both SavedPlanning (local) and SavedPlan (from SavedPlansDialog)
    const planName = 'nome' in plan ? plan.nome : plan.name;
    setNumEquipes(plan.numEquipes);
    setTeamConfig({ ...plan.teamConfig });
    setMetrosDia(plan.metrosDia);
    setDataInicio(plan.dataInicio);
    setDataTermino(plan.dataTermino);
    setHorasTrabalho(plan.horasTrabalho);
    setWorkDays(plan.workDays);
    setHolidays([...(plan.holidays || [])]);
    setProductivity([...(plan.productivity || [])]);
    if ('trechoOverrides' in plan) {
      setTrechoOverrides({ ...plan.trechoOverrides });
    }
    if ('serviceNotes' in plan) {
      setServiceNotes([...plan.serviceNotes]);
    }
    if ('trechoMetadata' in plan && Array.isArray(plan.trechoMetadata)) {
      setTrechoMetadata([...plan.trechoMetadata]);
    }
    setEditingPlanId(plan.id);
    setCurrentPlanName(planName);
    setDataLoaded(true);
    setShowSavedPlans(false);
    toast.success(`Planejamento "${planName}" carregado!`);
  }, []);

  const handleDuplicatePlan = useCallback((plan: SavedPlanning) => {
    const dup: SavedPlanning = {
      ...plan,
      id: crypto.randomUUID(),
      nome: `${plan.nome} (Cópia)`,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    const updated = [...savedPlans, dup];
    setSavedPlans(updated);
    savePlansToStorage(updated);
    toast.success(`Planejamento duplicado: "${dup.nome}"`);
  }, [savedPlans]);

  const handleDeletePlan = useCallback((planId: string) => {
    const updated = savedPlans.filter(p => p.id !== planId);
    setSavedPlans(updated);
    savePlansToStorage(updated);
    supabase.from("hydro_saved_plans").delete().eq("id", planId).then(() => {});
    if (editingPlanId === planId) setEditingPlanId(null);
    toast.success("Planejamento excluído!");
  }, [savedPlans, editingPlanId]);

  // ── Service Note handlers ──
  const handleSaveNote = useCallback((note: ServiceNote) => {
    const updated = note.id && serviceNotes.find(n => n.id === note.id)
      ? serviceNotes.map(n => n.id === note.id ? note : n)
      : [...serviceNotes, { ...note, id: note.id || crypto.randomUUID() }];
    setServiceNotes(updated);
    setShowNoteDialog(false);
    setEditingNote(null);
    toast.success("Nota de serviço salva!");
  }, [serviceNotes]);

  const handleDeleteNote = useCallback((noteId: string) => {
    setServiceNotes(serviceNotes.filter(n => n.id !== noteId));
    toast.success("Nota de serviço excluída!");
  }, [serviceNotes]);

  // ── Generate schedule ──
  const handleGenerateSchedule = useCallback(() => {
    if (trechos.length === 0) { toast.error("Carregue dados primeiro."); return; }
    const config: TeamConfig = { ...teamConfig, metrosDiaBase: metrosDia, hoursPerDay: horasTrabalho };
    const result = generateFullSchedule(trechos, numEquipes, config, new Date(dataInicio));

    // Set end date
    const endDate = new Date(dataInicio);
    endDate.setDate(endDate.getDate() + result.totalDays);
    setDataTermino(endDate.toISOString().split("T")[0]);

    setScheduleResult(result);
    setDataLoaded(true);
    toast.success(`Planejamento gerado: ${result.totalDays} dias, ${trechos.length} trechos.`);

    // Check for active lean constraints
    checkActiveConstraints();
  }, [trechos, numEquipes, teamConfig, metrosDia, horasTrabalho, dataInicio, setScheduleResult, checkActiveConstraints]);


  // ── Get trecho display name ──
  const getTrechoDisplayName = useCallback((trechoId: string, fallbackIdx: number) => {
    const meta = trechoMetadata.find(m => m.trechoKey === trechoId);
    if (meta?.nomeTrecho) return meta.nomeTrecho;
    return `T${String(fallbackIdx + 1).padStart(2, "0")}`;
  }, [trechoMetadata]);

  // ── Computed ──
  const totalMetros = useMemo(() => trechos.reduce((s, t) => s + t.comprimento, 0), [trechos]);
  const totalEscavacao = useMemo(() => {
    return trechos.reduce((s, t) => {
      const largura = Math.max(0.6, t.diametroMm / 1000 + 0.4);
      const prof = Math.abs(t.cotaInicio - t.cotaFim) || 1.5;
      return s + t.comprimento * largura * prof;
    }, 0);
  }, [trechos]);
  const totalActivities = useMemo(() => scheduleResult?.allSegments.length || 0, [scheduleResult]);
  const totalCost = useMemo(() => scheduleResult?.allSegments.reduce((s, seg) => s + seg.custoTotal, 0) || 0, [scheduleResult]);
  const workersPerTeam = teamConfig.encarregado + teamConfig.oficiais + teamConfig.ajudantes + teamConfig.operador;

  // ── Gantt data with grouping support ──
  const ganttData = useMemo(() => {
    if (!scheduleResult) return [];
    const { allSegments, totalDays } = scheduleResult;

    // First group by trecho
    const trechoMap = new Map<string, DailySegment[]>();
    allSegments.forEach(seg => {
      if (!trechoMap.has(seg.trechoId)) trechoMap.set(seg.trechoId, []);
      trechoMap.get(seg.trechoId)!.push(seg);
    });

    // If grouping mode is "trecho" (detailed), show per trecho
    if (groupingMode === "trecho") {
      return Array.from(trechoMap.entries()).map(([trechoId, segs], idx) => {
        const totalMeters = segs.reduce((s, seg) => s + seg.meters, 0);
        const days: Record<number, { meters: number; isTest: boolean }> = {};
        segs.forEach(seg => { days[seg.day] = { meters: seg.meters, isTest: false }; });
        const lastDay = segs.length > 0 ? segs.reduce((m, s) => s.day > m ? s.day : m, segs[0].day) : 0;
        if (lastDay + 1 <= totalDays) days[lastDay + 1] = { meters: 0, isTest: true };
        const displayName = getTrechoDisplayName(trechoId, idx);
        return { id: displayName, trechoId, meters: Math.round(totalMeters), days, totalDays };
      });
    }

    // For grouped modes, aggregate trechos by the grouping key
    const getGroupKey = (trechoId: string, idx: number): string => {
      const trecho = trechos[idx];
      const meta = trechoMetadata.find(m => m.trechoKey === trechoId);
      if (groupingMode === "frente") {
        return meta?.frenteServico || trecho?.frenteServico || "Sem Frente";
      }
      if (groupingMode === "lote") {
        return meta?.lote || trecho?.lote || "Sem Lote";
      }
      if (groupingMode === "rede") {
        return meta?.tipoRedeManual || trecho?.tipoRedeManual || "esgoto";
      }
      return `T${String(idx + 1).padStart(2, "0")}`;
    };

    // Build group map
    const groupMap = new Map<string, { segs: DailySegment[]; trechoCount: number }>();
    let idx = 0;
    for (const [trechoId, segs] of trechoMap.entries()) {
      const key = getGroupKey(trechoId, idx);
      if (!groupMap.has(key)) groupMap.set(key, { segs: [], trechoCount: 0 });
      const group = groupMap.get(key)!;
      group.segs.push(...segs);
      group.trechoCount++;
      idx++;
    }

    return Array.from(groupMap.entries()).map(([groupName, { segs, trechoCount }]) => {
      const totalMeters = segs.reduce((s, seg) => s + seg.meters, 0);
      const days: Record<number, { meters: number; isTest: boolean }> = {};
      segs.forEach(seg => {
        if (!days[seg.day]) days[seg.day] = { meters: 0, isTest: false };
        days[seg.day].meters += seg.meters;
      });
      const redeIconComponents: Record<string, React.ReactNode> = {
        agua: <Droplets className="h-4 w-4 inline-block mr-1" />,
        esgoto: null,
        drenagem: <CloudRain className="h-4 w-4 inline-block mr-1" />,
        recalque: <ArrowUp className="h-4 w-4 inline-block mr-1" />,
      };
      const displayName = groupingMode === "rede"
        ? `${groupName} (${trechoCount} tr.)`
        : `${groupName} (${trechoCount} tr.)`;
      const displayLabel = groupingMode === "rede"
        ? <>{redeIconComponents[groupName]}{groupName} ({trechoCount} tr.)</>
        : <>{groupName} ({trechoCount} tr.)</>;
      return { id: displayName, label: displayLabel, trechoId: groupName, meters: Math.round(totalMeters), days, totalDays };
    });
  }, [scheduleResult, getTrechoDisplayName, groupingMode, trechos, trechoMetadata]);

  // ── Histogram stats ──
  const histStats = useMemo(() => {
    if (!scheduleResult) return { peakLabor: 0, avgDaily: 0, totalHH: 0, equipDays: 0 };
    const hist = scheduleResult.histogram;
    const peakLabor = hist.length > 0 ? hist.reduce((m, h) => h.labor > m ? h.labor : m, 0) : 0;
    const avgDaily = hist.length > 0 ? hist.reduce((s, h) => s + h.labor, 0) / hist.length : 0;
    const totalHH = hist.reduce((s, h) => s + h.labor * horasTrabalho, 0);
    const equipDays = hist.reduce((s, h) => s + h.equipment, 0);
    return { peakLabor, avgDaily: parseFloat(avgDaily.toFixed(1)), totalHH, equipDays };
  }, [scheduleResult, horasTrabalho]);

  // ── Inverse Calculator ──
  const [inverseMode, setInverseMode] = useState(false);
  const [inverseFixedField, setInverseFixedField] = useState<"equipes" | "metros">("equipes");
  const [inverseDataTermino, setInverseDataTermino] = useState("");

  const inverseResult = useMemo(() => {
    if (!inverseMode || !dataInicio || !inverseDataTermino) return null;
    const start = new Date(dataInicio);
    const end = new Date(inverseDataTermino);
    if (end <= start) return null;

    // Calculate business days
    let businessDays = 0;
    const current = new Date(start);
    const holidayDates = new Set(holidays.map(h => h.date));
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split("T")[0];
      const isWorkDay = workDays === 7 || (workDays === 6 ? dayOfWeek !== 0 : (dayOfWeek !== 0 && dayOfWeek !== 6));
      if (isWorkDay && !holidayDates.has(dateStr)) businessDays++;
      current.setDate(current.getDate() + 1);
    }

    if (businessDays <= 0) return null;

    const total = totalMetros || trechos.reduce((s, t) => s + t.comprimento, 0);
    if (total <= 0) return null;

    if (inverseFixedField === "equipes") {
      // Fixed: numEquipes → calculate metrosDia needed
      const neededMetrosDia = total / (businessDays * numEquipes);
      return { businessDays, totalMetros: total, metrosDia: neededMetrosDia, equipes: numEquipes };
    } else {
      // Fixed: metrosDia → calculate equipes needed
      const neededEquipes = Math.ceil(total / (businessDays * metrosDia));
      return { businessDays, totalMetros: total, metrosDia, equipes: neededEquipes };
    }
  }, [inverseMode, dataInicio, inverseDataTermino, holidays, workDays, totalMetros, trechos, numEquipes, metrosDia, inverseFixedField]);

  // ── Spreadsheet Export / Import ──
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleExportPlanningExcel = useCallback(() => {
    if (!scheduleResult) { toast.error("Gere o planejamento primeiro."); return; }
    const wb = XLSX.utils.book_new();

    // Sheet 1: Trechos + Custos
    const trechoData = trechos.map((t, idx) => {
      const ov = trechoOverrides[`${t.idInicio}-${t.idFim}`] || {};
      const segs = scheduleResult.allSegments.filter(s => s.trechoId === `${t.idInicio}-${t.idFim}`);
      const custo = segs.reduce((s, seg) => s + seg.custoTotal, 0);
      return {
        "#": idx + 1,
        "Trecho": ov.nome || t.nomeTrecho || `${t.idInicio} → ${t.idFim}`,
        "ID Início": t.idInicio,
        "ID Fim": t.idFim,
        "Comprimento (m)": Math.round((ov.comprimento ?? t.comprimento) * 100) / 100,
        "Profundidade (m)": Math.round((ov.profundidade ?? (Math.abs(t.cotaInicio - t.cotaFim) || 1.5)) * 100) / 100,
        "Diâmetro (mm)": ov.diametroMm ?? t.diametroMm,
        "Tipo Rede": t.tipoRedeManual || t.tipoRede || "",
        "Material": t.material,
        "Custo Total (R$)": Math.round(custo * 100) / 100,
        "Produtividade (m/dia)": ov.produtividadeDia ?? metrosDia,
        "Prioridade": ov.prioridade ?? 0,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trechoData), "Trechos e Custos");

    // Sheet 2: Cronograma
    const schedData = scheduleResult.allSegments.map(seg => ({
      "Trecho": seg.trechoId,
      "Dia": seg.day,
      "Equipe": seg.team,
      "Metros": Math.round(seg.meters * 100) / 100,
      "Custo (R$)": Math.round(seg.custoTotal * 100) / 100,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(schedData), "Cronograma");

    // Sheet 3: Resumo
    const resumo = [
      { "Indicador": "Total de Trechos", "Valor": trechos.length },
      { "Indicador": "Comprimento Total (m)", "Valor": Math.round(totalMetros * 100) / 100 },
      { "Indicador": "Custo Total (R$)", "Valor": Math.round(totalCost * 100) / 100 },
      { "Indicador": "Total de Dias", "Valor": scheduleResult.totalDays },
      { "Indicador": "Equipes", "Valor": numEquipes },
      { "Indicador": "Metros/dia", "Valor": metrosDia },
      { "Indicador": "Data Início", "Valor": dataInicio },
      { "Indicador": "Data Término", "Valor": dataTermino },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");

    // Sheet 4: Produtividades
    const prodData = productivity.map(p => ({
      "Serviço": p.servico,
      "Unidade": p.unidade,
      "Produtividade": p.produtividade,
      "Fonte": p.fonte,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodData), "Produtividades");

    XLSX.writeFile(wb, `planejamento_${dataInicio || "export"}.xlsx`);
    toast.success("Planilha de planejamento exportada!");
  }, [scheduleResult, trechos, trechoOverrides, metrosDia, totalMetros, totalCost, numEquipes, dataInicio, dataTermino, productivity]);

  const handleImportPlanningExcel = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      // Try to read "Trechos e Custos" sheet
      const trechoSheet = wb.Sheets["Trechos e Custos"] || wb.Sheets[wb.SheetNames[0]];
      if (!trechoSheet) { toast.error("Planilha sem aba de trechos."); return; }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(trechoSheet);
      if (rows.length === 0) { toast.error("Planilha vazia."); return; }

      // Apply overrides from imported spreadsheet
      const newOverrides: Record<string, TrechoOverride> = { ...trechoOverrides };
      let applied = 0;
      for (const row of rows) {
        const idInicio = String(row["ID Início"] || row["ID Inicio"] || "").trim();
        const idFim = String(row["ID Fim"] || "").trim();
        if (!idInicio || !idFim) continue;
        const key = `${idInicio}-${idFim}`;
        const trecho = trechos.find(t => t.idInicio === idInicio && t.idFim === idFim);
        if (!trecho) continue;

        const ov: TrechoOverride = newOverrides[key] || {};
        const nome = row["Trecho"] ? String(row["Trecho"]) : undefined;
        const comp = row["Comprimento (m)"] ? Number(String(row["Comprimento (m)"]).replace(",", ".")) : undefined;
        const prof = row["Profundidade (m)"] ? Number(String(row["Profundidade (m)"]).replace(",", ".")) : undefined;
        const dn = row["Diâmetro (mm)"] || row["Diametro (mm)"] ? Number(String(row["Diâmetro (mm)"] || row["Diametro (mm)"]).replace(",", ".")) : undefined;
        const prod = row["Produtividade (m/dia)"] ? Number(String(row["Produtividade (m/dia)"]).replace(",", ".")) : undefined;
        const prio = row["Prioridade"] != null ? Number(row["Prioridade"]) : undefined;

        if (nome) ov.nome = nome;
        if (comp && comp > 0) ov.comprimento = comp;
        if (prof && prof > 0) ov.profundidade = prof;
        if (dn && dn > 0) ov.diametroMm = dn;
        if (prod && prod > 0) ov.produtividadeDia = prod;
        if (prio != null && !isNaN(prio)) ov.prioridade = prio;
        newOverrides[key] = ov;
        applied++;
      }

      // Also try to import productivities
      const prodSheet = wb.Sheets["Produtividades"];
      if (prodSheet) {
        const prodRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(prodSheet);
        if (prodRows.length > 0) {
          const importedProd: ProductivityEntry[] = prodRows.map(r => ({
            servico: String(r["Serviço"] || r["Servico"] || ""),
            unidade: String(r["Unidade"] || "m"),
            produtividade: Number(String(r["Produtividade"] || "0").replace(",", ".")) || 0,
            fonte: String(r["Fonte"] || "Importado"),
          })).filter(p => p.servico && p.produtividade > 0);
          if (importedProd.length > 0) setProductivity(importedProd);
        }
      }

      setTrechoOverrides(newOverrides);
      toast.success(`${applied} trechos atualizados a partir da planilha importada.`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar planilha.");
    }
    if (importFileRef.current) importFileRef.current.value = "";
  }, [trechos, trechoOverrides]);

  // ── Technical Rules ──
  const technicalRules = [
    "Método de escavação vs profundidade",
    "Necessidade de escoramento (prof + solo)",
    "Presença de água → ativação de drenagem",
    "Largura da vala vs diâmetro do tubo",
    "Sequência lógica de atividades",
  ];

  return (
    <div className="space-y-6">
      {/* Saved Plans Toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button variant="outline" size="sm" onClick={() => setShowSavedPlans(!showSavedPlans)}>
          <FolderOpen className="h-4 w-4 mr-1" /> Planejamentos Salvos
        </Button>
        <Button variant="outline" size="sm" onClick={() => {
          if (currentPlanName) {
            handleSavePlan(currentPlanName);
          } else {
            setShowSaveDialog(true);
          }
        }}>
          <Save className="h-4 w-4 mr-1" /> {editingPlanId ? "Salvar" : "Salvar Como"}
        </Button>
        {currentPlanName && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Ativo: {currentPlanName}
            </Badge>
            <Input
              value={currentPlanName}
              onChange={e => setCurrentPlanName(e.target.value)}
              className="h-7 w-48 text-xs"
              placeholder="Nome do planejamento"
            />
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            variant={showTrechoEditor ? "default" : "outline"}
            size="sm"
            onClick={() => setShowTrechoEditor(!showTrechoEditor)}
          >
            <Edit className="h-4 w-4 mr-1" /> Editor de Trechos
          </Button>
          <Select value={groupingMode} onValueChange={v => setGroupingMode(v as GroupingMode)}>
            <SelectTrigger className="h-8 w-48 text-sm">
              <Layers className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Agrupamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trecho">Detalhado (por trecho)</SelectItem>
              <SelectItem value="frente">Agrupado por Frente</SelectItem>
              <SelectItem value="lote">Agrupado por Lote/Area</SelectItem>
              <SelectItem value="rede">Agrupado por Tipo de Rede</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Saved Plans Dialog */}
      {showSavedPlans && (
        <SavedPlansDialog
          onLoadPlan={handleLoadPlan}
          onClose={() => setShowSavedPlans(false)}
          currentPlanId={currentPlanId || undefined}
        />
      )}

      {/* Trecho Editor Panel */}
      {showTrechoEditor && trechos.length > 0 && (
        <TrechoEditorPanel
          trechos={trechos}
          metadata={trechoMetadata}
          onMetadataChange={setTrechoMetadata}
        />
      )}

      {/* Same-Day Completion Rule */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-700 dark:text-yellow-400">Regra: Same-Day Completion</p>
              <p className="text-sm text-muted-foreground">Escavação → Assentamento → Reaterro no mesmo dia. A vala é fechada no mesmo dia de abertura.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 1: Data + Team + Productivity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Data Loading */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5" /> Dados para Planejamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Carregue os dados da própria plataforma ou importe de arquivo externo.</p>
            <div className="border-2 border-primary/20 p-4 bg-primary/5">
              <h4 className="font-semibold text-sm mb-1">Usar Dados da Plataforma</h4>
              <p className="text-xs text-muted-foreground mb-3">Importa automaticamente os trechos e quantitativos já calculados nas outras abas.</p>
              <Button variant="outline" className="w-full" onClick={handleLoadPlatformData}>
                <Download className="h-4 w-4 mr-2" /> Carregar Dados da Plataforma
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Dados disponíveis: {pontos.length} pontos, {trechos.length} trechos
              </p>
            </div>

            {dataLoaded && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-green-600 font-semibold text-sm">✓ Dados Carregados</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Trechos", value: trechos.length, color: "text-blue-600" },
                    { label: "Metros", value: Math.round(totalMetros), color: "text-green-600" },
                    { label: "m³ Escavação", value: Math.round(totalEscavacao), color: "text-orange-600" },
                    { label: "Atividades", value: totalActivities, color: "text-purple-600" },
                  ].map((s, i) => (
                    <div key={i} className="text-center">
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-green-600">✓ Dados carregados com sucesso! Clique em "Gerar Planejamento".</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" /> Configuração de Equipes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Configure as equipes de trabalho para o planejamento.</p>
            <div>
              <Label>Número de Equipes</Label>
              <Input type="number" min={1} max={10} value={numEquipes} onChange={e => setNumEquipes(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Equipes trabalhando em paralelo</p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">Composição da Equipe Padrão:</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Encarregado</Label><Input type="number" min={0} value={teamConfig.encarregado} onChange={e => setTeamConfig({ ...teamConfig, encarregado: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Oficiais</Label><Input type="number" min={0} value={teamConfig.oficiais} onChange={e => setTeamConfig({ ...teamConfig, oficiais: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Ajudantes</Label><Input type="number" min={0} value={teamConfig.ajudantes} onChange={e => setTeamConfig({ ...teamConfig, ajudantes: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Operador</Label><Input type="number" min={0} value={teamConfig.operador} onChange={e => setTeamConfig({ ...teamConfig, operador: Number(e.target.value) })} /></div>
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">Equipamentos por Equipe:</p>
              <div className="space-y-2">
                {[
                  { key: "hasRetro" as const, label: "Retroescavadeira" },
                  { key: "hasCompactor" as const, label: "Compactador" },
                  { key: "hasTruck" as const, label: "Caminhão Basculante" },
                  { key: "hasPump" as const, label: "Bomba de Esgotamento" },
                ].map(eq => (
                  <div key={eq.key} className="flex items-center gap-2">
                    <Checkbox
                      checked={teamConfig[eq.key]}
                      onCheckedChange={v => setTeamConfig({ ...teamConfig, [eq.key]: !!v })}
                    />
                    <span className="text-sm">{eq.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Profundidade Máxima para Escavação Manual (m)</Label>
              <Input type="number" step={0.05} value={profManualMax} onChange={e => setProfManualMax(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Acima disso, usa retroescavadeira obrigatoriamente</p>
            </div>
          </CardContent>
        </Card>

        {/* Productivity Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5" /> Parâmetros de Produtividade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Configure a produtividade e o modo de visualização do cronograma.</p>
            <div>
              <Label className="font-semibold">Metros por Dia (Base)</Label>
              <Input type="number" min={1} max={50} value={metrosDia} onChange={e => setMetrosDia(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Produtividade base em condições normais (profundidade {"<"} 1.5m, DN150). Aumente para dias mais corridos com mais metros executados.</p>
            </div>
            <div>
              <Label className="font-semibold">Modo de Agrupamento do Gantt</Label>
              <Select value={ganttMode} onValueChange={v => setGanttMode(v as GanttMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="segment">Por Segmento Diário (mais detalhado)</SelectItem>
                  <SelectItem value="trecho">Por Trecho Completo (menos linhas)</SelectItem>
                  <SelectItem value="trecho_activity">Por Trecho + Atividade (ciclo completo)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Escolha "Por Trecho Completo" para um Gantt mais limpo com menos linhas.</p>
            </div>
            <div>
              <Label className="font-semibold">Agrupar Trechos por Proximidade</Label>
              <div className="flex items-center gap-2 mt-1">
                <Checkbox checked={groupByProximity} onCheckedChange={v => setGroupByProximity(!!v)} />
                <span className="text-sm">Agrupa trechos próximos para otimizar a execução sequencial</span>
              </div>
            </div>
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300">
              <CardContent className="pt-3 pb-3">
                <p className="font-semibold text-sm text-yellow-700 dark:text-yellow-400"><Lightbulb className="h-4 w-4 inline-block mr-1" />Dica: Dias Mais Corridos</p>
                <ul className="text-xs text-muted-foreground mt-1 space-y-1 list-disc pl-4">
                  <li>Aumente os "Metros por Dia" (ex: 15-20 m/dia)</li>
                  <li>Selecione "Por Trecho Completo" no modo de agrupamento</li>
                  <li>Aumente o número de equipes trabalhando em paralelo</li>
                </ul>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Execution Period + Holidays */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5" /> Período de Execução
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Defina as datas de início e fim previsto da obra.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data de Início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
              <div><Label>Data de Término (Previsão)</Label><Input type="date" value={dataTermino} onChange={e => setDataTermino(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Horas de Trabalho/Dia</Label><Input type="number" min={4} max={12} value={horasTrabalho} onChange={e => setHorasTrabalho(Number(e.target.value))} /></div>
              <div>
                <Label>Dias da Semana</Label>
                <Select value={String(workDays)} onValueChange={v => setWorkDays(Number(v) as WorkDays)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Segunda a Sexta (5 dias)</SelectItem>
                    <SelectItem value="6">Segunda a Sábado (6 dias)</SelectItem>
                    <SelectItem value="7">Todos os dias (7 dias)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-primary font-medium">Dias úteis calculados: {diasUteis ?? "-"}</p>
              <Button size="sm" onClick={calculateBusinessDays}>Recalcular</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              🎉 Gestão de Feriados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Adicione feriados que não serão contados como dias úteis.</p>
            <div className="flex gap-2">
              <Input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} className="flex-1" />
              <Input placeholder="Nome do feriado" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} className="flex-1" />
              <Button size="sm" onClick={() => {
                if (!newHolidayDate || !newHolidayName) return;
                setHolidays([...holidays, { date: newHolidayDate, name: newHolidayName }]);
                setNewHolidayDate(""); setNewHolidayName("");
              }}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => {
                setHolidays(BRAZILIAN_HOLIDAYS_2026);
                toast.success("Feriados nacionais 2026 carregados.");
              }}>🇧🇷 Carregar Feriados Nacionais</Button>
              <Button variant="destructive" size="sm" onClick={() => setHolidays([])}>
                <Trash2 className="h-4 w-4 mr-1" /> Limpar Todos
              </Button>
            </div>
            <div className="max-h-[150px] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Feriado</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader>
                <TableBody>
                  {holidays.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">Nenhum feriado cadastrado</TableCell></TableRow>
                  ) : holidays.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{new Date(h.date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-sm">{h.name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setHolidays(holidays.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inverse Calculator */}
      <Card className={inverseMode ? "border-blue-500/30 bg-blue-500/5" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5" /> Calculadora Inversa
            </CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox checked={inverseMode} onCheckedChange={v => setInverseMode(!!v)} />
              <Label className="text-sm cursor-pointer" onClick={() => setInverseMode(!inverseMode)}>Ativar</Label>
            </div>
          </div>
        </CardHeader>
        {inverseMode && (
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Defina a data de término desejada e descubra quantas equipes ou metros/dia são necessários para cumprir o prazo.
              Este cálculo é apenas informativo e não altera o planejamento atual.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Data de Início</Label>
                <Input type="date" value={dataInicio} disabled className="h-8 text-sm bg-muted" />
              </div>
              <div>
                <Label className="text-xs">Data de Término Desejada</Label>
                <Input type="date" value={inverseDataTermino} onChange={e => setInverseDataTermino(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Fixar campo</Label>
                <Select value={inverseFixedField} onValueChange={v => setInverseFixedField(v as "equipes" | "metros")}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipes">Fixar Equipes ({numEquipes}) → Calcular m/dia</SelectItem>
                    <SelectItem value="metros">Fixar m/dia ({metrosDia}) → Calcular equipes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Total de Metros</Label>
                <Input type="text" value={`${Math.round(totalMetros || trechos.reduce((s, t) => s + t.comprimento, 0))} m`} disabled className="h-8 text-sm bg-muted" />
              </div>
            </div>

            {inverseResult && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-blue-500/30">
                  <CardContent className="pt-3 pb-3 text-center">
                    <div className="text-xl font-bold text-blue-600">{inverseResult.businessDays}</div>
                    <div className="text-xs text-muted-foreground">Dias Úteis</div>
                  </CardContent>
                </Card>
                <Card className="border-green-500/30">
                  <CardContent className="pt-3 pb-3 text-center">
                    <div className="text-xl font-bold text-green-600">{Math.round(inverseResult.totalMetros)} m</div>
                    <div className="text-xs text-muted-foreground">Total de Metros</div>
                  </CardContent>
                </Card>
                <Card className={inverseFixedField === "metros" ? "border-orange-500/50 bg-orange-500/10" : "border-border"}>
                  <CardContent className="pt-3 pb-3 text-center">
                    <div className="text-xl font-bold text-orange-600">{inverseResult.equipes}</div>
                    <div className="text-xs text-muted-foreground">{inverseFixedField === "metros" ? "Equipes Necessárias" : "Equipes (fixo)"}</div>
                  </CardContent>
                </Card>
                <Card className={inverseFixedField === "equipes" ? "border-purple-500/50 bg-purple-500/10" : "border-border"}>
                  <CardContent className="pt-3 pb-3 text-center">
                    <div className="text-xl font-bold text-purple-600">{fmt(inverseResult.metrosDia)}</div>
                    <div className="text-xs text-muted-foreground">{inverseFixedField === "equipes" ? "m/dia Necessários" : "m/dia (fixo)"}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {!inverseDataTermino && (
              <p className="text-xs text-muted-foreground">Selecione a data de término desejada para ver o cálculo.</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Row 3: Productivity Table + Technical Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5" /> Tabela de Produtividade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Produtividade por equipe/dia. Fonte: SINAPI/SEINFRA/TCPO</p>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Produtividade/Dia</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productivity.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        <Input className="h-8 w-full min-w-[120px]" value={p.servico} onChange={e => { const np = [...productivity]; np[i].servico = e.target.value; setProductivity(np); }} />
                      </TableCell>
                      <TableCell>
                        <Select value={p.unidade} onValueChange={v => { const np = [...productivity]; np[i].unidade = v; setProductivity(np); }}>
                          <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["m", "m²", "m³", "un", "h", "vb"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" className="h-8 w-20" value={p.produtividade} onChange={e => { const np = [...productivity]; np[i].produtividade = Number(e.target.value); setProductivity(np); }} />
                      </TableCell>
                      <TableCell>
                        <Select value={p.fonte} onValueChange={v => { const np = [...productivity]; np[i].fonte = v; setProductivity(np); }}>
                          <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["SINAPI", "SEINFRA", "TCPO", "Mercado", "Histórico"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setProductivity(productivity.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {showAddServiceForm ? (
              <div className="border p-3 space-y-2 bg-muted/30">
                <p className="text-sm font-semibold">Novo Serviço</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nome do Serviço</Label>
                    <Input placeholder="Ex: Escavação manual" value={newServico} onChange={e => setNewServico(e.target.value)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade</Label>
                    <Select value={newUnidade} onValueChange={setNewUnidade}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["m", "m²", "m³", "un", "h", "vb", "kg"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Produtividade/Dia</Label>
                    <Input type="number" value={newProd} onChange={e => setNewProd(Number(e.target.value))} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Fonte</Label>
                    <Select value={newFonte} onValueChange={setNewFonte}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["SINAPI", "SEINFRA", "TCPO", "Mercado", "Histórico"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => {
                    if (!newServico.trim()) { toast.error("Digite o nome do serviço."); return; }
                    setProductivity([...productivity, { servico: newServico.trim(), unidade: newUnidade, produtividade: newProd, fonte: newFonte }]);
                    setNewServico(""); setNewProd(10);
                    setShowAddServiceForm(false);
                    toast.success("Serviço adicionado!");
                  }}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddServiceForm(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowAddServiceForm(true)}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Serviço
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" /> Regras Técnicas (Alertas)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Verificações automáticas (não modificam os dados)</p>
            <p className="text-sm italic text-muted-foreground">
              {trechos.length > 0 ? "Verificações aplicadas aos dados carregados." : "Carregue a planilha para verificar as regras técnicas"}
            </p>
            <div>
              <p className="font-semibold text-sm text-orange-600 mb-2">Regras Verificadas:</p>
              <ul className="space-y-1">
                {technicalRules.map((rule, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span className="text-muted-foreground">•</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── SCHEDULE RESULTS ── */}
      {scheduleResult && (
        <>
          {/* Execution Schedule Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 inline-block mr-1" /> Cronograma de Execução
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Dias Úteis", value: scheduleResult.totalDays, color: "text-blue-600" },
                  { label: "Início", value: new Date(dataInicio).toLocaleDateString("pt-BR"), color: "text-green-600" },
                  { label: "Término", value: scheduleResult.endDate.toLocaleDateString("pt-BR"), color: "text-purple-600" },
                  { label: "Custo Total", value: fmtCurrency(totalCost), color: "text-orange-600" },
                ].map((c, i) => (
                  <div key={i} className="bg-muted/50 p-3 text-center">
                    <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
                <span className="font-semibold">Legenda (Ciclo Completo/Dia):</span>
                <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> Execução (Esc→Ass→Reat)</span>
                <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-yellow-400 inline-block" /> Teste Hidrostático</span>
                <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-600" /> Vala fechada no mesmo dia</span>
              </div>

              {/* Gantt Grid */}
              <div className="overflow-x-auto max-h-[600px]">
                <table className="text-xs border-collapse w-full">
                  <thead className="sticky top-0 z-10 bg-background">
                    <tr>
                      <th className="border px-2 py-1 text-left font-semibold bg-muted min-w-[60px] sticky left-0 z-20">Trecho</th>
                      <th className="border px-2 py-1 text-left font-semibold bg-muted min-w-[50px] sticky left-[60px] z-20">Metros</th>
                      {Array.from({ length: scheduleResult.totalDays }, (_, i) => (
                        <th key={i} className="border px-1 py-1 text-center font-normal bg-muted min-w-[28px]">{i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ganttData.map((row) => (
                      <tr key={row.id}>
                        <td className="border px-2 py-1 font-semibold bg-muted/50 sticky left-0 z-10">{row.label || row.id}</td>
                        <td className="border px-2 py-1 text-right bg-muted/50 sticky left-[60px] z-10">{row.meters}m</td>
                        {Array.from({ length: scheduleResult.totalDays }, (_, d) => {
                          const dayNum = d + 1;
                          const dayData = row.days[dayNum];
                          if (!dayData) return <td key={d} className="border px-0 py-0 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedGanttCell({ trechoId: row.id, day: dayNum })} />;
                          if (dayData.isTest) return (
                            <td key={d} className="border px-0 py-0 bg-yellow-300 dark:bg-yellow-700 text-center font-bold text-yellow-800 dark:text-yellow-200 cursor-pointer hover:opacity-80" onClick={() => setSelectedGanttCell({ trechoId: row.id, day: dayNum })}>T</td>
                          );
                          return (
                            <td key={d} className="border px-0 py-0 bg-primary/80 text-primary-foreground text-center text-[10px] font-medium cursor-pointer hover:bg-primary" onClick={() => setSelectedGanttCell({ trechoId: row.id, day: dayNum })}>
                              {dayData.meters > 0 ? Math.round(dayData.meters) : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Gantt footer */}
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                <span>Total de Trechos: <strong>{ganttData.length}</strong></span>
                <span>Total de Metros: <strong>{Math.round(totalMetros)}m</strong></span>
                <span>Dias de Obra: <strong>{scheduleResult.totalDays}</strong></span>
                <span>Média: <strong>{scheduleResult.totalDays > 0 ? fmt(totalMetros / scheduleResult.totalDays, 1) : 0} m/dia</strong></span>
              </div>
            </CardContent>
          </Card>

          {/* Curva ABC */}
          <Card>
            <CardHeader><CardTitle className="text-base"><BarChart3 className="h-4 w-4 inline-block mr-1" /> Curva ABC (Pareto)</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                // Build ABC data from gantt trechos sorted by cost descending
                const abcItems = ganttData.map((g) => {
                  const segs = scheduleResult.allSegments.filter(s => {
                    const idx = Array.from(new Set(scheduleResult.allSegments.map(ss => ss.trechoId))).indexOf(s.trechoId);
                    return `T${String(idx + 1).padStart(2, "0")}` === g.id;
                  });
                  const cost = segs.reduce((sum, s) => sum + s.custoTotal, 0);
                  return { id: g.id, meters: g.meters, cost };
                }).sort((a, b) => b.cost - a.cost);

                const totalAbcCost = abcItems.reduce((s, i) => s + i.cost, 0);
                let cumPercent = 0;
                const abcData = abcItems.map(item => {
                  cumPercent += totalAbcCost > 0 ? (item.cost / totalAbcCost) * 100 : 0;
                  const classABC = cumPercent <= 80 ? "A" : cumPercent <= 95 ? "B" : "C";
                  return { ...item, percent: totalAbcCost > 0 ? (item.cost / totalAbcCost) * 100 : 0, cumPercent, classABC };
                });

                return (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={abcData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="id" fontSize={10} />
                        <YAxis yAxisId="left" tickFormatter={v => fmtCurrency(v)} fontSize={9} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={10} />
                        <RechartsTooltip formatter={(v: number, name: string) => name === "% Acumulado" ? `${v.toFixed(1)}%` : fmtCurrency(v)} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="cost" name="Custo" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="cumPercent" name="% Acumulado" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                        <ReferenceLine yAxisId="right" y={80} stroke="#f97316" strokeDasharray="5 5" label={{ value: "80% (A)", position: "right", fontSize: 10 }} />
                        <ReferenceLine yAxisId="right" y={95} stroke="#a855f7" strokeDasharray="5 5" label={{ value: "95% (B)", position: "right", fontSize: 10 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div className="max-h-[250px] overflow-auto mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Trecho</TableHead>
                            <TableHead>Metros</TableHead>
                            <TableHead>Custo</TableHead>
                            <TableHead>%</TableHead>
                            <TableHead>% Acum.</TableHead>
                            <TableHead>Classe</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {abcData.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.id}</TableCell>
                              <TableCell>{item.meters}m</TableCell>
                              <TableCell>{fmtCurrency(item.cost)}</TableCell>
                              <TableCell>{fmt(item.percent, 1)}%</TableCell>
                              <TableCell>{fmt(item.cumPercent, 1)}%</TableCell>
                              <TableCell>
                                <Badge className={item.classABC === "A" ? "bg-red-500" : item.classABC === "B" ? "bg-yellow-500" : "bg-green-500"}>
                                  {item.classABC}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Curva S + Histogram */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base"><TrendingUp className="h-4 w-4 inline-block mr-1" /> Curva S</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={scheduleResult.curveS}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickFormatter={d => `D${d}`} fontSize={10} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={10} />
                    <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Legend />
                    <Area type="monotone" dataKey="physicalPercent" name="Físico Previsto" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="financialPercent" name="Financeiro Previsto" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base"><BarChart3 className="h-4 w-4 inline-block mr-1" /> Histograma de Recursos</CardTitle>
                <div className="flex gap-2 mt-2">
                  <Select value={histView} onValueChange={v => setHistView(v as HistogramView)}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Visão Diária</SelectItem>
                      <SelectItem value="weekly">Visão Semanal</SelectItem>
                      <SelectItem value="monthly">Visão Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={histFilter} onValueChange={v => setHistFilter(v as HistogramFilter)}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Recursos</SelectItem>
                      <SelectItem value="labor">Apenas Mão de Obra</SelectItem>
                      <SelectItem value="equipment">Apenas Equipamentos</SelectItem>
                      <SelectItem value="cost">Custo Acumulado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={scheduleResult.histogram}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickFormatter={d => `D${d}`} fontSize={10} />
                    <YAxis fontSize={10} />
                    <RechartsTooltip />
                    <Legend />
                    {(histFilter === "all" || histFilter === "labor") && (
                      <Bar dataKey="labor" name="Mão de Obra (pessoas)" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    )}
                    {(histFilter === "all" || histFilter === "equipment") && (
                      <Bar dataKey="equipment" name="Equipamentos (unid.)" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                    )}
                    {histFilter === "cost" && (
                      <Line type="monotone" dataKey="cost" name="Custo Acumulado" stroke="#22c55e" strokeWidth={2} dot={false} />
                    )}
                    <ReferenceLine y={histStats.avgDaily} stroke="#f97316" strokeDasharray="5 5" label={{ value: "Média", position: "right", fontSize: 10 }} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {[
                    { label: "Pico Mão de Obra", value: histStats.peakLabor, color: "text-blue-600" },
                    { label: "Média Diária", value: histStats.avgDaily, color: "text-foreground" },
                    { label: "Total HH", value: fmt(histStats.totalHH, 0), color: "text-green-600" },
                    { label: "Equip. x Dias", value: histStats.equipDays, color: "text-purple-600" },
                  ].map((s, i) => (
                    <div key={i} className="bg-muted/50 p-3 text-center">
                      <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Daily Plan */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 inline-block mr-1" /> Plano Diário Detalhado</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dia</TableHead>
                      <TableHead>Trecho</TableHead>
                      <TableHead>Atividade</TableHead>
                      <TableHead>Equipes</TableHead>
                      <TableHead>Produção</TableHead>
                      <TableHead>Mão de Obra</TableHead>
                      <TableHead>Equipamentos</TableHead>
                      <TableHead>Custo Dia (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduleResult.allSegments.map((seg, i) => {
                      const trechoLabel = ganttData.find(g => {
                        const segsForTrecho = scheduleResult.allSegments.filter(s => s.trechoId === seg.trechoId);
                        return segsForTrecho.length > 0 && g.meters === Math.round(segsForTrecho.reduce((sum, s) => sum + s.meters, 0));
                      })?.id || `T${String(Array.from(new Set(scheduleResult.allSegments.map(s => s.trechoId))).indexOf(seg.trechoId) + 1).padStart(2, "0")}`;
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{seg.day}</TableCell>
                          <TableCell className="font-semibold text-primary">{trechoLabel}</TableCell>
                          <TableCell className="text-sm">Ciclo completo ({fmt(seg.meters, 1)}m)</TableCell>
                          <TableCell>Eq. {seg.team}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input type="number" className="h-7 w-16" defaultValue={seg.meters > 0 ? Math.round(seg.meters) : ""} />
                              <span className="text-xs text-muted-foreground">/dia</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{workersPerTeam} pessoas</TableCell>
                          <TableCell className="text-sm">{[teamConfig.hasRetro, teamConfig.hasCompactor, teamConfig.hasTruck, teamConfig.hasPump].filter(Boolean).length} equip.</TableCell>
                          <TableCell className="font-medium">{fmtCurrency(seg.custoTotal)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── EDITABLE TRECHOS ── */}
      {dataLoaded && trechos.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Pencil className="h-5 w-5" /> Trechos do Planejamento
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowTrechoEditor(!showTrechoEditor)}>
                {showTrechoEditor ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                {showTrechoEditor ? "Recolher" : "Editar Trechos"}
              </Button>
            </div>
          </CardHeader>
          {showTrechoEditor && (
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Edite os nomes, comprimentos e produtividade dos trechos. Alterações ficam apenas no planejamento.
              </p>
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[50px]">#</TableHead>
                      <TableHead className="min-w-[140px]">Nome do Trecho</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Comp. (m)</TableHead>
                      <TableHead>Prof. (m)</TableHead>
                      <TableHead>DN (mm)</TableHead>
                      <TableHead>Prod. (m/dia)</TableHead>
                      <TableHead>Prioridade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trechos.map((t, i) => {
                      const key = `${t.idInicio}-${t.idFim}`;
                      const ov = trechoOverrides[key] || {};
                      const prof = Math.abs(t.cotaInicio - t.cotaFim) || 1.5;
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-muted-foreground">T{String(i + 1).padStart(2, "0")}</TableCell>
                          <TableCell>
                            <Input className="h-8 min-w-[120px]" placeholder={`Trecho ${i + 1}`}
                              value={ov.nome ?? t.nome ?? ""}
                              onChange={e => setTrechoOverrides({ ...trechoOverrides, [key]: { ...ov, nome: e.target.value } })}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{t.idInicio}</TableCell>
                          <TableCell className="text-sm">{t.idFim}</TableCell>
                          <TableCell>
                            <Input type="number" className="h-8 w-20" step={0.1}
                              value={ov.comprimento ?? t.comprimento}
                              onChange={e => setTrechoOverrides({ ...trechoOverrides, [key]: { ...ov, comprimento: Number(e.target.value) } })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input type="number" className="h-8 w-20" step={0.1}
                              value={ov.profundidade ?? prof}
                              onChange={e => setTrechoOverrides({ ...trechoOverrides, [key]: { ...ov, profundidade: Number(e.target.value) } })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input type="number" className="h-8 w-20"
                              value={ov.diametroMm ?? t.diametroMm}
                              onChange={e => setTrechoOverrides({ ...trechoOverrides, [key]: { ...ov, diametroMm: Number(e.target.value) } })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input type="number" className="h-8 w-16" step={0.5}
                              value={ov.produtividadeDia ?? metrosDia}
                              onChange={e => setTrechoOverrides({ ...trechoOverrides, [key]: { ...ov, produtividadeDia: Number(e.target.value) } })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input type="number" className="h-8 w-14" min={1}
                              value={ov.prioridade ?? i + 1}
                              onChange={e => setTrechoOverrides({ ...trechoOverrides, [key]: { ...ov, prioridade: Number(e.target.value) } })}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => { setTrechoOverrides({}); toast.success("Edições dos trechos resetadas."); }}>
                  Resetar Edições
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── NOTAS DE SERVIÇO ── */}
      {dataLoaded && trechos.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" /> Planejamento por Nota de Serviço
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowServiceNotes(!showServiceNotes)}>
                  {showServiceNotes ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                  {showServiceNotes ? "Recolher" : "Ver Notas"}
                </Button>
                <Button size="sm" onClick={() => {
                  setEditingNote({
                    id: "", trechoIndex: 0, trechoNome: "", descricao: "",
                    dataInicio: dataInicio, dataFim: "", responsavel: "",
                    status: "pendente", servicos: [], observacoes: ""
                  });
                  setShowNoteDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" /> Nova Nota de Serviço
                </Button>
              </div>
            </div>
          </CardHeader>
          {showServiceNotes && (
            <CardContent>
              {serviceNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma nota de serviço cadastrada.</p>
              ) : (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trecho</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Data Início</TableHead>
                        <TableHead>Data Fim</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceNotes.map(note => (
                        <TableRow key={note.id}>
                          <TableCell className="font-semibold">{note.trechoNome || `Trecho ${note.trechoIndex + 1}`}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{note.descricao}</TableCell>
                          <TableCell className="text-sm">{note.dataInicio ? new Date(note.dataInicio + "T12:00:00").toLocaleDateString("pt-BR") : "-"}</TableCell>
                          <TableCell className="text-sm">{note.dataFim ? new Date(note.dataFim + "T12:00:00").toLocaleDateString("pt-BR") : "-"}</TableCell>
                          <TableCell className="text-sm">{note.responsavel || "-"}</TableCell>
                          <TableCell>
                            <Badge className={
                              note.status === "aprovada" ? "bg-green-600" :
                              note.status === "concluida" ? "bg-blue-600" :
                              note.status === "em_execucao" ? "bg-yellow-600" : "bg-gray-500"
                            }>
                              {note.status === "pendente" ? "Pendente" : note.status === "em_execucao" ? "Em Execução" : note.status === "concluida" ? "Concluída" : "Aprovada"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingNote(note); setShowNoteDialog(true); }}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteNote(note.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap justify-center">
        <Button size="lg" className="bg-primary" onClick={handleGenerateSchedule} disabled={trechos.length === 0}>
          <Calendar className="h-4 w-4 mr-2" /> Gerar Planejamento
        </Button>
        <Button size="lg" variant="secondary" onClick={() => {
          if (!dataLoaded && trechos.length === 0) { toast.error("Carregue os dados primeiro."); return; }
          setSavePlanName(editingPlanId ? savedPlans.find(p => p.id === editingPlanId)?.nome || "" : "");
          setShowSaveDialog(true);
        }}>
          <Save className="h-4 w-4 mr-2" /> Salvar Planejamento
        </Button>
        <Button size="lg" variant="outline" onClick={() => setShowSavedPlans(true)}>
          <FolderOpen className="h-4 w-4 mr-2" /> Planejamentos Salvos
          {savedPlans.length > 0 && <Badge className="ml-2 bg-primary">{savedPlans.length}</Badge>}
        </Button>
        <Button size="lg" variant="outline" onClick={handleExportPlanningExcel}>
          <Download className="h-4 w-4 mr-2" /> Exportar XLSX
        </Button>
        <input
          ref={importFileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleImportPlanningExcel}
        />
        <Button size="lg" variant="outline" onClick={() => importFileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" /> Importar XLSX
        </Button>
      </div>

      {editingPlanId && (
        <p className="text-center text-sm text-muted-foreground">
          Editando: <strong>{savedPlans.find(p => p.id === editingPlanId)?.nome}</strong>
        </p>
      )}

      {/* ── DIALOGS ── */}

      {/* Save Plan Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingPlanId ? "Atualizar Planejamento" : "Salvar Planejamento"}</DialogTitle>
            <DialogDescription>Salve todas as configurações para poder restaurar depois.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Planejamento</Label>
              <Input placeholder="Ex: Cenário 3 equipes - Otimista" value={savePlanName} onChange={e => setSavePlanName(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancelar</Button>
              <Button onClick={() => {
                if (!savePlanName.trim()) { toast.error("Digite um nome."); return; }
                handleSavePlan(savePlanName.trim());
              }}>
                <Save className="h-4 w-4 mr-1" /> {editingPlanId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Saved Plans Dialog */}
      <Dialog open={showSavedPlans} onOpenChange={setShowSavedPlans}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Planejamentos Salvos</DialogTitle>
            <DialogDescription>Carregue, edite, duplique ou exclua planejamentos salvos.</DialogDescription>
          </DialogHeader>
          {/* Import JSON button */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                try {
                  const plan = await importPlanFromJSON(file);
                  const updated = [...savedPlans, plan];
                  setSavedPlans(updated);
                  savePlansToStorage(updated);
                  toast.success(`Planejamento "${plan.nome}" importado!`);
                } catch {
                  toast.error("Arquivo JSON inválido.");
                }
              };
              input.click();
            }}>
              <Upload className="h-3 w-3 mr-1" /> Importar JSON
            </Button>
          </div>
          {savedPlans.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum planejamento salvo ainda.</p>
          ) : (
            <div className="space-y-3">
              {savedPlans.map(plan => (
                <Card key={plan.id} className={`${editingPlanId === plan.id ? "border-primary border-2" : ""}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{plan.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Criado: {new Date(plan.criadoEm).toLocaleDateString("pt-BR")} | Atualizado: {new Date(plan.atualizadoEm).toLocaleDateString("pt-BR")}
                        </p>
                        <div className="flex gap-3 mt-1 text-xs">
                          <span>{plan.numEquipes} equipes</span>
                          {plan.totalMetros && <span>{Math.round(plan.totalMetros)}m</span>}
                          {plan.totalDias && <span>{plan.totalDias} dias</span>}
                          {plan.custoTotal && <span>{fmtCurrency(plan.custoTotal)}</span>}
                          {plan.serviceNotes?.length > 0 && <span>{plan.serviceNotes.length} notas</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleLoadPlan(plan)}>
                          <FolderOpen className="h-3 w-3 mr-1" /> Carregar
                        </Button>
                        <Button size="sm" variant="outline" title="Exportar JSON" onClick={() => {
                          exportPlanAsJSON(plan);
                          toast.success(`"${plan.nome}" exportado como JSON!`);
                        }}>
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDuplicatePlan(plan)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeletePlan(plan.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Service Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={v => { setShowNoteDialog(v); if (!v) setEditingNote(null); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingNote?.id ? "Editar Nota de Serviço" : "Nova Nota de Serviço"}</DialogTitle>
            <DialogDescription>Planeje a execução por trecho com datas e responsável.</DialogDescription>
          </DialogHeader>
          {editingNote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Trecho</Label>
                  <Select value={String(editingNote.trechoIndex)} onValueChange={v => {
                    const idx = Number(v);
                    const t = trechos[idx];
                    const key = t ? `${t.idInicio}-${t.idFim}` : "";
                    const ov = trechoOverrides[key] || {};
                    setEditingNote({ ...editingNote, trechoIndex: idx, trechoNome: ov.nome || t?.nome || `T${String(idx + 1).padStart(2, "0")} (${t?.idInicio}→${t?.idFim})` });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {trechos.map((t, i) => {
                        const key = `${t.idInicio}-${t.idFim}`;
                        const ov = trechoOverrides[key] || {};
                        return <SelectItem key={i} value={String(i)}>T{String(i + 1).padStart(2, "0")} - {ov.nome || t.nome || `${t.idInicio}→${t.idFim}`}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Input value={editingNote.responsavel} onChange={e => setEditingNote({ ...editingNote, responsavel: e.target.value })} placeholder="Nome do responsável" />
                </div>
              </div>
              <div>
                <Label>Descrição da Nota de Serviço</Label>
                <Input value={editingNote.descricao} onChange={e => setEditingNote({ ...editingNote, descricao: e.target.value })} placeholder="Ex: NS-001 - Assentamento PVC DN200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data Início</Label>
                  <Input type="date" value={editingNote.dataInicio} onChange={e => setEditingNote({ ...editingNote, dataInicio: e.target.value })} />
                </div>
                <div>
                  <Label>Data Fim</Label>
                  <Input type="date" value={editingNote.dataFim} onChange={e => setEditingNote({ ...editingNote, dataFim: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editingNote.status} onValueChange={v => setEditingNote({ ...editingNote, status: v as ServiceNote["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_execucao">Em Execução</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="aprovada">Aprovada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Serviços Incluídos</Label>
                <Input value={editingNote.servicos.join(", ")} onChange={e => setEditingNote({ ...editingNote, servicos: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="Escavação, Assentamento, Reaterro (separados por vírgula)" />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={editingNote.observacoes} onChange={e => setEditingNote({ ...editingNote, observacoes: e.target.value })} placeholder="Observações adicionais..." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowNoteDialog(false); setEditingNote(null); }}>Cancelar</Button>
                <Button onClick={() => {
                  if (!editingNote.descricao.trim()) { toast.error("Preencha a descrição."); return; }
                  handleSaveNote(editingNote);
                }}>
                  <Save className="h-4 w-4 mr-1" /> Salvar Nota
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Gantt Cell Detail Dialog */}
      <Dialog open={!!selectedGanttCell} onOpenChange={() => setSelectedGanttCell(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Detalhe do Dia</DialogTitle>
          </DialogHeader>
          {selectedGanttCell && scheduleResult && (() => {
            const segs = scheduleResult.allSegments.filter(s => s.day === selectedGanttCell.day);
            return (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Dia {selectedGanttCell.day} - {new Date(new Date(dataInicio).getTime() + (selectedGanttCell.day - 1) * 86400000).toLocaleDateString("pt-BR")}</p>
                {segs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem atividade neste dia.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trecho</TableHead>
                        <TableHead>Metros</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead>Custo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {segs.map((seg, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm font-medium">{seg.trechoId}</TableCell>
                          <TableCell className="text-sm">{fmt(seg.meters, 1)}m</TableCell>
                          <TableCell className="text-sm">Eq. {seg.team}</TableCell>
                          <TableCell className="text-sm">{fmtCurrency(seg.custoTotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <p className="text-xs text-muted-foreground">
                  Total: {fmt(segs.reduce((s, seg) => s + seg.meters, 0), 1)}m | {fmtCurrency(segs.reduce((s, seg) => s + seg.custoTotal, 0))}
                </p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
