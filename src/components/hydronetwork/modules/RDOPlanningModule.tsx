/**
 * RDO Hydro + Planning Integration Module
 * Combines RDO execution data with planning schedule for dashboards and exports
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, BarChart3, Calendar, AlertTriangle, TrendingUp, FileText } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line
} from "recharts";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { RDO, calculateDashboardMetrics } from "@/engine/rdo";
import { ScheduleResult } from "@/engine/planning";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface RDOPlanningModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  rdos: RDO[];
  scheduleResult: ScheduleResult | null;
}

const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const RDOPlanningModule = ({ pontos, trechos, rdos, scheduleResult }: RDOPlanningModuleProps) => {
  const [view, setView] = useState<"dashboard" | "comparison" | "delays">("dashboard");

  const totalPlanned = useMemo(() => trechos.reduce((s, t) => s + t.comprimento, 0), [trechos]);
  const totalExecuted = useMemo(() => {
    const allSegs = rdos.flatMap(r => r.segments);
    return allSegs.reduce((s, seg) => s + seg.executedBefore + seg.executedToday, 0);
  }, [rdos]);
  const progressPercent = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

  const plannedDays = scheduleResult?.totalDays || 0;
  const rdoDays = rdos.length;
  const avgDailyProduction = rdoDays > 0 ? totalExecuted / rdoDays : 0;
  const estimatedRemainingDays = avgDailyProduction > 0 ? (totalPlanned - totalExecuted) / avgDailyProduction : Infinity;
  const delayDays = plannedDays > 0 ? Math.max(0, (rdoDays + estimatedRemainingDays) - plannedDays) : 0;

  // Build comparison data
  const comparisonData = useMemo(() => {
    if (!scheduleResult) return [];
    const days = scheduleResult.totalDays;
    return Array.from({ length: Math.max(days, rdoDays) }, (_, i) => ({
      dia: `D${i + 1}`,
      planejado: Math.min(totalPlanned, (totalPlanned / days) * (i + 1)),
      executado: i < rdoDays ? Math.min(totalExecuted, (totalExecuted / rdoDays) * (i + 1)) : null,
    }));
  }, [scheduleResult, rdos, totalPlanned, totalExecuted, rdoDays]);

  // Segment-level analysis
  const segmentAnalysis = useMemo(() => {
    return trechos.map((t, i) => {
      const allSegs = rdos.flatMap(r => r.segments);
      const matching = allSegs.filter(s =>
        s.segmentName === `${t.idInicio}-${t.idFim}` || s.segmentName === t.idInicio
      );
      const executed = matching.reduce((sum, s) => sum + s.executedBefore + s.executedToday, 0);
      const planned = t.comprimento;
      const pct = planned > 0 ? (executed / planned) * 100 : 0;
      const status = pct >= 100 ? "Concluído" : pct > 0 ? "Em Execução" : "Não Iniciado";
      return { id: `${t.idInicio}-${t.idFim}`, planned, executed, pct, status, trecho: t };
    });
  }, [trechos, rdos]);

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
            <div className="flex gap-2 flex-wrap">
              <Badge className="bg-blue-600">{rdos.length} RDOs</Badge>
              <Badge variant="secondary">{plannedDays} dias planejados</Badge>
              {delayDays > 0 && <Badge variant="destructive">{fmt(delayDays, 0)} dias de atraso</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "dashboard", label: "📊 Dashboard Integrado" },
          { key: "comparison", label: "📈 Curva S Comparativa" },
          { key: "delays", label: "⚠️ Análise de Atrasos" },
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
              { icon: "✅", label: "Executado", value: `${fmt(totalExecuted, 1)} m`, color: "text-green-600" },
              { icon: "📊", label: "Progresso", value: `${fmt(progressPercent)}%`, color: "text-purple-600" },
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
            <CardHeader><CardTitle>Detalhamento por Trecho</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Trecho</TableHead><TableHead>Planejado</TableHead><TableHead>Executado</TableHead><TableHead>Progresso</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {segmentAnalysis.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.id}</TableCell>
                        <TableCell>{fmt(s.planned, 2)} m</TableCell>
                        <TableCell>{fmt(s.executed, 2)} m</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(s.pct, 100)} className="w-20 h-2" />
                            <span className="text-xs">{fmt(s.pct)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={s.status === "Concluído" ? "bg-green-500 text-white" : s.status === "Em Execução" ? "bg-orange-500 text-white" : "bg-red-500 text-white"}>
                            {s.status}
                          </Badge>
                        </TableCell>
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
            <CardTitle>📈 Curva S — Planejado vs Executado</CardTitle>
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
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-sm text-muted-foreground">Produtividade Necessária</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {plannedDays > 0 ? fmt(totalPlanned / plannedDays, 1) : "N/A"} m/dia
                  </div>
                  <div className="text-xs text-muted-foreground">Para cumprir o prazo</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-sm text-muted-foreground">Produtividade Real</div>
                  <div className={`text-2xl font-bold ${avgDailyProduction >= (totalPlanned / (plannedDays || 1)) ? "text-green-600" : "text-red-600"}`}>
                    {fmt(avgDailyProduction, 1)} m/dia
                  </div>
                  <div className="text-xs text-muted-foreground">Média dos RDOs</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
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
                        {delayDays > 5 ? "⚠️ Atraso Crítico" : delayDays > 0 ? "⏰ Atenção: Atraso Detectado" : "✅ Obra no Prazo"}
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
    </div>
  );
};
