import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Upload, Download, Calculator, MapPin, Droplets, Calendar, Plus, Trash2,
  AlertTriangle, FileText, Users, Settings2, Info, X
} from "lucide-react";
import { useParams } from "react-router-dom";
import { parseTopographyFile, parseTopographyCSV, validateTopographySequence, PontoTopografico } from "@/engine/reader";
import { parseDxfFile, parseDxfToPoints } from "@/engine/dxfReader";
import { createTrechosFromTopography, summarizeNetwork, Trecho, NetworkSummary, DEFAULT_DIAMETRO_MM, DEFAULT_MATERIAL } from "@/engine/domain";
import { parseCostBaseFile, applyBudget, createBudgetSummary, exportBudgetExcel, BudgetRow, BudgetSummary, CostBase } from "@/engine/budget";
import { criarParametrosExecucao, ParametrosExecucao, TipoSolo, TipoEscavacao, TipoPavimento, TipoMaterial } from "@/engine/construction";
import { generateFullSchedule, TeamConfig, DEFAULT_TEAM_CONFIG, ScheduleResult } from "@/engine/planning";
import { RDO, loadRDOs, deleteRDO } from "@/engine/rdo";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { TopographyMap } from "@/components/hydronetwork/TopographyMap";
import { RDOHydroModule } from "@/components/hydronetwork/RDOHydroModule";
import { PlanningModule } from "@/components/hydronetwork/PlanningModule";
import { downloadDXF } from "@/lib/dxfExporter";
import { SewerModule } from "@/components/hydronetwork/modules/SewerModule";
import { WaterModule } from "@/components/hydronetwork/modules/WaterModule";
import { DrainageModule } from "@/components/hydronetwork/modules/DrainageModule";
import { QuantitiesModule } from "@/components/hydronetwork/modules/QuantitiesModule";
import { EpanetModule } from "@/components/hydronetwork/modules/EpanetModule";
import { SwmmModule } from "@/components/hydronetwork/modules/SwmmModule";
import { OpenProjectModule } from "@/components/hydronetwork/modules/OpenProjectModule";
import { ProjectLibreModule } from "@/components/hydronetwork/modules/ProjectLibreModule";
import { QgisModule } from "@/components/hydronetwork/modules/QgisModule";
import { PeerReviewModule } from "@/components/hydronetwork/modules/PeerReviewModule";
import { BudgetCostModule } from "@/components/hydronetwork/modules/BudgetCostModule";
// Shared state context - in a real app, use React Context or Zustand
const useHydroState = () => {
  const [pontos, setPontos] = useState<PontoTopografico[]>([]);
  const [trechos, setTrechos] = useState<Trecho[]>([]);
  const [networkSummary, setNetworkSummary] = useState<NetworkSummary | null>(null);
  const [costBase, setCostBase] = useState<CostBase | null>(null);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [diametroMm, setDiametroMm] = useState(DEFAULT_DIAMETRO_MM);
  const [material, setMaterial] = useState(DEFAULT_MATERIAL);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [rdos, setRdos] = useState<RDO[]>(loadRDOs());

  return {
    pontos, setPontos, trechos, setTrechos, networkSummary, setNetworkSummary,
    costBase, setCostBase, budgetRows, setBudgetRows, budgetSummary, setBudgetSummary,
    diametroMm, setDiametroMm, material, setMaterial, scheduleResult, setScheduleResult,
    rdos, setRdos,
  };
};

const HydroNetwork = () => {
  const { module } = useParams<{ module?: string }>();
  const activeModule = module || "topografia";

  const state = useHydroState();
  const {
    pontos, setPontos, trechos, setTrechos, networkSummary, setNetworkSummary,
    costBase, setCostBase, budgetRows, setBudgetRows, budgetSummary, setBudgetSummary,
    diametroMm, setDiametroMm, material, setMaterial, scheduleResult, setScheduleResult,
    rdos, setRdos,
  } = state;

  const [pasteData, setPasteData] = useState("");
  const [tipoSolo, setTipoSolo] = useState<TipoSolo>("normal");
  const [tipoEscavacao, setTipoEscavacao] = useState<TipoEscavacao>("mecanizada");
  const [tipoPavimento, setTipoPavimento] = useState<TipoPavimento>("asfalto");
  const [tipoMaterial, setTipoMaterial] = useState<TipoMaterial>("PVC");
  const [profundidade, setProfundidade] = useState(1.5);
  const [numEquipes, setNumEquipes] = useState(2);
  const [teamConfig, setTeamConfig] = useState<TeamConfig>(DEFAULT_TEAM_CONFIG);
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split("T")[0]);

  const processPoints = useCallback((pts: PontoTopografico[]) => {
    validateTopographySequence(pts);
    setPontos(pts);
    const segs = createTrechosFromTopography(pts, diametroMm, material);
    setTrechos(segs);
    setNetworkSummary(summarizeNetwork(segs));
    setBudgetRows([]); setBudgetSummary(null);
    toast.success(`${pts.length} pontos carregados, ${segs.length} trechos criados.`);
  }, [diametroMm, material]);

  const handleTopographyUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "dxf") {
        const pts = await parseDxfFile(file);
        processPoints(pts);
      } else if (ext === "txt" || ext === "csv") {
        const text = await file.text();
        const pts = parseTopographyCSV(text);
        processPoints(pts);
      } else {
        const pts = await parseTopographyFile(file);
        processPoints(pts);
      }
    } catch (err: any) { toast.error(err.message || "Erro ao processar arquivo."); }
  }, [processPoints]);

  const handleClearTopography = useCallback(() => {
    setPontos([]);
    setTrechos([]);
    setNetworkSummary(null);
    setBudgetRows([]);
    setBudgetSummary(null);
    setScheduleResult(null);
    toast.success("Dados de topografia limpos.");
  }, []);

  const handlePasteData = useCallback(() => {
    if (!pasteData.trim()) { toast.error("Cole dados primeiro."); return; }
    try {
      const pts = parseTopographyCSV(pasteData);
      processPoints(pts);
    } catch (err: any) { toast.error(err.message); }
  }, [pasteData, processPoints]);

  const handleCostBaseUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const cb = await parseCostBaseFile(file);
      setCostBase(cb);
      toast.success(`Base de custos carregada (${cb.size} entradas).`);
    } catch (err: any) { toast.error(err.message); }
  }, []);

  const handleCalculateBudget = useCallback(() => {
    if (trechos.length === 0) { toast.error("Carregue a topografia primeiro."); return; }
    if (!costBase) { toast.error("Carregue a base de custos primeiro."); return; }
    const rows = applyBudget(trechos, costBase, false);
    setBudgetRows(rows); setBudgetSummary(createBudgetSummary(rows));
    toast.success("Orçamento calculado!");
  }, [trechos, costBase]);

  const handleGenerateSchedule = useCallback(() => {
    if (trechos.length === 0) { toast.error("Carregue topografia primeiro."); return; }
    const result = generateFullSchedule(trechos, numEquipes, teamConfig, new Date(dataInicio));
    setScheduleResult(result);
    toast.success(`Cronograma gerado: ${result.totalDays} dias.`);
  }, [trechos, numEquipes, teamConfig, dataInicio]);

  const fmt = (n: number, d = 2) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtCurrency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  

  const renderModule = () => {
    switch (activeModule) {
      case "topografia":
        return <TopografiaModule />;
      case "esgoto":
        return <SewerModule pontos={pontos} trechos={trechos} onTrechosChange={setTrechos} />;
      case "agua":
        return <WaterModule pontos={pontos} />;
      case "drenagem":
        return <DrainageModule pontos={pontos} />;
      case "quantitativos":
        return <QuantitiesModule trechos={trechos} pontos={pontos} />;
      case "orcamento":
        return <OrcamentoModule />;
      case "planejamento":
        return <PlanningModule pontos={pontos} trechos={trechos} networkSummary={networkSummary} scheduleResult={scheduleResult} setScheduleResult={setScheduleResult} />;
      case "epanet":
        return <EpanetModule pontos={pontos} trechos={trechos} />;
      case "swmm":
        return <SwmmModule pontos={pontos} trechos={trechos} />;
      case "openproject":
        return <OpenProjectModule pontos={pontos} trechos={trechos} />;
      case "projectlibre":
        return <ProjectLibreModule pontos={pontos} trechos={trechos} />;
      case "qgis":
        return <QgisModule pontos={pontos} trechos={trechos} />;
      case "revisao":
        return <PeerReviewModule pontos={pontos} trechos={trechos} />;
      case "rdo":
        return <RDOHydroModule pontos={pontos} trechos={trechos} rdos={rdos} setRdos={setRdos} />;
      case "perfil":
        return <PerfilLongitudinalModule />;
      case "mapa":
        return <MapaInterativoModule />;
      case "exportacao":
        return <ExportacaoGISModule />;
      default:
        return <TopografiaModule />;
    }
  };

  // ── TOPOGRAFIA MODULE ──
  const [summaryFilter, setSummaryFilter] = useState<string>("todos");

  function TopografiaModule() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Carregar Topografia</CardTitle>
              <CardDescription>CSV, TXT, XLSX, XLS, DXF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pontos.length > 0 ? (
                <div className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-600">{pontos.length} pontos</Badge>
                      <Badge variant="secondary">{trechos.length} trechos</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClearTopography}>
                      <X className="h-4 w-4 mr-1" /> Limpar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Dados processados. Clique em "Limpar" para substituir.</p>
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">Arraste ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mb-1">Aceita: CSV, TXT, XLSX, XLS, <strong>DXF</strong></p>
                  <p className="text-xs text-muted-foreground mb-3">TXT com X,Y,Z (sem cabeçalho) ou DXF com entidades POINT/LINE</p>
                  <Input type="file" accept=".csv,.txt,.xlsx,.xls,.dxf" onChange={handleTopographyUpload} className="mt-2" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Colar dados manualmente</Label>
                <Textarea placeholder={"358129.1978,7353581.4981,-0.8630\n358132.1686,7353618.8114,-0.7250\n\nou com cabeçalho:\nid;x;y;cota"} value={pasteData} onChange={e => setPasteData(e.target.value)} rows={4} />
                <Button variant="outline" size="sm" onClick={handlePasteData} className="w-full">Processar Dados Colados</Button>
                <Button variant="secondary" size="sm" onClick={async () => {
                  try {
                    const res = await fetch("/demo/pontos_criadores.txt");
                    const text = await res.text();
                    const pts = parseTopographyCSV(text);
                    processPoints(pts);
                    toast.success("Demo carregado: pontos_criadores.txt");
                  } catch (err: any) { toast.error(err.message); }
                }} className="w-full">🎯 Carregar Demo (pontos_criadores.txt)</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Diâmetro (mm)</Label>
                  <Select value={String(diametroMm)} onValueChange={v => setDiametroMm(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[100, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200].map(d => <SelectItem key={d} value={String(d)}>DN{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Material</Label>
                  <Select value={material} onValueChange={setMaterial}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["PVC", "PEAD", "Concreto", "Ferro Fundido"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de Rede</Label>
                  <Select defaultValue="esgoto">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="esgoto">Esgoto (Gravidade)</SelectItem>
                      <SelectItem value="agua">Água (Pressurizado)</SelectItem>
                      <SelectItem value="drenagem">Drenagem Pluvial</SelectItem>
                      <SelectItem value="recalque">Recalque/Elevatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Solo</Label>
                  <Select value={tipoSolo} onValueChange={v => setTipoSolo(v as TipoSolo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">1ª Categoria</SelectItem>
                      <SelectItem value="rochoso">2ª Categoria</SelectItem>
                      <SelectItem value="arenoso">3ª Categoria (Rocha)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          {networkSummary && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Resumo da Rede</CardTitle>
                  <Select value={summaryFilter} onValueChange={setSummaryFilter}>
                    <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Tipos</SelectItem>
                      <SelectItem value="esgoto">Rede de Esgoto</SelectItem>
                      <SelectItem value="agua">Rede de Água</SelectItem>
                      <SelectItem value="drenagem">Drenagem Pluvial</SelectItem>
                      <SelectItem value="elevatoria">Elevatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filteredTrechos = summaryFilter === "todos" ? trechos :
                    summaryFilter === "esgoto" ? trechos.filter(t => t.tipoRede === "Esgoto por Gravidade") :
                    summaryFilter === "elevatoria" ? trechos.filter(t => t.tipoRede !== "Esgoto por Gravidade") :
                    trechos; // agua/drenagem use all for now (type is determined by module)
                  const summary = summarizeNetwork(filteredTrechos);
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Pontos", value: pontos.length, color: "text-blue-600", desc: "Total de pontos topográficos carregados" },
                        { label: "Trechos", value: summary.totalTrechos, color: "text-green-600", desc: "Segmentos de tubulação entre pontos" },
                        { label: "Comprimento", value: `${fmt(summary.comprimentoTotal, 1)}m`, color: "text-orange-600", desc: "Extensão total da rede" },
                        { label: "Gravidade", value: summary.trechosGravidade, color: "text-green-600", desc: "Trechos com escoamento por gravidade (decliv. positiva)" },
                        { label: "Elevatória", value: summary.trechosElevatoria, color: "text-orange-600", desc: "Trechos que necessitam bombeamento (decliv. negativa)" },
                        { label: "Decliv. Média", value: `${(summary.declividadeMedia * 100).toFixed(2)}%`, color: "text-purple-600", desc: "Declividade média ponderada da rede" },
                      ].map((item, i) => (
                        <TooltipProvider key={i}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="bg-muted/50 rounded-lg p-3 text-center cursor-help">
                                <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                  {item.label} <Info className="h-3 w-3" />
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent><p className="max-w-[200px] text-xs">{item.desc}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
        <TopographyMap pontos={pontos} trechos={trechos} onTrechosChange={setTrechos} onClearAll={handleClearTopography} />
        {pontos.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Pontos ({pontos.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>X</TableHead><TableHead>Y</TableHead><TableHead>Cota (m)</TableHead></TableRow></TableHeader>
                  <TableBody>{pontos.map(p => (<TableRow key={p.id}><TableCell className="font-medium">{p.id}</TableCell><TableCell>{fmt(p.x, 3)}</TableCell><TableCell>{fmt(p.y, 3)}</TableCell><TableCell>{fmt(p.cota, 3)}</TableCell></TableRow>))}</TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
        {trechos.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Trechos ({trechos.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <TooltipProvider><Tooltip><TooltipTrigger className="flex items-center gap-1">Início <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>ID do ponto de montante (origem)</TooltipContent></Tooltip></TooltipProvider>
                      </TableHead>
                      <TableHead>
                        <TooltipProvider><Tooltip><TooltipTrigger className="flex items-center gap-1">Fim <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>ID do ponto de jusante (destino)</TooltipContent></Tooltip></TooltipProvider>
                      </TableHead>
                      <TableHead>
                        <TooltipProvider><Tooltip><TooltipTrigger className="flex items-center gap-1">Comp. <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>Comprimento horizontal do trecho em metros</TooltipContent></Tooltip></TooltipProvider>
                      </TableHead>
                      <TableHead>
                        <TooltipProvider><Tooltip><TooltipTrigger className="flex items-center gap-1">Decliv. <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>Declividade = (Cota início - Cota fim) / Comprimento. Positiva = gravidade, Negativa = recalque</TooltipContent></Tooltip></TooltipProvider>
                      </TableHead>
                      <TableHead>
                        <TooltipProvider><Tooltip><TooltipTrigger className="flex items-center gap-1">Tipo <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>Classificação: Gravidade (declividade ≥ 0) ou Elevatória (declividade negativa)</TooltipContent></Tooltip></TooltipProvider>
                      </TableHead>
                      <TableHead>
                        <TooltipProvider><Tooltip><TooltipTrigger className="flex items-center gap-1">Ø <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>Diâmetro nominal da tubulação em milímetros</TooltipContent></Tooltip></TooltipProvider>
                      </TableHead>
                      <TableHead>
                        <TooltipProvider><Tooltip><TooltipTrigger className="flex items-center gap-1">Desnível <Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>Diferença de cota entre início e fim (metros)</TooltipContent></Tooltip></TooltipProvider>
                      </TableHead>
                      <TableHead>Material</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{trechos.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <TooltipProvider><Tooltip><TooltipTrigger className="font-medium cursor-help">{t.idInicio}</TooltipTrigger>
                        <TooltipContent><p className="text-xs">X: {t.xInicio.toFixed(3)}<br/>Y: {t.yInicio.toFixed(3)}<br/>Cota: {t.cotaInicio.toFixed(3)}m</p></TooltipContent></Tooltip></TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider><Tooltip><TooltipTrigger className="font-medium cursor-help">{t.idFim}</TooltipTrigger>
                        <TooltipContent><p className="text-xs">X: {t.xFim.toFixed(3)}<br/>Y: {t.yFim.toFixed(3)}<br/>Cota: {t.cotaFim.toFixed(3)}m</p></TooltipContent></Tooltip></TooltipProvider>
                      </TableCell>
                      <TableCell>{fmt(t.comprimento, 2)}m</TableCell>
                      <TableCell className={t.declividade < 0 ? "text-destructive font-medium" : ""}>{(t.declividade * 100).toFixed(2)}%</TableCell>
                      <TableCell>
                        <Badge variant={t.tipoRede === "Esgoto por Gravidade" ? "default" : "destructive"}>
                          {t.tipoRede === "Esgoto por Gravidade" ? "Gravidade" : "Elevatória"}
                        </Badge>
                      </TableCell>
                      <TableCell>DN{t.diametroMm}</TableCell>
                      <TableCell className={t.cotaInicio - t.cotaFim < 0 ? "text-destructive" : "text-green-600"}>
                        {(t.cotaInicio - t.cotaFim).toFixed(3)}m
                      </TableCell>
                      <TableCell><Badge variant="outline">{t.material}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
        {trechos.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Exportação</CardTitle><CardDescription>Exporte os dados em múltiplos formatos</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const header = "id;x;y;cota\n";
                  const rows = pontos.map(p => `${p.id};${p.x.toFixed(4)};${p.y.toFixed(4)};${p.cota.toFixed(4)}`).join("\n");
                  const blob = new Blob([header + rows], { type: "text/csv" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "topografia.csv"; a.click(); URL.revokeObjectURL(a.href);
                  toast.success("CSV exportado!");
                }}><Download className="h-4 w-4 mr-1" />CSV</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const wb = XLSX.utils.book_new();
                  const ptData = pontos.map(p => ({ ID: p.id, X: p.x, Y: p.y, Cota: p.cota }));
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ptData), "Pontos");
                  const trData = trechos.map((t, i) => ({ "#": i+1, Inicio: t.idInicio, Fim: t.idFim, "Comp (m)": t.comprimento, "Decliv (%)": (t.declividade*100).toFixed(2), Tipo: t.tipoRede, DN: t.diametroMm, Material: t.material }));
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trData), "Trechos");
                  XLSX.writeFile(wb, "topografia.xlsx");
                  toast.success("Excel exportado!");
                }}><Download className="h-4 w-4 mr-1" />Excel</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const features = pontos.map(p => ({
                    type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [p.x, p.y, p.cota] },
                    properties: { id: p.id, cota: p.cota }
                  }));
                  const lineFeatures = trechos.map(t => {
                    const p1 = pontos.find(p => p.id === t.idInicio); const p2 = pontos.find(p => p.id === t.idFim);
                    if (!p1 || !p2) return null;
                    return { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: [[p1.x, p1.y, p1.cota], [p2.x, p2.y, p2.cota]] },
                      properties: { inicio: t.idInicio, fim: t.idFim, comprimento: t.comprimento, tipo: t.tipoRede, dn: t.diametroMm }
                    };
                  }).filter(Boolean);
                  const geojson = { type: "FeatureCollection", features: [...features, ...lineFeatures] };
                  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "topografia.geojson"; a.click(); URL.revokeObjectURL(a.href);
                  toast.success("GeoJSON exportado!");
                }}><Download className="h-4 w-4 mr-1" />GeoJSON</Button>
                <Button variant="outline" size="sm" onClick={() => { downloadDXF(pontos, trechos); toast.success("Arquivo DXF exportado!"); }}><Download className="h-4 w-4 mr-1" />DXF</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── ORÇAMENTO MODULE ──
  function OrcamentoModule() {
    return <BudgetCostModule trechos={trechos} pontos={pontos} />;
  }

  // PlanejamentoModule is now handled by PlanningModule component

  // RDO Module is now handled by RDOHydroModule component

  // ── PLACEHOLDER MODULES ──
  function PerfilLongitudinalModule() {
    return (
      <Card>
        <CardHeader><CardTitle>Perfil Longitudinal</CardTitle><CardDescription>Visualização do corte vertical da rede</CardDescription></CardHeader>
        <CardContent>
          {pontos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Carregue dados na aba Topografia primeiro.</p>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">Perfil longitudinal com {pontos.length} pontos e {trechos.length} trechos</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Escala Horizontal</Label><Select defaultValue="1000"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="500">1:500</SelectItem><SelectItem value="1000">1:1000</SelectItem><SelectItem value="2000">1:2000</SelectItem></SelectContent></Select></div>
                <div><Label>Escala Vertical</Label><Select defaultValue="100"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="50">1:50</SelectItem><SelectItem value="100">1:100</SelectItem><SelectItem value="200">1:200</SelectItem></SelectContent></Select></div>
                <div><Label>Exagero Vertical</Label><Input type="number" defaultValue={10} /></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function MapaInterativoModule() {
    return (
      <div className="space-y-4">
        <TopographyMap pontos={pontos} trechos={trechos} onTrechosChange={setTrechos} />
        <Card>
          <CardHeader><CardTitle>Camadas</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {["Nós/PVs", "Trechos por Tipo", "Trechos por Diâmetro", "Status (OK/WARN)", "Áreas de Contribuição", "Perfil Longitudinal"].map(layer => (
                <Button key={layer} variant="outline" size="sm">{layer}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function ExportacaoGISModule() {
    return (
      <Card>
        <CardHeader><CardTitle>Exportação GIS</CardTitle><CardDescription>Exporte resultados para formatos GIS e CAD</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>CRS de Saída</Label>
              <Select defaultValue="31983"><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="31983">SIRGAS 2000 / UTM 23S</SelectItem>
                  <SelectItem value="31984">SIRGAS 2000 / UTM 24S</SelectItem>
                  <SelectItem value="4326">WGS84 (Lat/Long)</SelectItem>
                  <SelectItem value="4674">SIRGAS 2000 Geográfico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { label: "Shapefile (.SHP)", icon: "🗺️" },
              { label: "GeoJSON", icon: "📋" },
              { label: "GeoPackage (.gpkg)", icon: "📦" },
              { label: "KML/KMZ", icon: "🌍" },
              { label: "DXF (AutoCAD)", icon: "📐" },
              { label: "CSV", icon: "📊" },
            ].map(f => (
              <Button key={f.label} variant="outline" size="sm" onClick={() => toast.info(`Exportação ${f.label} em desenvolvimento`)} disabled={trechos.length === 0}>
                <span className="mr-1">{f.icon}</span>{f.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const moduleNames: Record<string, string> = {
    topografia: "Topografia", esgoto: "Rede de Esgoto", agua: "Rede de Água",
    drenagem: "Drenagem Pluvial", quantitativos: "Quantitativos", orcamento: "Orçamento e Custos",
    planejamento: "Planejamento", epanet: "EPANET", swmm: "SWMM",
    openproject: "OpenProject", projectlibre: "ProjectLibre", qgis: "QGIS",
    revisao: "Revisão por Pares", rdo: "RDO", perfil: "Perfil Longitudinal",
    mapa: "Mapa Interativo", exportacao: "Exportação GIS",
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Droplets className="h-8 w-8 text-blue-600" /> HydroNetwork
                </h1>
                <p className="text-muted-foreground mt-1">{moduleNames[activeModule] || "Plataforma de Saneamento"}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  toast.info(`Pontos: ${pontos.length} | Trechos: ${trechos.length} | RDOs: ${rdos.length} | Cronograma: ${scheduleResult ? "Sim" : "Não"}`);
                }}>✅ Verificar Plataforma</Button>
              </div>
            </div>
            {renderModule()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default HydroNetwork;
