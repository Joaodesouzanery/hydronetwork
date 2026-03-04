/**
 * TrechoEditModule — Dedicated module for inline editing of quantities,
 * unit costs, and schedule parameters per network segment (trecho).
 * Supports trecho subdivision by length.
 *
 * Performance optimizations:
 * - EditCell extracted as React.memo component (avoids remount on parent render)
 * - Row components wrapped in React.memo (only changed rows re-render)
 * - Handlers stabilized with useCallback (stable references for memo)
 * - quantRowsRef avoids stale state in cross-table recalculations
 * - Table virtualization via @tanstack/react-virtual (DOM-efficient for 100+ rows)
 */

import { useState, useMemo, useCallback, useRef, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calculator, Download, Scissors, Undo2, Search, FileSpreadsheet, DollarSign,
  Calendar, RefreshCw, Filter, Upload, FileDown, MapPin, BarChart3,
  ArrowRight, Check, Settings2, Trash2, Plus, Edit3, ToggleLeft, Layers,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Line, Cell,
} from "recharts";
import { Trecho } from "@/engine/domain";
import { PontoTopografico } from "@/engine/reader";
import { subdivideTrecho, reunifySubTrechos, isSubTrecho, SubTrecho } from "@/engine/trechoSubdivision";
import type { QuantRow, QuantityParams } from "./QuantitiesModule";
import {
  getEscavacaoCusto as sinapiGetEscCusto,
  getTuboCusto as sinapiGetTuboCusto,
  getPVCusto as sinapiGetPVCusto,
  SINAPI_COSTS,
} from "@/engine/sinapi";
import {
  parseMedicaoFile,
  calcularMedicaoPorTrecho,
  calcularResumoMedicao,
  exportMedicaoExcel,
  exportMedicaoCSV,
  saveMedicaoItems,
  loadMedicaoItems,
  saveMedicaoTrechos,
  loadMedicaoTrechos,
  type MedicaoItem,
  type TrechoMedicao,
  type MedicaoSummary,
} from "@/engine/medicao";
import {
  downloadGeoJSON,
  downloadGISCSV,
  exportGISExcel,
  exportCustoSpreadsheet,
} from "@/engine/gisExport";
import type { CostRowExport, CustoImportItemExport } from "@/engine/gisExport";
import { saveModuleData } from "@/engine/moduleExchange";
import * as XLSX from "xlsx";
import { CustomCostTrechoModule } from "./CustomCostTrechoModule";

// ── SINAPI reference costs (from shared sinapi engine) ──
const SINAPI_UNIT_COSTS = {
  escavacao_0_1_5: SINAPI_COSTS.escavacao["0-1.5"].custo,
  escavacao_1_5_3: SINAPI_COSTS.escavacao["1.5-3"].custo,
  escavacao_3_4_5: SINAPI_COSTS.escavacao["3-4.5"].custo,
  escoramento_madeira: SINAPI_COSTS.escoramento.madeira.custo,
  tubo_150: SINAPI_COSTS.tubulacao[150].custo,
  tubo_200: SINAPI_COSTS.tubulacao[200].custo,
  tubo_250: SINAPI_COSTS.tubulacao[250].custo,
  tubo_300: SINAPI_COSTS.tubulacao[300].custo,
  tubo_400: SINAPI_COSTS.tubulacao[400].custo,
  tubo_500: 702.86,
  tubo_600: 886.14,
  reaterro: SINAPI_COSTS.reaterro.compactado.custo,
  berco: SINAPI_COSTS.reaterro.berco.custo,
  envoltoria: SINAPI_COSTS.reaterro.envoltoria.custo,
  pv_0_1_5: SINAPI_COSTS.pv["0-1.5"].custo,
  pv_1_5_2_5: SINAPI_COSTS.pv["1.5-2.5"].custo,
  pv_2_5_4: SINAPI_COSTS.pv["2.5-4"].custo,
  botafora: SINAPI_COSTS.botafora.custo,
};

// ── Types ──

interface EditableQuantRow {
  id: string;
  trechoKey: string;
  nomeTrecho: string;
  comp: number;
  dn: number;
  prof: number;
  escavacao: number;
  reaterro: number;
  botafora: number;
  pavimento: number;
  escoramento: number;
  isSubdivided: boolean;
  parentId?: string;
  subIndex?: number;
  subCount?: number;
  originalTrecho: Trecho;
}

interface EditableCostRow {
  id: string;
  trechoKey: string;
  nomeTrecho: string;
  comp: number;
  dn: number;
  custoEscavacao: number;
  custoTubo: number;
  custoReaterro: number;
  custoPV: number;
  bdiPct: number;
  fonte: "SINAPI" | "Manual";
  subtotal: number;
  total: number;
}

interface EditableScheduleRow {
  id: string;
  trechoKey: string;
  nomeTrecho: string;
  comp: number;
  equipe: number;
  metrosDia: number;
  diasEstimados: number;
  dataInicio: string;
  dataFim: string;
  prioridade: number;
}

// Cost spreadsheet item — imported from user's cost spreadsheet
interface CustoImportItem {
  item_custo: string;
  descricao: string;
  unidade: string;
  preco_unitario: number;
  fonte: string;
  enabled: boolean;
}

// Column mapping state for measurement import
interface ColumnMapping {
  spreadsheetHeaders: string[];
  rawData: Record<string, unknown>[];
  mappings: Record<string, string>; // field -> spreadsheet column
  extraColumns: string[]; // additional columns user chose to include
  confirmed: boolean;
}

const MEDICAO_FIELDS = [
  { key: "item_medicao", label: "Item / Codigo", required: true },
  { key: "descricao", label: "Descricao", required: false },
  { key: "tipo_rede", label: "Tipo Rede", required: false },
  { key: "dn_min", label: "DN Minimo", required: false },
  { key: "dn_max", label: "DN Maximo", required: false },
  { key: "driver", label: "Unidade (m, m2, m3, un)", required: false },
  { key: "regra_quantidade", label: "Regra de Quantidade (campo)", required: true },
  { key: "preco_unitario", label: "Preco Unitario", required: true },
] as const;

// Execution status per trecho — user decides when a trecho is done
type TrechoExecStatus = "pendente" | "em_execucao" | "concluido" | "medido";

interface TrechoExecState {
  status: TrechoExecStatus;
  qtdExecutada: number;
  dataExecucao: string;
  observacao: string;
}

const CUSTO_STORAGE_KEY = "hydronetwork_custo_import";
const STORAGE_KEY = "hydronetwork_trecho_edits";
const ROW_HEIGHT = 44;
const TABLE_MAX_HEIGHT = 560;
const VIRTUALIZER_OVERSCAN = 15;

// ── Props ──

interface TrechoEditModuleProps {
  trechos: Trecho[];
  pontos?: PontoTopografico[];
  quantityRows?: QuantRow[];
  quantityParams?: QuantityParams;
  onTrechosChange?: (trechos: Trecho[]) => void;
}

// ── Helpers ──

function getEscavacaoCusto(prof: number): number {
  if (prof <= 1.5) return SINAPI_UNIT_COSTS.escavacao_0_1_5;
  if (prof <= 3.0) return SINAPI_UNIT_COSTS.escavacao_1_5_3;
  return SINAPI_UNIT_COSTS.escavacao_3_4_5;
}

function getTuboCusto(dn: number): number {
  if (dn <= 150) return SINAPI_UNIT_COSTS.tubo_150;
  if (dn <= 200) return SINAPI_UNIT_COSTS.tubo_200;
  if (dn <= 250) return SINAPI_UNIT_COSTS.tubo_250;
  if (dn <= 300) return SINAPI_UNIT_COSTS.tubo_300;
  if (dn <= 400) return SINAPI_UNIT_COSTS.tubo_400;
  if (dn <= 500) return SINAPI_UNIT_COSTS.tubo_500;
  return SINAPI_UNIT_COSTS.tubo_600;
}

function getPVCusto(prof: number): number {
  if (prof <= 1.5) return SINAPI_UNIT_COSTS.pv_0_1_5;
  if (prof <= 2.5) return SINAPI_UNIT_COSTS.pv_1_5_2_5;
  return SINAPI_UNIT_COSTS.pv_2_5_4;
}

function computeQuantities(t: Trecho, prof: number): { escavacao: number; reaterro: number; botafora: number; pavimento: number; escoramento: number } {
  const dnM = t.diametroMm / 1000;
  const lv = Math.max(0.6, dnM + 0.30);
  const volEsc = t.comprimento * lv * prof;
  const volTubo = t.comprimento * Math.PI * (dnM / 2) ** 2;
  const volBerco = t.comprimento * lv * 0.10;
  const volEnv = t.comprimento * lv * 0.30;
  const reaterro = Math.max(0, volEsc - volTubo - volBerco - volEnv);
  const botafora = (volEsc - reaterro) * 1.25;
  const pavimento = t.comprimento * (lv + 0.60);
  const escoramento = prof > 1.25 ? t.comprimento * prof * 2 : 0;
  return {
    escavacao: round2(volEsc),
    reaterro: round2(reaterro),
    botafora: round2(botafora),
    pavimento: round2(pavimento),
    escoramento: round2(escoramento),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtC(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Extracted Components (outside render — stable references) ──

interface EditCellProps {
  value: number | string;
  onChange: (v: number | string) => void;
  type?: string;
  className?: string;
}

const EditCell = memo(function EditCell({ value, onChange, type = "number", className = "" }: EditCellProps) {
  return (
    <Input
      type={type}
      value={value}
      onChange={e => {
        const v = type === "number" ? parseFloat(e.target.value) || 0 : e.target.value;
        onChange(v);
      }}
      className={`h-7 text-xs w-20 ${className}`}
    />
  );
});

// ── Memoized Row Components ──

interface QuantRowProps {
  row: EditableQuantRow;
  onFieldChange: (id: string, field: keyof EditableQuantRow, value: number) => void;
  onSubdivide: (id: string) => void;
  onReunify: (parentId: string) => void;
}

const MemoQuantRow = memo(function MemoQuantRow({ row, onFieldChange, onSubdivide, onReunify }: QuantRowProps) {
  return (
    <TableRow className={row.isSubdivided ? "bg-orange-50/30" : ""} style={{ height: ROW_HEIGHT }}>
      <TableCell className="text-xs font-mono py-1">
        {row.id}
        {row.isSubdivided && <Badge variant="outline" className="ml-1 text-[10px]">Sub</Badge>}
      </TableCell>
      <TableCell className="text-xs max-w-[140px] truncate py-1" title={row.nomeTrecho}>{row.nomeTrecho}</TableCell>
      <TableCell className="py-1"><EditCell value={row.comp} onChange={v => onFieldChange(row.id, "comp", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.dn} onChange={v => onFieldChange(row.id, "dn", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.prof} onChange={v => onFieldChange(row.id, "prof", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.escavacao} onChange={v => onFieldChange(row.id, "escavacao", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.reaterro} onChange={v => onFieldChange(row.id, "reaterro", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.botafora} onChange={v => onFieldChange(row.id, "botafora", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.pavimento} onChange={v => onFieldChange(row.id, "pavimento", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.escoramento} onChange={v => onFieldChange(row.id, "escoramento", v as number)} /></TableCell>
      <TableCell className="py-1">
        {row.isSubdivided && row.parentId ? (
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => onReunify(row.parentId!)}>
            <Undo2 className="h-3 w-3" />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => onSubdivide(row.id)}>
            <Scissors className="h-3 w-3" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
});

interface CostRowProps {
  row: EditableCostRow;
  onFieldChange: (id: string, field: keyof EditableCostRow, value: number) => void;
}

const MemoCostRow = memo(function MemoCostRow({ row, onFieldChange }: CostRowProps) {
  return (
    <TableRow style={{ height: ROW_HEIGHT }}>
      <TableCell className="text-xs max-w-[120px] truncate py-1" title={row.nomeTrecho}>{row.nomeTrecho}</TableCell>
      <TableCell className="text-xs py-1">{fmt(row.comp)}</TableCell>
      <TableCell className="py-1"><EditCell value={row.custoEscavacao} onChange={v => onFieldChange(row.id, "custoEscavacao", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.custoTubo} onChange={v => onFieldChange(row.id, "custoTubo", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.custoReaterro} onChange={v => onFieldChange(row.id, "custoReaterro", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.custoPV} onChange={v => onFieldChange(row.id, "custoPV", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.bdiPct} onChange={v => onFieldChange(row.id, "bdiPct", v as number)} /></TableCell>
      <TableCell className="py-1">
        <Badge variant={row.fonte === "SINAPI" ? "secondary" : "default"} className="text-[10px]">{row.fonte}</Badge>
      </TableCell>
      <TableCell className="text-xs font-medium py-1">{fmtC(row.subtotal)}</TableCell>
      <TableCell className="text-xs font-bold py-1">{fmtC(row.total)}</TableCell>
    </TableRow>
  );
});

interface ScheduleRowProps {
  row: EditableScheduleRow;
  onFieldChange: (id: string, field: keyof EditableScheduleRow, value: number | string) => void;
}

const MemoScheduleRow = memo(function MemoScheduleRow({ row, onFieldChange }: ScheduleRowProps) {
  return (
    <TableRow style={{ height: ROW_HEIGHT }}>
      <TableCell className="text-xs max-w-[140px] truncate py-1" title={row.nomeTrecho}>{row.nomeTrecho}</TableCell>
      <TableCell className="text-xs py-1">{fmt(row.comp)}</TableCell>
      <TableCell className="py-1"><EditCell value={row.equipe} onChange={v => onFieldChange(row.id, "equipe", v as number)} /></TableCell>
      <TableCell className="py-1"><EditCell value={row.metrosDia} onChange={v => onFieldChange(row.id, "metrosDia", v as number)} /></TableCell>
      <TableCell className="text-xs font-medium py-1">{row.diasEstimados}</TableCell>
      <TableCell className="py-1"><EditCell value={row.dataInicio} onChange={v => onFieldChange(row.id, "dataInicio", v)} type="date" className="w-32" /></TableCell>
      <TableCell className="text-xs py-1">{row.dataFim}</TableCell>
      <TableCell className="py-1"><EditCell value={row.prioridade} onChange={v => onFieldChange(row.id, "prioridade", v as number)} /></TableCell>
    </TableRow>
  );
});

// ── Main Component ──

export function TrechoEditModule({ trechos, pontos, quantityRows, quantityParams, onTrechosChange }: TrechoEditModuleProps) {
  const [activeTab, setActiveTab] = useState("quantitativos");
  const [searchFilter, setSearchFilter] = useState("");
  const [compMinFilter, setCompMinFilter] = useState("");
  const [compMaxFilter, setCompMaxFilter] = useState("");

  // Editable data
  const [quantRows, setQuantRows] = useState<EditableQuantRow[]>([]);
  const [costRows, setCostRows] = useState<EditableCostRow[]>([]);
  const [scheduleRows, setScheduleRows] = useState<EditableScheduleRow[]>([]);

  // Cost import data
  const [custoImportItems, setCustoImportItems] = useState<CustoImportItem[]>(() => {
    try {
      const d = localStorage.getItem(CUSTO_STORAGE_KEY);
      if (!d) return [];
      const parsed = JSON.parse(d) as CustoImportItem[];
      return parsed.map(item => ({ ...item, enabled: item.enabled ?? true }));
    } catch { return []; }
  });
  const custoFileRef = useRef<HTMLInputElement>(null);

  // Measurement (Medição) data
  const [medicaoItems, setMedicaoItems] = useState<MedicaoItem[]>(() => {
    try { return loadMedicaoItems(); } catch { return []; }
  });
  const [medicaoTrechos, setMedicaoTrechos] = useState<TrechoMedicao[]>(() => {
    try { return loadMedicaoTrechos(); } catch { return []; }
  });
  const medicaoFileRef = useRef<HTMLInputElement>(null);

  // Track which items are enabled (selected) for use
  const [medicaoEnabled, setMedicaoEnabled] = useState<Record<string, boolean>>({});
  const [custoEditIdx, setCustoEditIdx] = useState<number | null>(null);
  const [medicaoEditIdx, setMedicaoEditIdx] = useState<number | null>(null);
  // Schedule global params
  const [schedGlobalProdutividade, setSchedGlobalProdutividade] = useState(12);
  const [schedGlobalEquipes, setSchedGlobalEquipes] = useState(1);
  const [schedGlobalDataInicio, setSchedGlobalDataInicio] = useState(new Date().toISOString().slice(0, 10));

  // Column mapping for measurement import
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);

  // Execution tracking per trecho — user-driven
  const [trechoExecStates, setTrechoExecStates] = useState<Record<string, TrechoExecState>>(() => {
    try {
      const d = localStorage.getItem("hydronetwork_trecho_exec");
      return d ? JSON.parse(d) : {};
    } catch { return {}; }
  });

  // Extra columns from the user's measurement file
  const [medicaoExtraData, setMedicaoExtraData] = useState<Record<string, Record<string, unknown>>>({});

  // Subdivision dialog
  const [subdivideTarget, setSubdivideTarget] = useState<string | null>(null);
  const [subdivideLength, setSubdivideLength] = useState("50");

  // ── Refs for stable callback access (avoids stale state) ──
  const quantRowsRef = useRef(quantRows);
  quantRowsRef.current = quantRows;
  const costRowsRef = useRef(costRows);
  costRowsRef.current = costRows;
  const scheduleRowsRef = useRef(scheduleRows);
  scheduleRowsRef.current = scheduleRows;

  // ── Virtualization scroll refs ──
  const quantScrollRef = useRef<HTMLDivElement>(null);
  const costScrollRef = useRef<HTMLDivElement>(null);
  const scheduleScrollRef = useRef<HTMLDivElement>(null);

  // ── Initialize rows from trechos ──

  const initializeRows = useCallback(() => {
    if (trechos.length === 0) {
      toast.error("Sem trechos carregados. Importe topografia primeiro.");
      return;
    }

    const baseProfMin = 1.20;

    const qRows: EditableQuantRow[] = trechos.map((t, idx) => {
      const prof = Math.max(baseProfMin, 1.0 + t.diametroMm / 1000);
      const quant = computeQuantities(t, prof);

      const existingQ = quantityRows?.find(q => q.trecho === `${t.idInicio}→${t.idFim}` || q.id === `T-${String(idx + 1).padStart(2, "0")}`);

      return {
        id: `T-${String(idx + 1).padStart(2, "0")}`,
        trechoKey: `${t.idInicio}-${t.idFim}`,
        nomeTrecho: t.nomeTrecho || `${t.idInicio}→${t.idFim}`,
        comp: round2(t.comprimento),
        dn: t.diametroMm,
        prof: existingQ ? round2(existingQ.prof) : round2(prof),
        escavacao: existingQ ? round2(existingQ.escavacao) : quant.escavacao,
        reaterro: existingQ ? round2(existingQ.reaterro) : quant.reaterro,
        botafora: existingQ ? round2(existingQ.botafora) : quant.botafora,
        pavimento: existingQ ? round2(existingQ.pavimento) : quant.pavimento,
        escoramento: existingQ ? round2(existingQ.escorArea ?? 0) : quant.escoramento,
        isSubdivided: false,
        originalTrecho: t,
      };
    });
    setQuantRows(qRows);

    const cRows: EditableCostRow[] = qRows.map(q => {
      const custoEsc = getEscavacaoCusto(q.prof);
      const custoTubo = getTuboCusto(q.dn);
      const custoReat = SINAPI_UNIT_COSTS.reaterro;
      const custoPV = getPVCusto(q.prof);
      const subtotal = q.escavacao * custoEsc + q.comp * custoTubo + q.reaterro * custoReat + custoPV;
      const bdi = 25;
      return {
        id: q.id,
        trechoKey: q.trechoKey,
        nomeTrecho: q.nomeTrecho,
        comp: q.comp,
        dn: q.dn,
        custoEscavacao: custoEsc,
        custoTubo,
        custoReaterro: custoReat,
        custoPV,
        bdiPct: bdi,
        fonte: "SINAPI" as const,
        subtotal: round2(subtotal),
        total: round2(subtotal * (1 + bdi / 100)),
      };
    });
    setCostRows(cRows);

    const today = new Date().toISOString().slice(0, 10);
    const sRows: EditableScheduleRow[] = qRows.map((q, idx) => {
      const metrosDia = 12;
      const dias = Math.ceil(q.comp / metrosDia);
      return {
        id: q.id,
        trechoKey: q.trechoKey,
        nomeTrecho: q.nomeTrecho,
        comp: q.comp,
        equipe: 1,
        metrosDia,
        diasEstimados: dias,
        dataInicio: today,
        dataFim: addDays(today, dias),
        prioridade: idx + 1,
      };
    });
    setScheduleRows(sRows);

    // Save to shared module store for inter-module communication
    saveModuleData("trechos", trechos);
    saveModuleData("quantRows", qRows);

    toast.success(`${trechos.length} trechos carregados para edição.`);
  }, [trechos, quantityRows]);

  // ── Filtering ──

  const filterRow = useCallback((name: string, comp: number) => {
    const matchesSearch = !searchFilter || name.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesMin = !compMinFilter || comp >= parseFloat(compMinFilter);
    const matchesMax = !compMaxFilter || comp <= parseFloat(compMaxFilter);
    return matchesSearch && matchesMin && matchesMax;
  }, [searchFilter, compMinFilter, compMaxFilter]);

  const filteredQuantRows = useMemo(() => quantRows.filter(r => filterRow(r.nomeTrecho, r.comp)), [quantRows, filterRow]);
  const filteredCostRows = useMemo(() => costRows.filter(r => filterRow(r.nomeTrecho, r.comp)), [costRows, filterRow]);
  const filteredScheduleRows = useMemo(() => scheduleRows.filter(r => filterRow(r.nomeTrecho, r.comp)), [scheduleRows, filterRow]);

  // ── Stable inline editing handlers (useCallback with [] deps) ──

  const updateQuantField = useCallback((id: string, field: keyof EditableQuantRow, value: number) => {
    setQuantRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  const updateCostField = useCallback((id: string, field: keyof EditableCostRow, value: number) => {
    setCostRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value, fonte: "Manual" as const };
      // Use ref to get current quantRows (avoids stale state)
      const qRow = quantRowsRef.current.find(q => q.id === id);
      if (qRow) {
        updated.subtotal = round2(
          qRow.escavacao * updated.custoEscavacao +
          qRow.comp * updated.custoTubo +
          qRow.reaterro * updated.custoReaterro +
          updated.custoPV
        );
        updated.total = round2(updated.subtotal * (1 + updated.bdiPct / 100));
      }
      return updated;
    }));
  }, []);

  const updateScheduleField = useCallback((id: string, field: keyof EditableScheduleRow, value: number | string) => {
    setScheduleRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === "metrosDia" || field === "comp") {
        updated.diasEstimados = Math.ceil(updated.comp / updated.metrosDia);
        updated.dataFim = addDays(updated.dataInicio, updated.diasEstimados);
      }
      if (field === "dataInicio") {
        updated.dataFim = addDays(value as string, updated.diasEstimados);
      }
      return updated;
    }));
  }, []);

  // ── Recalculate quantities from comp/dn/prof ──

  const recalculateQuantities = useCallback(() => {
    setQuantRows(prev => prev.map(r => {
      const mockTrecho = { ...r.originalTrecho, comprimento: r.comp, diametroMm: r.dn };
      const quant = computeQuantities(mockTrecho, r.prof);
      return { ...r, ...quant };
    }));
    toast.success("Quantitativos recalculados.");
  }, []);

  // ── Subdivision ──

  const handleSubdivide = useCallback((rowId: string) => {
    setSubdivideTarget(rowId);
    setSubdivideLength("50");
  }, []);

  const confirmSubdivide = useCallback(() => {
    if (!subdivideTarget) return;
    const len = parseFloat(subdivideLength);
    if (isNaN(len) || len <= 0) {
      toast.error("Comprimento inválido.");
      return;
    }

    const currentQuantRows = quantRowsRef.current;
    const currentCostRows = costRowsRef.current;
    const currentScheduleRows = scheduleRowsRef.current;

    const targetRow = currentQuantRows.find(r => r.id === subdivideTarget);
    if (!targetRow) return;

    if (len >= targetRow.comp) {
      toast.error("Comprimento deve ser menor que o trecho.");
      return;
    }

    const subTrechos = subdivideTrecho(targetRow.originalTrecho, len);

    const newQuantRows: EditableQuantRow[] = [];
    const newCostRows: EditableCostRow[] = [];
    const newScheduleRows: EditableScheduleRow[] = [];

    for (const r of currentQuantRows) {
      if (r.id !== subdivideTarget) {
        newQuantRows.push(r);
        const cRow = currentCostRows.find(c => c.id === r.id);
        if (cRow) newCostRows.push(cRow);
        const sRow = currentScheduleRows.find(s => s.id === r.id);
        if (sRow) newScheduleRows.push(sRow);
        continue;
      }

      subTrechos.forEach((st, idx) => {
        const subId = `${r.id}_S${idx + 1}`;
        const prof = r.prof;
        const quant = computeQuantities(st, prof);

        newQuantRows.push({
          id: subId,
          trechoKey: `${st.idInicio}-${st.idFim}`,
          nomeTrecho: st.nomeTrecho || `${st.idInicio}→${st.idFim}`,
          comp: round2(st.comprimento),
          dn: st.diametroMm,
          prof,
          ...quant,
          isSubdivided: true,
          parentId: st.parentId,
          subIndex: st.subIndex,
          subCount: st.subCount,
          originalTrecho: st,
        });

        const custoEsc = getEscavacaoCusto(prof);
        const custoTubo = getTuboCusto(st.diametroMm);
        const custoReat = SINAPI_UNIT_COSTS.reaterro;
        const custoPV = idx === 0 ? getPVCusto(prof) : 0;
        const subtotal = quant.escavacao * custoEsc + st.comprimento * custoTubo + quant.reaterro * custoReat + custoPV;
        const bdiPct = currentCostRows.find(c => c.id === r.id)?.bdiPct ?? 25;
        newCostRows.push({
          id: subId,
          trechoKey: `${st.idInicio}-${st.idFim}`,
          nomeTrecho: st.nomeTrecho || `${st.idInicio}→${st.idFim}`,
          comp: round2(st.comprimento),
          dn: st.diametroMm,
          custoEscavacao: custoEsc,
          custoTubo,
          custoReaterro: custoReat,
          custoPV,
          bdiPct,
          fonte: "SINAPI",
          subtotal: round2(subtotal),
          total: round2(subtotal * (1 + bdiPct / 100)),
        });

        const metrosDia = currentScheduleRows.find(s => s.id === r.id)?.metrosDia ?? 12;
        const dias = Math.ceil(st.comprimento / metrosDia);
        const today = new Date().toISOString().slice(0, 10);
        newScheduleRows.push({
          id: subId,
          trechoKey: `${st.idInicio}-${st.idFim}`,
          nomeTrecho: st.nomeTrecho || `${st.idInicio}→${st.idFim}`,
          comp: round2(st.comprimento),
          equipe: currentScheduleRows.find(s => s.id === r.id)?.equipe ?? 1,
          metrosDia,
          diasEstimados: dias,
          dataInicio: today,
          dataFim: addDays(today, dias),
          prioridade: newScheduleRows.length + 1,
        });
      });
    }

    setQuantRows(newQuantRows);
    setCostRows(newCostRows);
    setScheduleRows(newScheduleRows);
    setSubdivideTarget(null);
    toast.success(`Trecho subdividido em ${subTrechos.length} sub-trechos.`);
  }, [subdivideTarget, subdivideLength]);

  const handleReunify = useCallback((parentId: string) => {
    const currentQuantRows = quantRowsRef.current;
    const currentCostRows = costRowsRef.current;
    const currentScheduleRows = scheduleRowsRef.current;

    const subQuantRows = currentQuantRows.filter(r => r.parentId === parentId);
    if (subQuantRows.length === 0) return;

    const subTrechos = subQuantRows.map(r => r.originalTrecho).filter(isSubTrecho);
    if (subTrechos.length === 0) return;

    const original = reunifySubTrechos(subTrechos);
    const subIds = new Set(subQuantRows.map(r => r.id));

    const prof = subQuantRows[0].prof;
    const quant = computeQuantities(original, prof);
    const reunifiedId = subQuantRows[0].id.replace(/_S\d+$/, "");

    const newQuantRows = currentQuantRows.filter(r => !subIds.has(r.id));
    const insertIdx = currentQuantRows.findIndex(r => subIds.has(r.id));
    newQuantRows.splice(insertIdx, 0, {
      id: reunifiedId,
      trechoKey: `${original.idInicio}-${original.idFim}`,
      nomeTrecho: original.nomeTrecho || `${original.idInicio}→${original.idFim}`,
      comp: round2(original.comprimento),
      dn: original.diametroMm,
      prof,
      ...quant,
      isSubdivided: false,
      originalTrecho: original,
    });
    setQuantRows(newQuantRows);

    const custoEsc = getEscavacaoCusto(prof);
    const custoTubo = getTuboCusto(original.diametroMm);
    const custoReat = SINAPI_UNIT_COSTS.reaterro;
    const custoPV = getPVCusto(prof);
    const subtotal = quant.escavacao * custoEsc + original.comprimento * custoTubo + quant.reaterro * custoReat + custoPV;
    const bdiPct = 25;
    const newCostRows = currentCostRows.filter(r => !subIds.has(r.id));
    const costInsertIdx = currentCostRows.findIndex(r => subIds.has(r.id));
    newCostRows.splice(costInsertIdx, 0, {
      id: reunifiedId,
      trechoKey: `${original.idInicio}-${original.idFim}`,
      nomeTrecho: original.nomeTrecho || `${original.idInicio}→${original.idFim}`,
      comp: round2(original.comprimento),
      dn: original.diametroMm,
      custoEscavacao: custoEsc,
      custoTubo,
      custoReaterro: custoReat,
      custoPV,
      bdiPct,
      fonte: "SINAPI",
      subtotal: round2(subtotal),
      total: round2(subtotal * (1 + bdiPct / 100)),
    });
    setCostRows(newCostRows);

    const metrosDia = 12;
    const dias = Math.ceil(original.comprimento / metrosDia);
    const today = new Date().toISOString().slice(0, 10);
    const newScheduleRows = currentScheduleRows.filter(r => !subIds.has(r.id));
    const schedInsertIdx = currentScheduleRows.findIndex(r => subIds.has(r.id));
    newScheduleRows.splice(schedInsertIdx, 0, {
      id: reunifiedId,
      trechoKey: `${original.idInicio}-${original.idFim}`,
      nomeTrecho: original.nomeTrecho || `${original.idInicio}→${original.idFim}`,
      comp: round2(original.comprimento),
      equipe: 1,
      metrosDia,
      diasEstimados: dias,
      dataInicio: today,
      dataFim: addDays(today, dias),
      prioridade: schedInsertIdx + 1,
    });
    setScheduleRows(newScheduleRows);

    toast.success("Sub-trechos reunificados.");
  }, []);

  // ── Persistence ──

  const saveEdits = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        quantRows: quantRowsRef.current,
        costRows: costRowsRef.current,
        scheduleRows: scheduleRowsRef.current,
      }));
      toast.success("Edições salvas localmente.");
    } catch {
      toast.error("Erro ao salvar edições.");
    }
  }, []);

  const loadEdits = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { toast.info("Nenhuma edição salva encontrada."); return; }
      const data = JSON.parse(raw);
      if (data.quantRows) setQuantRows(data.quantRows);
      if (data.costRows) setCostRows(data.costRows);
      if (data.scheduleRows) setScheduleRows(data.scheduleRows);
      toast.success("Edições carregadas.");
    } catch {
      toast.error("Erro ao carregar edições.");
    }
  }, []);

  // ── Cost spreadsheet import handler ──

  const handleCustoImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows: Record<string, unknown>[] = [];

      if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      } else {
        const text = await file.text();
        const lines = text.trim().split("\n");
        let delim = ",";
        if (lines[0].includes(";")) delim = ";";
        else if (lines[0].includes("\t")) delim = "\t";
        const headers = lines[0].split(delim).map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(delim).map(p => p.trim());
          const row: Record<string, unknown> = {};
          headers.forEach((h, idx) => { row[h] = parts[idx] || ""; });
          rows.push(row);
        }
      }

      if (rows.length === 0) { toast.error("Planilha de custo vazia."); return; }

      const headers = Object.keys(rows[0]);
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
      const findCol = (names: string[]): string | null => {
        for (const n of names) {
          const found = headers.find(h => normalize(h).includes(n));
          if (found) return found;
        }
        return null;
      };

      const itemCol = findCol(["item", "codigo", "cod"]);
      const descCol = findCol(["descricao", "desc", "servico"]);
      const unCol = findCol(["unidade", "un", "driver"]);
      const precoCol = findCol(["preco", "valor", "custo", "unit"]);
      const fonteCol = findCol(["fonte", "referencia", "ref"]);

      const items: CustoImportItem[] = rows.map((row, i) => ({
        item_custo: itemCol ? String(row[itemCol] || `CUSTO${i + 1}`) : `CUSTO${i + 1}`,
        descricao: descCol ? String(row[descCol] || "") : "",
        unidade: unCol ? String(row[unCol] || "un") : "un",
        preco_unitario: precoCol ? Number(String(row[precoCol]).replace(",", ".")) || 0 : 0,
        fonte: fonteCol ? String(row[fonteCol] || "Importado") : "Importado",
        enabled: true,
      })).filter(item => item.preco_unitario > 0);

      setCustoImportItems(items);
      localStorage.setItem(CUSTO_STORAGE_KEY, JSON.stringify(items));
      toast.success(`${items.length} itens de custo importados.`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar planilha de custo.");
    }
    if (custoFileRef.current) custoFileRef.current.value = "";
  }, []);

  // ── Re-import exported cost spreadsheet (updates per-trecho costs) ──
  const custoReimportRef = useRef<HTMLInputElement>(null);

  const handleCustoReimport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      // Try "Custos por Trecho" sheet first, then "Valores e Custos", then first sheet
      const sheetName = wb.SheetNames.find(n =>
        n.toLowerCase().includes("custo") && n.toLowerCase().includes("trecho")
      ) || wb.SheetNames.find(n =>
        n.toLowerCase().includes("valores") || n.toLowerCase().includes("custo")
      ) || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      if (!sheet) { toast.error("Planilha sem aba de custos."); return; }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      if (rows.length === 0) { toast.error("Planilha de custos vazia."); return; }

      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
      const headers = Object.keys(rows[0]);
      const findCol = (names: string[]): string | null => {
        for (const n of names) {
          const found = headers.find(h => normalize(h).includes(n));
          if (found) return found;
        }
        return null;
      };

      const idCol = findCol(["id"]);
      const trechoCol = findCol(["trecho", "nome"]);
      const escCol = findCol(["escavacao"]);
      const tuboCol = findCol(["tubo"]);
      const reaterroCol = findCol(["reaterro"]);
      const pvCol = findCol(["pv"]);
      const bdiCol = findCol(["bdi"]);
      const fonteCol = findCol(["fonte"]);

      let updated = 0;
      setCostRows(prev => prev.map(row => {
        const matchRow = rows.find(r => {
          if (idCol && String(r[idCol]).trim() === row.id) return true;
          if (trechoCol && String(r[trechoCol]).trim() === row.nomeTrecho) return true;
          return false;
        });
        if (!matchRow) return row;
        updated++;
        const toNum = (v: unknown) => v != null ? Number(String(v).replace(",", ".")) : undefined;
        const newRow = { ...row };
        const esc = escCol ? toNum(matchRow[escCol]) : undefined;
        const tubo = tuboCol ? toNum(matchRow[tuboCol]) : undefined;
        const reat = reaterroCol ? toNum(matchRow[reaterroCol]) : undefined;
        const pv = pvCol ? toNum(matchRow[pvCol]) : undefined;
        const bdi = bdiCol ? toNum(matchRow[bdiCol]) : undefined;
        const fonte = fonteCol ? String(matchRow[fonteCol]).trim() : undefined;

        if (esc != null && !isNaN(esc)) newRow.custoEscavacao = esc;
        if (tubo != null && !isNaN(tubo)) newRow.custoTubo = tubo;
        if (reat != null && !isNaN(reat)) newRow.custoReaterro = reat;
        if (pv != null && !isNaN(pv)) newRow.custoPV = pv;
        if (bdi != null && !isNaN(bdi)) newRow.bdiPct = bdi;
        if (fonte === "SINAPI" || fonte === "Manual") newRow.fonte = fonte;

        // Recalculate subtotal and total
        newRow.subtotal = newRow.custoEscavacao + newRow.custoTubo + newRow.custoReaterro + newRow.custoPV;
        newRow.total = newRow.subtotal * (1 + newRow.bdiPct / 100);
        return newRow;
      }));

      // Also try to import "Itens de Custo" sheet
      const itemsSheet = wb.Sheets["Itens de Custo"];
      if (itemsSheet) {
        const itemRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(itemsSheet);
        if (itemRows.length > 0) {
          const itemHeaders = Object.keys(itemRows[0]);
          const itemFindCol = (names: string[]): string | null => {
            for (const n of names) {
              const found = itemHeaders.find(h => normalize(h).includes(n));
              if (found) return found;
            }
            return null;
          };
          const iItemCol = itemFindCol(["item", "codigo"]);
          const iDescCol = itemFindCol(["descricao", "desc"]);
          const iUnCol = itemFindCol(["unidade", "un"]);
          const iPrecoCol = itemFindCol(["preco", "valor", "custo"]);
          const iFonteCol = itemFindCol(["fonte"]);
          const iAtivoCol = itemFindCol(["ativo"]);

          const items: CustoImportItem[] = itemRows.map((row, i) => ({
            item_custo: iItemCol ? String(row[iItemCol] || `CUSTO${i + 1}`) : `CUSTO${i + 1}`,
            descricao: iDescCol ? String(row[iDescCol] || "") : "",
            unidade: iUnCol ? String(row[iUnCol] || "un") : "un",
            preco_unitario: iPrecoCol ? Number(String(row[iPrecoCol]).replace(",", ".")) || 0 : 0,
            fonte: iFonteCol ? String(row[iFonteCol] || "Importado") : "Importado",
            enabled: iAtivoCol ? String(row[iAtivoCol]).toLowerCase() !== "não" && String(row[iAtivoCol]).toLowerCase() !== "nao" : true,
          })).filter(item => item.preco_unitario > 0 || item.descricao);
          if (items.length > 0) {
            setCustoImportItems(items);
            localStorage.setItem(CUSTO_STORAGE_KEY, JSON.stringify(items));
          }
        }
      }

      toast.success(`${updated} trechos com custos atualizados da planilha reimportada.`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao reimportar planilha de custos.");
    }
    if (custoReimportRef.current) custoReimportRef.current.value = "";
  }, []);

  // ── Re-import exported measurement spreadsheet ──
  const medicaoReimportRef = useRef<HTMLInputElement>(null);

  const handleMedicaoReimport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) { toast.error("Planilha vazia."); return; }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      if (rows.length === 0) { toast.error("Planilha de medição vazia."); return; }

      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
      const headers = Object.keys(rows[0]);
      const findCol = (names: string[]): string | null => {
        for (const n of names) {
          const found = headers.find(h => normalize(h).includes(n));
          if (found) return found;
        }
        return null;
      };

      const trechoCol = findCol(["trecho", "id"]);
      const execCol = findCol(["executado", "exec", "qtd_exec"]);
      const medRealCol = findCol(["med_realiz", "medicao_real"]);
      const custoRealCol = findCol(["custo_real"]);

      let updated = 0;
      setMedicaoTrechos(prev => prev.map(mt => {
        const matchRow = rows.find(r => {
          if (trechoCol && String(r[trechoCol]).trim() === mt.trecho_id) return true;
          return false;
        });
        if (!matchRow) return mt;
        updated++;
        const toNum = (v: unknown) => v != null ? Number(String(v).replace(",", ".")) : undefined;
        const newMt = { ...mt };
        const exec = execCol ? toNum(matchRow[execCol]) : undefined;
        const medReal = medRealCol ? toNum(matchRow[medRealCol]) : undefined;
        const custoReal = custoRealCol ? toNum(matchRow[custoRealCol]) : undefined;

        if (exec != null && !isNaN(exec)) {
          newMt.qtd_executada = exec;
          newMt.pct_executado = mt.comprimento > 0 ? (exec / mt.comprimento) * 100 : 0;
        }
        if (medReal != null && !isNaN(medReal)) newMt.med_realizada = medReal;
        if (custoReal != null && !isNaN(custoReal)) newMt.custo_real = custoReal;
        return newMt;
      }));

      toast.success(`${updated} trechos de medição atualizados da planilha reimportada.`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao reimportar planilha de medição.");
    }
    if (medicaoReimportRef.current) medicaoReimportRef.current.value = "";
  }, []);

  // ── Measurement (Medição) handlers — with column mapping ──

  const handleMedicaoImportStep1 = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows: Record<string, unknown>[] = [];

      if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      } else {
        const text = await file.text();
        const lines = text.trim().split("\n");
        let delim = ",";
        if (lines[0].includes(";")) delim = ";";
        else if (lines[0].includes("\t")) delim = "\t";
        const headers = lines[0].split(delim).map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(delim).map(p => p.trim());
          const row: Record<string, unknown> = {};
          headers.forEach((h, idx) => { row[h] = parts[idx] || ""; });
          rows.push(row);
        }
      }

      if (rows.length === 0) { toast.error("Planilha de medicao vazia."); return; }

      const spreadsheetHeaders = Object.keys(rows[0]);

      // Auto-suggest mappings based on common column names
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
      const suggestMap: Record<string, string> = {};

      const suggestions: Record<string, string[]> = {
        item_medicao: ["item_medicao", "item", "codigo", "cod"],
        descricao: ["descricao", "desc", "servico", "nome"],
        tipo_rede: ["tipo_rede", "tipo", "rede", "sistema"],
        dn_min: ["dn_min", "diametro_min", "dn_de"],
        dn_max: ["dn_max", "diametro_max", "dn_ate"],
        driver: ["driver", "unidade", "un"],
        regra_quantidade: ["regra_quantidade", "regra", "quantidade_campo", "campo"],
        preco_unitario: ["preco_unitario", "preco", "valor", "custo"],
      };

      for (const [field, names] of Object.entries(suggestions)) {
        for (const n of names) {
          const found = spreadsheetHeaders.find(h => normalize(h).includes(n));
          if (found) { suggestMap[field] = found; break; }
        }
      }

      setColumnMapping({
        spreadsheetHeaders,
        rawData: rows,
        mappings: suggestMap,
        extraColumns: spreadsheetHeaders.filter(h => !Object.values(suggestMap).includes(h)),
        confirmed: false,
      });

      toast.info(`Planilha carregada com ${rows.length} linhas e ${spreadsheetHeaders.length} colunas. Mapeie as colunas abaixo.`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao ler planilha de medicao.");
    }
    if (medicaoFileRef.current) medicaoFileRef.current.value = "";
  }, []);

  const handleColumnMappingChange = useCallback((field: string, column: string) => {
    setColumnMapping(prev => {
      if (!prev) return prev;
      return { ...prev, mappings: { ...prev.mappings, [field]: column === "__none__" ? "" : column } };
    });
  }, []);

  const confirmColumnMapping = useCallback(() => {
    if (!columnMapping) return;
    const { rawData, mappings, extraColumns } = columnMapping;

    if (!mappings.preco_unitario) {
      toast.error("Coluna de Preco Unitario e obrigatoria.");
      return;
    }

    const items: MedicaoItem[] = rawData.map((row, i) => {
      const preco = Number(String(row[mappings.preco_unitario] || "0").replace(",", "."));
      if (isNaN(preco) || preco <= 0) return null;

      return {
        item_medicao: mappings.item_medicao ? String(row[mappings.item_medicao] || `ITEM${i + 1}`) : `ITEM${i + 1}`,
        descricao: mappings.descricao ? String(row[mappings.descricao] || "") : "",
        tipo_rede: mappings.tipo_rede ? String(row[mappings.tipo_rede] || "ESGOTO").toUpperCase() : "ESGOTO",
        dn_min: mappings.dn_min ? Number(row[mappings.dn_min]) || 0 : 0,
        dn_max: mappings.dn_max ? Number(row[mappings.dn_max]) || 9999 : 9999,
        driver: mappings.driver ? String(row[mappings.driver] || "m") : "m",
        regra_quantidade: mappings.regra_quantidade ? String(row[mappings.regra_quantidade] || "comprimento") : "comprimento",
        preco_unitario: preco,
      };
    }).filter(Boolean) as MedicaoItem[];

    setMedicaoItems(items);
    saveMedicaoItems(items);

    // Save extra column data from file — user chose these columns
    if (extraColumns.length > 0) {
      const extraData: Record<string, Record<string, unknown>> = {};
      rawData.forEach((row, i) => {
        const itemKey = mappings.item_medicao ? String(row[mappings.item_medicao] || `ITEM${i + 1}`) : `ITEM${i + 1}`;
        const extra: Record<string, unknown> = {};
        for (const col of extraColumns) {
          extra[col] = row[col];
        }
        extraData[itemKey] = extra;
      });
      setMedicaoExtraData(extraData);
    }

    // Initialize all items as enabled
    const enabledMap: Record<string, boolean> = {};
    items.forEach((_, idx) => { enabledMap[String(idx)] = true; });
    setMedicaoEnabled(enabledMap);
    setColumnMapping(prev => prev ? { ...prev, confirmed: true } : prev);

    // Auto-calculate if we have trechos loaded
    if (trechos.length > 0) {
      const medTrechos = calcularMedicaoPorTrecho(trechos, quantityRows || [], items);
      setMedicaoTrechos(medTrechos);
      saveMedicaoTrechos(medTrechos);
      saveModuleData("medicaoTrechos", medTrechos);
    }

    toast.success(`${items.length} itens de medicao mapeados e importados${extraColumns.length > 0 ? ` com ${extraColumns.length} colunas extras` : ""}.`);
  }, [columnMapping, trechos, quantityRows]);

  const cancelColumnMapping = useCallback(() => {
    setColumnMapping(null);
  }, []);

  // ── Cost item management handlers ──

  const toggleCustoItem = useCallback((idx: number) => {
    setCustoImportItems(prev => prev.map((item, i) => i === idx ? { ...item, enabled: !item.enabled } : item));
  }, []);

  const toggleAllCustoItems = useCallback((enabled: boolean) => {
    setCustoImportItems(prev => prev.map(item => ({ ...item, enabled })));
  }, []);

  const updateCustoItem = useCallback((idx: number, field: keyof CustoImportItem, value: string | number) => {
    setCustoImportItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }, []);

  const removeCustoItem = useCallback((idx: number) => {
    setCustoImportItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addCustoItemManual = useCallback(() => {
    setCustoImportItems(prev => [...prev, {
      item_custo: `MANUAL${prev.length + 1}`,
      descricao: "Novo item",
      unidade: "un",
      preco_unitario: 0,
      fonte: "Manual",
      enabled: true,
    }]);
  }, []);

  const saveCustoToStorage = useCallback(() => {
    localStorage.setItem(CUSTO_STORAGE_KEY, JSON.stringify(custoImportItems));
    toast.success("Planilha de custo salva.");
  }, [custoImportItems]);

  // ── Measurement item management handlers ──

  const toggleMedicaoItem = useCallback((idx: number) => {
    setMedicaoEnabled(prev => {
      const key = String(idx);
      return { ...prev, [key]: !(prev[key] ?? true) };
    });
  }, []);

  const toggleAllMedicaoItems = useCallback((enabled: boolean) => {
    setMedicaoEnabled(prev => {
      const next = { ...prev };
      medicaoItems.forEach((_, idx) => { next[String(idx)] = enabled; });
      return next;
    });
  }, [medicaoItems]);

  const updateMedicaoItem = useCallback((idx: number, field: keyof MedicaoItem, value: string | number) => {
    setMedicaoItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }, []);

  const removeMedicaoItem = useCallback((idx: number) => {
    setMedicaoItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addMedicaoItemManual = useCallback(() => {
    setMedicaoItems(prev => [...prev, {
      item_medicao: `MED${prev.length + 1}`,
      descricao: "Novo item de medição",
      tipo_rede: "ESGOTO",
      dn_min: 0,
      dn_max: 9999,
      driver: "m",
      regra_quantidade: "comprimento",
      preco_unitario: 0,
    }]);
  }, []);

  const saveMedicaoToStorage = useCallback(() => {
    saveMedicaoItems(medicaoItems);
    toast.success("Itens de medição salvos.");
  }, [medicaoItems]);

  // ── Schedule bulk update ──

  const applyScheduleGlobal = useCallback(() => {
    setScheduleRows(prev => {
      let diaAcum = 0;
      return prev.map(r => {
        const dias = Math.ceil(r.comp / (schedGlobalProdutividade * schedGlobalEquipes));
        const inicio = new Date(schedGlobalDataInicio);
        inicio.setDate(inicio.getDate() + diaAcum);
        const fim = new Date(inicio);
        fim.setDate(fim.getDate() + dias);
        diaAcum += dias;
        return {
          ...r,
          equipe: schedGlobalEquipes,
          metrosDia: schedGlobalProdutividade,
          diasEstimados: dias,
          dataInicio: inicio.toISOString().slice(0, 10),
          dataFim: fim.toISOString().slice(0, 10),
        };
      });
    });
    toast.success("Cronograma recalculado com novos parâmetros.");
  }, [schedGlobalProdutividade, schedGlobalEquipes, schedGlobalDataInicio]);

  const recalcularMedicaoHandler = useCallback(() => {
    if (trechos.length === 0) {
      toast.error("Sem trechos carregados.");
      return;
    }
    if (medicaoItems.length === 0) {
      toast.error("Sem planilha de medição importada.");
      return;
    }
    // Filter only enabled items
    const enabledItems = medicaoItems.filter((_, idx) => medicaoEnabled[String(idx)] ?? true);
    if (enabledItems.length === 0) {
      toast.error("Nenhum item de medição habilitado. Ative pelo menos um item.");
      return;
    }
    const medTrechos = calcularMedicaoPorTrecho(
      trechos,
      quantityRows || [],
      enabledItems,
    );
    // Apply user execution states
    const updatedMedTrechos = medTrechos.map(m => {
      const execState = trechoExecStates[m.trecho_id];
      if (execState) {
        const qtd = execState.qtdExecutada;
        return {
          ...m,
          qtd_executada: qtd,
          pct_executado: m.comprimento > 0 ? (qtd / m.comprimento) * 100 : 0,
          med_realizada: m.med_total * (m.comprimento > 0 ? qtd / m.comprimento : 0),
        };
      }
      return m;
    });
    setMedicaoTrechos(updatedMedTrechos);
    saveMedicaoTrechos(updatedMedTrechos);
    saveModuleData("medicaoTrechos", updatedMedTrechos);
    toast.success(`Medição recalculada com ${enabledItems.length} itens ativos.`);
  }, [trechos, quantityRows, medicaoItems, medicaoEnabled, trechoExecStates]);

  // Execution tracking handlers
  const updateTrechoExecStatus = useCallback((trechoId: string, status: TrechoExecStatus) => {
    setTrechoExecStates(prev => {
      const current = prev[trechoId] || { status: "pendente", qtdExecutada: 0, dataExecucao: "", observacao: "" };
      const trecho = trechos.find((_, idx) => `T${String(idx + 1).padStart(2, "0")}` === trechoId);
      const comp = trecho?.comprimento || 0;

      const updated = {
        ...prev,
        [trechoId]: {
          ...current,
          status,
          qtdExecutada: status === "concluido" || status === "medido" ? comp : current.qtdExecutada,
          dataExecucao: status !== "pendente" ? (current.dataExecucao || new Date().toISOString().slice(0, 10)) : "",
        },
      };
      localStorage.setItem("hydronetwork_trecho_exec", JSON.stringify(updated));

      // Update medicaoTrechos execution data
      setMedicaoTrechos(medPrev => medPrev.map(m => {
        const exec = updated[m.trecho_id];
        if (!exec) return m;
        const qtd = exec.qtdExecutada;
        return {
          ...m,
          qtd_executada: qtd,
          pct_executado: m.comprimento > 0 ? (qtd / m.comprimento) * 100 : 0,
          med_realizada: m.med_total * (m.comprimento > 0 ? qtd / m.comprimento : 0),
        };
      }));

      return updated;
    });
  }, [trechos]);

  const updateTrechoExecQtd = useCallback((trechoId: string, qtd: number) => {
    setTrechoExecStates(prev => {
      const current = prev[trechoId] || { status: "em_execucao", qtdExecutada: 0, dataExecucao: new Date().toISOString().slice(0, 10), observacao: "" };
      const updated = {
        ...prev,
        [trechoId]: { ...current, qtdExecutada: qtd, status: qtd > 0 ? "em_execucao" as TrechoExecStatus : current.status },
      };
      localStorage.setItem("hydronetwork_trecho_exec", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const toggleExtraColumn = useCallback((col: string) => {
    setColumnMapping(prev => {
      if (!prev) return prev;
      const extras = prev.extraColumns.includes(col)
        ? prev.extraColumns.filter(c => c !== col)
        : [...prev.extraColumns, col];
      return { ...prev, extraColumns: extras };
    });
  }, []);

  const exportMedicaoHandler = useCallback(() => {
    if (medicaoTrechos.length === 0) {
      toast.error("Sem dados de medição.");
      return;
    }
    exportMedicaoExcel(medicaoTrechos);
    toast.success("Planilha de medição exportada.");
  }, [medicaoTrechos]);

  const getCostRowsForExport = useCallback((): CostRowExport[] => {
    return costRowsRef.current.map(r => ({
      id: r.id,
      trechoKey: r.trechoKey,
      nomeTrecho: r.nomeTrecho,
      comp: r.comp,
      dn: r.dn,
      custoEscavacao: r.custoEscavacao,
      custoTubo: r.custoTubo,
      custoReaterro: r.custoReaterro,
      custoPV: r.custoPV,
      bdiPct: r.bdiPct,
      fonte: r.fonte,
      subtotal: r.subtotal,
      total: r.total,
    }));
  }, []);

  const exportGeoJSONHandler = useCallback(() => {
    downloadGeoJSON(trechos, quantityRows || [], medicaoTrechos, getCostRowsForExport());
    toast.success("GeoJSON exportado com todos os atributos (incluindo custos).");
  }, [trechos, quantityRows, medicaoTrechos, getCostRowsForExport]);

  const exportGISCSVHandler = useCallback(() => {
    downloadGISCSV(trechos, quantityRows || [], medicaoTrechos, getCostRowsForExport());
    toast.success("CSV GIS exportado com custos.");
  }, [trechos, quantityRows, medicaoTrechos, getCostRowsForExport]);

  const exportGISExcelHandler = useCallback(() => {
    exportGISExcel(trechos, quantityRows || [], medicaoTrechos, getCostRowsForExport());
    toast.success("XLSX GIS exportado com custos.");
  }, [trechos, quantityRows, medicaoTrechos, getCostRowsForExport]);

  const exportCustoSpreadsheetHandler = useCallback(() => {
    const cRows = getCostRowsForExport();
    const custoItems: CustoImportItemExport[] = custoImportItems.map(item => ({
      item_custo: item.item_custo,
      descricao: item.descricao,
      unidade: item.unidade,
      preco_unitario: item.preco_unitario,
      fonte: item.fonte,
      enabled: item.enabled,
    }));
    if (cRows.length === 0 && custoItems.length === 0) {
      toast.error("Sem dados de custo para exportar.");
      return;
    }
    exportCustoSpreadsheet(custoItems, cRows);
    toast.success("Planilha de custos exportada.");
  }, [getCostRowsForExport, custoImportItems]);

  const medicaoSummary = useMemo<MedicaoSummary | null>(() => {
    if (medicaoTrechos.length === 0) return null;
    try { return calcularResumoMedicao(medicaoTrechos); } catch { return null; }
  }, [medicaoTrechos]);

  // ── Export XLSX ──

  const exportExcel = useCallback(() => {
    const currentQuantRows = quantRowsRef.current;
    const currentCostRows = costRowsRef.current;
    const currentScheduleRows = scheduleRowsRef.current;

    if (currentQuantRows.length === 0) { toast.error("Sem dados para exportar."); return; }
    const wb = XLSX.utils.book_new();

    const qData = currentQuantRows.map(r => ({
      ID: r.id, Trecho: r.nomeTrecho, "Comp (m)": r.comp, "DN (mm)": r.dn,
      "Prof (m)": r.prof, "Escavação (m³)": r.escavacao, "Reaterro (m³)": r.reaterro,
      "Bota-fora (m³)": r.botafora, "Pavimento (m²)": r.pavimento,
      "Escoramento (m²)": r.escoramento, Subdividido: r.isSubdivided ? "Sim" : "Não",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qData), "Quantitativos");

    const cData = currentCostRows.map(r => ({
      ID: r.id, Trecho: r.nomeTrecho, "Comp (m)": r.comp,
      "Escavação (R$/m³)": r.custoEscavacao, "Tubo (R$/m)": r.custoTubo,
      "Reaterro (R$/m³)": r.custoReaterro, "PV (R$/un)": r.custoPV,
      "BDI (%)": r.bdiPct, Fonte: r.fonte, "Subtotal (R$)": r.subtotal, "Total (R$)": r.total,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cData), "Valores e Custos");

    const sData = currentScheduleRows.map(r => ({
      ID: r.id, Trecho: r.nomeTrecho, "Comp (m)": r.comp, Equipe: r.equipe,
      "Metros/dia": r.metrosDia, "Dias Estimados": r.diasEstimados,
      "Data Início": r.dataInicio, "Data Fim": r.dataFim, Prioridade: r.prioridade,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sData), "Cronograma");

    XLSX.writeFile(wb, "edicao_por_trecho.xlsx");
    toast.success("Planilha exportada.");
  }, []);

  // ── Summaries ──

  const quantSummary = useMemo(() => ({
    totalComp: quantRows.reduce((s, r) => s + r.comp, 0),
    totalEscavacao: quantRows.reduce((s, r) => s + r.escavacao, 0),
    totalReaterro: quantRows.reduce((s, r) => s + r.reaterro, 0),
    totalPavimento: quantRows.reduce((s, r) => s + r.pavimento, 0),
    count: quantRows.length,
  }), [quantRows]);

  const costSummary = useMemo(() => ({
    totalSubtotal: costRows.reduce((s, r) => s + r.subtotal, 0),
    totalFinal: costRows.reduce((s, r) => s + r.total, 0),
  }), [costRows]);

  const scheduleSummary = useMemo(() => ({
    totalDias: Math.max(0, ...scheduleRows.map(r => r.diasEstimados)),
    totalMetros: scheduleRows.reduce((s, r) => s + r.comp, 0),
  }), [scheduleRows]);

  // ── Virtualizers ──

  const quantVirtualizer = useVirtualizer({
    count: filteredQuantRows.length,
    getScrollElement: () => quantScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: VIRTUALIZER_OVERSCAN,
  });

  const costVirtualizer = useVirtualizer({
    count: filteredCostRows.length,
    getScrollElement: () => costScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: VIRTUALIZER_OVERSCAN,
  });

  const scheduleVirtualizer = useVirtualizer({
    count: filteredScheduleRows.length,
    getScrollElement: () => scheduleScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: VIRTUALIZER_OVERSCAN,
  });

  // Virtualizer spacer helpers
  const quantVirtualItems = quantVirtualizer.getVirtualItems();
  const quantPaddingTop = quantVirtualItems[0]?.start ?? 0;
  const quantPaddingBottom = quantVirtualizer.getTotalSize() - (quantVirtualItems.at(-1)?.end ?? 0);

  const costVirtualItems = costVirtualizer.getVirtualItems();
  const costPaddingTop = costVirtualItems[0]?.start ?? 0;
  const costPaddingBottom = costVirtualizer.getTotalSize() - (costVirtualItems.at(-1)?.end ?? 0);

  const scheduleVirtualItems = scheduleVirtualizer.getVirtualItems();
  const schedulePaddingTop = scheduleVirtualItems[0]?.start ?? 0;
  const schedulePaddingBottom = scheduleVirtualizer.getTotalSize() - (scheduleVirtualItems.at(-1)?.end ?? 0);

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Edição por Trecho
              </CardTitle>
              <CardDescription>
                Edite quantitativos, valores e cronograma por trecho. Referência SINAPI 01/2026.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={initializeRows}>
                <RefreshCw className="h-4 w-4 mr-1" /> Carregar Trechos
              </Button>
              <Button size="sm" variant="outline" onClick={loadEdits}>
                Restaurar Edições
              </Button>
              <Button size="sm" variant="outline" onClick={saveEdits}>
                Salvar Edições
              </Button>
              <Button size="sm" variant="outline" onClick={exportExcel}>
                <Download className="h-4 w-4 mr-1" /> XLSX
              </Button>
              <Button size="sm" variant="outline" onClick={exportGeoJSONHandler}>
                <MapPin className="h-4 w-4 mr-1" /> GeoJSON
              </Button>
              <Button size="sm" variant="outline" onClick={exportGISCSVHandler}>
                <FileDown className="h-4 w-4 mr-1" /> CSV GIS
              </Button>
              <Button size="sm" variant="outline" onClick={exportCustoSpreadsheetHandler}>
                <DollarSign className="h-4 w-4 mr-1" /> Planilha Custos
              </Button>
              <input ref={custoReimportRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleCustoReimport} />
              <Button size="sm" variant="outline" onClick={() => custoReimportRef.current?.click()} title="Reimportar planilha de custos editada">
                <Upload className="h-4 w-4 mr-1" /> Reimportar Custos
              </Button>
              <input ref={medicaoReimportRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleMedicaoReimport} />
              <Button size="sm" variant="outline" onClick={() => {
                if (medicaoTrechos.length === 0) { toast.error("Exporte a medição antes de reimportar."); return; }
                medicaoReimportRef.current?.click();
              }} title="Reimportar planilha de medição editada">
                <Upload className="h-4 w-4 mr-1" /> Reimportar Medição
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <Label className="text-xs">Buscar trecho</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nome do trecho..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="pl-7 h-8 w-48 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Comp. mín. (m)</Label>
              <Input type="number" value={compMinFilter} onChange={e => setCompMinFilter(e.target.value)} className="h-8 w-24 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Comp. máx. (m)</Label>
              <Input type="number" value={compMaxFilter} onChange={e => setCompMaxFilter(e.target.value)} className="h-8 w-24 text-xs" />
            </div>
            {quantRows.length > 0 && (
              <div className="flex gap-2 ml-auto">
                <Badge variant="secondary">{quantSummary.count} trechos</Badge>
                <Badge variant="outline">{fmt(quantSummary.totalComp)} m</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subdivision Dialog */}
      {subdivideTarget && (
        <Card className="border-orange-300 bg-orange-50/50">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Scissors className="h-5 w-5 text-orange-600" />
              <span className="text-sm font-medium">
                Subdividir trecho: <strong>{quantRows.find(r => r.id === subdivideTarget)?.nomeTrecho}</strong> ({fmt(quantRows.find(r => r.id === subdivideTarget)?.comp ?? 0)} m)
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <Label className="text-xs">Comprimento (m):</Label>
                <Input
                  type="number"
                  value={subdivideLength}
                  onChange={e => setSubdivideLength(e.target.value)}
                  className="h-8 w-24 text-xs"
                />
                <Button size="sm" onClick={confirmSubdivide}>Confirmar</Button>
                <Button size="sm" variant="ghost" onClick={() => setSubdivideTarget(null)}>Cancelar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="quantitativos" className="flex items-center gap-1">
            <Calculator className="h-4 w-4" /> Quantitativos
          </TabsTrigger>
          <TabsTrigger value="valores" className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" /> Custos
          </TabsTrigger>
          <TabsTrigger value="custo-planilha" className="flex items-center gap-1">
            <FileSpreadsheet className="h-4 w-4" /> Planilha Custo
          </TabsTrigger>
          <TabsTrigger value="medicao" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" /> Medicao
          </TabsTrigger>
          <TabsTrigger value="cronograma" className="flex items-center gap-1">
            <Calendar className="h-4 w-4" /> Cronograma
          </TabsTrigger>
          <TabsTrigger value="base-personalizada" className="flex items-center gap-1">
            <Layers className="h-4 w-4" /> Base Custom
          </TabsTrigger>
        </TabsList>

        {/* ── Quantitativos Tab ── */}
        <TabsContent value="quantitativos">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Quantitativos por Trecho</CardTitle>
                <Button size="sm" variant="outline" onClick={recalculateQuantities}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Recalcular
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredQuantRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Clique em "Carregar Trechos" para iniciar a edição.
                </p>
              ) : (
                <div ref={quantScrollRef} className="overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                      <TableRow>
                        <TableHead className="text-xs w-8">ID</TableHead>
                        <TableHead className="text-xs">Trecho</TableHead>
                        <TableHead className="text-xs">Comp (m)</TableHead>
                        <TableHead className="text-xs">DN (mm)</TableHead>
                        <TableHead className="text-xs">Prof (m)</TableHead>
                        <TableHead className="text-xs">Escavação (m³)</TableHead>
                        <TableHead className="text-xs">Reaterro (m³)</TableHead>
                        <TableHead className="text-xs">Bota-fora (m³)</TableHead>
                        <TableHead className="text-xs">Pavim. (m²)</TableHead>
                        <TableHead className="text-xs">Escor. (m²)</TableHead>
                        <TableHead className="text-xs w-20">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quantPaddingTop > 0 && (
                        <tr><td colSpan={11} style={{ height: quantPaddingTop, padding: 0, border: "none" }} /></tr>
                      )}
                      {quantVirtualItems.map(vi => (
                        <MemoQuantRow
                          key={filteredQuantRows[vi.index].id}
                          row={filteredQuantRows[vi.index]}
                          onFieldChange={updateQuantField}
                          onSubdivide={handleSubdivide}
                          onReunify={handleReunify}
                        />
                      ))}
                      {quantPaddingBottom > 0 && (
                        <tr><td colSpan={11} style={{ height: quantPaddingBottom, padding: 0, border: "none" }} /></tr>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Summary */}
              {quantRows.length > 0 && (
                <div className="mt-4 grid grid-cols-4 gap-3">
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <p className="text-xs text-muted-foreground">Extensão Total</p>
                    <p className="font-semibold text-sm">{fmt(quantSummary.totalComp)} m</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <p className="text-xs text-muted-foreground">Escavação Total</p>
                    <p className="font-semibold text-sm">{fmt(quantSummary.totalEscavacao)} m³</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <p className="text-xs text-muted-foreground">Reaterro Total</p>
                    <p className="font-semibold text-sm">{fmt(quantSummary.totalReaterro)} m³</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <p className="text-xs text-muted-foreground">Pavimento Total</p>
                    <p className="font-semibold text-sm">{fmt(quantSummary.totalPavimento)} m²</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Valores / Custos Tab ── */}
        <TabsContent value="valores">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Valores e Custos Unitários por Trecho</CardTitle>
              <CardDescription className="text-xs">
                Valores padrão: SINAPI Desonerado 01/2026. Edite para sobrescrever.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredCostRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Clique em "Carregar Trechos" para iniciar.
                </p>
              ) : (
                <div ref={costScrollRef} className="overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                      <TableRow>
                        <TableHead className="text-xs">Trecho</TableHead>
                        <TableHead className="text-xs">Comp (m)</TableHead>
                        <TableHead className="text-xs">Escav. (R$/m³)</TableHead>
                        <TableHead className="text-xs">Tubo (R$/m)</TableHead>
                        <TableHead className="text-xs">Reaterro (R$/m³)</TableHead>
                        <TableHead className="text-xs">PV (R$/un)</TableHead>
                        <TableHead className="text-xs">BDI (%)</TableHead>
                        <TableHead className="text-xs">Fonte</TableHead>
                        <TableHead className="text-xs">Subtotal</TableHead>
                        <TableHead className="text-xs">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costPaddingTop > 0 && (
                        <tr><td colSpan={10} style={{ height: costPaddingTop, padding: 0, border: "none" }} /></tr>
                      )}
                      {costVirtualItems.map(vi => (
                        <MemoCostRow
                          key={filteredCostRows[vi.index].id}
                          row={filteredCostRows[vi.index]}
                          onFieldChange={updateCostField}
                        />
                      ))}
                      {costPaddingBottom > 0 && (
                        <tr><td colSpan={10} style={{ height: costPaddingBottom, padding: 0, border: "none" }} /></tr>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Cost Summary */}
              {costRows.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded p-3 text-center">
                    <p className="text-xs text-muted-foreground">Subtotal (sem BDI)</p>
                    <p className="font-semibold text-lg">{fmtC(costSummary.totalSubtotal)}</p>
                  </div>
                  <div className="bg-primary/10 rounded p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total Geral (com BDI)</p>
                    <p className="font-bold text-lg text-primary">{fmtC(costSummary.totalFinal)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Planilha Custo Tab ── */}
        <TabsContent value="custo-planilha">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Planilha de Custo</CardTitle>
                  <CardDescription className="text-xs">
                    Importe ou crie manualmente itens de custo. Selecione quais itens usar e edite valores diretamente.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={custoFileRef}
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    className="hidden"
                    onChange={handleCustoImport}
                  />
                  <Button size="sm" onClick={() => custoFileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> Importar
                  </Button>
                  <Button size="sm" variant="outline" onClick={addCustoItemManual}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                  </Button>
                  {custoImportItems.length > 0 && (
                    <>
                      <Button size="sm" variant="outline" onClick={saveCustoToStorage}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportCustoSpreadsheetHandler}>
                        <Download className="h-4 w-4 mr-1" /> Exportar XLSX
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => custoReimportRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-1" /> Reimportar XLSX
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {custoImportItems.length === 0 ? (
                <div className="py-8 text-center">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Importe uma planilha ou adicione itens manualmente.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A planilha deve conter colunas como: item/codigo, descricao, unidade, preco_unitario
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{custoImportItems.filter(i => i.enabled).length}/{custoImportItems.length} ativos</Badge>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => toggleAllCustoItems(true)}>
                      <ToggleLeft className="h-3 w-3 mr-1" /> Ativar todos
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => toggleAllCustoItems(false)}>
                      Desativar todos
                    </Button>
                    <div className="ml-auto">
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-red-600" onClick={() => { setCustoImportItems([]); localStorage.removeItem(CUSTO_STORAGE_KEY); toast.success("Planilha de custo removida."); }}>
                        <Trash2 className="h-3 w-3 mr-1" /> Limpar tudo
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                        <TableRow>
                          <TableHead className="text-xs w-8">Usar</TableHead>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs">Descricao</TableHead>
                          <TableHead className="text-xs">Unidade</TableHead>
                          <TableHead className="text-xs">Preco Unitario</TableHead>
                          <TableHead className="text-xs">Fonte</TableHead>
                          <TableHead className="text-xs w-16">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {custoImportItems.map((item, idx) => (
                          <TableRow key={idx} className={!item.enabled ? "opacity-40" : ""}>
                            <TableCell>
                              <Checkbox checked={item.enabled} onCheckedChange={() => toggleCustoItem(idx)} />
                            </TableCell>
                            {custoEditIdx === idx ? (
                              <>
                                <TableCell><Input value={item.item_custo} onChange={e => updateCustoItem(idx, "item_custo", e.target.value)} className="h-7 text-xs w-24" /></TableCell>
                                <TableCell><Input value={item.descricao} onChange={e => updateCustoItem(idx, "descricao", e.target.value)} className="h-7 text-xs w-40" /></TableCell>
                                <TableCell><Input value={item.unidade} onChange={e => updateCustoItem(idx, "unidade", e.target.value)} className="h-7 text-xs w-16" /></TableCell>
                                <TableCell><Input type="number" value={item.preco_unitario} onChange={e => updateCustoItem(idx, "preco_unitario", parseFloat(e.target.value) || 0)} className="h-7 text-xs w-24" /></TableCell>
                                <TableCell><Input value={item.fonte} onChange={e => updateCustoItem(idx, "fonte", e.target.value)} className="h-7 text-xs w-20" /></TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setCustoEditIdx(null)}>
                                    <Check className="h-3 w-3 text-green-600" />
                                  </Button>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="text-xs font-mono">{item.item_custo}</TableCell>
                                <TableCell className="text-xs max-w-[250px] truncate" title={item.descricao}>{item.descricao}</TableCell>
                                <TableCell className="text-xs">{item.unidade}</TableCell>
                                <TableCell className="text-xs font-medium">{fmtC(item.preco_unitario)}</TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant="outline" className="text-[10px]">{item.fonte}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setCustoEditIdx(idx)}>
                                      <Edit3 className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => removeCustoItem(idx)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Itens Ativos</p>
                      <p className="font-semibold text-sm">{custoImportItems.filter(i => i.enabled).length} de {custoImportItems.length}</p>
                    </div>
                    <div className="bg-muted/50 rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Valor Total (ativos)</p>
                      <p className="font-semibold text-sm">{fmtC(custoImportItems.filter(i => i.enabled).reduce((s, i) => s + i.preco_unitario, 0))}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Medição Tab ── */}
        <TabsContent value="medicao">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Medicao por Trecho</CardTitle>
                  <CardDescription className="text-xs">
                    Importe ou crie itens de medição. Selecione quais itens usar e edite valores. Recalcule para aplicar.
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input
                    ref={medicaoFileRef}
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    className="hidden"
                    onChange={handleMedicaoImportStep1}
                  />
                  <Button size="sm" onClick={() => medicaoFileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> Importar
                  </Button>
                  <Button size="sm" variant="outline" onClick={addMedicaoItemManual}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                  </Button>
                  {medicaoItems.length > 0 && (
                    <>
                      <Button size="sm" variant="outline" onClick={saveMedicaoToStorage}>
                        Salvar Itens
                      </Button>
                      <Button size="sm" onClick={recalcularMedicaoHandler}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Recalcular
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportMedicaoHandler}>
                        <Download className="h-4 w-4 mr-1" /> Exportar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Column Mapping Dialog */}
              {columnMapping && !columnMapping.confirmed && (
                <Card className="mb-4 border-blue-300 bg-blue-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-blue-600" />
                      Mapeamento de Colunas da Planilha
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Selecione qual coluna da sua planilha corresponde a cada campo.
                      Colunas encontradas: <strong>{columnMapping.spreadsheetHeaders.join(", ")}</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Preview of spreadsheet data */}
                    <div className="mb-3 p-2 bg-muted/50 rounded text-xs">
                      <p className="font-medium mb-1">Amostra dos dados ({columnMapping.rawData.length} linhas):</p>
                      <div className="overflow-auto max-h-24">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {columnMapping.spreadsheetHeaders.map(h => (
                                <TableHead key={h} className="text-[10px] py-1">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {columnMapping.rawData.slice(0, 3).map((row, idx) => (
                              <TableRow key={idx}>
                                {columnMapping.spreadsheetHeaders.map(h => (
                                  <TableCell key={h} className="text-[10px] py-0.5 max-w-[100px] truncate">
                                    {String(row[h] || "")}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Field mapping selectors */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {MEDICAO_FIELDS.map(field => (
                        <div key={field.key}>
                          <Label className="text-xs">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-0.5">*</span>}
                          </Label>
                          <Select
                            value={columnMapping.mappings[field.key] || "__none__"}
                            onValueChange={v => handleColumnMappingChange(field.key, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione coluna..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="text-xs text-muted-foreground">
                                -- Nao mapear --
                              </SelectItem>
                              {columnMapping.spreadsheetHeaders.map(h => (
                                <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>

                    {/* Extra columns selection — user decides what to include */}
                    <div className="mt-3 p-2 bg-yellow-50/50 rounded border border-yellow-200">
                      <p className="text-xs font-medium mb-2 flex items-center gap-1">
                        <Filter className="h-3 w-3" />
                        Colunas extras da sua planilha (voce decide o que incluir):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {columnMapping.spreadsheetHeaders
                          .filter(h => !Object.values(columnMapping.mappings).includes(h))
                          .map(col => (
                            <label key={col} className="flex items-center gap-1 text-xs cursor-pointer">
                              <Checkbox
                                checked={columnMapping.extraColumns.includes(col)}
                                onCheckedChange={() => toggleExtraColumn(col)}
                              />
                              {col}
                            </label>
                          ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Marque as colunas adicionais que deseja importar junto com os itens de medicao.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={confirmColumnMapping}>
                        <Check className="h-4 w-4 mr-1" /> Confirmar Mapeamento e Importar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelColumnMapping}>
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Imported items with selection and editing */}
              {medicaoItems.length > 0 && (
                <div className="mb-4 p-3 bg-muted/50 rounded">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <p className="text-sm font-medium">Itens de Medicao: {medicaoItems.filter((_, i) => medicaoEnabled[String(i)] ?? true).length}/{medicaoItems.length} ativos</p>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => toggleAllMedicaoItems(true)}>
                      <ToggleLeft className="h-3 w-3 mr-1" /> Ativar todos
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => toggleAllMedicaoItems(false)}>
                      Desativar todos
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-red-600 ml-auto" onClick={() => { setMedicaoItems([]); setMedicaoEnabled({}); setMedicaoTrechos([]); toast.success("Itens removidos."); }}>
                      <Trash2 className="h-3 w-3 mr-1" /> Limpar
                    </Button>
                  </div>
                  <div className="overflow-auto" style={{ maxHeight: 280 }}>
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted/80 z-10">
                        <TableRow>
                          <TableHead className="text-xs w-8">Usar</TableHead>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs">Descricao</TableHead>
                          <TableHead className="text-xs">Tipo Rede</TableHead>
                          <TableHead className="text-xs">DN Faixa</TableHead>
                          <TableHead className="text-xs">Unidade</TableHead>
                          <TableHead className="text-xs">Regra Qtd.</TableHead>
                          <TableHead className="text-xs">Preco Unit.</TableHead>
                          <TableHead className="text-xs w-16">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medicaoItems.map((item, idx) => {
                          const isEnabled = medicaoEnabled[String(idx)] ?? true;
                          const isEditing = medicaoEditIdx === idx;
                          return (
                            <TableRow key={idx} className={!isEnabled ? "opacity-40" : ""}>
                              <TableCell>
                                <Checkbox checked={isEnabled} onCheckedChange={() => toggleMedicaoItem(idx)} />
                              </TableCell>
                              {isEditing ? (
                                <>
                                  <TableCell><Input value={item.item_medicao} onChange={e => updateMedicaoItem(idx, "item_medicao", e.target.value)} className="h-7 text-xs w-20" /></TableCell>
                                  <TableCell><Input value={item.descricao} onChange={e => updateMedicaoItem(idx, "descricao", e.target.value)} className="h-7 text-xs w-32" /></TableCell>
                                  <TableCell>
                                    <Select value={item.tipo_rede} onValueChange={v => updateMedicaoItem(idx, "tipo_rede", v)}>
                                      <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ESGOTO" className="text-xs">ESGOTO</SelectItem>
                                        <SelectItem value="AGUA" className="text-xs">AGUA</SelectItem>
                                        <SelectItem value="DRENAGEM" className="text-xs">DRENAGEM</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Input type="number" value={item.dn_min} onChange={e => updateMedicaoItem(idx, "dn_min", parseFloat(e.target.value) || 0)} className="h-7 text-xs w-14" />
                                      <Input type="number" value={item.dn_max} onChange={e => updateMedicaoItem(idx, "dn_max", parseFloat(e.target.value) || 9999)} className="h-7 text-xs w-14" />
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Select value={item.driver} onValueChange={v => updateMedicaoItem(idx, "driver", v)}>
                                      <SelectTrigger className="h-7 text-xs w-16"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="m" className="text-xs">m</SelectItem>
                                        <SelectItem value="m2" className="text-xs">m²</SelectItem>
                                        <SelectItem value="m3" className="text-xs">m³</SelectItem>
                                        <SelectItem value="un" className="text-xs">un</SelectItem>
                                        <SelectItem value="dia" className="text-xs">dia</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Select value={item.regra_quantidade} onValueChange={v => updateMedicaoItem(idx, "regra_quantidade", v)}>
                                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="comprimento" className="text-xs">comprimento</SelectItem>
                                        <SelectItem value="escavacao_m3" className="text-xs">escavacao (m³)</SelectItem>
                                        <SelectItem value="reaterro_m3" className="text-xs">reaterro (m³)</SelectItem>
                                        <SelectItem value="bota_fora_m3" className="text-xs">bota-fora (m³)</SelectItem>
                                        <SelectItem value="pavimento_m2" className="text-xs">pavimento (m²)</SelectItem>
                                        <SelectItem value="escoramento_m2" className="text-xs">escoramento (m²)</SelectItem>
                                        <SelectItem value="numero_pvs" className="text-xs">PV (un)</SelectItem>
                                        <SelectItem value="berco" className="text-xs">berço (m³)</SelectItem>
                                        <SelectItem value="envoltoria" className="text-xs">envoltória (m³)</SelectItem>
                                        <SelectItem value="ligacao" className="text-xs">ligação (un)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell><Input type="number" value={item.preco_unitario} onChange={e => updateMedicaoItem(idx, "preco_unitario", parseFloat(e.target.value) || 0)} className="h-7 text-xs w-24" /></TableCell>
                                  <TableCell>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setMedicaoEditIdx(null)}>
                                      <Check className="h-3 w-3 text-green-600" />
                                    </Button>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="text-xs font-mono">{item.item_medicao}</TableCell>
                                  <TableCell className="text-xs max-w-[180px] truncate" title={item.descricao}>{item.descricao}</TableCell>
                                  <TableCell className="text-xs">{item.tipo_rede}</TableCell>
                                  <TableCell className="text-xs">{item.dn_min}-{item.dn_max}</TableCell>
                                  <TableCell className="text-xs">{item.driver}</TableCell>
                                  <TableCell className="text-xs">{item.regra_quantidade}</TableCell>
                                  <TableCell className="text-xs font-medium">{fmtC(item.preco_unitario)}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setMedicaoEditIdx(idx)}>
                                        <Edit3 className="h-3 w-3" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => removeMedicaoItem(idx)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Measurement per trecho — user-driven execution flow */}
              {medicaoTrechos.length === 0 && !columnMapping ? (
                <div className="py-8 text-center">
                  <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Importe uma planilha de medicao para calcular valores por trecho.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Voce escolhera quais colunas usar, quais itens calcular e quais trechos medir.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A medicao aparece conforme o andamento da obra — voce controla o status de execucao de cada trecho.
                  </p>
                </div>
              ) : medicaoTrechos.length > 0 && (
                <>
                  {/* Execution flow info */}
                  <div className="mb-3 p-2 bg-blue-50/50 rounded border border-blue-200">
                    <p className="text-xs font-medium flex items-center gap-1">
                      <ArrowRight className="h-3 w-3 text-blue-600" />
                      Fluxo de execucao: Marque cada trecho conforme a obra avanca. A medicao aparece quando voce define o status.
                    </p>
                    <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Badge variant="outline" className="text-[9px] h-4">Pendente</Badge> Nao iniciado</span>
                      <span className="flex items-center gap-1"><Badge className="text-[9px] h-4 bg-yellow-500">Em Execucao</Badge> Em andamento</span>
                      <span className="flex items-center gap-1"><Badge className="text-[9px] h-4 bg-green-600">Concluido</Badge> Trecho feito</span>
                      <span className="flex items-center gap-1"><Badge className="text-[9px] h-4 bg-blue-600">Medido</Badge> Medicao aprovada</span>
                    </div>
                  </div>
                  <div className="overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT + 60 }}>
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                        <TableRow>
                          <TableHead className="text-xs">Trecho</TableHead>
                          <TableHead className="text-xs">Inicio→Fim</TableHead>
                          <TableHead className="text-xs">Comp (m)</TableHead>
                          <TableHead className="text-xs">DN</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Exec. (m)</TableHead>
                          <TableHead className="text-xs">Itens</TableHead>
                          <TableHead className="text-xs">Medicao (R$)</TableHead>
                          <TableHead className="text-xs">Custo (R$)</TableHead>
                          <TableHead className="text-xs">Margem (R$)</TableHead>
                          <TableHead className="text-xs">% Exec.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medicaoTrechos.map(m => {
                          const execState = trechoExecStates[m.trecho_id];
                          const status = execState?.status || "pendente";
                          const statusColors: Record<TrechoExecStatus, string> = {
                            pendente: "",
                            em_execucao: "bg-yellow-50/50",
                            concluido: "bg-green-50/50",
                            medido: "bg-blue-50/50",
                          };
                          return (
                            <TableRow key={m.trecho_id} className={`${statusColors[status]} ${m.margem < 0 ? "border-l-2 border-l-red-400" : ""}`}>
                              <TableCell className="text-xs font-mono">{m.trecho_id}</TableCell>
                              <TableCell className="text-xs max-w-[100px] truncate" title={`${m.inicio}→${m.fim}`}>
                                {m.inicio}→{m.fim}
                              </TableCell>
                              <TableCell className="text-xs">{fmt(m.comprimento)}</TableCell>
                              <TableCell className="text-xs">{m.dn}</TableCell>
                              <TableCell>
                                <Select value={status} onValueChange={v => updateTrechoExecStatus(m.trecho_id, v as TrechoExecStatus)}>
                                  <SelectTrigger className="h-6 text-[10px] w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pendente" className="text-xs">Pendente</SelectItem>
                                    <SelectItem value="em_execucao" className="text-xs">Em Execucao</SelectItem>
                                    <SelectItem value="concluido" className="text-xs">Concluido</SelectItem>
                                    <SelectItem value="medido" className="text-xs">Medido</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={execState?.qtdExecutada || m.qtd_executada || 0}
                                  onChange={e => updateTrechoExecQtd(m.trecho_id, parseFloat(e.target.value) || 0)}
                                  className="h-6 text-[10px] w-16"
                                  max={m.comprimento}
                                  min={0}
                                />
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {(m.itens_medicao || []).length > 0 ? m.itens_medicao[0].item.item_medicao : "-"}
                                {(m.itens_medicao || []).length > 1 && (
                                  <Badge variant="outline" className="ml-1 text-[9px]">+{m.itens_medicao.length - 1}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs font-medium text-blue-700">{fmtC(m.med_total)}</TableCell>
                              <TableCell className="text-xs font-medium text-orange-700">{fmtC(m.cus_total)}</TableCell>
                              <TableCell className={`text-xs font-bold ${m.margem >= 0 ? "text-green-700" : "text-red-700"}`}>
                                {fmtC(m.margem)}
                              </TableCell>
                              <TableCell className="text-xs">{m.pct_executado.toFixed(0)}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {/* Medição Summary */}
              {medicaoSummary && (
                <div className="mt-4 grid grid-cols-4 gap-3">
                  <div className="bg-blue-50 rounded p-3 text-center">
                    <p className="text-xs text-muted-foreground">Medicao Total</p>
                    <p className="font-bold text-lg text-blue-700">{fmtC(medicaoSummary.medicao_total)}</p>
                  </div>
                  <div className="bg-orange-50 rounded p-3 text-center">
                    <p className="text-xs text-muted-foreground">Custo Total</p>
                    <p className="font-bold text-lg text-orange-700">{fmtC(medicaoSummary.custo_total)}</p>
                  </div>
                  <div className={`rounded p-3 text-center ${medicaoSummary.margem_total >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                    <p className="text-xs text-muted-foreground">Margem Total</p>
                    <p className={`font-bold text-lg ${medicaoSummary.margem_total >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {fmtC(medicaoSummary.margem_total)} ({medicaoSummary.margem_pct.toFixed(1)}%)
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded p-3 text-center">
                    <p className="text-xs text-muted-foreground">Prazo Total</p>
                    <p className="font-semibold text-lg">{medicaoSummary.prazo_total_dias} dias</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Cronograma Tab ── */}
        <TabsContent value="cronograma">
          <div className="space-y-4">
            {/* Global schedule parameters */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Cronograma por Trecho</CardTitle>
                    <CardDescription className="text-xs">
                      Edite equipe, produtividade e prioridade por trecho, ou aplique parâmetros globais.
                    </CardDescription>
                  </div>
                </div>
                <div className="mt-3 flex gap-3 items-end flex-wrap p-3 bg-muted/30 rounded">
                  <div>
                    <Label className="text-xs">Produtividade (m/dia)</Label>
                    <Input type="number" value={schedGlobalProdutividade} onChange={e => setSchedGlobalProdutividade(parseFloat(e.target.value) || 12)} className="h-8 w-24 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Equipes</Label>
                    <Input type="number" value={schedGlobalEquipes} onChange={e => setSchedGlobalEquipes(parseInt(e.target.value) || 1)} className="h-8 w-20 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Data Início</Label>
                    <Input type="date" value={schedGlobalDataInicio} onChange={e => setSchedGlobalDataInicio(e.target.value)} className="h-8 w-36 text-xs" />
                  </div>
                  <Button size="sm" onClick={applyScheduleGlobal}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Aplicar a Todos
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredScheduleRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Clique em "Carregar Trechos" para iniciar.
                  </p>
                ) : (
                  <div ref={scheduleScrollRef} className="overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                        <TableRow>
                          <TableHead className="text-xs">Trecho</TableHead>
                          <TableHead className="text-xs">Comp (m)</TableHead>
                          <TableHead className="text-xs">Custo (R$)</TableHead>
                          <TableHead className="text-xs">Equipe</TableHead>
                          <TableHead className="text-xs">Metros/dia</TableHead>
                          <TableHead className="text-xs">Dias</TableHead>
                          <TableHead className="text-xs">Data Início</TableHead>
                          <TableHead className="text-xs">Data Fim</TableHead>
                          <TableHead className="text-xs">% Exec.</TableHead>
                          <TableHead className="text-xs">Prioridade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedulePaddingTop > 0 && (
                          <tr><td colSpan={10} style={{ height: schedulePaddingTop, padding: 0, border: "none" }} /></tr>
                        )}
                        {scheduleVirtualItems.map(vi => {
                          const row = filteredScheduleRows[vi.index];
                          const cRow = costRows.find(c => c.id === row.id);
                          const mRow = medicaoTrechos.find(m => m.trecho_id === row.id);
                          const execState = trechoExecStates[row.id];
                          const pctExec = execState?.qtdExecutada ? Math.min(100, (execState.qtdExecutada / row.comp) * 100) : (mRow?.pct_executado || 0);
                          return (
                            <TableRow key={row.id} className={pctExec >= 100 ? "bg-green-50/30" : pctExec > 0 ? "bg-yellow-50/30" : ""}>
                              <TableCell className="text-xs max-w-[140px] truncate" title={row.nomeTrecho}>{row.nomeTrecho}</TableCell>
                              <TableCell className="text-xs">{fmt(row.comp)}</TableCell>
                              <TableCell className="text-xs font-medium">{cRow ? fmtC(cRow.total) : "-"}</TableCell>
                              <TableCell><EditCell value={row.equipe} onChange={v => updateScheduleField(row.id, "equipe", v as number)} /></TableCell>
                              <TableCell><EditCell value={row.metrosDia} onChange={v => updateScheduleField(row.id, "metrosDia", v as number)} /></TableCell>
                              <TableCell className="text-xs font-medium">{row.diasEstimados}</TableCell>
                              <TableCell><EditCell value={row.dataInicio} onChange={v => updateScheduleField(row.id, "dataInicio", v)} type="date" className="w-32" /></TableCell>
                              <TableCell className="text-xs">{row.dataFim}</TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1">
                                  <Progress value={pctExec} className="w-12 h-2" />
                                  <span className="text-[10px]">{pctExec.toFixed(0)}%</span>
                                </div>
                              </TableCell>
                              <TableCell><EditCell value={row.prioridade} onChange={v => updateScheduleField(row.id, "prioridade", v as number)} /></TableCell>
                            </TableRow>
                          );
                        })}
                        {schedulePaddingBottom > 0 && (
                          <tr><td colSpan={10} style={{ height: schedulePaddingBottom, padding: 0, border: "none" }} /></tr>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedule Summary with Costs and Medição */}
            {scheduleRows.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-muted/50 rounded p-3 text-center">
                  <p className="text-xs text-muted-foreground">Extensão Total</p>
                  <p className="font-semibold">{fmt(scheduleSummary.totalMetros)} m</p>
                </div>
                <div className="bg-muted/50 rounded p-3 text-center">
                  <p className="text-xs text-muted-foreground">Duração Máx.</p>
                  <p className="font-semibold">{scheduleSummary.totalDias} dias</p>
                </div>
                <div className="bg-primary/10 rounded p-3 text-center">
                  <p className="text-xs text-muted-foreground">Custo Total (BDI)</p>
                  <p className="font-bold text-primary">{fmtC(costSummary.totalFinal)}</p>
                </div>
                {medicaoSummary && (
                  <>
                    <div className="bg-blue-50 rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Medicao Total</p>
                      <p className="font-bold text-blue-700">{fmtC(medicaoSummary.medicao_total)}</p>
                    </div>
                    <div className={`rounded p-3 text-center ${medicaoSummary.margem_total >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                      <p className="text-xs text-muted-foreground">Margem</p>
                      <p className={`font-bold ${medicaoSummary.margem_total >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {fmtC(medicaoSummary.margem_total)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Charts — Gantt-like, Curva S, and Histogram */}
            {scheduleRows.length > 0 && (() => {
              // Generate Gantt data
              const ganttData = scheduleRows.map(r => {
                const cRow = costRows.find(c => c.id === r.id);
                const mRow = medicaoTrechos.find(m => m.trecho_id === r.id);
                return {
                  trecho: r.nomeTrecho.length > 12 ? r.nomeTrecho.slice(0, 12) + "..." : r.nomeTrecho,
                  dias: r.diasEstimados,
                  custo: cRow?.total || 0,
                  medicao: mRow?.med_total || 0,
                };
              });

              // Generate Curva S data
              const curveSData: { dia: number; fisicoAcum: number; financeiroAcum: number }[] = [];
              const totalMetros = scheduleRows.reduce((s, r) => s + r.comp, 0);
              const totalCusto = costRows.reduce((s, r) => s + r.total, 0);
              let metrosAcum = 0;
              let custoAcum = 0;
              const sorted = [...scheduleRows].sort((a, b) => a.prioridade - b.prioridade);
              let diaAcum = 0;
              for (const r of sorted) {
                const cRow = costRows.find(c => c.id === r.id);
                metrosAcum += r.comp;
                custoAcum += cRow?.total || 0;
                diaAcum += r.diasEstimados;
                curveSData.push({
                  dia: diaAcum,
                  fisicoAcum: totalMetros > 0 ? (metrosAcum / totalMetros) * 100 : 0,
                  financeiroAcum: totalCusto > 0 ? (custoAcum / totalCusto) * 100 : 0,
                });
              }

              // Generate histogram data
              const histData = scheduleRows.map(r => {
                const cRow = costRows.find(c => c.id === r.id);
                return {
                  trecho: r.id,
                  maoDeObra: r.equipe * 6 * r.diasEstimados * 180, // equipe * workers * days * daily cost
                  equipamento: r.equipe * r.diasEstimados * 800,
                  material: cRow ? cRow.custoTubo * r.comp : 0,
                };
              });

              const CHART_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed"];

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Gantt-like bar chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> Gantt — Duração por Trecho
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={Math.max(200, ganttData.length * 28)}>
                        <BarChart data={ganttData} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" fontSize={10} tickFormatter={v => `${v}d`} />
                          <YAxis dataKey="trecho" type="category" fontSize={9} width={100} />
                          <RechartsTooltip formatter={(v: number) => `${v} dias`} />
                          <Bar dataKey="dias" fill="#2563eb" name="Duração (dias)">
                            {ganttData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Curva S */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" /> Curva S — Progresso Acumulado
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={curveSData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="dia" fontSize={10} tickFormatter={v => `D${v}`} />
                          <YAxis fontSize={10} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                          <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                          <Legend />
                          <Area type="monotone" dataKey="fisicoAcum" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} name="Físico (%)" />
                          <Area type="monotone" dataKey="financeiroAcum" stroke="#16a34a" fill="#16a34a" fillOpacity={0.15} name="Financeiro (%)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Custo por trecho bar chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4" /> Custo por Trecho
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={ganttData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="trecho" fontSize={9} angle={-45} textAnchor="end" height={60} />
                          <YAxis fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                          <RechartsTooltip formatter={(v: number) => fmtC(v)} />
                          <Legend />
                          <Bar dataKey="custo" fill="#ea580c" name="Custo c/ BDI (R$)" />
                          {medicaoTrechos.length > 0 && (
                            <Bar dataKey="medicao" fill="#2563eb" name="Medição (R$)" />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Histograma de recursos */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" /> Histograma de Recursos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <ComposedChart data={histData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="trecho" fontSize={10} />
                          <YAxis fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                          <RechartsTooltip formatter={(v: number) => fmtC(v)} />
                          <Legend />
                          <Bar dataKey="maoDeObra" stackId="a" fill="#2563eb" name="Mão de Obra" />
                          <Bar dataKey="equipamento" stackId="a" fill="#ea580c" name="Equipamento" />
                          <Bar dataKey="material" stackId="a" fill="#16a34a" name="Material" />
                          <Line type="monotone" dataKey="maoDeObra" stroke="#7c3aed" dot={false} name="" legendType="none" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
          </div>
        </TabsContent>

        {/* ── Base Personalizada (Custom Cost) Tab ── */}
        <TabsContent value="base-personalizada">
          <CustomCostTrechoModule trechos={trechos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TrechoEditModule;
