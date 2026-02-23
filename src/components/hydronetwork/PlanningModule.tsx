import { useState, useMemo, useCallback } from "react";
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
  Calendar, Users, Zap, ClipboardList, AlertTriangle, Download,
  BarChart3, TrendingUp, Plus, Trash2, FileText
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine,
  Line, ComposedChart
} from "recharts";
import { PontoTopografico } from "@/engine/reader";
import { supabase } from "@/lib/supabase";
import { Trecho, NetworkSummary } from "@/engine/domain";
import {
  generateFullSchedule, TeamConfig, DEFAULT_TEAM_CONFIG,
  ScheduleResult, DailySegment, generateCurveSData, generateHistogramData
} from "@/engine/planning";
import { exportToExcel as exportPlanningExcel } from "@/components/planning/planningExport";

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

      const { data: activeConstraints } = await supabase
        .from('lps_constraints')
        .select('id, tipo_restricao, descricao')
        .eq('project_id', projects[0].id)
        .in('status', ['ativa', 'critica']);

      if (activeConstraints && activeConstraints.length > 0) {
        toast.warning(
          `${activeConstraints.length} restricao(oes) ativa(s) podem impactar o planejamento. Verifique em Restricoes Lean.`,
          { duration: 6000 }
        );
      }
    } catch {
      // Silently ignore constraint check errors
    }
  }, []);

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

  // ── Gantt data ──
  const ganttData = useMemo(() => {
    if (!scheduleResult) return [];
    const { allSegments, totalDays } = scheduleResult;
    
    // Group by trecho
    const trechoMap = new Map<string, DailySegment[]>();
    allSegments.forEach(seg => {
      if (!trechoMap.has(seg.trechoId)) trechoMap.set(seg.trechoId, []);
      trechoMap.get(seg.trechoId)!.push(seg);
    });

    return Array.from(trechoMap.entries()).map(([trechoId, segs], idx) => {
      const totalMeters = segs.reduce((s, seg) => s + seg.meters, 0);
      const days: Record<number, { meters: number; isTest: boolean }> = {};
      segs.forEach(seg => { days[seg.day] = { meters: seg.meters, isTest: false }; });
      // Add test day after last execution day
      const lastDay = Math.max(...segs.map(s => s.day));
      if (lastDay + 1 <= totalDays) days[lastDay + 1] = { meters: 0, isTest: true };
      
      return { id: `T${String(idx + 1).padStart(2, "0")}`, meters: Math.round(totalMeters), days, totalDays };
    });
  }, [scheduleResult]);

  // ── Histogram stats ──
  const histStats = useMemo(() => {
    if (!scheduleResult) return { peakLabor: 0, avgDaily: 0, totalHH: 0, equipDays: 0 };
    const hist = scheduleResult.histogram;
    const peakLabor = Math.max(...hist.map(h => h.labor));
    const avgDaily = hist.length > 0 ? hist.reduce((s, h) => s + h.labor, 0) / hist.length : 0;
    const totalHH = hist.reduce((s, h) => s + h.labor * horasTrabalho, 0);
    const equipDays = hist.reduce((s, h) => s + h.equipment, 0);
    return { peakLabor, avgDaily: parseFloat(avgDaily.toFixed(1)), totalHH, equipDays };
  }, [scheduleResult, horasTrabalho]);

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
            <div className="border-2 border-primary/20 rounded-lg p-4 bg-primary/5">
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
                <p className="font-semibold text-sm text-yellow-700 dark:text-yellow-400">💡 Dica: Dias Mais Corridos</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productivity.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{p.servico}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button size="sm" variant="outline" onClick={() => {
              if (!newServico) return;
              setProductivity([...productivity, { servico: newServico, unidade: newUnidade, produtividade: newProd, fonte: newFonte }]);
              setNewServico("");
            }}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Serviço
            </Button>
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
                📅 Cronograma de Execução
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
                  <div key={i} className="bg-muted/50 rounded-lg p-3 text-center">
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
                        <td className="border px-2 py-1 font-semibold bg-muted/50 sticky left-0 z-10">{row.id}</td>
                        <td className="border px-2 py-1 text-right bg-muted/50 sticky left-[60px] z-10">{row.meters}m</td>
                        {Array.from({ length: scheduleResult.totalDays }, (_, d) => {
                          const dayNum = d + 1;
                          const dayData = row.days[dayNum];
                          if (!dayData) return <td key={d} className="border px-0 py-0" />;
                          if (dayData.isTest) return (
                            <td key={d} className="border px-0 py-0 bg-yellow-300 dark:bg-yellow-700 text-center font-bold text-yellow-800 dark:text-yellow-200">T</td>
                          );
                          return (
                            <td key={d} className="border px-0 py-0 bg-primary/80 text-primary-foreground text-center text-[10px] font-medium">
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
            <CardHeader><CardTitle className="text-base">📊 Curva ABC (Pareto)</CardTitle></CardHeader>
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
              <CardHeader><CardTitle className="text-base">📈 Curva S</CardTitle></CardHeader>
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
                <CardTitle className="text-base">📊 Histograma de Recursos</CardTitle>
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
                    <div key={i} className="bg-muted/50 rounded-lg p-3 text-center">
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
            <CardHeader><CardTitle className="flex items-center gap-2 text-base">📋 Plano Diário Detalhado</CardTitle></CardHeader>
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

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap justify-center">
        <Button size="lg" className="bg-primary" onClick={handleGenerateSchedule} disabled={trechos.length === 0}>
          <Calendar className="h-4 w-4 mr-2" /> Gerar Planejamento
        </Button>
        <Button size="lg" variant="secondary" onClick={() => {
          if (!scheduleResult) { toast.error("Gere o planejamento primeiro."); return; }
          toast.info("Exportação em desenvolvimento.");
        }}>
          <Download className="h-4 w-4 mr-2" /> Exportar Planejamento
        </Button>
        <Button size="lg" variant="outline" onClick={async () => {
          try {
            const res = await fetch("/demo/pontos_criadores.txt");
            const text = await res.text();
            toast.success("Demo disponível - carregue os dados na aba Topografia primeiro.");
          } catch { toast.error("Erro ao carregar demo."); }
        }}>
          <BarChart3 className="h-4 w-4 mr-2" /> Carregar Demo
        </Button>
      </div>
    </div>
  );
}
