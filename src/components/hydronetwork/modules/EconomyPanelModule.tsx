import { useState, useMemo, useEffect } from "react";
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
  Calculator, BarChart3, FileText, CheckCircle2, AlertTriangle,
  Database, Activity
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import * as XLSX from "xlsx";
import { Trecho } from "@/engine/domain";
import type { QuantRow } from "./QuantitiesModule";
import { loadModuleData, saveModuleData } from "@/engine/moduleExchange";
import type { TrechoMedicao, MedicaoItem } from "@/engine/medicao";
import { calcularResumoMedicao } from "@/engine/medicao";

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

  // User-editable real project inputs for accurate savings
  const [orcamentoObra, setOrcamentoObra] = useState(0); // Real project budget
  const [custoManualEstimado, setCustoManualEstimado] = useState(0); // What it would cost manually
  const [margemErroManual, setMargemErroManual] = useState(20); // % error in manual estimates
  const [custoRetrabalhoReal, setCustoRetrabalhoReal] = useState(8500); // Real rework cost per error
  const [horasManualProjeto, setHorasManualProjeto] = useState(0); // Manual hours per project (0 = use benchmark)

  // Load real platform data from moduleExchange store
  const [medicaoTrechos, setMedicaoTrechos] = useState<TrechoMedicao[]>([]);
  const [medicaoItems, setMedicaoItems] = useState<MedicaoItem[]>([]);

  // Loaded review data from PeerReviewModule (persisted via moduleExchange)
  const [loadedReviewErrors, setLoadedReviewErrors] = useState(0);
  const [loadedReviewWarnings, setLoadedReviewWarnings] = useState(0);

  // Prediction inputs
  const [predExtensaoKm, setPredExtensaoKm] = useState(0); // km of network
  const [predDnMedio, setPredDnMedio] = useState(200); // average diameter mm
  const [predProfMedia, setPredProfMedia] = useState(1.5); // average depth m
  const [predTipoProjeto, setPredTipoProjeto] = useState<"esgoto" | "agua" | "drenagem">("esgoto");

  useEffect(() => {
    const storedMedicao = loadModuleData<TrechoMedicao[]>("medicaoTrechos");
    if (storedMedicao && storedMedicao.length > 0) setMedicaoTrechos(storedMedicao);
    const storedItems = loadModuleData<MedicaoItem[]>("medicaoItems");
    if (storedItems && storedItems.length > 0) setMedicaoItems(storedItems);

    // Load persisted review results (saved by PeerReviewModule via moduleExchange)
    const storedErrors = loadModuleData<number>("reviewErrors");
    const storedWarnings = loadModuleData<number>("reviewWarnings");
    if (storedErrors != null && storedErrors > 0) setLoadedReviewErrors(storedErrors);
    if (storedWarnings != null && storedWarnings > 0) setLoadedReviewWarnings(storedWarnings);
  }, []);

  // Use props if available, otherwise fall back to loaded persisted data
  const effectiveReviewErrors = reviewErrorsCount > 0 ? reviewErrorsCount : loadedReviewErrors;
  const effectiveReviewWarnings = reviewWarningsCount > 0 ? reviewWarningsCount : loadedReviewWarnings;

  const hasTrechos = trechos.length > 0;
  const hasQuantities = (quantityRows?.length ?? 0) > 0;
  const hasMedicao = medicaoTrechos.length > 0;

  // Real platform data summary
  const platformData = useMemo(() => {
    // Real cost from quantityRows
    const realCostTotal = quantityRows?.reduce((s, r) => s + (r.custoTotal || 0), 0) ?? 0;

    // Real medicao summary
    const medicaoSummary = hasMedicao ? calcularResumoMedicao(medicaoTrechos) : null;

    // Real execution tracking
    const totalExecutado = medicaoTrechos.reduce((s, m) => s + m.qtd_executada, 0);
    const totalComprimento = medicaoTrechos.reduce((s, m) => s + m.comprimento, 0);
    const pctExecutado = totalComprimento > 0 ? (totalExecutado / totalComprimento) * 100 : 0;
    const medicaoRealizada = medicaoTrechos.reduce((s, m) => s + m.med_realizada, 0);
    const custoReal = medicaoTrechos.reduce((s, m) => s + m.custo_real, 0);

    // Extension from trechos
    const extensaoTotal = trechos.reduce((s, t) => s + t.comprimento, 0);

    return {
      realCostTotal,
      medicaoSummary,
      totalExecutado,
      totalComprimento,
      pctExecutado,
      medicaoRealizada,
      custoReal,
      extensaoTotal,
      margemReal: medicaoSummary ? medicaoSummary.margem_total : 0,
      margemPctReal: medicaoSummary ? medicaoSummary.margem_pct : 0,
    };
  }, [trechos, quantityRows, medicaoTrechos, hasMedicao]);

  const economy = useMemo(() => {
    // 1. Time saved per project — use user input if provided, otherwise benchmarks
    const benchmarkManualHours =
      BENCHMARKS.manualBudgetDays * 8 +
      BENCHMARKS.manualDesignDays * 8 +
      BENCHMARKS.manualScheduleDays * 8 +
      BENCHMARKS.manualReviewDays * 8;
    const manualHoursPerProject = horasManualProjeto > 0 ? horasManualProjeto : benchmarkManualHours;
    const platformHoursPerProject =
      BENCHMARKS.platformBudgetMinutes / 60 +
      BENCHMARKS.platformDesignHours +
      BENCHMARKS.platformScheduleMinutes / 60 +
      BENCHMARKS.platformReviewMinutes / 60;
    const hoursSavedPerProject = manualHoursPerProject - platformHoursPerProject;
    const hoursSavedPerYear = hoursSavedPerProject * projectsPerYear * teamSize;
    const timeSavingValue = hoursSavedPerYear * engineerRate;

    // 2. Rework avoided — use user-defined rework cost
    const errorsDetected = effectiveReviewErrors;
    const warningsDetected = effectiveReviewWarnings;
    const reworkCostError = custoRetrabalhoReal > 0 ? custoRetrabalhoReal : BENCHMARKS.reworkCostPerError;
    const reworkFromErrors = errorsDetected * reworkCostError;
    const reworkFromWarnings = Math.round(warningsDetected * BENCHMARKS.warningToReworkRate) * BENCHMARKS.reworkCostPerWarning;
    const reworkAvoided = reworkFromErrors + reworkFromWarnings;
    const reworkAvoidedPerYear = reworkAvoided * projectsPerYear;

    // 3. Budget accuracy — prioritize user inputs, then platform data, then benchmarks
    const manualErrorPct = margemErroManual / 100;
    const platformErrorPct = BENCHMARKS.platformMarginError;
    // Use: user-entered budget > module budget > real cost from quantities > fallback
    const estimatedBudget = orcamentoObra > 0
      ? orcamentoObra
      : budgetTotal || platformData.realCostTotal || (trechos.length * 85000);
    const manualOvercost = estimatedBudget * manualErrorPct;
    const platformOvercost = estimatedBudget * platformErrorPct;
    const accuracySaving = manualOvercost - platformOvercost;
    const accuracySavingPerYear = accuracySaving * projectsPerYear;

    // 3b. Direct comparison: if user provided both manual estimate and real budget
    const hasDirectComparison = custoManualEstimado > 0 && estimatedBudget > 0;
    const directSaving = hasDirectComparison ? custoManualEstimado - estimatedBudget : 0;
    const directSavingPerYear = directSaving * projectsPerYear;

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
      reworkCostError,
      // Accuracy
      manualErrorPct,
      platformErrorPct,
      estimatedBudget,
      manualOvercost,
      platformOvercost,
      accuracySaving,
      accuracySavingPerYear,
      // Direct comparison
      hasDirectComparison,
      directSaving,
      directSavingPerYear,
      // Licenses
      manualLicenses,
      totalLicenseCost,
      // Totals
      totalSavingPerYear,
      totalSavingPerProject,
    };
  }, [trechos, quantityRows, budgetTotal, effectiveReviewErrors, effectiveReviewWarnings, projectsPerYear, engineerRate, teamSize, platformData.realCostTotal, orcamentoObra, custoManualEstimado, margemErroManual, custoRetrabalhoReal, horasManualProjeto]);

  // Scenario simulator — show savings for different company sizes
  const scenarios = useMemo(() => {
    const configs = [
      { label: "Pequena (2 eng, 3 proj/ano)", team: 2, projects: 3 },
      { label: "Media (5 eng, 8 proj/ano)", team: 5, projects: 8 },
      { label: "Grande (10 eng, 15 proj/ano)", team: 10, projects: 15 },
      { label: `Sua empresa (${teamSize} eng, ${projectsPerYear} proj/ano)`, team: teamSize, projects: projectsPerYear },
    ];
    return configs.map(c => {
      const timeSaving = economy.hoursSavedPerProject * c.projects * c.team * engineerRate;
      const reworkSaving = economy.reworkAvoided * c.projects;
      const accuracySaving = economy.accuracySaving * c.projects;
      const licenseSaving =
        BENCHMARKS.autocadLicenseYear * c.team +
        BENCHMARKS.excelAdvancedYear * c.team +
        BENCHMARKS.msProjectYear +
        BENCHMARKS.projectManagementToolYear;
      const total = timeSaving + reworkSaving + accuracySaving + licenseSaving;
      return { ...c, timeSaving, reworkSaving, accuracySaving, licenseSaving, total };
    });
  }, [economy, engineerRate, teamSize, projectsPerYear]);

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

  // Data source indicators
  const dataSources = useMemo(() => {
    const sources: { label: string; active: boolean; detail: string }[] = [
      { label: "Topografia", active: hasTrechos, detail: hasTrechos ? `${trechos.length} trechos / ${fmtNum(platformData.extensaoTotal)} m` : "Nao importada" },
      { label: "Quantitativos", active: hasQuantities, detail: hasQuantities ? `${quantityRows!.length} itens calculados` : "Nao calculados" },
      { label: "Orcamento", active: !!budgetTotal || platformData.realCostTotal > 0, detail: budgetTotal ? fmtBRL(budgetTotal) : platformData.realCostTotal > 0 ? fmtBRL(platformData.realCostTotal) : "Nao calculado" },
      { label: "Medicao", active: hasMedicao, detail: hasMedicao ? `${medicaoItems.length} itens / ${fmtBRL(platformData.medicaoSummary?.medicao_total ?? 0)}` : "Nao importada" },
      { label: "Revisao ABNT", active: effectiveReviewErrors > 0 || effectiveReviewWarnings > 0, detail: effectiveReviewErrors > 0 || effectiveReviewWarnings > 0 ? `${effectiveReviewErrors} erros, ${effectiveReviewWarnings} alertas` : "Nao executada" },
      { label: "Cronograma", active: !!scheduleResult, detail: scheduleResult ? `${scheduleResult.totalDays} dias` : "Nao gerado" },
    ];
    return sources;
  }, [hasTrechos, hasQuantities, budgetTotal, hasMedicao, effectiveReviewErrors, effectiveReviewWarnings, scheduleResult, trechos, quantityRows, platformData, medicaoItems]);

  const exportReport = () => {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      { "Indicador": "Projetos/ano", "Valor": projectsPerYear },
      { "Indicador": "Custo/hora engenheiro", "Valor": `R$ ${engineerRate}` },
      { "Indicador": "Tamanho da equipe", "Valor": teamSize },
      ...(orcamentoObra > 0 ? [{ "Indicador": "Orcamento da obra (informado)", "Valor": fmtBRL(orcamentoObra) }] : []),
      ...(custoManualEstimado > 0 ? [{ "Indicador": "Custo manual estimado (informado)", "Valor": fmtBRL(custoManualEstimado) }] : []),
      ...(economy.hasDirectComparison ? [{ "Indicador": "ECONOMIA DIRETA (manual vs plataforma)", "Valor": fmtBRL(economy.directSaving) }] : []),
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

    // Platform data sheet — real data from modules
    if (hasMedicao && platformData.medicaoSummary) {
      const ms = platformData.medicaoSummary;
      const platformSheet = [
        { "Metrica": "Total de Trechos", "Valor": ms.total_trechos },
        { "Metrica": "Extensao Total (m)", "Valor": ms.extensao_total.toFixed(2) },
        { "Metrica": "Medicao Total (R$)", "Valor": ms.medicao_total.toFixed(2) },
        { "Metrica": "Custo Total (R$)", "Valor": ms.custo_total.toFixed(2) },
        { "Metrica": "Margem Total (R$)", "Valor": ms.margem_total.toFixed(2) },
        { "Metrica": "Margem (%)", "Valor": ms.margem_pct.toFixed(1) },
        { "Metrica": "Prazo Total (dias)", "Valor": ms.prazo_total_dias },
        { "Metrica": "Itens de Medicao", "Valor": ms.itens_count },
        { "Metrica": "", "Valor": "" },
        { "Metrica": "Executado (m)", "Valor": platformData.totalExecutado.toFixed(2) },
        { "Metrica": "% Executado", "Valor": platformData.pctExecutado.toFixed(1) },
        { "Metrica": "Medicao Realizada (R$)", "Valor": platformData.medicaoRealizada.toFixed(2) },
        { "Metrica": "Custo Real (R$)", "Valor": platformData.custoReal.toFixed(2) },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(platformSheet), "Dados Reais Plataforma");
    }

    // Per-trecho medicao detail
    if (hasMedicao) {
      const trechoData = medicaoTrechos.map(m => ({
        "Trecho": m.trecho_id,
        "Inicio": m.inicio,
        "Fim": m.fim,
        "Comp (m)": m.comprimento.toFixed(2),
        "DN": m.dn,
        "Tipo Rede": m.tipo_rede,
        "Medicao (R$)": m.med_total.toFixed(2),
        "Custo (R$)": m.cus_total.toFixed(2),
        "Margem (R$)": m.margem.toFixed(2),
        "Margem (%)": m.margem_pct.toFixed(1),
        "Executado (m)": m.qtd_executada.toFixed(2),
        "% Exec.": m.pct_executado.toFixed(1),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trechoData), "Medicao por Trecho");
    }

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
          <CardDescription className="space-y-1">
            <p>
              Relatorio de economia gerado a partir dos dados reais da plataforma.
              Apresente ao gestor/diretor para comprovar o ROI da ferramenta.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Como funciona:</strong> Este modulo compara o custo real do seu fluxo de trabalho atual
              (planilhas, AutoCAD, MS Project, calculo manual) com o tempo e custo usando a plataforma HydroNetwork.
              Os calculos consideram: (1) <em>tempo economizado</em> em cada etapa do projeto,
              (2) <em>retrabalho evitado</em> por erros detectados automaticamente,
              (3) <em>precisao orcamentaria</em> com custos SINAPI vs. estimativa manual, e
              (4) <em>licencas de software eliminadas</em>. Ajuste os parametros abaixo para refletir a realidade
              da sua empresa e veja a economia projetada por projeto e por ano.
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data source indicators */}
          <div className="flex flex-wrap gap-2">
            {dataSources.map(src => (
              <Badge
                key={src.label}
                variant={src.active ? "default" : "outline"}
                className={`text-xs cursor-default ${src.active ? "bg-green-600 hover:bg-green-600" : "text-muted-foreground"}`}
                title={src.detail}
              >
                {src.active ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Database className="h-3 w-3 mr-1" />}
                {src.label}
              </Badge>
            ))}
          </div>

          {/* Company parameters */}
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

          {/* Auto-calculation status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-800 mb-1">Calculo automatico ativado</p>
            <p className="text-[11px] text-blue-700">
              Este modulo calcula a economia automaticamente a partir dos dados dos outros modulos
              (topografia, quantitativos, orcamento, medicao, revisao ABNT, cronograma).
              Quanto mais modulos voce preencher, mais preciso sera o calculo.
              Os campos abaixo permitem ajustar com dados reais da sua empresa para um resultado ainda mais fiel.
            </p>
          </div>

          {/* Real project inputs for accurate savings */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-1 flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Dados Reais do Seu Projeto
            </p>
            <p className="text-[11px] text-muted-foreground mb-3">
              Preencha com os valores reais da sua empresa para ver a economia exata.
              Deixe em branco para usar os benchmarks do setor (ABES/CBIC).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Orcamento da obra (R$)</Label>
                <Input
                  type="number"
                  value={orcamentoObra || ""}
                  onChange={e => setOrcamentoObra(Number(e.target.value) || 0)}
                  placeholder={budgetTotal ? fmtBRL(budgetTotal) : "Ex: 500000"}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {budgetTotal
                    ? `Detectado automaticamente: ${fmtBRL(budgetTotal)} (modulo Orcamento)`
                    : platformData.realCostTotal > 0
                      ? `Detectado automaticamente: ${fmtBRL(platformData.realCostTotal)} (modulo Custos)`
                      : "Preencha ou use o modulo Orcamento/Custos para capturar automaticamente"}
                </p>
              </div>
              <div>
                <Label className="text-xs">Custo atual do projeto (metodo manual) (R$)</Label>
                <Input
                  type="number"
                  value={custoManualEstimado || ""}
                  onChange={e => setCustoManualEstimado(Number(e.target.value) || 0)}
                  placeholder="Ex: 600000"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  O orcamento que voce faria usando planilhas Excel e calculo manual.
                  <br />
                  <strong>Dica:</strong> Use o ultimo orcamento que voce fez manualmente para uma obra similar.
                  Normalmente sera 15-25% maior que o valor calculado pela plataforma com SINAPI.
                </p>
              </div>
              <div>
                <Label className="text-xs">Margem de erro tipica no metodo manual (%)</Label>
                <Input
                  type="number"
                  value={margemErroManual}
                  onChange={e => setMargemErroManual(Math.max(0, Math.min(100, Number(e.target.value))))}
                  min={0}
                  max={100}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Diferenca media entre orcamento manual e custo real de obras anteriores.
                  Padrao: 20% (pesquisa ABES/CBIC).
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <Label className="text-xs">Horas manuais por projeto (h)</Label>
                <Input
                  type="number"
                  value={horasManualProjeto || ""}
                  onChange={e => setHorasManualProjeto(Number(e.target.value) || 0)}
                  placeholder={`Padrao: ${BENCHMARKS.manualBudgetDays * 8 + BENCHMARKS.manualDesignDays * 8 + BENCHMARKS.manualScheduleDays * 8 + BENCHMARKS.manualReviewDays * 8}h (benchmark)`}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Some as horas do ultimo projeto: orcamento + projeto + cronograma + revisao.
                  Padrao: {BENCHMARKS.manualBudgetDays + BENCHMARKS.manualDesignDays + BENCHMARKS.manualScheduleDays + BENCHMARKS.manualReviewDays} dias uteis ({(BENCHMARKS.manualBudgetDays + BENCHMARKS.manualDesignDays + BENCHMARKS.manualScheduleDays + BENCHMARKS.manualReviewDays) * 8}h).
                </p>
              </div>
              <div>
                <Label className="text-xs">Custo medio de retrabalho por erro (R$)</Label>
                <Input
                  type="number"
                  value={custoRetrabalhoReal}
                  onChange={e => setCustoRetrabalhoReal(Number(e.target.value) || 0)}
                  min={0}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Custo para corrigir cada erro encontrado em campo (retrabalho, material perdido, atraso).
                  Padrao: R$ 8.500 (media do setor de saneamento).
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Direct comparison card — shown when user provides manual estimate */}
      {economy.hasDirectComparison && (
        <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-600" /> Economia Direta: Orcamento Manual vs. Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-xs text-muted-foreground mb-1">Custo Manual Estimado</p>
                <p className="text-xl font-bold text-red-600">{fmtBRL(custoManualEstimado)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-xs text-muted-foreground mb-1">Custo c/ Plataforma</p>
                <p className="text-xl font-bold text-green-600">{fmtBRL(economy.estimatedBudget)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <p className="text-xs text-muted-foreground mb-1">Economia por Projeto</p>
                <p className="text-2xl font-bold text-emerald-600">{fmtBRL(economy.directSaving)}</p>
                <p className="text-xs text-emerald-700 font-medium">
                  {economy.estimatedBudget > 0 ? `${((economy.directSaving / custoManualEstimado) * 100).toFixed(1)}% de reducao` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 bg-emerald-500/10 rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Economia anual projetada ({projectsPerYear} projetos)</p>
              <p className="text-2xl font-bold text-emerald-700">{fmtBRL(economy.directSavingPerYear)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real Platform Data — only shown when medicao data exists */}
      {hasMedicao && platformData.medicaoSummary && (
        <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" /> Dados Reais da Plataforma
            </CardTitle>
            <CardDescription className="text-xs">
              Valores calculados a partir das planilhas de custo e medicao importadas no modulo Edicao por Trecho
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-blue-50 rounded p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Medicao Total</p>
                <p className="font-bold text-sm text-blue-700">{fmtBRL(platformData.medicaoSummary.medicao_total)}</p>
              </div>
              <div className="bg-orange-50 rounded p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Custo Total</p>
                <p className="font-bold text-sm text-orange-700">{fmtBRL(platformData.medicaoSummary.custo_total)}</p>
              </div>
              <div className={`rounded p-2 text-center ${platformData.margemReal >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                <p className="text-[10px] text-muted-foreground">Margem</p>
                <p className={`font-bold text-sm ${platformData.margemReal >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {fmtBRL(platformData.margemReal)} ({platformData.margemPctReal.toFixed(1)}%)
                </p>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Extensao</p>
                <p className="font-semibold text-sm">{fmtNum(platformData.extensaoTotal)} m</p>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Execucao</p>
                <p className="font-semibold text-sm">{platformData.pctExecutado.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards with explanations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-green-500/20" title="Soma de todas as economias: tempo, retrabalho, precisao e licencas">
          <CardContent className="pt-4 text-center">
            <TrendingDown className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-600">{fmtBRL(economy.totalSavingPerYear)}</div>
            <div className="text-xs text-muted-foreground">Economia Total / Ano</div>
            <div className="text-[10px] text-muted-foreground mt-1">{fmtBRL(economy.totalSavingPerProject)} por projeto</div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20" title="Horas de engenheiro poupadas usando a plataforma vs. metodo manual">
          <CardContent className="pt-4 text-center">
            <Clock className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-blue-600">{fmtNum(economy.daysSavedPerYear)} dias</div>
            <div className="text-xs text-muted-foreground">Tempo Economizado / Ano</div>
            <div className="text-[10px] text-muted-foreground mt-1">{fmtNum(economy.hoursSavedPerProject)}h por projeto</div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/20" title="Custo de retrabalho em campo evitado pela deteccao automatica de erros ABNT">
          <CardContent className="pt-4 text-center">
            <ShieldCheck className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-orange-600">{fmtBRL(economy.reworkAvoidedPerYear)}</div>
            <div className="text-xs text-muted-foreground">Retrabalho Evitado / Ano</div>
            <div className="text-[10px] text-muted-foreground mt-1">{economy.errorsDetected} erros + {economy.warningsDetected} alertas</div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20" title="Licencas de AutoCAD, Excel, MS Project e ferramentas de gestao que a plataforma substitui">
          <CardContent className="pt-4 text-center">
            <CreditCard className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-purple-600">{fmtBRL(economy.totalLicenseCost)}</div>
            <div className="text-xs text-muted-foreground">Licencas Eliminadas / Ano</div>
            <div className="text-[10px] text-muted-foreground mt-1">AutoCAD + MS Project + Excel + PM</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="simulador">
        <TabsList className="grid w-full max-w-6xl grid-cols-8">
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
          <TabsTrigger value="previsao">Previsao</TabsTrigger>
          <TabsTrigger value="resumo">Resumo Executivo</TabsTrigger>
          <TabsTrigger value="dados-reais">Dados Reais</TabsTrigger>
          <TabsTrigger value="tempo">Tempo</TabsTrigger>
          <TabsTrigger value="qualidade">Qualidade</TabsTrigger>
          <TabsTrigger value="licencas">Licencas</TabsTrigger>
          <TabsTrigger value="como-funciona">Como Funciona</TabsTrigger>
        </TabsList>

        {/* Simulador de Cenários */}
        <TabsContent value="simulador" className="space-y-4">
          {/* Per-project savings breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Calculator className="h-4 w-4" /> Detalhamento da Economia por Projeto
              </CardTitle>
              <CardDescription>Veja exatamente de onde vem cada real economizado</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fonte de Economia</TableHead>
                    <TableHead>Calculo</TableHead>
                    <TableHead>Por Projeto</TableHead>
                    <TableHead>Por Ano ({projectsPerYear} proj.)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-600" /> Tempo de engenharia</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtNum(economy.hoursSavedPerProject)}h poupadas x {teamSize} eng. x R$ {engineerRate}/h
                    </TableCell>
                    <TableCell className="font-semibold">{fmtBRL(economy.hoursSavedPerProject * teamSize * engineerRate)}</TableCell>
                    <TableCell className="font-bold text-blue-600">{fmtBRL(economy.timeSavingValue)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-orange-600" /> Retrabalho evitado</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {economy.errorsDetected} erros x R$ {fmtNum(economy.reworkCostError)} + {economy.warningsDetected} alertas x 35% x R$ 2.200
                    </TableCell>
                    <TableCell className="font-semibold">{fmtBRL(economy.reworkAvoided)}</TableCell>
                    <TableCell className="font-bold text-orange-600">{fmtBRL(economy.reworkAvoidedPerYear)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2"><Target className="h-4 w-4 text-green-600" /> Precisao orcamentaria</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      Orcamento {fmtBRL(economy.estimatedBudget)} x ({(economy.manualErrorPct * 100).toFixed(0)}% - {(economy.platformErrorPct * 100).toFixed(0)}%) erro
                    </TableCell>
                    <TableCell className="font-semibold">{fmtBRL(economy.accuracySaving)}</TableCell>
                    <TableCell className="font-bold text-green-600">{fmtBRL(economy.accuracySavingPerYear)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-purple-600" /> Licencas eliminadas</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      AutoCAD + MS Project + Excel + PM ({teamSize} licencas)
                    </TableCell>
                    <TableCell className="font-semibold">{fmtBRL(economy.totalLicenseCost / projectsPerYear)}</TableCell>
                    <TableCell className="font-bold text-purple-600">{fmtBRL(economy.totalLicenseCost)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-green-500/10 text-lg">
                    <TableCell className="font-bold" colSpan={2}>ECONOMIA TOTAL</TableCell>
                    <TableCell className="font-bold">{fmtBRL(economy.totalSavingPerProject)}</TableCell>
                    <TableCell className="font-bold text-green-700 text-xl">{fmtBRL(economy.totalSavingPerYear)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Scenario comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Simulador de Cenarios — Comparacao por Porte de Empresa
              </CardTitle>
              <CardDescription>Veja quanto cada tipo de empresa economizaria usando a plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cenario</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Retrabalho</TableHead>
                    <TableHead>Precisao</TableHead>
                    <TableHead>Licencas</TableHead>
                    <TableHead>Total / Ano</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scenarios.map((s, i) => (
                    <TableRow key={i} className={i === scenarios.length - 1 ? "bg-primary/10 font-bold" : ""}>
                      <TableCell className="font-medium text-xs">{s.label}</TableCell>
                      <TableCell className="text-xs">{fmtBRL(s.timeSaving)}</TableCell>
                      <TableCell className="text-xs">{fmtBRL(s.reworkSaving)}</TableCell>
                      <TableCell className="text-xs">{fmtBRL(s.accuracySaving)}</TableCell>
                      <TableCell className="text-xs">{fmtBRL(s.licenseSaving)}</TableCell>
                      <TableCell className="font-bold text-green-700">{fmtBRL(s.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={scenarios}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={9} angle={-10} textAnchor="end" height={60} />
                    <YAxis fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(v: number) => fmtBRL(v)} />
                    <Legend />
                    <Bar dataKey="timeSaving" stackId="a" fill="#2563eb" name="Tempo" />
                    <Bar dataKey="reworkSaving" stackId="a" fill="#ea580c" name="Retrabalho" />
                    <Bar dataKey="accuracySaving" stackId="a" fill="#16a34a" name="Precisao" />
                    <Bar dataKey="licenseSaving" stackId="a" fill="#7c3aed" name="Licencas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* ROI breakdown — what the company invests vs what it saves */}
          <Card className="border-green-500/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-600" /> Retorno sobre Investimento (ROI)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                  <p className="text-xs text-muted-foreground mb-1">Economia Mensal</p>
                  <p className="text-xl font-bold text-blue-700">{fmtBRL(economy.totalSavingPerYear / 12)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                  <p className="text-xs text-muted-foreground mb-1">Economia Anual</p>
                  <p className="text-xl font-bold text-green-700">{fmtBRL(economy.totalSavingPerYear)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
                  <p className="text-xs text-muted-foreground mb-1">Dias Liberados / Ano</p>
                  <p className="text-xl font-bold text-purple-700">{fmtNum(economy.daysSavedPerYear)}</p>
                  <p className="text-[10px] text-muted-foreground">= {fmtNum(economy.daysSavedPerYear / 22)} meses de trabalho</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-200">
                  <p className="text-xs text-muted-foreground mb-1">Projetos Extras Possiveis</p>
                  <p className="text-xl font-bold text-orange-700">
                    +{Math.floor(economy.daysSavedPerYear / (economy.manualHoursPerProject / 8))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">projetos/ano com o tempo liberado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Previsao de Economia */}
        <TabsContent value="previsao" className="space-y-4">
          <Card className="border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 to-blue-500/5">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-cyan-600" /> Previsao de Economia para Novos Projetos
              </CardTitle>
              <CardDescription>
                Insira os parametros do projeto que voce esta orcando ou planejando para estimar a economia antes de iniciar.
                O calculo usa os benchmarks SINAPI e dados reais de projetos anteriores na plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs">Extensao da rede (km)</Label>
                  <Input type="number" value={predExtensaoKm || ""} onChange={e => setPredExtensaoKm(Number(e.target.value) || 0)} placeholder="Ex: 3.5" min={0} step={0.1} />
                  <p className="text-[10px] text-muted-foreground mt-1">Comprimento total estimado da rede</p>
                </div>
                <div>
                  <Label className="text-xs">DN medio (mm)</Label>
                  <Input type="number" value={predDnMedio} onChange={e => setPredDnMedio(Number(e.target.value) || 200)} placeholder="200" />
                  <p className="text-[10px] text-muted-foreground mt-1">Diametro nominal medio dos tubos</p>
                </div>
                <div>
                  <Label className="text-xs">Profundidade media (m)</Label>
                  <Input type="number" value={predProfMedia} onChange={e => setPredProfMedia(Number(e.target.value) || 1.5)} placeholder="1.5" step={0.1} />
                  <p className="text-[10px] text-muted-foreground mt-1">Profundidade media de escavacao</p>
                </div>
                <div>
                  <Label className="text-xs">Tipo de projeto</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={predTipoProjeto}
                    onChange={e => setPredTipoProjeto(e.target.value as "esgoto" | "agua" | "drenagem")}
                  >
                    <option value="esgoto">Esgoto</option>
                    <option value="agua">Agua</option>
                    <option value="drenagem">Drenagem</option>
                  </select>
                </div>
              </div>

              {predExtensaoKm > 0 && (() => {
                // Prediction calculations based on SINAPI costs and project parameters
                const extensaoM = predExtensaoKm * 1000;
                const numTrechos = Math.ceil(extensaoM / 80); // ~80m per trecho average
                const numPVs = numTrechos + 1;

                // SINAPI-based cost estimation
                const dnM = predDnMedio / 1000;
                const lv = Math.max(0.6, dnM + 0.30);
                const volEscTotal = extensaoM * lv * predProfMedia;
                const volTubo = extensaoM * Math.PI * (dnM / 2) ** 2;
                const volBerco = extensaoM * lv * 0.10;
                const volEnv = extensaoM * lv * 0.30;
                const volReaterro = Math.max(0, volEscTotal - volTubo - volBerco - volEnv);
                const volBotafora = (volEscTotal - volReaterro) * 1.25;
                const areaPavimento = extensaoM * (lv + 0.60);

                // Unit costs (SINAPI reference)
                const custoEscUnit = predProfMedia <= 1.5 ? 52.47 : predProfMedia <= 3 ? 72.83 : 95.16;
                const custoTuboUnit = predDnMedio <= 150 ? 67.43 : predDnMedio <= 200 ? 89.74 : predDnMedio <= 300 ? 142.56 : 195.88;
                const custoReaterroUnit = 18.92;
                const custoPVUnit = predProfMedia <= 1.5 ? 1850 : predProfMedia <= 2.5 ? 2650 : 3800;
                const bdiPct = 25;

                const custoEscavacao = volEscTotal * custoEscUnit;
                const custoTubo = extensaoM * custoTuboUnit;
                const custoReaterro = volReaterro * custoReaterroUnit;
                const custoPV = numPVs * custoPVUnit;
                const subtotal = custoEscavacao + custoTubo + custoReaterro + custoPV;
                const totalComBDI = subtotal * (1 + bdiPct / 100);

                // Error estimation (manual vs platform)
                const custoManualEstimadoPred = totalComBDI * (1 + margemErroManual / 100);
                const economiaPrecisao = custoManualEstimadoPred - totalComBDI;

                // Rework prediction based on project size
                const errosEstimados = Math.max(1, Math.round(numTrechos * 0.08)); // ~8% of trechos will have issues
                const alertasEstimados = Math.max(2, Math.round(numTrechos * 0.15)); // ~15% warnings
                const retrabalhoEvitado = errosEstimados * custoRetrabalhoReal + Math.round(alertasEstimados * 0.35) * 2200;

                // Time saved
                const tempoEconomizado = economy.hoursSavedPerProject * engineerRate * teamSize;

                // Total projection
                const economiaTotalProjeto = tempoEconomizado + retrabalhoEvitado + economiaPrecisao + (economy.totalLicenseCost / projectsPerYear);

                return (
                  <div className="space-y-4 mt-4">
                    {/* Project estimation summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-200">
                        <p className="text-[10px] text-muted-foreground">Orcamento Estimado (SINAPI)</p>
                        <p className="text-lg font-bold text-cyan-700">{fmtBRL(totalComBDI)}</p>
                        <p className="text-[10px] text-muted-foreground">com BDI {bdiPct}%</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                        <p className="text-[10px] text-muted-foreground">Estimativa Manual (tipica)</p>
                        <p className="text-lg font-bold text-red-600">{fmtBRL(custoManualEstimadoPred)}</p>
                        <p className="text-[10px] text-muted-foreground">+{margemErroManual}% de margem</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                        <p className="text-[10px] text-muted-foreground">Economia na Precisao</p>
                        <p className="text-lg font-bold text-green-600">{fmtBRL(economiaPrecisao)}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
                        <p className="text-[10px] text-muted-foreground">Economia Total Projetada</p>
                        <p className="text-xl font-bold text-emerald-700">{fmtBRL(economiaTotalProjeto)}</p>
                      </div>
                    </div>

                    {/* Detail breakdown */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Detalhamento da Previsao</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Parametro</TableHead>
                              <TableHead>Quantidade</TableHead>
                              <TableHead>Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="text-xs">Extensao da rede</TableCell>
                              <TableCell className="text-xs">{fmtNum(extensaoM)} m ({predExtensaoKm} km)</TableCell>
                              <TableCell className="text-xs">—</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs">Trechos estimados (~80m cada)</TableCell>
                              <TableCell className="text-xs">{numTrechos} trechos</TableCell>
                              <TableCell className="text-xs">—</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs">Pocos de visita</TableCell>
                              <TableCell className="text-xs">{numPVs} PVs</TableCell>
                              <TableCell className="text-xs">{fmtBRL(custoPV)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs">Escavacao</TableCell>
                              <TableCell className="text-xs">{fmtNum(volEscTotal)} m3</TableCell>
                              <TableCell className="text-xs">{fmtBRL(custoEscavacao)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs">Tubulacao DN{predDnMedio}</TableCell>
                              <TableCell className="text-xs">{fmtNum(extensaoM)} m</TableCell>
                              <TableCell className="text-xs">{fmtBRL(custoTubo)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs">Reaterro</TableCell>
                              <TableCell className="text-xs">{fmtNum(volReaterro)} m3</TableCell>
                              <TableCell className="text-xs">{fmtBRL(custoReaterro)}</TableCell>
                            </TableRow>
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell>Subtotal (sem BDI)</TableCell>
                              <TableCell>—</TableCell>
                              <TableCell>{fmtBRL(subtotal)}</TableCell>
                            </TableRow>
                            <TableRow className="bg-cyan-50 font-bold">
                              <TableCell>Total com BDI ({bdiPct}%)</TableCell>
                              <TableCell>—</TableCell>
                              <TableCell className="text-cyan-700">{fmtBRL(totalComBDI)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    {/* Economy projection breakdown */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Projecao de Economia</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fonte de Economia</TableHead>
                              <TableHead>Base do Calculo</TableHead>
                              <TableHead>Valor Projetado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="text-xs font-medium">Tempo de engenharia</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {fmtNum(economy.hoursSavedPerProject)}h x {teamSize} eng. x R$ {engineerRate}/h
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-blue-600">{fmtBRL(tempoEconomizado)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs font-medium">Retrabalho evitado</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                ~{errosEstimados} erros + ~{alertasEstimados} alertas previstos para {numTrechos} trechos
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-orange-600">{fmtBRL(retrabalhoEvitado)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs font-medium">Precisao orcamentaria</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {fmtBRL(totalComBDI)} x ({margemErroManual}% - 5%) = diferenca manual vs plataforma
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-green-600">{fmtBRL(economiaPrecisao)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs font-medium">Licencas (proporcional)</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {fmtBRL(economy.totalLicenseCost)} / {projectsPerYear} projetos
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-purple-600">{fmtBRL(economy.totalLicenseCost / projectsPerYear)}</TableCell>
                            </TableRow>
                            <TableRow className="bg-emerald-50 font-bold text-lg">
                              <TableCell colSpan={2}>ECONOMIA PROJETADA NESTE PROJETO</TableCell>
                              <TableCell className="text-emerald-700">{fmtBRL(economiaTotalProjeto)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>

                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
                            <p className="text-[10px] text-muted-foreground">Economia como % do orcamento</p>
                            <p className="text-xl font-bold text-emerald-700">
                              {totalComBDI > 0 ? ((economiaTotalProjeto / totalComBDI) * 100).toFixed(1) : 0}%
                            </p>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                            <p className="text-[10px] text-muted-foreground">Economia anual ({projectsPerYear} proj.)</p>
                            <p className="text-xl font-bold text-blue-700">{fmtBRL(economiaTotalProjeto * projectsPerYear)}</p>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-200">
                            <p className="text-[10px] text-muted-foreground">Dias liberados</p>
                            <p className="text-xl font-bold text-purple-700">{fmtNum(economy.daysSavedPerProject)}</p>
                            <p className="text-[10px] text-muted-foreground">por projeto</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              {predExtensaoKm === 0 && (
                <div className="bg-muted/50 rounded-lg p-6 text-center">
                  <Calculator className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground mb-1">Insira a extensao da rede acima para ver a previsao</p>
                  <p className="text-xs text-muted-foreground">
                    O calculo estima custos SINAPI, numero de trechos, pocos de visita, volumes de escavacao/reaterro,
                    e projeta a economia com base nos parametros da sua empresa.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Como Funciona */}
        <TabsContent value="como-funciona" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" /> O que e o modulo Economia Comprovada?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                O modulo <strong>Economia Comprovada</strong> e um relatorio de ROI (Retorno sobre Investimento)
                que demonstra, com numeros reais, quanto dinheiro e tempo a sua empresa economiza ao usar a
                plataforma HydroNetwork em vez do fluxo de trabalho tradicional.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 flex items-center gap-1 mb-2">
                    <Clock className="h-4 w-4" /> 1. Tempo Economizado
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Compara o tempo gasto em cada etapa do projeto (orcamento, dimensionamento, cronograma, revisao)
                    no metodo manual vs. na plataforma. Exemplo: um orcamento manual leva ~5 dias; na plataforma, ~15 minutos.
                    Multiplica pelo custo/hora do engenheiro, numero de projetos e tamanho da equipe.
                  </p>
                </div>

                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="font-semibold text-orange-800 flex items-center gap-1 mb-2">
                    <ShieldCheck className="h-4 w-4" /> 2. Retrabalho Evitado
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    A Revisao por Pares automatica detecta erros ABNT que, se nao corrigidos, causam retrabalho em campo.
                    Cada erro critico custa em media R$ 8.500 em retrabalho. Cada alerta tem 35% de chance de gerar
                    retrabalho de R$ 2.200. Quanto mais erros a plataforma encontra, maior a economia.
                  </p>
                </div>

                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 flex items-center gap-1 mb-2">
                    <Target className="h-4 w-4" /> 3. Precisao Orcamentaria
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Orcamentos manuais tem margem de erro de ~20% (estimativa alta ou baixa). A plataforma, usando
                    custos SINAPI automaticos, reduz para ~5%. Essa diferenca, aplicada ao valor do orcamento,
                    representa economia real — menos sobre-custo ou sub-orcamento.
                  </p>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-purple-800 flex items-center gap-1 mb-2">
                    <CreditCard className="h-4 w-4" /> 4. Licencas Eliminadas
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    A plataforma substitui ferramentas como AutoCAD (~R$ 9.800/ano), MS Project (~R$ 5.400/ano),
                    Excel avancado e ferramentas de gestao de projetos. O custo acumulado dessas licencas para
                    toda a equipe e eliminado.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-2">Como personalizar:</h4>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  <li><strong>Projetos por ano:</strong> Quantos projetos de saneamento sua equipe executa por ano</li>
                  <li><strong>Custo/hora engenheiro:</strong> Valor medio do hora-homem de um engenheiro na sua empresa</li>
                  <li><strong>Tamanho da equipe:</strong> Quantos profissionais usam a plataforma na sua empresa</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Os dados reais (topografia, quantitativos, medicao, revisao ABNT) sao carregados automaticamente
                  dos outros modulos. Quanto mais modulos voce usar, mais preciso sera o relatorio.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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

        {/* Dados Reais da Plataforma */}
        <TabsContent value="dados-reais" className="space-y-4">
          {!hasMedicao && !hasQuantities && !hasTrechos ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Database className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-2">
                  Nenhum dado real da plataforma disponivel ainda.
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Importe topografia, calcule quantitativos e importe planilhas de custo/medicao nos modulos correspondentes para que os dados reais aparecam aqui.
                </p>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 max-w-lg mx-auto text-left space-y-1">
                  <p className="font-medium">Passos para alimentar os dados reais:</p>
                  <p>1. <strong>Topografia:</strong> Importe seus pontos topograficos no modulo principal</p>
                  <p>2. <strong>Quantitativos:</strong> Calcule no modulo Quantitativos (escavacao, reaterro, etc.)</p>
                  <p>3. <strong>Custos:</strong> Use a tabela de custos SINAPI ou importe planilha propria em Edicao por Trecho</p>
                  <p>4. <strong>Medicao:</strong> Importe planilha de medicao e configure itens em Edicao por Trecho</p>
                  <p>5. <strong>Revisao ABNT:</strong> Execute a Revisao por Pares para detectar erros automaticamente</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Data sources status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4" /> Fontes de Dados Ativas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Modulo</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Dados</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dataSources.map(src => (
                        <TableRow key={src.label}>
                          <TableCell className="text-xs font-medium">{src.label}</TableCell>
                          <TableCell>
                            <Badge variant={src.active ? "default" : "outline"} className={`text-[10px] ${src.active ? "bg-green-600" : ""}`}>
                              {src.active ? "Ativo" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{src.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Real quantities cost breakdown */}
              {hasQuantities && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calculator className="h-4 w-4" /> Custo Real por Trecho (SINAPI)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto" style={{ maxHeight: 400 }}>
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="text-xs">ID</TableHead>
                            <TableHead className="text-xs">Trecho</TableHead>
                            <TableHead className="text-xs">Comp (m)</TableHead>
                            <TableHead className="text-xs">DN</TableHead>
                            <TableHead className="text-xs">Custo Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quantityRows!.slice(0, 50).map(r => (
                            <TableRow key={r.id}>
                              <TableCell className="text-xs font-mono">{r.id}</TableCell>
                              <TableCell className="text-xs max-w-[180px] truncate" title={r.trecho}>{r.trecho}</TableCell>
                              <TableCell className="text-xs">{r.comp.toFixed(2)}</TableCell>
                              <TableCell className="text-xs">{r.dn}</TableCell>
                              <TableCell className="text-xs font-medium">{fmtBRL(r.custoTotal)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-3 bg-primary/10 rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Custo Total Calculado (SINAPI)</p>
                      <p className="font-bold text-lg text-primary">{fmtBRL(platformData.realCostTotal)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Real medicao breakdown */}
              {hasMedicao && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Medicao Real por Trecho
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto" style={{ maxHeight: 400 }}>
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="text-xs">Trecho</TableHead>
                            <TableHead className="text-xs">Tipo</TableHead>
                            <TableHead className="text-xs">Medicao (R$)</TableHead>
                            <TableHead className="text-xs">Custo (R$)</TableHead>
                            <TableHead className="text-xs">Margem (R$)</TableHead>
                            <TableHead className="text-xs">Margem (%)</TableHead>
                            <TableHead className="text-xs">% Exec.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {medicaoTrechos.slice(0, 50).map(m => (
                            <TableRow key={m.trecho_id} className={m.margem < 0 ? "bg-red-50/50" : ""}>
                              <TableCell className="text-xs font-mono">{m.trecho_id}</TableCell>
                              <TableCell className="text-xs">{m.tipo_rede}</TableCell>
                              <TableCell className="text-xs text-blue-700">{fmtBRL(m.med_total)}</TableCell>
                              <TableCell className="text-xs text-orange-700">{fmtBRL(m.cus_total)}</TableCell>
                              <TableCell className={`text-xs font-bold ${m.margem >= 0 ? "text-green-700" : "text-red-700"}`}>
                                {fmtBRL(m.margem)}
                              </TableCell>
                              <TableCell className={`text-xs ${m.margem_pct >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {m.margem_pct.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-xs">{m.pct_executado.toFixed(0)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
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
                {(budgetTotal || platformData.realCostTotal > 0) ? (
                  <div className="bg-green-500/5 p-3 rounded-lg border border-green-500/20">
                    <div className="text-sm font-medium">Sobre-custo evitado neste projeto:</div>
                    <div className="text-lg font-bold text-green-600">{fmtBRL(economy.accuracySaving)}</div>
                    <div className="text-xs text-muted-foreground">
                      Base: orcamento de {fmtBRL(economy.estimatedBudget)}
                      {!budgetTotal && platformData.realCostTotal > 0 && (
                        <Badge variant="outline" className="ml-2 text-[9px]">Custo real da plataforma</Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">
                    Calcule o orcamento no modulo de Orcamento ou importe planilhas de custo para dados reais.
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
