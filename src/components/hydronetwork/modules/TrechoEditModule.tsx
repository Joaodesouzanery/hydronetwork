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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calculator, Download, Scissors, Undo2, Search, FileSpreadsheet, DollarSign,
  Calendar, RefreshCw, Filter, Upload, FileDown, MapPin, BarChart3,
} from "lucide-react";
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
} from "@/engine/gisExport";
import { saveModuleData } from "@/engine/moduleExchange";
import * as XLSX from "xlsx";

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

const STORAGE_KEY = "hydronetwork_trecho_edits";
const ROW_HEIGHT = 40;
const TABLE_MAX_HEIGHT = 520;
const VIRTUALIZER_OVERSCAN = 10;

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
    <TableRow className={row.isSubdivided ? "bg-orange-50/30" : ""}>
      <TableCell className="text-xs font-mono">
        {row.id}
        {row.isSubdivided && <Badge variant="outline" className="ml-1 text-[10px]">Sub</Badge>}
      </TableCell>
      <TableCell className="text-xs max-w-[140px] truncate" title={row.nomeTrecho}>{row.nomeTrecho}</TableCell>
      <TableCell><EditCell value={row.comp} onChange={v => onFieldChange(row.id, "comp", v as number)} /></TableCell>
      <TableCell><EditCell value={row.dn} onChange={v => onFieldChange(row.id, "dn", v as number)} /></TableCell>
      <TableCell><EditCell value={row.prof} onChange={v => onFieldChange(row.id, "prof", v as number)} /></TableCell>
      <TableCell><EditCell value={row.escavacao} onChange={v => onFieldChange(row.id, "escavacao", v as number)} /></TableCell>
      <TableCell><EditCell value={row.reaterro} onChange={v => onFieldChange(row.id, "reaterro", v as number)} /></TableCell>
      <TableCell><EditCell value={row.botafora} onChange={v => onFieldChange(row.id, "botafora", v as number)} /></TableCell>
      <TableCell><EditCell value={row.pavimento} onChange={v => onFieldChange(row.id, "pavimento", v as number)} /></TableCell>
      <TableCell><EditCell value={row.escoramento} onChange={v => onFieldChange(row.id, "escoramento", v as number)} /></TableCell>
      <TableCell>
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
    <TableRow>
      <TableCell className="text-xs max-w-[120px] truncate" title={row.nomeTrecho}>{row.nomeTrecho}</TableCell>
      <TableCell className="text-xs">{fmt(row.comp)}</TableCell>
      <TableCell><EditCell value={row.custoEscavacao} onChange={v => onFieldChange(row.id, "custoEscavacao", v as number)} /></TableCell>
      <TableCell><EditCell value={row.custoTubo} onChange={v => onFieldChange(row.id, "custoTubo", v as number)} /></TableCell>
      <TableCell><EditCell value={row.custoReaterro} onChange={v => onFieldChange(row.id, "custoReaterro", v as number)} /></TableCell>
      <TableCell><EditCell value={row.custoPV} onChange={v => onFieldChange(row.id, "custoPV", v as number)} /></TableCell>
      <TableCell><EditCell value={row.bdiPct} onChange={v => onFieldChange(row.id, "bdiPct", v as number)} /></TableCell>
      <TableCell>
        <Badge variant={row.fonte === "SINAPI" ? "secondary" : "default"} className="text-[10px]">{row.fonte}</Badge>
      </TableCell>
      <TableCell className="text-xs font-medium">{fmtC(row.subtotal)}</TableCell>
      <TableCell className="text-xs font-bold">{fmtC(row.total)}</TableCell>
    </TableRow>
  );
});

interface ScheduleRowProps {
  row: EditableScheduleRow;
  onFieldChange: (id: string, field: keyof EditableScheduleRow, value: number | string) => void;
}

const MemoScheduleRow = memo(function MemoScheduleRow({ row, onFieldChange }: ScheduleRowProps) {
  return (
    <TableRow>
      <TableCell className="text-xs max-w-[140px] truncate" title={row.nomeTrecho}>{row.nomeTrecho}</TableCell>
      <TableCell className="text-xs">{fmt(row.comp)}</TableCell>
      <TableCell><EditCell value={row.equipe} onChange={v => onFieldChange(row.id, "equipe", v as number)} /></TableCell>
      <TableCell><EditCell value={row.metrosDia} onChange={v => onFieldChange(row.id, "metrosDia", v as number)} /></TableCell>
      <TableCell className="text-xs font-medium">{row.diasEstimados}</TableCell>
      <TableCell><EditCell value={row.dataInicio} onChange={v => onFieldChange(row.id, "dataInicio", v)} type="date" className="w-32" /></TableCell>
      <TableCell className="text-xs">{row.dataFim}</TableCell>
      <TableCell><EditCell value={row.prioridade} onChange={v => onFieldChange(row.id, "prioridade", v as number)} /></TableCell>
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

  // Measurement (Medição) data
  const [medicaoItems, setMedicaoItems] = useState<MedicaoItem[]>(() => loadMedicaoItems());
  const [medicaoTrechos, setMedicaoTrechos] = useState<TrechoMedicao[]>(() => loadMedicaoTrechos());
  const medicaoFileRef = useRef<HTMLInputElement>(null);

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

  // ── Measurement (Medição) handlers ──

  const handleMedicaoImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const items = await parseMedicaoFile(file);
      setMedicaoItems(items);
      saveMedicaoItems(items);
      toast.success(`${items.length} itens de medição importados.`);

      // Auto-calculate if we have trechos loaded
      if (trechos.length > 0) {
        const medTrechos = calcularMedicaoPorTrecho(
          trechos,
          quantityRows || [],
          items,
        );
        setMedicaoTrechos(medTrechos);
        saveMedicaoTrechos(medTrechos);
        saveModuleData("medicaoTrechos", medTrechos);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar planilha de medição.");
    }
    // Reset input
    if (medicaoFileRef.current) medicaoFileRef.current.value = "";
  }, [trechos, quantityRows]);

  const recalcularMedicaoHandler = useCallback(() => {
    if (trechos.length === 0) {
      toast.error("Sem trechos carregados.");
      return;
    }
    if (medicaoItems.length === 0) {
      toast.error("Sem planilha de medição importada.");
      return;
    }
    const medTrechos = calcularMedicaoPorTrecho(
      trechos,
      quantityRows || [],
      medicaoItems,
    );
    setMedicaoTrechos(medTrechos);
    saveMedicaoTrechos(medTrechos);
    saveModuleData("medicaoTrechos", medTrechos);
    toast.success("Medição recalculada com sucesso.");
  }, [trechos, quantityRows, medicaoItems]);

  const exportMedicaoHandler = useCallback(() => {
    if (medicaoTrechos.length === 0) {
      toast.error("Sem dados de medição.");
      return;
    }
    exportMedicaoExcel(medicaoTrechos);
    toast.success("Planilha de medição exportada.");
  }, [medicaoTrechos]);

  const exportGeoJSONHandler = useCallback(() => {
    downloadGeoJSON(trechos, quantityRows || [], medicaoTrechos);
    toast.success("GeoJSON exportado com todos os atributos.");
  }, [trechos, quantityRows, medicaoTrechos]);

  const exportGISCSVHandler = useCallback(() => {
    downloadGISCSV(trechos, quantityRows || [], medicaoTrechos);
    toast.success("CSV GIS exportado.");
  }, [trechos, quantityRows, medicaoTrechos]);

  const exportGISExcelHandler = useCallback(() => {
    exportGISExcel(trechos, quantityRows || [], medicaoTrechos);
    toast.success("XLSX GIS exportado.");
  }, [trechos, quantityRows, medicaoTrechos]);

  const medicaoSummary = useMemo<MedicaoSummary | null>(() => {
    if (medicaoTrechos.length === 0) return null;
    return calcularResumoMedicao(medicaoTrechos);
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quantitativos" className="flex items-center gap-1">
            <Calculator className="h-4 w-4" /> Quantitativos
          </TabsTrigger>
          <TabsTrigger value="valores" className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" /> Valores / Custos
          </TabsTrigger>
          <TabsTrigger value="medicao" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" /> Medição
          </TabsTrigger>
          <TabsTrigger value="cronograma" className="flex items-center gap-1">
            <Calendar className="h-4 w-4" /> Cronograma
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
                    <TableHeader className="sticky top-0 bg-background z-10">
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
                    <TableHeader className="sticky top-0 bg-background z-10">
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

        {/* ── Medição Tab ── */}
        <TabsContent value="medicao">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Medição por Trecho</CardTitle>
                  <CardDescription className="text-xs">
                    Importe sua planilha de medição (CSV/XLSX) para mapear itens automaticamente aos trechos.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={medicaoFileRef}
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    className="hidden"
                    onChange={handleMedicaoImport}
                  />
                  <Button size="sm" onClick={() => medicaoFileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> Importar Planilha de Medição
                  </Button>
                  <Button size="sm" variant="outline" onClick={recalcularMedicaoHandler}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Recalcular Medição
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportMedicaoHandler}>
                    <Download className="h-4 w-4 mr-1" /> Exportar Medição
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Imported items info */}
              {medicaoItems.length > 0 && (
                <div className="mb-4 p-3 bg-muted/50 rounded">
                  <p className="text-sm font-medium mb-2">Itens de Medição Importados: {medicaoItems.length}</p>
                  <div className="overflow-auto max-h-40">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs">Tipo Rede</TableHead>
                          <TableHead className="text-xs">DN Faixa</TableHead>
                          <TableHead className="text-xs">Driver</TableHead>
                          <TableHead className="text-xs">Regra</TableHead>
                          <TableHead className="text-xs">Preço Unit.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medicaoItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-mono">{item.item_medicao}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate" title={item.descricao}>{item.descricao}</TableCell>
                            <TableCell className="text-xs">{item.tipo_rede}</TableCell>
                            <TableCell className="text-xs">{item.dn_min}-{item.dn_max}</TableCell>
                            <TableCell className="text-xs">{item.driver}</TableCell>
                            <TableCell className="text-xs">{item.regra_quantidade}</TableCell>
                            <TableCell className="text-xs">{fmtC(item.preco_unitario)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Measurement per trecho */}
              {medicaoTrechos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Importe uma planilha de medição para calcular custo, medição e margem por trecho.
                </p>
              ) : (
                <div className="overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="text-xs">Trecho</TableHead>
                        <TableHead className="text-xs">Início→Fim</TableHead>
                        <TableHead className="text-xs">Comp (m)</TableHead>
                        <TableHead className="text-xs">DN</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Item Med.</TableHead>
                        <TableHead className="text-xs">Qtd Med.</TableHead>
                        <TableHead className="text-xs">Medição (R$)</TableHead>
                        <TableHead className="text-xs">Custo (R$)</TableHead>
                        <TableHead className="text-xs">Margem (R$)</TableHead>
                        <TableHead className="text-xs">Margem (%)</TableHead>
                        <TableHead className="text-xs">Prazo</TableHead>
                        <TableHead className="text-xs">% Exec.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {medicaoTrechos.map(m => (
                        <TableRow key={m.trecho_id} className={m.margem < 0 ? "bg-red-50/50" : ""}>
                          <TableCell className="text-xs font-mono">{m.trecho_id}</TableCell>
                          <TableCell className="text-xs max-w-[120px] truncate" title={`${m.inicio}→${m.fim}`}>
                            {m.inicio}→{m.fim}
                          </TableCell>
                          <TableCell className="text-xs">{fmt(m.comprimento)}</TableCell>
                          <TableCell className="text-xs">{m.dn}</TableCell>
                          <TableCell className="text-xs">{m.tipo_rede}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {m.itens_medicao.length > 0 ? m.itens_medicao[0].item.item_medicao : "-"}
                            {m.itens_medicao.length > 1 && (
                              <Badge variant="outline" className="ml-1 text-[9px]">+{m.itens_medicao.length - 1}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {m.itens_medicao.length > 0 ? fmt(m.itens_medicao[0].quantidade) : "-"}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-blue-700">{fmtC(m.med_total)}</TableCell>
                          <TableCell className="text-xs font-medium text-orange-700">{fmtC(m.cus_total)}</TableCell>
                          <TableCell className={`text-xs font-bold ${m.margem >= 0 ? "text-green-700" : "text-red-700"}`}>
                            {fmtC(m.margem)}
                          </TableCell>
                          <TableCell className={`text-xs ${m.margem_pct >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {m.margem_pct.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-xs">{m.prazo_dias}d</TableCell>
                          <TableCell className="text-xs">{m.pct_executado.toFixed(0)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Medição Summary */}
              {medicaoSummary && (
                <div className="mt-4 grid grid-cols-4 gap-3">
                  <div className="bg-blue-50 rounded p-3 text-center">
                    <p className="text-xs text-muted-foreground">Medição Total</p>
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cronograma por Trecho</CardTitle>
              <CardDescription className="text-xs">
                Edite equipe, produtividade e prioridade por trecho.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredScheduleRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Clique em "Carregar Trechos" para iniciar.
                </p>
              ) : (
                <div ref={scheduleScrollRef} className="overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="text-xs">Trecho</TableHead>
                        <TableHead className="text-xs">Comp (m)</TableHead>
                        <TableHead className="text-xs">Equipe</TableHead>
                        <TableHead className="text-xs">Metros/dia</TableHead>
                        <TableHead className="text-xs">Dias</TableHead>
                        <TableHead className="text-xs">Data Início</TableHead>
                        <TableHead className="text-xs">Data Fim</TableHead>
                        <TableHead className="text-xs">Prioridade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedulePaddingTop > 0 && (
                        <tr><td colSpan={8} style={{ height: schedulePaddingTop, padding: 0, border: "none" }} /></tr>
                      )}
                      {scheduleVirtualItems.map(vi => (
                        <MemoScheduleRow
                          key={filteredScheduleRows[vi.index].id}
                          row={filteredScheduleRows[vi.index]}
                          onFieldChange={updateScheduleField}
                        />
                      ))}
                      {schedulePaddingBottom > 0 && (
                        <tr><td colSpan={8} style={{ height: schedulePaddingBottom, padding: 0, border: "none" }} /></tr>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Schedule Summary */}
              {scheduleRows.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded p-3 text-center">
                    <p className="text-xs text-muted-foreground">Extensão Total</p>
                    <p className="font-semibold">{fmt(scheduleSummary.totalMetros)} m</p>
                  </div>
                  <div className="bg-muted/50 rounded p-3 text-center">
                    <p className="text-xs text-muted-foreground">Maior Duração (dias)</p>
                    <p className="font-semibold">{scheduleSummary.totalDias} dias</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TrechoEditModule;
