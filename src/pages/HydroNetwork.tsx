import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Upload, Download, MapPin, Droplets,
  AlertTriangle, Settings2, Info, X
} from "lucide-react";
import { useParams } from "react-router-dom";
import { parseTopographyCSV, validateTopographySequence, PontoTopografico } from "@/engine/reader";
import { UnifiedImportPanel } from "@/components/hydronetwork/UnifiedImportPanel";
import { ValidationReport } from "@/components/hydronetwork/ValidationReport";
import { createTrechosFromTopography, summarizeNetwork, Trecho, NetworkSummary, DEFAULT_DIAMETRO_MM, DEFAULT_MATERIAL } from "@/engine/domain";
import { parseCostBaseFile, applyBudget, createBudgetSummary, exportBudgetExcel, BudgetRow, BudgetSummary, CostBase } from "@/engine/budget";
import { criarParametrosExecucao, ParametrosExecucao, TipoSolo, TipoEscavacao, TipoPavimento, TipoMaterial } from "@/engine/construction";
import { generateFullSchedule, TeamConfig, DEFAULT_TEAM_CONFIG, ScheduleResult } from "@/engine/planning";
import { RDO, loadRDOs, deleteRDO } from "@/engine/rdo";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { TopographyMap } from "@/components/hydronetwork/TopographyMap";
import { PerfilLongitudinal } from "@/components/hydronetwork/PerfilLongitudinal";
import { RDOHydroModule } from "@/components/hydronetwork/RDOHydroModule";
import { PlanningModule } from "@/components/hydronetwork/PlanningModule";
import { downloadDXF } from "@/lib/dxfExporter";
import { SewerModule } from "@/components/hydronetwork/modules/SewerModule";
import { WaterModule } from "@/components/hydronetwork/modules/WaterModule";
import { DrainageModule } from "@/components/hydronetwork/modules/DrainageModule";
import { QuantitiesModule } from "@/components/hydronetwork/modules/QuantitiesModule";
import { EpanetModule } from "@/components/hydronetwork/modules/EpanetModule";
import { EpanetProModule } from "@/components/hydronetwork/modules/EpanetProModule";
import { SwmmModule } from "@/components/hydronetwork/modules/SwmmModule";
import { OpenProjectModule } from "@/components/hydronetwork/modules/OpenProjectModule";
import { ProjectLibreModule } from "@/components/hydronetwork/modules/ProjectLibreModule";
import { QgisModule } from "@/components/hydronetwork/modules/QgisModule";
import { PeerReviewModule } from "@/components/hydronetwork/modules/PeerReviewModule";
import { BudgetCostModule } from "@/components/hydronetwork/modules/BudgetCostModule";
import { BdiModule } from "@/components/hydronetwork/modules/BdiModule";
import { RDOPlanningModule } from "@/components/hydronetwork/modules/RDOPlanningModule";
import { saveHydroProject, loadHydroProject } from "@/engine/sharedPlanningStore";
import {
  getSpatialProject, validateProject, ValidationIssue,
  getAllLayers, resetSpatialProject,
} from "@/engine/spatialCore";

// Shared state context
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

  // Validation report
  const [showValidation, setShowValidation] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  const processPoints = useCallback((pts: PontoTopografico[]) => {
    validateTopographySequence(pts);
    setPontos(pts);
    const segs = createTrechosFromTopography(pts, diametroMm, material);
    setTrechos(segs);
    setNetworkSummary(summarizeNetwork(segs));
    setBudgetRows([]); setBudgetSummary(null);
    toast.success(`${pts.length} pontos carregados, ${segs.length} trechos criados.`);
  }, [diametroMm, material]);


  const handleClearTopography = useCallback(() => {
    setPontos([]);
    setTrechos([]);
    setNetworkSummary(null);
    setBudgetRows([]);
    setBudgetSummary(null);
    setScheduleResult(null);
    resetSpatialProject();
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
    toast.success("OrÃ§amento calculado!");
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
      case "bdi":
        return <BdiModule />;
      case "epanet":
        return <EpanetModule pontos={pontos} trechos={trechos} />;
      case "epanet-pro":
        return <EpanetProModule pontos={pontos} trechos={trechos} />;
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
        return <RDOHydroModule pontos={pontos} trechos={trechos} rdos={rdos} setRdos={setRdos} onPontosChange={setPontos} onTrechosChange={setTrechos} />;
      case "rdo-planejamento":
        return <RDOPlanningModule pontos={pontos} trechos={trechos} rdos={rdos} scheduleResult={scheduleResult} />;
      case "perfil":
        return <PerfilLongitudinal pontos={pontos} trechos={trechos} />;
      case "mapa":
        return <MapaInterativoModule />;
      case "exportacao":
        return <ExportacaoGISModule />;
      default:
        return <TopografiaModule />;
    }
  };

  // â”€â”€ TOPOGRAFIA MODULE â”€â”€
  const [summaryFilter, setSummaryFilter] = useState<string>("todos");

  function TopografiaModule() {
    const spatialProject = getSpatialProject();
    const layerCount = getAllLayers().length;

    return (
      <div className="space-y-4">
        {/* Header */}
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" /> Levantamento TopogrÃ¡fico
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Importe dados (CSV, XLSX, DXF, GeoJSON, IFC) com wizard de 4 etapas estilo QGIS
                </p>
              </div>
              <div className="flex items-center gap-2">
                {layerCount > 0 && <Badge variant="outline">{layerCount} camadas</Badge>}
                <Badge className="bg-muted text-muted-foreground text-xs">CRS: {spatialProject.crs.name}</Badge>
                {pontos.length > 0 && (
                  <>
                    <Badge className="bg-blue-600">{pontos.length} pontos</Badge>
                    <Badge variant="secondary">{trechos.length} trechos</Badge>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Importar Dados</CardTitle>
              <CardDescription>CSV, TXT, XLSX, DXF, GeoJSON, IFC â€” Wizard de 4 etapas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pontos.length > 0 && (
                <div className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-600">{pontos.length} pontos</Badge>
                      <Badge variant="secondary">{trechos.length} trechos</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => {
                        const issues = validateProject();
                        setValidationIssues(issues);
                        setShowValidation(true);
                      }}>
                        <AlertTriangle className="h-4 w-4 mr-1" /> Validar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleClearTopography}>
                        <X className="h-4 w-4 mr-1" /> Limpar
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Dados processados. Importe mais arquivos ou limpe para substituir.</p>
                </div>
              )}

              <UnifiedImportPanel onImport={processPoints} />

              <div className="space-y-2">
                <Label>Colar dados manualmente</Label>
                <Textarea placeholder={"358129.1978,7353581.4981,-0.8630\n..."} value={pasteData} onChange={e => setPasteData(e.target.value)} rows={3} />
                <Button variant="outline" size="sm" onClick={handlePasteData} className="w-full">Processar Dados Colados</Button>
                <Button variant="secondary" size="sm" onClick={async () => {
                  try {
                    const res = await fetch("/demo/pontos_criadores.txt");
                    const text = await res.text();
                    const pts = parseTopographyCSV(text);
                    processPoints(pts);
                    toast.success("Demo carregado: pontos_criadores.txt");
                  } catch (err: any) { toast.error(err.message); }
                }} className="w-full">ðŸŽ¯ Carregar Demo (pontos_criadores.txt)</Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>DiÃ¢metro (mm)</Label>
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
                      <SelectItem value="agua">Ãgua (Pressurizado)</SelectItem>
                      <SelectItem value="drenagem">Drenagem Pluvial</SelectItem>
                      <SelectItem value="recalque">Recalque/ElevatÃ³ria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Solo</Label>
                  <Select value={tipoSolo} onValueChange={v => setTipoSolo(v as TipoSolo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">1Âª Categoria</SelectItem>
                      <SelectItem value="rochoso">2Âª Categoria</SelectItem>
                      <SelectItem value="arenoso">3Âª Categoria (Rocha)</SelectItem>
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
                      <SelectItem value="agua">Rede de Ãgua</SelectItem>
                      <SelectItem value="drenagem">Drenagem Pluvial</SelectItem>
                      <SelectItem value="elevatoria">ElevatÃ³ria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filteredTrechos = summaryFilter === "todos" ? trechos :
                    summaryFilter === "esgoto" ? trechos.filter(t => t.tipoRede === "Esgoto por Gravidade") :
                    summaryFilter === "elevatoria" ? trechos.filter(t => t.tipoRede !== "Esgoto por Gravidade") :
                    trechos;
                  const summary = summarizeNetwork(filteredTrechos);
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Pontos", value: pontos.length, color: "text-blue-600", desc: "Total de pontos topogrÃ¡ficos" },
                        { label: "Trechos", value: summary.totalTrechos, color: "text-green-600", desc: "Segmentos de tubulaÃ§Ã£o" },
                        { label: "Comprimento", value: `${fmt(summary.comprimentoTotal, 1)}m`, color: "text-orange-600", desc: "ExtensÃ£o total" },
                        { label: "Gravidade", value: summary.trechosGravidade, color: "text-green-600", desc: "Escoamento por gravidade" },
                        { label: "ElevatÃ³ria", value: summary.trechosElevatoria, color: "text-orange-600", desc: "Necessita bombeamento" },
                        { label: "Decliv. MÃ©dia", value: `${(summary.declividadeMedia * 100).toFixed(2)}%`, color: "text-purple-600", desc: "Declividade mÃ©dia ponderada" },
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

        {/* Spatial Layers Panel */}
        {getAllLayers().length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Camadas do Projeto ({getAllLayers().length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {getAllLayers().map(layer => (
                  <div key={layer.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: layer.color }} />
                      <span className="font-medium">{layer.name}</span>
                      <Badge variant="outline" className="text-[10px]">{layer.discipline}</Badge>
                      <Badge variant="outline" className="text-[10px]">{layer.geometryType}</Badge>
                    </div>
                    <span className="text-muted-foreground">{layer.nodeIds.length} nÃ³s Â· {layer.edgeIds.length} trechos</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <TopographyMap pontos={pontos} trechos={trechos} onTrechosChange={setTrechos} onClearAll={handleClearTopography} onPontosChange={setPontos} />

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
                      <TableHead>InÃ­cio</TableHead><TableHead>Fim</TableHead><TableHead>Comp.</TableHead>
                      <TableHead>Decliv.</TableHead><TableHead>DesnÃ­vel</TableHead><TableHead>Material</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{trechos.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{t.idInicio}</TableCell>
                      <TableCell className="font-medium">{t.idFim}</TableCell>
                      <TableCell>{fmt(t.comprimento, 2)}m</TableCell>
                      <TableCell className={t.declividade < 0 ? "text-destructive font-medium" : ""}>{(t.declividade * 100).toFixed(2)}%</TableCell>
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
            <CardHeader><CardTitle>ExportaÃ§Ã£o</CardTitle><CardDescription>Exporte os dados em mÃºltiplos formatos</CardDescription></CardHeader>
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

        {/* Validation Report */}
        <ValidationReport
          open={showValidation}
          onOpenChange={setShowValidation}
          issues={validationIssues}
          nodeCount={pontos.length}
          edgeCount={trechos.length}
        />
      </div>
    );
  }

  // â”€â”€ ORÃ‡AMENTO MODULE â”€â”€
  function OrcamentoModule() {
    return <BudgetCostModule trechos={trechos} pontos={pontos} />;
  }

  // ... keep existing code

  function MapaInterativoModule() {
    return (
      <div className="space-y-4">
        <TopographyMap pontos={pontos} trechos={trechos} onTrechosChange={setTrechos} onPontosChange={setPontos} />
        <Card>
          <CardHeader><CardTitle>Camadas</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {["NÃ³s/PVs", "Trechos por Tipo", "Trechos por DiÃ¢metro", "Status (OK/WARN)", "Ãreas de ContribuiÃ§Ã£o", "Perfil Longitudinal"].map(layer => (
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
        <CardHeader><CardTitle>ExportaÃ§Ã£o GIS</CardTitle><CardDescription>Exporte resultados para formatos GIS e CAD</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>CRS de SaÃ­da</Label>
              <Select defaultValue="31983"><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="31983">SIRGAS 2000 / UTM 23S</SelectItem>
                  <SelectItem value="31984">SIRGAS 2000 / UTM 24S</SelectItem>
                  <SelectItem value="4326">WGS84 (Lat/Long)</SelectItem>
                  <SelectItem value="4674">SIRGAS 2000 GeogrÃ¡fico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { label: "Shapefile (.SHP)", icon: "ðŸ—ºï¸" },
              { label: "GeoJSON", icon: "ðŸ“‹" },
              { label: "GeoPackage (.gpkg)", icon: "ðŸ“¦" },
              { label: "KML/KMZ", icon: "ðŸŒ" },
              { label: "DXF (AutoCAD)", icon: "ðŸ“" },
              { label: "CSV", icon: "ðŸ“Š" },
            ].map(f => (
              <Button key={f.label} variant="outline" size="sm" onClick={() => toast.info(`ExportaÃ§Ã£o ${f.label} em desenvolvimento`)} disabled={trechos.length === 0}>
                <span className="mr-1">{f.icon}</span>{f.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const moduleNames: Record<string, string> = {
    topografia: "Topografia", esgoto: "Rede de Esgoto", agua: "Rede de Ãgua",
    drenagem: "Drenagem Pluvial", quantitativos: "Quantitativos", orcamento: "OrÃ§amento e Custos",
    bdi: "BDI â€” BenefÃ­cios e Despesas Indiretas", planejamento: "Planejamento", epanet: "EPANET", "epanet-pro": "EPANET PRO",
    swmm: "SWMM", openproject: "OpenProject", projectlibre: "ProjectLibre", qgis: "QGIS",
    revisao: "RevisÃ£o por Pares", rdo: "RDO", "rdo-planejamento": "RDO Ã— Planejamento",
    perfil: "Perfil Longitudinal", mapa: "Mapa Interativo", exportacao: "ExportaÃ§Ã£o GIS",
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
                  saveHydroProject({
                    pontos, trechos, rdos, planning: null, scheduleResult,
                    savedAt: new Date().toISOString(), projectName: "HydroNetwork",
                  });
                  toast.success("Projeto salvo localmente!");
                }}>ðŸ’¾ Salvar Projeto</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const saved = loadHydroProject();
                  if (!saved) { toast.error("Nenhum projeto salvo encontrado."); return; }
                  if (saved.pontos?.length) setPontos(saved.pontos);
                  if (saved.trechos?.length) setTrechos(saved.trechos);
                  if (saved.rdos?.length) setRdos(saved.rdos);
                  if (saved.scheduleResult) setScheduleResult(saved.scheduleResult);
                  toast.success(`Projeto restaurado: ${saved.pontos?.length || 0} pontos, ${saved.trechos?.length || 0} trechos`);
                }}>ðŸ“‚ Carregar Projeto</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  toast.info(`Pontos: ${pontos.length} | Trechos: ${trechos.length} | RDOs: ${rdos.length} | Camadas: ${getAllLayers().length} | CRS: ${getSpatialProject().crs.name}`);
                }}>âœ… Verificar Plataforma</Button>
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




