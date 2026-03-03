/**
 * TrechoEditModule — Dedicated module for inline editing of quantities,
 * unit costs, and schedule parameters per network segment (trecho).
 * Supports trecho subdivision by length.
 */

import { useState, useMemo, useCallback } from "react";
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
  Calendar, RefreshCw, Filter,
} from "lucide-react";
import { Trecho } from "@/engine/domain";
import { PontoTopografico } from "@/engine/reader";
import { subdivideTrecho, reunifySubTrechos, isSubTrecho, SubTrecho } from "@/engine/trechoSubdivision";
import type { QuantRow, QuantityParams } from "./QuantitiesModule";
import * as XLSX from "xlsx";

// ── SINAPI reference costs (01/2026 - Desonerado) ──
const SINAPI_UNIT_COSTS = {
  escavacao_0_1_5: 30.78,
  escavacao_1_5_3: 38.02,
  escavacao_3_4_5: 46.22,
  escoramento_madeira: 49.46,
  tubo_150: 135.54,
  tubo_200: 200.12,
  tubo_250: 287.06,
  tubo_300: 383.62,
  tubo_400: 524.45,
  tubo_500: 702.86,
  tubo_600: 886.14,
  reaterro: 19.98,
  berco: 102.92,
  envoltoria: 92.34,
  pv_0_1_5: 3078.00,
  pv_1_5_2_5: 4590.00,
  pv_2_5_4: 7398.00,
  botafora: 13.50,
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
  // Track if this is a sub-trecho
  isSubdivided: boolean;
  parentId?: string;
  subIndex?: number;
  subCount?: number;
  // Original trecho reference for subdivision
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

// ── Component ──

export function TrechoEditModule({ trechos, pontos, quantityRows, quantityParams, onTrechosChange }: TrechoEditModuleProps) {
  const [activeTab, setActiveTab] = useState("quantitativos");
  const [searchFilter, setSearchFilter] = useState("");
  const [compMinFilter, setCompMinFilter] = useState("");
  const [compMaxFilter, setCompMaxFilter] = useState("");

  // Editable data
  const [quantRows, setQuantRows] = useState<EditableQuantRow[]>([]);
  const [costRows, setCostRows] = useState<EditableCostRow[]>([]);
  const [scheduleRows, setScheduleRows] = useState<EditableScheduleRow[]>([]);

  // Subdivision dialog
  const [subdivideTarget, setSubdivideTarget] = useState<string | null>(null);
  const [subdivideLength, setSubdivideLength] = useState("50");

  // ── Initialize rows from trechos ──

  const initializeRows = useCallback(() => {
    if (trechos.length === 0) {
      toast.error("Sem trechos carregados. Importe topografia primeiro.");
      return;
    }

    const baseProfMin = 1.20;

    // Quantity rows
    const qRows: EditableQuantRow[] = trechos.map((t, idx) => {
      const prof = Math.max(baseProfMin, 1.0 + t.diametroMm / 1000);
      const quant = computeQuantities(t, prof);

      // If we have pre-calculated quantities from QuantitiesModule, use them
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

    // Cost rows
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

    // Schedule rows
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

  // ── Inline editing handlers ──

  const updateQuantField = (id: string, field: keyof EditableQuantRow, value: number) => {
    setQuantRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const updateCostField = (id: string, field: keyof EditableCostRow, value: number) => {
    setCostRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value, fonte: "Manual" as const };
      // Recalc totals
      const qRow = quantRows.find(q => q.id === id);
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
  };

  const updateScheduleField = (id: string, field: keyof EditableScheduleRow, value: number | string) => {
    setScheduleRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      // Recalc dias if metros/dia or comp changed
      if (field === "metrosDia" || field === "comp") {
        updated.diasEstimados = Math.ceil(updated.comp / updated.metrosDia);
        updated.dataFim = addDays(updated.dataInicio, updated.diasEstimados);
      }
      if (field === "dataInicio") {
        updated.dataFim = addDays(value as string, updated.diasEstimados);
      }
      return updated;
    }));
  };

  // ── Recalculate quantities from comp/dn/prof ──

  const recalculateQuantities = () => {
    setQuantRows(prev => prev.map(r => {
      const mockTrecho = { ...r.originalTrecho, comprimento: r.comp, diametroMm: r.dn };
      const quant = computeQuantities(mockTrecho, r.prof);
      return { ...r, ...quant };
    }));
    toast.success("Quantitativos recalculados.");
  };

  // ── Subdivision ──

  const handleSubdivide = (rowId: string) => {
    setSubdivideTarget(rowId);
    setSubdivideLength("50");
  };

  const confirmSubdivide = () => {
    if (!subdivideTarget) return;
    const len = parseFloat(subdivideLength);
    if (isNaN(len) || len <= 0) {
      toast.error("Comprimento inválido.");
      return;
    }

    const targetRow = quantRows.find(r => r.id === subdivideTarget);
    if (!targetRow) return;

    if (len >= targetRow.comp) {
      toast.error("Comprimento deve ser menor que o trecho.");
      return;
    }

    const subTrechos = subdivideTrecho(targetRow.originalTrecho, len);

    // Replace the target row with sub-rows in all tables
    const newQuantRows: EditableQuantRow[] = [];
    const newCostRows: EditableCostRow[] = [];
    const newScheduleRows: EditableScheduleRow[] = [];

    for (const r of quantRows) {
      if (r.id !== subdivideTarget) {
        newQuantRows.push(r);
        const cRow = costRows.find(c => c.id === r.id);
        if (cRow) newCostRows.push(cRow);
        const sRow = scheduleRows.find(s => s.id === r.id);
        if (sRow) newScheduleRows.push(sRow);
        continue;
      }

      // Add sub-trechos
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
        const custoPV = idx === 0 ? getPVCusto(prof) : 0; // PV only on first sub-trecho
        const subtotal = quant.escavacao * custoEsc + st.comprimento * custoTubo + quant.reaterro * custoReat + custoPV;
        const bdiPct = costRows.find(c => c.id === r.id)?.bdiPct ?? 25;
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

        const metrosDia = scheduleRows.find(s => s.id === r.id)?.metrosDia ?? 12;
        const dias = Math.ceil(st.comprimento / metrosDia);
        const today = new Date().toISOString().slice(0, 10);
        newScheduleRows.push({
          id: subId,
          trechoKey: `${st.idInicio}-${st.idFim}`,
          nomeTrecho: st.nomeTrecho || `${st.idInicio}→${st.idFim}`,
          comp: round2(st.comprimento),
          equipe: scheduleRows.find(s => s.id === r.id)?.equipe ?? 1,
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
  };

  const handleReunify = (parentId: string) => {
    // Find all sub-rows with this parentId
    const subQuantRows = quantRows.filter(r => r.parentId === parentId);
    if (subQuantRows.length === 0) return;

    // Reunify the original trecho
    const subTrechos = subQuantRows.map(r => r.originalTrecho).filter(isSubTrecho);
    if (subTrechos.length === 0) return;

    const original = reunifySubTrechos(subTrechos);
    const subIds = new Set(subQuantRows.map(r => r.id));

    // Rebuild quantity rows
    const prof = subQuantRows[0].prof;
    const quant = computeQuantities(original, prof);
    const reunifiedId = subQuantRows[0].id.replace(/_S\d+$/, "");

    const newQuantRows = quantRows.filter(r => !subIds.has(r.id));
    // Insert the reunified row at the position of the first sub-row
    const insertIdx = quantRows.findIndex(r => subIds.has(r.id));
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

    // Rebuild cost rows
    const custoEsc = getEscavacaoCusto(prof);
    const custoTubo = getTuboCusto(original.diametroMm);
    const custoReat = SINAPI_UNIT_COSTS.reaterro;
    const custoPV = getPVCusto(prof);
    const subtotal = quant.escavacao * custoEsc + original.comprimento * custoTubo + quant.reaterro * custoReat + custoPV;
    const bdiPct = 25;
    const newCostRows = costRows.filter(r => !subIds.has(r.id));
    const costInsertIdx = costRows.findIndex(r => subIds.has(r.id));
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

    // Rebuild schedule rows
    const metrosDia = 12;
    const dias = Math.ceil(original.comprimento / metrosDia);
    const today = new Date().toISOString().slice(0, 10);
    const newScheduleRows = scheduleRows.filter(r => !subIds.has(r.id));
    const schedInsertIdx = scheduleRows.findIndex(r => subIds.has(r.id));
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
  };

  // ── Persistence ──

  const saveEdits = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ quantRows, costRows, scheduleRows }));
      toast.success("Edições salvas localmente.");
    } catch {
      toast.error("Erro ao salvar edições.");
    }
  };

  const loadEdits = () => {
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
  };

  // ── Export XLSX ──

  const exportExcel = () => {
    if (quantRows.length === 0) { toast.error("Sem dados para exportar."); return; }
    const wb = XLSX.utils.book_new();

    // Quantitativos sheet
    const qData = quantRows.map(r => ({
      ID: r.id, Trecho: r.nomeTrecho, "Comp (m)": r.comp, "DN (mm)": r.dn,
      "Prof (m)": r.prof, "Escavação (m³)": r.escavacao, "Reaterro (m³)": r.reaterro,
      "Bota-fora (m³)": r.botafora, "Pavimento (m²)": r.pavimento,
      "Escoramento (m²)": r.escoramento, Subdividido: r.isSubdivided ? "Sim" : "Não",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qData), "Quantitativos");

    // Custos sheet
    const cData = costRows.map(r => ({
      ID: r.id, Trecho: r.nomeTrecho, "Comp (m)": r.comp,
      "Escavação (R$/m³)": r.custoEscavacao, "Tubo (R$/m)": r.custoTubo,
      "Reaterro (R$/m³)": r.custoReaterro, "PV (R$/un)": r.custoPV,
      "BDI (%)": r.bdiPct, Fonte: r.fonte, "Subtotal (R$)": r.subtotal, "Total (R$)": r.total,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cData), "Valores e Custos");

    // Cronograma sheet
    const sData = scheduleRows.map(r => ({
      ID: r.id, Trecho: r.nomeTrecho, "Comp (m)": r.comp, Equipe: r.equipe,
      "Metros/dia": r.metrosDia, "Dias Estimados": r.diasEstimados,
      "Data Início": r.dataInicio, "Data Fim": r.dataFim, Prioridade: r.prioridade,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sData), "Cronograma");

    XLSX.writeFile(wb, "edicao_por_trecho.xlsx");
    toast.success("Planilha exportada.");
  };

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

  // ── Editable cell component ──

  const EditCell = ({ value, onChange, type = "number", className = "" }: {
    value: number | string; onChange: (v: number | string) => void; type?: string; className?: string;
  }) => (
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="quantitativos" className="flex items-center gap-1">
            <Calculator className="h-4 w-4" /> Quantitativos
          </TabsTrigger>
          <TabsTrigger value="valores" className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" /> Valores / Custos
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
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
                      {filteredQuantRows.map(r => (
                        <TableRow key={r.id} className={r.isSubdivided ? "bg-orange-50/30" : ""}>
                          <TableCell className="text-xs font-mono">
                            {r.id}
                            {r.isSubdivided && <Badge variant="outline" className="ml-1 text-[10px]">Sub</Badge>}
                          </TableCell>
                          <TableCell className="text-xs max-w-[140px] truncate" title={r.nomeTrecho}>{r.nomeTrecho}</TableCell>
                          <TableCell><EditCell value={r.comp} onChange={v => updateQuantField(r.id, "comp", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.dn} onChange={v => updateQuantField(r.id, "dn", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.prof} onChange={v => updateQuantField(r.id, "prof", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.escavacao} onChange={v => updateQuantField(r.id, "escavacao", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.reaterro} onChange={v => updateQuantField(r.id, "reaterro", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.botafora} onChange={v => updateQuantField(r.id, "botafora", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.pavimento} onChange={v => updateQuantField(r.id, "pavimento", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.escoramento} onChange={v => updateQuantField(r.id, "escoramento", v as number)} /></TableCell>
                          <TableCell>
                            {r.isSubdivided && r.parentId ? (
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleReunify(r.parentId!)}>
                                <Undo2 className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleSubdivide(r.id)}>
                                <Scissors className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
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
                      {filteredCostRows.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs max-w-[120px] truncate" title={r.nomeTrecho}>{r.nomeTrecho}</TableCell>
                          <TableCell className="text-xs">{fmt(r.comp)}</TableCell>
                          <TableCell><EditCell value={r.custoEscavacao} onChange={v => updateCostField(r.id, "custoEscavacao", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.custoTubo} onChange={v => updateCostField(r.id, "custoTubo", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.custoReaterro} onChange={v => updateCostField(r.id, "custoReaterro", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.custoPV} onChange={v => updateCostField(r.id, "custoPV", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.bdiPct} onChange={v => updateCostField(r.id, "bdiPct", v as number)} /></TableCell>
                          <TableCell>
                            <Badge variant={r.fonte === "SINAPI" ? "secondary" : "default"} className="text-[10px]">{r.fonte}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">{fmtC(r.subtotal)}</TableCell>
                          <TableCell className="text-xs font-bold">{fmtC(r.total)}</TableCell>
                        </TableRow>
                      ))}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
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
                      {filteredScheduleRows.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs max-w-[140px] truncate" title={r.nomeTrecho}>{r.nomeTrecho}</TableCell>
                          <TableCell className="text-xs">{fmt(r.comp)}</TableCell>
                          <TableCell><EditCell value={r.equipe} onChange={v => updateScheduleField(r.id, "equipe", v as number)} /></TableCell>
                          <TableCell><EditCell value={r.metrosDia} onChange={v => updateScheduleField(r.id, "metrosDia", v as number)} /></TableCell>
                          <TableCell className="text-xs font-medium">{r.diasEstimados}</TableCell>
                          <TableCell><EditCell value={r.dataInicio} onChange={v => updateScheduleField(r.id, "dataInicio", v)} type="date" className="w-32" /></TableCell>
                          <TableCell className="text-xs">{r.dataFim}</TableCell>
                          <TableCell><EditCell value={r.prioridade} onChange={v => updateScheduleField(r.id, "prioridade", v as number)} /></TableCell>
                        </TableRow>
                      ))}
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
