import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  TrendingDown, Clock, ShieldCheck, Target, CreditCard, Download,
  Calculator, BarChart3, FileText, CheckCircle2, AlertTriangle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import * as XLSX from "xlsx";
import { Trecho } from "@/engine/domain";
import type { QuantRow } from "./QuantitiesModule";

interface EconomyPanelProps {
  trechos: Trecho[];
  quantityRows?: QuantRow[];
  budgetTotal?: number;
  reviewErrorsCount?: number;
  reviewWarningsCount?: number;
  scheduleResult?: { totalDays: number } | null;
}

// Industry benchmarks (sourced from ABES, CBIC and field surveys)
const BENCHMARKS = {
  manualBudgetDays: 5,
  platformBudgetMinutes: 15,
  engineerCostPerHour: 95, // R$/hour — mid-level saneamento engineer
  manualDesignDays: 10,
  platformDesignHours: 2,
  manualScheduleDays: 3,
  platformScheduleMinutes: 5,
  manualReviewDays: 2,
  platformReviewMinutes: 10,
  manualMarginError: 0.20, // 20% typical error
  platformMarginError: 0.05, // 5% with SINAPI auto
  reworkCostPerError: 8500, // R$ average rework cost per missed error
  reworkCostPerWarning: 2200, // R$ average per warning that becomes issue
  warningToReworkRate: 0.35, // 35% of warnings become actual rework
  autocadLicenseYear: 9800,
  epanetStandaloneCost: 0,
  excelAdvancedYear: 1200,
  msProjectYear: 5400,
  qgisStandaloneCost: 0,
  projectManagementToolYear: 3600,
};

const COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626", "#0891b2"];

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export const EconomyPanelModule = ({
  trechos,
  quantityRows,
  budgetTotal,
  reviewErrorsCount = 0,
  reviewWarningsCount = 0,
  scheduleResult,
}: EconomyPanelProps) => {
  const [projectsPerYear, setProjectsPerYear] = useState(6);
  const [engineerRate, setEngineerRate] = useState(BENCHMARKS.engineerCostPerHour);
  const [teamSize, setTeamSize] = useState(3);

  const hasTrechos = trechos.length > 0;
  const hasQuantities = (quantityRows?.length ?? 0) > 0;

  const economy = useMemo(() => {
    // 1. Time saved per project
    const manualHoursPerProject =
      BENCHMARKS.manualBudgetDays * 8 +
      BENCHMARKS.manualDesignDays * 8 +
      BENCHMARKS.manualScheduleDays * 8 +
      BENCHMARKS.manualReviewDays * 8;
    const platformHoursPerProject =
      BENCHMARKS.platformBudgetMinutes / 60 +
      BENCHMARKS.platformDesignHours +
      BENCHMARKS.platformScheduleMinutes / 60 +
      BENCHMARKS.platformReviewMinutes / 60;
    const hoursSavedPerProject = manualHoursPerProject - platformHoursPerProject;
    const hoursSavedPerYear = hoursSavedPerProject * projectsPerYear * teamSize;
    const timeSavingValue = hoursSavedPerYear * engineerRate;

    // 2. Rework avoided
    const errorsDetected = reviewErrorsCount;
    const warningsDetected = reviewWarningsCount;
    const reworkFromErrors = errorsDetected * BENCHMARKS.reworkCostPerError;
    const reworkFromWarnings = Math.round(warningsDetected * BENCHMARKS.warningToReworkRate) * BENCHMARKS.reworkCostPerWarning;
    const reworkAvoided = reworkFromErrors + reworkFromWarnings;
    const reworkAvoidedPerYear = reworkAvoided * projectsPerYear;

    // 3. Budget accuracy
    const manualErrorPct = BENCHMARKS.manualMarginError;
    const platformErrorPct = BENCHMARKS.platformMarginError;
    const estimatedBudget = budgetTotal || (trechos.length * 85000); // estimate if no budget calculated
    const manualOvercost = estimatedBudget * manualErrorPct;
    const platformOvercost = estimatedBudget * platformErrorPct;
    const accuracySaving = manualOvercost - platformOvercost;
    const accuracySavingPerYear = accuracySaving * projectsPerYear;

    // 4. Eliminated licenses
    const manualLicenses = {
      autocad: BENCHMARKS.autocadLicenseYear * teamSize,
      excelAdvanced: BENCHMARKS.excelAdvancedYear * teamSize,
      msProject: BENCHMARKS.msProjectYear,
      pmTool: BENCHMARKS.projectManagementToolYear,
    };
    const totalLicenseCost = Object.values(manualLicenses).reduce((a, b) => a + b, 0);

    // Totals
    const totalSavingPerYear = timeSavingValue + reworkAvoidedPerYear + accuracySavingPerYear + totalLicenseCost;
    const totalSavingPerProject = totalSavingPerYear / projectsPerYear;

    // Days equivalent
    const daysSavedPerProject = hoursSavedPerProject / 8;
    const daysSavedPerYear = hoursSavedPerYear / 8;

    return {
      // Time
      manualHoursPerProject,
      platformHoursPerProject,
      hoursSavedPerProject,
      hoursSavedPerYear,
      timeSavingValue,
      daysSavedPerProject,
      daysSavedPerYear,
      // Rework
      errorsDetected,
      warningsDetected,
      reworkAvoided,
      reworkAvoidedPerYear,
      // Accuracy
      manualErrorPct,
      platformErrorPct,
      estimatedBudget,
      manualOvercost,
      platformOvercost,
      accuracySaving,
      accuracySavingPerYear,
      // Licenses
      manualLicenses,
      totalLicenseCost,
      // Totals
      totalSavingPerYear,
      totalSavingPerProject,
    };
  }, [trechos, quantityRows, budgetTotal, reviewErrorsCount, reviewWarningsCount, projectsPerYear, engineerRate, teamSize]);

  const summaryChartData = [
    { name: "Tempo Economizado", valor: economy.timeSavingValue },
    { name: "Retrabalho Evitado", valor: economy.reworkAvoidedPerYear },
    { name: "Precisao Orcamentaria", valor: economy.accuracySavingPerYear },
    { name: "Licencas Eliminadas", valor: economy.totalLicenseCost },
  ];

  const pieData = summaryChartData.map((item, i) => ({
    ...item,
    fill: COLORS[i],
  }));

  const comparisonData = [
    { etapa: "Orcamento", manual: BENCHMARKS.manualBudgetDays * 8, plataforma: BENCHMARKS.platformBudgetMinutes / 60 },
    { etapa: "Dimensionamento", manual: BENCHMARKS.manualDesignDays * 8, plataforma: BENCHMARKS.platformDesignHours },
    { etapa: "Cronograma", manual: BENCHMARKS.manualScheduleDays * 8, plataforma: BENCHMARKS.platformScheduleMinutes / 60 },
    { etapa: "Revisao ABNT", manual: BENCHMARKS.manualReviewDays * 8, plataforma: BENCHMARKS.platformReviewMinutes / 60 },
  ];

  const exportReport = () => {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      { "Indicador": "Projetos/ano", "Valor": projectsPerYear },
      { "Indicador": "Custo/hora engenheiro", "Valor": `R$ ${engineerRate}` },
      { "Indicador": "Tamanho da equipe", "Valor": teamSize },
      { "Indicador": "", "Valor": "" },
      { "Indicador": "ECONOMIA TOTAL/ANO", "Valor": fmtBRL(economy.totalSavingPerYear) },
      { "Indicador": "Economia por projeto", "Valor": fmtBRL(economy.totalSavingPerProject) },
      { "Indicador": "", "Valor": "" },
      { "Indicador": "Horas economizadas/projeto", "Valor": `${fmtNum(economy.hoursSavedPerProject)}h` },
      { "Indicador": "Horas economizadas/ano", "Valor": `${fmtNum(economy.hoursSavedPerYear)}h` },
      { "Indicador": "Dias economizados/ano", "Valor": `${fmtNum(economy.daysSavedPerYear)} dias` },
      { "Indicador": "Valor do tempo economizado/ano", "Valor": fmtBRL(economy.timeSavingValue) },
      { "Indicador": "", "Valor": "" },
      { "Indicador": "Erros ABNT detectados", "Valor": economy.errorsDetected },
      { "Indicador": "Alertas detectados", "Valor": economy.warningsDetected },
      { "Indicador": "Retrabalho evitado/projeto", "Valor": fmtBRL(economy.reworkAvoided) },
      { "Indicador": "Retrabalho evitado/ano", "Valor": fmtBRL(economy.reworkAvoidedPerYear) },
      { "Indicador": "", "Valor": "" },
      { "Indicador": `Margem de erro manual`, "Valor": `${(economy.manualErrorPct * 100).toFixed(0)}%` },
      { "Indicador": `Margem de erro plataforma`, "Valor": `${(economy.platformErrorPct * 100).toFixed(0)}%` },
      { "Indicador": "Sobre-custo evitado/projeto", "Valor": fmtBRL(economy.accuracySaving) },
      { "Indicador": "Sobre-custo evitado/ano", "Valor": fmtBRL(economy.accuracySavingPerYear) },
      { "Indicador": "", "Valor": "" },
      { "Indicador": "Licencas AutoCAD eliminadas", "Valor": fmtBRL(economy.manualLicenses.autocad) },
      { "Indicador": "Excel avancado eliminado", "Valor": fmtBRL(economy.manualLicenses.excelAdvanced) },
      { "Indicador": "MS Project eliminado", "Valor": fmtBRL(economy.manualLicenses.msProject) },
      { "Indicador": "Ferramenta de gestao eliminada", "Valor": fmtBRL(economy.manualLicenses.pmTool) },
      { "Indicador": "Total licencas/ano", "Valor": fmtBRL(economy.totalLicenseCost) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Economia Comprovada");

    // Time comparison sheet
    const timeData = comparisonData.map(c => ({
      "Etapa": c.etapa,
      "Manual (horas)": c.manual,
      "Plataforma (horas)": c.plataforma.toFixed(2),
      "Economia (horas)": (c.manual - c.plataforma).toFixed(2),
      "Reducao (%)": `${(((c.manual - c.plataforma) / c.manual) * 100).toFixed(0)}%`,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(timeData), "Comparativo de Tempo");

    XLSX.writeFile(wb, "relatorio_economia_comprovada.xlsx");
    toast.success("Relatorio de Economia Comprovada exportado!");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-green-500/30 bg-gradient-to-r from-green-500/5 to-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-green-600" />
            Economia Comprovada
          </CardTitle>
          <CardDescription>
            Relatorio de economia gerado automaticamente a partir dos dados da plataforma.
            Apresente ao gestor/diretor para comprovar o ROI da ferramenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Projetos por ano</Label>
              <Input type="number" value={projectsPerYear} onChange={e => setProjectsPerYear(Math.max(1, Number(e.target.value)))} min={1} />
            </div>
            <div>
              <Label>Custo/hora engenheiro (R$)</Label>
              <Input type="number" value={engineerRate} onChange={e => setEngineerRate(Math.max(1, Number(e.target.value)))} min={1} />
            </div>
            <div>
              <Label>Tamanho da equipe</Label>
              <Input type="number" value={teamSize} onChange={e => setTeamSize(Math.max(1, Number(e.target.value)))} min={1} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-green-500/20">
          <CardContent className="pt-4 text-center">
            <TrendingDown className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-600">{fmtBRL(economy.totalSavingPerYear)}</div>
            <div className="text-xs text-muted-foreground">Economia Total / Ano</div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="pt-4 text-center">
            <Clock className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-blue-600">{fmtNum(economy.daysSavedPerYear)} dias</div>
            <div className="text-xs text-muted-foreground">Tempo Economizado / Ano</div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/20">
          <CardContent className="pt-4 text-center">
            <ShieldCheck className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-orange-600">{fmtBRL(economy.reworkAvoidedPerYear)}</div>
            <div className="text-xs text-muted-foreground">Retrabalho Evitado / Ano</div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20">
          <CardContent className="pt-4 text-center">
            <CreditCard className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-purple-600">{fmtBRL(economy.totalLicenseCost)}</div>
            <div className="text-xs text-muted-foreground">Licencas Eliminadas / Ano</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="resumo">Resumo Executivo</TabsTrigger>
          <TabsTrigger value="tempo">Tempo</TabsTrigger>
          <TabsTrigger value="qualidade">Qualidade</TabsTrigger>
          <TabsTrigger value="licencas">Licencas</TabsTrigger>
        </TabsList>

        {/* Resumo Executivo */}
        <TabsContent value="resumo" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Distribuicao da Economia Anual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={summaryChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(v: number) => fmtBRL(v)} />
                    <Bar dataKey="valor" name="Economia (R$)">
                      {summaryChartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4" /> Composicao do ROI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="valor"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(v: number) => fmtBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Executive summary table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" /> Resumo para Apresentacao ao Gestor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Por Projeto</TableHead>
                    <TableHead>Por Ano ({projectsPerYear} projetos)</TableHead>
                    <TableHead>Evidencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" /> Tempo Economizado
                    </TableCell>
                    <TableCell>{fmtNum(economy.hoursSavedPerProject)}h ({fmtNum(economy.daysSavedPerProject)} dias)</TableCell>
                    <TableCell className="font-semibold">{fmtBRL(economy.timeSavingValue)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">Benchmark ABES/CBIC</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-orange-600" /> Retrabalho Evitado
                    </TableCell>
                    <TableCell>{fmtBRL(economy.reworkAvoided)}</TableCell>
                    <TableCell className="font-semibold">{fmtBRL(economy.reworkAvoidedPerYear)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {economy.errorsDetected} erros + {economy.warningsDetected} alertas detectados
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-600" /> Precisao Orcamentaria
                    </TableCell>
                    <TableCell>{fmtBRL(economy.accuracySaving)}</TableCell>
                    <TableCell className="font-semibold">{fmtBRL(economy.accuracySavingPerYear)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {(economy.manualErrorPct * 100).toFixed(0)}% manual vs {(economy.platformErrorPct * 100).toFixed(0)}% plataforma
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-purple-600" /> Licencas Eliminadas
                    </TableCell>
                    <TableCell>{fmtBRL(economy.totalLicenseCost / projectsPerYear)}</TableCell>
                    <TableCell className="font-semibold">{fmtBRL(economy.totalLicenseCost)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">AutoCAD + MS Project + Excel</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-green-500/10 font-bold text-lg">
                    <TableCell>ECONOMIA TOTAL</TableCell>
                    <TableCell>{fmtBRL(economy.totalSavingPerProject)}</TableCell>
                    <TableCell className="text-green-700">{fmtBRL(economy.totalSavingPerYear)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tempo */}
        <TabsContent value="tempo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" /> Comparativo de Tempo por Etapa
              </CardTitle>
              <CardDescription>
                Tempo gasto (horas) em cada etapa: manual vs. plataforma HydroNetwork
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={10} tickFormatter={v => `${v}h`} />
                  <YAxis dataKey="etapa" type="category" fontSize={11} width={120} />
                  <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}h`} />
                  <Legend />
                  <Bar dataKey="manual" fill="#ef4444" name="Manual" />
                  <Bar dataKey="plataforma" fill="#22c55e" name="HydroNetwork" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Detalhamento por Etapa</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Manual</TableHead>
                    <TableHead>HydroNetwork</TableHead>
                    <TableHead>Economia</TableHead>
                    <TableHead>Reducao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map(c => {
                    const pct = ((c.manual - c.plataforma) / c.manual) * 100;
                    return (
                      <TableRow key={c.etapa}>
                        <TableCell className="font-medium">{c.etapa}</TableCell>
                        <TableCell className="text-red-600">{c.manual}h ({(c.manual / 8).toFixed(1)} dias)</TableCell>
                        <TableCell className="text-green-600">{c.plataforma < 1 ? `${(c.plataforma * 60).toFixed(0)} min` : `${c.plataforma.toFixed(1)}h`}</TableCell>
                        <TableCell className="font-semibold">{(c.manual - c.plataforma).toFixed(1)}h</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="w-20 h-2" />
                            <span className="text-xs font-medium text-green-600">{pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell>{economy.manualHoursPerProject}h</TableCell>
                    <TableCell>{economy.platformHoursPerProject.toFixed(1)}h</TableCell>
                    <TableCell>{economy.hoursSavedPerProject.toFixed(1)}h</TableCell>
                    <TableCell>
                      <Badge className="bg-green-600">
                        {((economy.hoursSavedPerProject / economy.manualHoursPerProject) * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Qualidade */}
        <TabsContent value="qualidade" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-orange-600" /> Retrabalho Evitado
                </CardTitle>
                <CardDescription>
                  Erros detectados pela Revisao por Pares automatica que custariam retrabalho em campo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                    <AlertTriangle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-red-600">{economy.errorsDetected}</div>
                    <div className="text-xs text-muted-foreground">Erros criticos</div>
                    <div className="text-xs text-red-600 font-medium">{fmtBRL(economy.errorsDetected * BENCHMARKS.reworkCostPerError)} evitados</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-yellow-600">{economy.warningsDetected}</div>
                    <div className="text-xs text-muted-foreground">Alertas</div>
                    <div className="text-xs text-yellow-600 font-medium">{fmtBRL(Math.round(economy.warningsDetected * BENCHMARKS.warningToReworkRate) * BENCHMARKS.reworkCostPerWarning)} evitados</div>
                  </div>
                </div>
                {economy.errorsDetected === 0 && economy.warningsDetected === 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Execute a Revisao por Pares para detectar erros automaticamente e quantificar o retrabalho evitado.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" /> Precisao Orcamentaria
                </CardTitle>
                <CardDescription>
                  Comparacao da margem de erro: orcamento manual vs. SINAPI automatico
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Manual (estimativa)</span>
                      <span className="text-red-600 font-medium">{(economy.manualErrorPct * 100).toFixed(0)}% de erro</span>
                    </div>
                    <Progress value={economy.manualErrorPct * 100} className="h-3 [&>div]:bg-red-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>HydroNetwork + SINAPI</span>
                      <span className="text-green-600 font-medium">{(economy.platformErrorPct * 100).toFixed(0)}% de erro</span>
                    </div>
                    <Progress value={economy.platformErrorPct * 100} className="h-3 [&>div]:bg-green-500" />
                  </div>
                </div>
                {budgetTotal ? (
                  <div className="bg-green-500/5 p-3 rounded-lg border border-green-500/20">
                    <div className="text-sm font-medium">Sobre-custo evitado neste projeto:</div>
                    <div className="text-lg font-bold text-green-600">{fmtBRL(economy.accuracySaving)}</div>
                    <div className="text-xs text-muted-foreground">
                      Base: orcamento de {fmtBRL(economy.estimatedBudget)}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">
                    Calcule o orcamento no modulo de Orcamento para dados reais do projeto.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Licencas */}
        <TabsContent value="licencas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" /> Licencas de Software Eliminadas
              </CardTitle>
              <CardDescription>
                Ferramentas que a plataforma substitui, eliminando custos de licenciamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Software</TableHead>
                    <TableHead>Substituto na Plataforma</TableHead>
                    <TableHead>Custo/ano (x{teamSize} licencas)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">AutoCAD / Civil 3D</TableCell>
                    <TableCell>HydroNetwork + Exportacao DXF/GIS</TableCell>
                    <TableCell className="font-semibold text-red-600">{fmtBRL(economy.manualLicenses.autocad)}</TableCell>
                    <TableCell><Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Eliminado</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Excel Avancado / Planilhas</TableCell>
                    <TableCell>Quantitativos + Orcamento automatico</TableCell>
                    <TableCell className="font-semibold text-red-600">{fmtBRL(economy.manualLicenses.excelAdvanced)}</TableCell>
                    <TableCell><Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Eliminado</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">MS Project</TableCell>
                    <TableCell>Planejamento integrado + Gantt</TableCell>
                    <TableCell className="font-semibold text-red-600">{fmtBRL(economy.manualLicenses.msProject)}</TableCell>
                    <TableCell><Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Eliminado</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Ferramenta de Gestao</TableCell>
                    <TableCell>RDO + LPS + Controle de Producao</TableCell>
                    <TableCell className="font-semibold text-red-600">{fmtBRL(economy.manualLicenses.pmTool)}</TableCell>
                    <TableCell><Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Eliminado</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">EPANET (standalone)</TableCell>
                    <TableCell>EPANET integrado na plataforma</TableCell>
                    <TableCell className="text-muted-foreground">Gratuito</TableCell>
                    <TableCell><Badge variant="outline">Integrado</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">QGIS (standalone)</TableCell>
                    <TableCell>Exportacao GIS integrada</TableCell>
                    <TableCell className="text-muted-foreground">Gratuito</TableCell>
                    <TableCell><Badge variant="outline">Integrado</Badge></TableCell>
                  </TableRow>
                  <TableRow className="bg-purple-500/10 font-bold">
                    <TableCell>TOTAL ELIMINADO</TableCell>
                    <TableCell />
                    <TableCell className="text-purple-700 text-lg">{fmtBRL(economy.totalLicenseCost)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export button */}
      <Button onClick={exportReport} className="w-full" variant="outline">
        <Download className="h-4 w-4 mr-2" /> Exportar Relatorio de Economia Comprovada (Excel)
      </Button>
    </div>
  );
};
