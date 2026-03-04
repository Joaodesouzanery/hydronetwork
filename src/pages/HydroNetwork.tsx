import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Download, MapPin, Droplets, Calculator,
  AlertTriangle, Settings2, X, Map
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
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
import type { QuantRow, QuantityParams } from "@/components/hydronetwork/modules/QuantitiesModule";
import { downloadDXF } from "@/lib/dxfExporter";
// Lazy-loaded modules for code splitting — only loaded when navigated to
const SewerModule = lazy(() => import("@/components/hydronetwork/modules/SewerModule").then(m => ({ default: m.SewerModule })));
const WaterModule = lazy(() => import("@/components/hydronetwork/modules/WaterModule").then(m => ({ default: m.WaterModule })));
const DrainageModule = lazy(() => import("@/components/hydronetwork/modules/DrainageModule").then(m => ({ default: m.DrainageModule })));
const QuantitiesModule = lazy(() => import("@/components/hydronetwork/modules/QuantitiesModule").then(m => ({ default: m.QuantitiesModule })));
const EpanetModule = lazy(() => import("@/components/hydronetwork/modules/EpanetModule").then(m => ({ default: m.EpanetModule })));
const EpanetProModule = lazy(() => import("@/components/hydronetwork/modules/EpanetProModule").then(m => ({ default: m.EpanetProModule })));
const SwmmModule = lazy(() => import("@/components/hydronetwork/modules/SwmmModule").then(m => ({ default: m.SwmmModule })));
const OpenProjectModule = lazy(() => import("@/components/hydronetwork/modules/OpenProjectModule").then(m => ({ default: m.OpenProjectModule })));
const ProjectLibreModule = lazy(() => import("@/components/hydronetwork/modules/ProjectLibreModule").then(m => ({ default: m.ProjectLibreModule })));
const QgisModule = lazy(() => import("@/components/hydronetwork/modules/QgisModule").then(m => ({ default: m.QgisModule })));
const PeerReviewModule = lazy(() => import("@/components/hydronetwork/modules/PeerReviewModule").then(m => ({ default: m.PeerReviewModule })));
const BudgetCostModule = lazy(() => import("@/components/hydronetwork/modules/BudgetCostModule").then(m => ({ default: m.BudgetCostModule })));
const BdiModule = lazy(() => import("@/components/hydronetwork/modules/BdiModule").then(m => ({ default: m.BdiModule })));
const RDOPlanningModule = lazy(() => import("@/components/hydronetwork/modules/RDOPlanningModule").then(m => ({ default: m.RDOPlanningModule })));
const LPSModule = lazy(() => import("@/components/hydronetwork/modules/LPSModule").then(m => ({ default: m.LPSModule })));
const QEsgWaterModule = lazy(() => import("@/components/hydronetwork/modules/QEsgWaterModule").then(m => ({ default: m.QEsgWaterModule })));
const ElevatorStationModule = lazy(() => import("@/components/hydronetwork/modules/ElevatorStationModule").then(m => ({ default: m.ElevatorStationModule })));
const RecalqueModule = lazy(() => import("@/components/hydronetwork/modules/RecalqueModule").then(m => ({ default: m.RecalqueModule })));
const TransientModule = lazy(() => import("@/components/hydronetwork/modules/TransientModule").then(m => ({ default: m.TransientModule })));
const CAESBModule = lazy(() => import("@/components/hydronetwork/modules/CAESBModule").then(m => ({ default: m.CAESBModule })));
const CAESBPreProjectModule = lazy(() => import("@/components/hydronetwork/modules/CAESBPreProjectModule").then(m => ({ default: m.CAESBPreProjectModule })));
const TrechoEditModule = lazy(() => import("@/components/hydronetwork/modules/TrechoEditModule").then(m => ({ default: m.TrechoEditModule })));
const EconomyPanelModule = lazy(() => import("@/components/hydronetwork/modules/EconomyPanelModule").then(m => ({ default: m.EconomyPanelModule })));
import { QEsgWaterPanel } from "@/components/hydronetwork/panels/QEsgWaterPanel";
import { getRasterGrid } from "@/engine/rasterStore";
import { extractContours, type ContourExtractionResult } from "@/engine/contourExtractor";
import { saveHydroProject, loadHydroProject, loadHydroProjectAsync, saveHydroProjectAsync, type HydroProjectSave } from "@/engine/sharedPlanningStore";
import { ProjectSelector } from "@/components/hydronetwork/ProjectSelector";
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
  const [quantityRows, setQuantityRows] = useState<QuantRow[]>([]);
  const [quantityParams, setQuantityParams] = useState<QuantityParams | null>(null);
  const [reviewErrorsCount, setReviewErrorsCount] = useState(0);
  const [reviewWarningsCount, setReviewWarningsCount] = useState(0);

  return {
    pontos, setPontos, trechos, setTrechos, networkSummary, setNetworkSummary,
    costBase, setCostBase, budgetRows, setBudgetRows, budgetSummary, setBudgetSummary,
    diametroMm, setDiametroMm, material, setMaterial, scheduleResult, setScheduleResult,
    rdos, setRdos, quantityRows, setQuantityRows, quantityParams, setQuantityParams,
    reviewErrorsCount, setReviewErrorsCount, reviewWarningsCount, setReviewWarningsCount,
  };
};

const HydroNetwork = () => {
  const { module } = useParams<{ module?: string }>();
  const navigate = useNavigate();
  const activeModule = module || "topografia";

  const state = useHydroState();
  const {
    pontos, setPontos, trechos, setTrechos, networkSummary, setNetworkSummary,
    costBase, setCostBase, budgetRows, setBudgetRows, budgetSummary, setBudgetSummary,
    diametroMm, setDiametroMm, material, setMaterial, scheduleResult, setScheduleResult,
    rdos, setRdos, quantityRows, setQuantityRows, quantityParams, setQuantityParams,
    reviewErrorsCount, setReviewErrorsCount, reviewWarningsCount, setReviewWarningsCount,
  } = state;

  // ══════════════════════════════════════════════
  // PROJECT VERSIONING: current project identity
  // ══════════════════════════════════════════════
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState("HydroNetwork");

  const getProjectData = useCallback((): HydroProjectSave => ({
    pontos, trechos, rdos, planning: null, scheduleResult,
    savedAt: new Date().toISOString(), projectName: currentProjectName,
  }), [pontos, trechos, rdos, scheduleResult, currentProjectName]);

  const handleLoadProject = useCallback((id: string, name: string, data: HydroProjectSave) => {
    setCurrentProjectId(id);
    setCurrentProjectName(name);
    setPontos(data.pontos || []);
    setTrechos(data.trechos || []);
    if (data.trechos?.length) setNetworkSummary(summarizeNetwork(data.trechos));
    else setNetworkSummary(null);
    setRdos(data.rdos || []);
    setScheduleResult(data.scheduleResult || null);
  }, []);

  const handleProjectChange = useCallback((id: string, name: string) => {
    setCurrentProjectId(id);
    setCurrentProjectName(name);
  }, []);

  // ══════════════════════════════════════════════
  // AUTO-LOAD: restore saved project on page open
  // ══════════════════════════════════════════════
  const autoLoadDone = useRef(false);
  useEffect(() => {
    if (autoLoadDone.current) return;
    autoLoadDone.current = true;
    (async () => {
      const saved = await loadHydroProjectAsync();
      if (!saved) return;
      if (saved.pontos?.length) setPontos(saved.pontos);
      if (saved.trechos?.length) {
        setTrechos(saved.trechos);
        setNetworkSummary(summarizeNetwork(saved.trechos));
      }
      if (saved.rdos?.length) setRdos(saved.rdos);
      if (saved.scheduleResult) setScheduleResult(saved.scheduleResult);
      if (saved.projectName) setCurrentProjectName(saved.projectName);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════════════
  // AUTO-SAVE: persist every change with 2s debounce
  // ══════════════════════════════════════════════
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip initial render (avoid saving empty state)
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    // Only save if there's actual data
    if (pontos.length === 0 && trechos.length === 0 && rdos.length === 0) return;
    const timer = setTimeout(() => {
      saveHydroProjectAsync({
        pontos, trechos, rdos, planning: null, scheduleResult,
        savedAt: new Date().toISOString(), projectName: currentProjectName,
      }, currentProjectId || undefined);
    }, 2000);
    return () => clearTimeout(timer);
  }, [pontos, trechos, rdos, scheduleResult, currentProjectId, currentProjectName]);

  // ══════════════════════════════════════════════
  // SAVE ON CLOSE: sync save when user closes tab
  // ══════════════════════════════════════════════
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pontos.length === 0 && trechos.length === 0) return;
      saveHydroProject({
        pontos, trechos, rdos, planning: null, scheduleResult,
        savedAt: new Date().toISOString(), projectName: currentProjectName,
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [pontos, trechos, rdos, scheduleResult, currentProjectName]);

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

  // Import handler for UnifiedImportPanel (receives both pontos + trechos from real edges)
  const handleImportData = useCallback((pts: PontoTopografico[], importedTrechos: Trecho[]) => {
    validateTopographySequence(pts);
    setPontos(pts);
    if (importedTrechos.length > 0) {
      // Use real trechos from file edges (preserves DXF/GeoJSON connectivity)
      setTrechos(importedTrechos);
      setNetworkSummary(summarizeNetwork(importedTrechos));
      toast.success(`${pts.length} pontos, ${importedTrechos.length} trechos reais importados.`);
    } else {
      // Fallback: create sequential trechos (for paste data, CSV with only points, etc.)
      const segs = createTrechosFromTopography(pts, diametroMm, material);
      setTrechos(segs);
      setNetworkSummary(summarizeNetwork(segs));
      toast.success(`${pts.length} pontos carregados, ${segs.length} trechos criados.`);
    }
    setBudgetRows([]); setBudgetSummary(null);
  }, [diametroMm, material]);

  // Simplified handler for paste/demo (only points → sequential trechos)
  const processPoints = useCallback((pts: PontoTopografico[]) => {
    handleImportData(pts, []);
  }, [handleImportData]);


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
    toast.success("Orcamento calculado!");
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
        return <WaterModule pontos={pontos} trechos={trechos} onTrechosChange={setTrechos} />;
      case "drenagem":
        return <DrainageModule pontos={pontos} />;
      case "quantitativos":
        return <QuantitiesModule trechos={trechos} pontos={pontos} onQuantitiesCalculated={(rows, params) => { setQuantityRows(rows); setQuantityParams(params); }} />;
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
        return <PeerReviewModule pontos={pontos} trechos={trechos} onReviewComplete={(errors, warnings) => { setReviewErrorsCount(errors); setReviewWarningsCount(warnings); }} />;
      case "rdo":
        return <RDOHydroModule pontos={pontos} trechos={trechos} rdos={rdos} setRdos={setRdos} onPontosChange={setPontos} onTrechosChange={setTrechos} />;
      case "rdo-planejamento":
        return <RDOPlanningModule pontos={pontos} trechos={trechos} rdos={rdos} scheduleResult={scheduleResult} />;
      case "lps":
        return <LPSModule pontos={pontos} trechos={trechos} />;
      case "qesg-qwater":
        return <QEsgWaterModule pontos={pontos} trechos={trechos} onTrechosChange={setTrechos} />;
      case "elevatoria":
        return <ElevatorStationModule />;
      case "recalque":
        return <RecalqueModule />;
      case "transientes":
        return <TransientModule />;
      case "caesb":
        return <CAESBModule />;
      case "caesb-preprojeto":
        return <CAESBPreProjectModule />;
      case "edicao-trecho":
        return <TrechoEditModule trechos={trechos} pontos={pontos} quantityRows={quantityRows} quantityParams={quantityParams ?? undefined} onTrechosChange={setTrechos} />;
      case "perfil":
        return <PerfilLongitudinal pontos={pontos} trechos={trechos} />;
      case "mapa":
        return <MapaInterativoModule />;
      case "exportacao":
        return <ExportacaoGISModule />;
      case "economia":
        return <EconomyPanelModule trechos={trechos} quantityRows={quantityRows} scheduleResult={scheduleResult} budgetTotal={budgetSummary?.totalCost} reviewErrorsCount={reviewErrorsCount} reviewWarningsCount={reviewWarningsCount} />;
      default:
        return <TopografiaModule />;
    }
  };

  // â"€â"€ TOPOGRAFIA MODULE â"€â"€
  function TopografiaModule() {
    const spatialProject = getSpatialProject();
    const layerCount = getAllLayers().length;
    const [contourInterval, setContourInterval] = useState(5);
    const [contourResult, setContourResult] = useState<ContourExtractionResult | null>(null);

    const handleGenerateContours = () => {
      const raster = getRasterGrid();
      if (!raster) { toast.error("Importe um arquivo TIF/GeoTIFF primeiro."); return; }
      const { grid, meta } = raster;
      const result = extractContours(
        grid.data, meta.width, meta.height,
        grid.origin, grid.pixelSize,
        contourInterval, meta.noDataValue,
      );
      setContourResult(result);
      toast.success(`${result.contours.length} curvas de nível geradas (intervalo ${contourInterval}m)`);
    };

    return (
      <div className="space-y-4">
        {/* Single centered card */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" /> Levantamento Topografico
                </CardTitle>
                <CardDescription>
                  Importe DXF, CSV, XLSX, GeoJSON ou IFC -- todos os nos, trechos e layers
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
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
          </CardHeader>
          <CardContent className="space-y-4">
            {pontos.length > 0 && (
              <div className="border border-border rounded-none p-4 bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">{pontos.length} pontos</Badge>
                    <Badge variant="secondary">{trechos.length} trechos</Badge>
                    {networkSummary && <Badge variant="outline">{fmt(networkSummary.comprimentoTotal, 1)}m total</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/hydronetwork/mapa')}>
                      <Map className="h-4 w-4 mr-1" /> Ver no Mapa
                    </Button>
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
                {networkSummary && (
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { label: "Pontos", value: pontos.length, color: "text-blue-600" },
                      { label: "Trechos", value: networkSummary.totalTrechos, color: "text-green-600" },
                      { label: "Comprimento", value: `${fmt(networkSummary.comprimentoTotal, 1)}m`, color: "text-orange-600" },
                      { label: "Gravidade", value: networkSummary.trechosGravidade, color: "text-green-600" },
                      { label: "Elevatoria", value: networkSummary.trechosElevatoria, color: "text-orange-600" },
                      { label: "Decliv. Media", value: `${(networkSummary.declividadeMedia * 100).toFixed(2)}%`, color: "text-purple-600" },
                    ].map((item, i) => (
                      <div key={i} className="bg-muted/50 rounded-none p-2 text-center">
                        <div className={`text-sm font-bold ${item.color}`}>{item.value}</div>
                        <div className="text-[10px] text-muted-foreground">{item.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <UnifiedImportPanel
              onImport={handleImportData}
              diametroMm={diametroMm}
              material={material}
              onBeforeImport={() => ({ pontos, trechos })}
              onUndo={(snapshot) => {
                setPontos(snapshot.pontos);
                setTrechos(snapshot.trechos);
                setNetworkSummary(snapshot.trechos.length > 0 ? summarizeNetwork(snapshot.trechos) : null);
                toast.success("Importacao desfeita! Dados restaurados.");
              }}
            />

            <details className="group">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                Colar dados manualmente / Carregar Demo
              </summary>
              <div className="space-y-2 mt-2">
                <Textarea placeholder={"358129.1978,7353581.4981,-0.8630\n..."} value={pasteData} onChange={e => setPasteData(e.target.value)} rows={3} />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePasteData} className="flex-1">Processar Colados</Button>
                  <Button variant="secondary" size="sm" onClick={async () => {
                    try {
                      const res = await fetch("/demo/pontos_criadores.txt");
                      const text = await res.text();
                      const pts = parseTopographyCSV(text);
                      processPoints(pts);
                      toast.success("Demo carregado: pontos_criadores.txt");
                    } catch (err: any) { toast.error(err.message); }
                  }} className="flex-1">Carregar Demo</Button>
                </div>
              </div>
            </details>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Diametro (mm)</Label>
                <Select value={String(diametroMm)} onValueChange={v => setDiametroMm(Number(v))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[100, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200].map(d => <SelectItem key={d} value={String(d)}>DN{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Material</Label>
                <Select value={material} onValueChange={setMaterial}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["PVC", "PEAD", "Concreto", "Ferro Fundido"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo de Rede</Label>
                <Select defaultValue="esgoto">
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="esgoto">Esgoto (Gravidade)</SelectItem>
                    <SelectItem value="agua">Agua (Pressurizado)</SelectItem>
                    <SelectItem value="drenagem">Drenagem Pluvial</SelectItem>
                    <SelectItem value="recalque">Recalque/Elevatoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo de Solo</Label>
                <Select value={tipoSolo} onValueChange={v => setTipoSolo(v as TipoSolo)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">1a Categoria</SelectItem>
                    <SelectItem value="rochoso">2a Categoria</SelectItem>
                    <SelectItem value="arenoso">3a Categoria (Rocha)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

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
                      <div className="w-3 h-3" style={{ backgroundColor: layer.color }} />
                      <span className="font-medium">{layer.name}</span>
                      <Badge variant="outline" className="text-[10px]">{layer.discipline}</Badge>
                      <Badge variant="outline" className="text-[10px]">{layer.geometryType}</Badge>
                    </div>
                    <span className="text-muted-foreground">{layer.nodeIds.length} nos . {layer.edgeIds.length} trechos</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <TopographyMap pontos={pontos} trechos={trechos} onTrechosChange={setTrechos} onClearAll={handleClearTopography} onPontosChange={setPontos} contourLines={contourResult?.contours} />

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
        {/* MDE / Curvas de Nível */}
        {getRasterGrid() && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" /> Modelo Digital de Elevação (MDE)
              </CardTitle>
              <CardDescription className="text-xs">
                Extraia curvas de nível do raster importado (TIF/GeoTIFF)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contourResult && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <div className="text-sm font-bold">{contourResult.stats.min.toFixed(1)}m</div>
                    <div className="text-[10px] text-muted-foreground">Mín</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <div className="text-sm font-bold">{contourResult.stats.max.toFixed(1)}m</div>
                    <div className="text-[10px] text-muted-foreground">Máx</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <div className="text-sm font-bold">{contourResult.stats.mean.toFixed(1)}m</div>
                    <div className="text-[10px] text-muted-foreground">Média</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <div className="text-sm font-bold">{contourResult.contours.length}</div>
                    <div className="text-[10px] text-muted-foreground">Curvas</div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Label className="text-xs whitespace-nowrap">Intervalo (m)</Label>
                <Select value={String(contourInterval)} onValueChange={v => setContourInterval(Number(v))}>
                  <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 5, 10, 20, 50].map(i => (
                      <SelectItem key={i} value={String(i)}>{i}m</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleGenerateContours}>Gerar Curvas de Nível</Button>
                {contourResult && contourResult.contours.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => {
                    const features = contourResult.contours.flatMap(c =>
                      c.segments.map(seg => ({
                        type: "Feature" as const,
                        properties: { elevation: c.elevation },
                        geometry: { type: "LineString" as const, coordinates: seg },
                      }))
                    );
                    const geojson = JSON.stringify({ type: "FeatureCollection", features }, null, 2);
                    const blob = new Blob([geojson], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = "curvas_nivel.geojson"; a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Curvas exportadas como GeoJSON");
                  }}>
                    <Download className="h-3 w-3 mr-1" /> GeoJSON
                  </Button>
                )}
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
                      <TableHead className="min-w-[40px]">#</TableHead>
                      <TableHead className="min-w-[120px]">Nome</TableHead>
                      <TableHead>Inicio</TableHead><TableHead>Fim</TableHead><TableHead>Comp.</TableHead>
                      <TableHead className="min-w-[100px]">Tipo Rede</TableHead>
                      <TableHead className="min-w-[100px]">Frente</TableHead>
                      <TableHead className="min-w-[80px]">Lote</TableHead>
                      <TableHead>Decliv.</TableHead><TableHead>Material</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{trechos.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-xs">T{String(i + 1).padStart(2, "0")}</TableCell>
                      <TableCell>
                        <input
                          className="bg-transparent border-b border-dashed border-muted-foreground/30 hover:border-primary focus:border-primary outline-none text-sm w-full px-0 py-0.5"
                          placeholder={`Trecho ${i + 1}`}
                          value={t.nomeTrecho || t.nome || ""}
                          onChange={e => {
                            const updated = [...trechos];
                            updated[i] = { ...updated[i], nomeTrecho: e.target.value, nome: e.target.value };
                            setTrechos(updated);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{t.idInicio}</TableCell>
                      <TableCell className="font-medium">{t.idFim}</TableCell>
                      <TableCell>{fmt(t.comprimento, 2)}m</TableCell>
                      <TableCell>
                        <Select value={t.tipoRedeManual || "esgoto"} onValueChange={v => {
                          const updated = [...trechos];
                          updated[i] = { ...updated[i], tipoRedeManual: v as any };
                          setTrechos(updated);
                        }}>
                          <SelectTrigger className="h-7 text-xs w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agua">Agua</SelectItem>
                            <SelectItem value="esgoto">Esgoto</SelectItem>
                            <SelectItem value="drenagem">Drenagem</SelectItem>
                            <SelectItem value="recalque">Recalque</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <input
                          className="bg-transparent border-b border-dashed border-muted-foreground/30 hover:border-primary focus:border-primary outline-none text-xs w-full px-0 py-0.5"
                          placeholder="Frente"
                          value={t.frenteServico || ""}
                          onChange={e => {
                            const updated = [...trechos];
                            updated[i] = { ...updated[i], frenteServico: e.target.value };
                            setTrechos(updated);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          className="bg-transparent border-b border-dashed border-muted-foreground/30 hover:border-primary focus:border-primary outline-none text-xs w-full px-0 py-0.5"
                          placeholder="Lote"
                          value={t.lote || ""}
                          onChange={e => {
                            const updated = [...trechos];
                            updated[i] = { ...updated[i], lote: e.target.value };
                            setTrechos(updated);
                          }}
                        />
                      </TableCell>
                      <TableCell className={t.declividade < 0 ? "text-destructive font-medium" : ""}>{(t.declividade * 100).toFixed(2)}%</TableCell>
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
            <CardHeader><CardTitle>Exportacao</CardTitle><CardDescription>Exporte os dados em multiplos formatos</CardDescription></CardHeader>
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

        {/* Inline QEsg/QWater dimensioning */}
        {trechos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Calculator className="h-4 w-4" /> Dimensionamento Hidráulico (QEsg / QWater)
              </CardTitle>
              <CardDescription className="text-xs">
                Dimensione diâmetros de esgoto (Manning/NBR 9649) e água (Hazen-Williams/NBR 12218) diretamente aqui.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QEsgWaterPanel pontos={pontos} trechos={trechos} onTrechosChange={setTrechos} />
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

  // â"€â"€ ORÃ‡AMENTO MODULE â"€â"€
  function OrcamentoModule() {
    return <BudgetCostModule trechos={trechos} pontos={pontos} quantityRows={quantityRows} quantityParams={quantityParams ?? undefined} />;
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
              {["Nos/PVs", "Trechos por Tipo", "Trechos por Diametro", "Status (OK/WARN)", "Areas de Contribuicao", "Perfil Longitudinal"].map(layer => (
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
        <CardHeader><CardTitle>Exportacao GIS</CardTitle><CardDescription>Exporte resultados para formatos GIS e CAD</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>CRS de Saida</Label>
              <Select defaultValue="31983"><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="31983">SIRGAS 2000 / UTM 23S</SelectItem>
                  <SelectItem value="31984">SIRGAS 2000 / UTM 24S</SelectItem>
                  <SelectItem value="4326">WGS84 (Lat/Long)</SelectItem>
                  <SelectItem value="4674">SIRGAS 2000 Geografico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { label: "Shapefile (.SHP)", icon: "SHP" },
              { label: "GeoJSON", icon: "JSON" },
              { label: "GeoPackage (.gpkg)", icon: "GPKG" },
              { label: "KML/KMZ", icon: "KML" },
              { label: "DXF (AutoCAD)", icon: "DXF" },
              { label: "CSV", icon: "CSV" },
            ].map(f => (
              <Button key={f.label} variant="outline" size="sm" onClick={() => toast.info(`Exportacao ${f.label} em desenvolvimento`)} disabled={trechos.length === 0}>
                <span className="mr-1">{f.icon}</span>{f.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const moduleNames: Record<string, string> = {
    topografia: "Topografia", esgoto: "Rede de Esgoto", agua: "Rede de Agua",
    drenagem: "Drenagem Pluvial", quantitativos: "Quantitativos", orcamento: "Orcamento e Custos",
    bdi: "BDI - Beneficios e Despesas Indiretas", planejamento: "Planejamento", epanet: "EPANET", "epanet-pro": "EPANET PRO",
    swmm: "SWMM", openproject: "OpenProject", projectlibre: "ProjectLibre", qgis: "QGIS",
    revisao: "Revisao por Pares", rdo: "RDO", "rdo-planejamento": "RDO Ã-- Planejamento",
    perfil: "Perfil Longitudinal", mapa: "Mapa Interativo", exportacao: "Exportacao GIS",
    lps: "LPS — Last Planner System",
    "qesg-qwater": "QEsg / QWater — Dimensionamento Hidráulico",
    elevatoria: "Orçamento de Elevatória",
    recalque: "Recalque / Booster — Linhas de Recalque",
    transientes: "Transientes Hidráulicos — Golpe de Aríete",
    "edicao-trecho": "Edição por Trecho",
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold font-mono flex items-center gap-2 text-primary">
                  <Droplets className="h-7 w-7 text-primary" /> HydroNetwork
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">{moduleNames[activeModule] || "Plataforma de Saneamento"}</p>
              </div>
              <div className="flex gap-2 items-center">
                <ProjectSelector
                  currentProjectId={currentProjectId}
                  currentProjectName={currentProjectName}
                  getData={getProjectData}
                  onLoadProject={handleLoadProject}
                  onProjectChange={handleProjectChange}
                />
                <Button variant="outline" size="sm" onClick={() => {
                  toast.info(`Pontos: ${pontos.length} | Trechos: ${trechos.length} | RDOs: ${rdos.length} | Camadas: ${getAllLayers().length} | CRS: ${getSpatialProject().crs.name}`);
                }}>Verificar Plataforma</Button>
              </div>
            </div>
            <ErrorBoundary moduleName={moduleNames[activeModule] || activeModule} key={activeModule}>
              <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-primary" /></div>}>
                {renderModule()}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default HydroNetwork;




