/**
 * RDO Hydro + Planning Integration Module
 * Combines RDO execution data with planning schedule for dashboards and exports
 * Supports both RDO Hydro (local segments) and RDO Normal (Supabase daily_reports/rdos)
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, BarChart3, Calendar, AlertTriangle, TrendingUp, FileText, CheckCircle2, Pencil, RotateCcw, Save, Database } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line
} from "recharts";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { RDO, calculateDashboardMetrics } from "@/engine/rdo";
import { ScheduleResult } from "@/engine/planning";
import { saveModuleData, loadModuleData } from "@/engine/moduleExchange";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

type RDOSource = "hydro" | "normal";

interface NormalRDOData {
  totalRdos: number;
  totalQuantity: number;
  serviceBreakdown: { serviceName: string; quantity: number; unit: string }[];
  dailyProduction: { date: string; quantity: number }[];
}

interface RDOPlanningModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  rdos: RDO[];
  scheduleResult: ScheduleResult | null;
}

const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const RDOPlanningModule = ({ pontos, trechos, rdos, scheduleResult }: RDOPlanningModuleProps) => {
  const [rdoSource, setRdoSource] = useState<RDOSource>(() => {
    return (loadModuleData<RDOSource>("rdoPlanningSource") || "hydro");
  });
  const [view, setView] = useState<"dashboard" | "comparison" | "delays">("dashboard");
  const [editMode, setEditMode] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<Record<string, number>>(() => {
    return loadModuleData<Record<string, number>>("executedOverrides") || {};
  });
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [normalRDOData, setNormalRDOData] = useState<NormalRDOData | null>(null);
  const [loadingNormal, setLoadingNormal] = useState(false);

  const handleSourceChange = useCallback((source: RDOSource) => {
    setRdoSource(source);
    saveModuleData("rdoPlanningSource", source);
    if (source === "hydro") setEditMode(false);
  }, []);

  // Fetch RDO Normal data from Supabase
  useEffect(() => {
    if (rdoSource !== "normal") return;
    let cancelled = false;
    const fetchNormalRDOs = async () => {
      setLoadingNormal(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          toast.error("Faça login para acessar os RDOs normais");
          setLoadingNormal(false);
          return;
        }
        const userId = session.user.id;

        // Fetch daily_reports with executed_services
        const { data: dailyReports, error: drError } = await supabase
          .from("daily_reports")
          .select(`
            id, report_date,
            executed_services (
              quantity, unit,
              services_catalog (name)
            )
          `)
          .eq("executed_by_user_id", userId)
          .order("report_date", { ascending: true });

        if (drError) throw drError;

        // Also fetch from legacy rdos table
        const { data: obrasData } = await supabase
          .from("obras")
          .select("id")
          .eq("user_id", userId);

        let legacyCount = 0;
        if (obrasData && obrasData.length > 0) {
          const { count } = await supabase
            .from("rdos")
            .select("id", { count: "exact", head: true })
            .in("obra_id", obrasData.map(o => o.id));
          legacyCount = count || 0;
        }

        if (cancelled) return;

        // Aggregate data
        const serviceMap = new Map<string, { quantity: number; unit: string }>();
        const dailyMap = new Map<string, number>();
        let totalQty = 0;

        for (const dr of (dailyReports || [])) {
          let dayTotal = 0;
          for (const es of (dr.executed_services || [])) {
            const name = (es as any).services_catalog?.name || "Servico sem nome";
            const qty = (es as any).quantity || 0;
            const unit = (es as any).unit || "un";
            totalQty += qty;
            dayTotal += qty;
            const existing = serviceMap.get(name);
            if (existing) {
              existing.quantity += qty;
            } else {
              serviceMap.set(name, { quantity: qty, unit });
            }
          }
          const existing = dailyMap.get(dr.report_date) || 0;
          dailyMap.set(dr.report_date, existing + dayTotal);
        }

        const serviceBreakdown = Array.from(serviceMap.entries())
          .map(([serviceName, { quantity, unit }]) => ({ serviceName, quantity, unit }))
          .sort((a, b) => b.quantity - a.quantity);

        const dailyProduction = Array.from(dailyMap.entries())
          .map(([date, quantity]) => ({ date, quantity }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setNormalRDOData({
          totalRdos: (dailyReports?.length || 0) + legacyCount,
          totalQuantity: totalQty,
          serviceBreakdown,
          dailyProduction,
        });
      } catch (err: any) {
        console.error("Erro ao carregar RDOs normais:", err);
        toast.error("Erro ao carregar RDOs normais: " + err.message);
      } finally {
        if (!cancelled) setLoadingNormal(false);
      }
    };
    fetchNormalRDOs();
    return () => { cancelled = true; };
  }, [rdoSource]);

  const saveOverrides = useCallback((overrides: Record<string, number>) => {
    setManualOverrides(overrides);
    saveModuleData("executedOverrides", overrides);
  }, []);

  const handleEditValue = (id: string, value: string) => {
    setEditingValues(prev => ({ ...prev, [id]: value }));
  };

  const handleCommitEdit = (id: string, rdoExecuted: number) => {
    const raw = editingValues[id];
    if (raw === undefined) return;
    const num = parseFloat(raw.replace(",", "."));
    if (isNaN(num) || num < 0) {
      toast.error("Valor invalido");
      return;
    }
    if (num === rdoExecuted) {
      // Same as RDO value, remove override
      const next = { ...manualOverrides };
      delete next[id];
      saveOverrides(next);
    } else {
      saveOverrides({ ...manualOverrides, [id]: num });
    }
    setEditingValues(prev => { const n = { ...prev }; delete n[id]; return n; });
    toast.success(`Executado de ${id} atualizado para ${fmt(num, 2)} m`);
  };

  const handleResetOverride = (id: string) => {
    const next = { ...manualOverrides };
    delete next[id];
    saveOverrides(next);
    setEditingValues(prev => { const n = { ...prev }; delete n[id]; return n; });
    toast.info(`${id} resetado para valor do RDO`);
  };

  const handleResetAllOverrides = () => {
    saveOverrides({});
    setEditingValues({});
    toast.info("Todos os overrides removidos");
  };

  const totalPlanned = useMemo(() => trechos.reduce((s, t) => s + t.comprimento, 0), [trechos]);
  const totalExecuted = useMemo(() => {
    const allSegs = rdos.flatMap(r => r.segments);
    const rdoTotal = allSegs.reduce((s, seg) => s + seg.executedBefore + seg.executedToday, 0);
    // Include manual overrides
    if (Object.keys(manualOverrides).length === 0) return rdoTotal;
    // Recalculate considering overrides per trecho
    let total = 0;
    for (const t of trechos) {
      const id = `${t.idInicio}-${t.idFim}`;
      if (manualOverrides[id] !== undefined) {
        total += manualOverrides[id];
      } else {
        const matching = allSegs.filter(s =>
          s.segmentName === id || s.segmentName === t.idInicio
        );
        total += matching.reduce((sum, s) => sum + s.executedBefore + s.executedToday, 0);
      }
    }
    return total;
  }, [rdos, manualOverrides, trechos]);
  const progressPercent = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

  const plannedDays = scheduleResult?.totalDays || 0;
  const rdoDays = rdos.length;
  const avgDailyProduction = rdoDays > 0 ? totalExecuted / rdoDays : 0;
  const estimatedRemainingDays = avgDailyProduction > 0 ? (totalPlanned - totalExecuted) / avgDailyProduction : Infinity;
  const delayDays = plannedDays > 0 ? Math.max(0, (rdoDays + estimatedRemainingDays) - plannedDays) : 0;

  // Build comparison data - using real cumulative execution from RDOs
  const comparisonData = useMemo(() => {
    if (!scheduleResult && rdos.length === 0) return [];
    const days = scheduleResult?.totalDays || rdoDays;
    if (days === 0) return [];

    // Build real cumulative execution from RDO dates
    const rdoByDay = new Map<number, number>();
    const sortedRdos = [...rdos].sort((a, b) => a.date.localeCompare(b.date));
    if (sortedRdos.length > 0) {
      const firstDate = new Date(sortedRdos[0].date);
      for (const rdo of sortedRdos) {
        const rdoDate = new Date(rdo.date);
        const dayIndex = Math.floor((rdoDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
        const execToday = rdo.segments.reduce((s, seg) => s + seg.executedToday, 0);
        rdoByDay.set(dayIndex, (rdoByDay.get(dayIndex) || 0) + execToday);
      }
    }

    const maxDay = Math.max(days, ...(rdoByDay.size > 0 ? Array.from(rdoByDay.keys()) : [0]));
    let cumExecuted = 0;
    return Array.from({ length: maxDay + 1 }, (_, i) => {
      if (rdoByDay.has(i)) {
        cumExecuted += rdoByDay.get(i)!;
      }
      return {
        dia: `D${i + 1}`,
        planejado: days > 0 ? Math.min(totalPlanned, (totalPlanned / days) * (i + 1)) : null,
        executado: i <= Math.max(...(rdoByDay.size > 0 ? Array.from(rdoByDay.keys()) : [-1])) ? cumExecuted : null,
      };
    });
  }, [scheduleResult, rdos, totalPlanned, rdoDays]);

  // Segment-level analysis
  const segmentAnalysis = useMemo(() => {
    return trechos.map((t, i) => {
      const id = `${t.idInicio}-${t.idFim}`;
      const allSegs = rdos.flatMap(r => r.segments);
      const matching = allSegs.filter(s =>
        s.segmentName === id || s.segmentName === t.idInicio
      );
      const rdoExecuted = matching.reduce((sum, s) => sum + s.executedBefore + s.executedToday, 0);
      const isOverridden = manualOverrides[id] !== undefined;
      const executed = isOverridden ? manualOverrides[id] : rdoExecuted;
      const planned = t.comprimento;
      const pct = planned > 0 ? (executed / planned) * 100 : 0;
      const status = pct >= 100 ? "Concluido" : pct > 0 ? "Em Execucao" : "Nao Iniciado";
      return { id, planned, executed, rdoExecuted, isOverridden, pct, status, trecho: t };
    });
  }, [trechos, rdos, manualOverrides]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório Integrado: RDO + Planejamento", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    doc.setFontSize(12);
    doc.text("Resumo Geral", 14, 40);
    (doc as any).autoTable({
      startY: 45,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total Planejado", `${fmt(totalPlanned, 2)} m`],
        ["Total Executado", `${fmt(totalExecuted, 2)} m`],
        ["Progresso", `${fmt(progressPercent)}%`],
        ["RDOs Preenchidos", String(rdos.length)],
        ["Dias Planejados", String(plannedDays)],
        ["Prod. Média Diária", `${fmt(avgDailyProduction, 2)} m/dia`],
        ["Dias Restantes (est.)", estimatedRemainingDays === Infinity ? "N/A" : fmt(estimatedRemainingDays, 0)],
        ["Atraso Estimado", `${fmt(delayDays, 0)} dias`],
      ],
    });

    doc.addPage();
    doc.setFontSize(12);
    doc.text("Detalhamento por Trecho", 14, 20);
    (doc as any).autoTable({
      startY: 25,
      head: [["Trecho", "Planejado (m)", "Executado (m)", "Progresso", "Status"]],
      body: segmentAnalysis.map(s => [s.id, fmt(s.planned, 2), fmt(s.executed, 2), `${fmt(s.pct)}%`, s.status]),
    });

    doc.save("relatorio-rdo-planejamento.pdf");
    toast.success("PDF exportado!");
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryData = [
      { Indicador: "Total Planejado (m)", Valor: totalPlanned },
      { Indicador: "Total Executado (m)", Valor: totalExecuted },
      { Indicador: "Progresso (%)", Valor: progressPercent },
      { Indicador: "RDOs", Valor: rdos.length },
      { Indicador: "Dias Planejados", Valor: plannedDays },
      { Indicador: "Produção Média (m/dia)", Valor: avgDailyProduction },
      { Indicador: "Atraso Estimado (dias)", Valor: delayDays },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumo");

    const segData = segmentAnalysis.map(s => ({
      Trecho: s.id, "Planejado (m)": s.planned, "Executado (m)": s.executed, "Progresso (%)": s.pct, Status: s.status
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(segData), "Trechos");

    if (comparisonData.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comparisonData), "Curva S");
    }

    XLSX.writeFile(wb, "relatorio-rdo-planejamento.xlsx");
    toast.success("Excel exportado!");
  };

  const handleExportCSV = () => {
    const header = "Trecho;Planejado (m);Executado (m);Progresso (%);Status\n";
    const rows = segmentAnalysis.map(s => `${s.id};${s.planned.toFixed(2)};${s.executed.toFixed(2)};${s.pct.toFixed(1)};${s.status}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rdo-planejamento.csv"; a.click();
    toast.success("CSV exportado!");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" /> RDO × Planejamento
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Integração entre dados de execução (RDO) e cronograma planejado
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <Select value={rdoSource} onValueChange={(v) => handleSourceChange(v as RDOSource)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hydro">RDO Hydro</SelectItem>
                    <SelectItem value="normal">RDO Normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Badge className="bg-blue-600">
                {rdoSource === "hydro" ? rdos.length : (normalRDOData?.totalRdos || 0)} RDOs
              </Badge>
              <Badge variant="secondary">{plannedDays} dias planejados</Badge>
              {rdoSource === "hydro" && delayDays > 0 && <Badge variant="destructive">{fmt(delayDays, 0)} dias de atraso</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── RDO HYDRO SOURCE ─── */}
      {rdoSource === "hydro" && (
        <>
          {/* Navigation */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "dashboard", label: <><BarChart3 className="h-4 w-4 inline-block mr-1" /> Dashboard Integrado</> },
              { key: "comparison", label: <><TrendingUp className="h-4 w-4 inline-block mr-1" /> Curva S Comparativa</> },
              { key: "delays", label: <><AlertTriangle className="h-4 w-4 inline-block mr-1" /> Análise de Atrasos</> },
            ].map(({ key, label }) => (
              <Button key={key} variant={view === key ? "default" : "outline"} size="sm" onClick={() => setView(key as any)}>{label}</Button>
            ))}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPDF}><Download className="h-4 w-4 mr-1" />PDF</Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="h-4 w-4 mr-1" />Excel</Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
            </div>
          </div>

          {!scheduleResult && (
            <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <p className="text-sm">Nenhum cronograma gerado. Acesse o módulo <strong>Planejamento</strong> para gerar o cronograma antes de usar esta integração.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {rdos.length === 0 && (
            <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-medium">Como alimentar o "Executado" e "Progresso"?</p>
                </div>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1 ml-7">
                  <li>Acesse o módulo <strong>RDO Hydro</strong> e clique em <strong>"Novo RDO"</strong></li>
                  <li>Na seção <strong>"Avanço por Trecho"</strong>, clique em <strong>"Carregar da Rede"</strong> para preencher os trechos automaticamente</li>
                  <li>Preencha o campo <strong>"Exec. Hoje"</strong> com os metros executados no dia</li>
                  <li>Salve o RDO — os dados aparecem aqui automaticamente</li>
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Dashboard */}
          {view === "dashboard" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: "📏", label: "Planejado", value: `${fmt(totalPlanned, 1)} m`, color: "text-blue-600" },
                  { icon: <CheckCircle2 className="h-6 w-6 inline-block" />, label: "Executado", value: `${fmt(totalExecuted, 1)} m`, color: "text-green-600" },
                  { icon: <BarChart3 className="h-6 w-6 inline-block" />, label: "Progresso", value: `${fmt(progressPercent)}%`, color: "text-purple-600" },
                  { icon: "⏱️", label: "Prod. Média", value: `${fmt(avgDailyProduction, 1)} m/dia`, color: "text-orange-600" },
                ].map((c, i) => (
                  <Card key={i}><CardContent className="pt-4 text-center">
                    <span className="text-2xl">{c.icon}</span>
                    <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                  </CardContent></Card>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card><CardContent className="pt-4 text-center">
                  <Calendar className="h-6 w-6 mx-auto text-blue-600 mb-1" />
                  <div className="text-2xl font-bold">{plannedDays}</div>
                  <div className="text-xs text-muted-foreground">Dias Planejados</div>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <FileText className="h-6 w-6 mx-auto text-green-600 mb-1" />
                  <div className="text-2xl font-bold">{rdoDays}</div>
                  <div className="text-xs text-muted-foreground">RDOs Preenchidos</div>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <AlertTriangle className={`h-6 w-6 mx-auto mb-1 ${delayDays > 5 ? "text-red-600" : delayDays > 0 ? "text-orange-600" : "text-green-600"}`} />
                  <div className={`text-2xl font-bold ${delayDays > 5 ? "text-red-600" : delayDays > 0 ? "text-orange-600" : "text-green-600"}`}>
                    {delayDays > 0 ? `${fmt(delayDays, 0)} dias` : "No prazo"}
                  </div>
                  <div className="text-xs text-muted-foreground">Atraso Estimado</div>
                </CardContent></Card>
              </div>

              {/* Segment table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Detalhamento por Trecho</CardTitle>
                    <div className="flex gap-2">
                      {Object.keys(manualOverrides).length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleResetAllOverrides}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resetar Todos
                        </Button>
                      )}
                      <Button
                        variant={editMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditMode(!editMode)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        {editMode ? "Fechar Edicao" : "Editar Executado"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Trecho</TableHead>
                        <TableHead>Planejado</TableHead>
                        <TableHead>Executado</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead>Status</TableHead>
                        {editMode && <TableHead className="w-10"></TableHead>}
                      </TableRow></TableHeader>
                      <TableBody>
                        {segmentAnalysis.map(s => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.id}</TableCell>
                            <TableCell>{fmt(s.planned, 2)} m</TableCell>
                            <TableCell>
                              {editMode ? (
                                <Input
                                  type="text"
                                  className="w-24 h-7 text-xs"
                                  value={editingValues[s.id] ?? fmt(s.executed, 2)}
                                  onChange={e => handleEditValue(s.id, e.target.value)}
                                  onBlur={() => handleCommitEdit(s.id, s.rdoExecuted)}
                                  onKeyDown={e => e.key === "Enter" && handleCommitEdit(s.id, s.rdoExecuted)}
                                />
                              ) : (
                                <span>{fmt(s.executed, 2)} m</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={s.isOverridden ? "default" : "secondary"} className={`text-[10px] ${s.isOverridden ? "bg-amber-500 text-white" : ""}`}>
                                {s.isOverridden ? "Manual" : "RDO"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={Math.min(s.pct, 100)} className="w-20 h-2" />
                                <span className="text-xs">{fmt(s.pct)}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={s.status === "Concluido" ? "bg-green-500 text-white" : s.status === "Em Execucao" ? "bg-orange-500 text-white" : "bg-red-500 text-white"}>
                                {s.status}
                              </Badge>
                            </TableCell>
                            {editMode && (
                              <TableCell>
                                {s.isOverridden && (
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleResetOverride(s.id)} title="Resetar para valor RDO">
                                    <RotateCcw className="h-3 w-3" />
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Curva S Comparison */}
          {view === "comparison" && (
            <Card>
              <CardHeader>
                <CardTitle><TrendingUp className="h-4 w-4 inline-block mr-1" /> Curva S — Planejado vs Executado</CardTitle>
                <CardDescription>Comparação entre progresso planejado e execução real</CardDescription>
              </CardHeader>
              <CardContent>
                {comparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                      <YAxis label={{ value: "Metros (m)", angle: -90, position: "insideLeft" }} />
                      <RechartsTooltip />
                      <Legend />
                      <Area type="monotone" dataKey="planejado" name="Planejado" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="executado" name="Executado" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} connectNulls={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Gere o cronograma no módulo Planejamento para visualizar a curva S.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Delays Analysis */}
          {view === "delays" && (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Análise de Atrasos</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/50 text-center">
                      <div className="text-sm text-muted-foreground">Produtividade Necessária</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {plannedDays > 0 ? fmt(totalPlanned / plannedDays, 1) : "N/A"} m/dia
                      </div>
                      <div className="text-xs text-muted-foreground">Para cumprir o prazo</div>
                    </div>
                    <div className="p-4 bg-muted/50 text-center">
                      <div className="text-sm text-muted-foreground">Produtividade Real</div>
                      <div className={`text-2xl font-bold ${avgDailyProduction >= (totalPlanned / (plannedDays || 1)) ? "text-green-600" : "text-red-600"}`}>
                        {fmt(avgDailyProduction, 1)} m/dia
                      </div>
                      <div className="text-xs text-muted-foreground">Média dos RDOs</div>
                    </div>
                    <div className="p-4 bg-muted/50 text-center">
                      <div className="text-sm text-muted-foreground">Restante</div>
                      <div className="text-2xl font-bold text-orange-600">{fmt(totalPlanned - totalExecuted, 1)} m</div>
                      <div className="text-xs text-muted-foreground">A executar</div>
                    </div>
                  </div>

                  <Card className={`${delayDays > 5 ? "border-red-300 bg-red-50 dark:bg-red-950/20" : delayDays > 0 ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : "border-green-300 bg-green-50 dark:bg-green-950/20"}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <TrendingUp className={`h-8 w-8 ${delayDays > 5 ? "text-red-600" : delayDays > 0 ? "text-orange-600" : "text-green-600"}`} />
                        <div>
                          <div className="font-bold text-lg">
                            {delayDays > 5 ? <><AlertTriangle className="h-4 w-4 inline-block mr-1" /> Atraso Crítico</> : delayDays > 0 ? <><AlertTriangle className="h-4 w-4 inline-block mr-1" /> Atenção: Atraso Detectado</> : <><CheckCircle2 className="h-4 w-4 inline-block mr-1" /> Obra no Prazo</>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {delayDays > 0
                              ? `Estimativa de atraso de ${fmt(delayDays, 0)} dias. Produtividade precisa aumentar para ${fmt((totalPlanned - totalExecuted) / Math.max(1, plannedDays - rdoDays), 1)} m/dia.`
                              : "A produtividade atual está compatível com o cronograma planejado."}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ─── RDO NORMAL SOURCE ─── */}
      {rdoSource === "normal" && (
        <>
          {loadingNormal && (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Carregando RDOs do banco de dados...</p>
              </CardContent>
            </Card>
          )}

          {!loadingNormal && !normalRDOData && (
            <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <p className="text-sm">Faça login para carregar os RDOs normais do banco de dados.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!loadingNormal && normalRDOData && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card><CardContent className="pt-4 text-center">
                  <FileText className="h-6 w-6 mx-auto text-blue-600 mb-1" />
                  <div className="text-2xl font-bold text-blue-600">{normalRDOData.totalRdos}</div>
                  <div className="text-xs text-muted-foreground">RDOs Registrados</div>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-1" />
                  <div className="text-2xl font-bold text-green-600">{fmt(normalRDOData.totalQuantity, 1)}</div>
                  <div className="text-xs text-muted-foreground">Qtd. Total Executada</div>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <BarChart3 className="h-6 w-6 mx-auto text-purple-600 mb-1" />
                  <div className="text-2xl font-bold text-purple-600">{normalRDOData.serviceBreakdown.length}</div>
                  <div className="text-xs text-muted-foreground">Servicos Distintos</div>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <Calendar className="h-6 w-6 mx-auto text-orange-600 mb-1" />
                  <div className="text-2xl font-bold text-orange-600">{normalRDOData.dailyProduction.length}</div>
                  <div className="text-xs text-muted-foreground">Dias com Producao</div>
                </CardContent></Card>
              </div>

              {/* Daily production chart */}
              {normalRDOData.dailyProduction.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle><TrendingUp className="h-4 w-4 inline-block mr-1" /> Producao Diaria (RDO Normal)</CardTitle>
                    <CardDescription>Quantidade executada por dia nos daily reports</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={normalRDOData.dailyProduction}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="quantity" name="Quantidade" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Service breakdown table */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento por Servico</CardTitle>
                  <CardDescription>Servicos executados registrados nos RDOs normais</CardDescription>
                </CardHeader>
                <CardContent>
                  {normalRDOData.serviceBreakdown.length > 0 ? (
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Servico</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Unidade</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {normalRDOData.serviceBreakdown.map((s, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{s.serviceName}</TableCell>
                              <TableCell>{fmt(s.quantity, 2)}</TableCell>
                              <TableCell><Badge variant="secondary">{s.unit}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhum servico executado encontrado nos RDOs normais.</p>
                  )}
                </CardContent>
              </Card>

              {/* Comparison with planning */}
              {scheduleResult && totalPlanned > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle><BarChart3 className="h-4 w-4 inline-block mr-1" /> Comparacao com Planejamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-muted/50 text-center">
                        <div className="text-sm text-muted-foreground">Total Planejado</div>
                        <div className="text-2xl font-bold text-blue-600">{fmt(totalPlanned, 1)} m</div>
                      </div>
                      <div className="p-4 bg-muted/50 text-center">
                        <div className="text-sm text-muted-foreground">Dias Planejados</div>
                        <div className="text-2xl font-bold text-purple-600">{plannedDays}</div>
                      </div>
                      <div className="p-4 bg-muted/50 text-center">
                        <div className="text-sm text-muted-foreground">Producao RDO Normal</div>
                        <div className="text-2xl font-bold text-green-600">{fmt(normalRDOData.totalQuantity, 1)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
