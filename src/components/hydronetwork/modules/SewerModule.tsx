import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Calculator, Waves, CheckCircle, XCircle, Download,
  AlertTriangle, Zap, Upload, Settings, Users,
  Map as MapIcon, TableProperties, Activity, Mountain,
  Save, CloudOff, ArrowRight, Hash, Layers, RefreshCw,
  ShieldAlert, BarChart3, Tag, Eraser, Target,
  FileText, FileSpreadsheet, FileInput, FileOutput,
  HelpCircle, ChevronDown, Ruler, Import, Eye,
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { classifyNetworkType } from "@/engine/geometry";
import {
  dimensionSewerNetwork,
  accumulateSewerFlow,
  calcPopulationFlow,
  numberSewerNetwork,
  fillFieldsFromNodes,
  findMinCoverPoints,
  summarizeByDiameter,
  parseDxfText,
  exportSewerDxf,
  parseLandXML,
  exportLandXML,
  generateProjectReport,
  generateResultsCSV,
  type SewerSegmentInput,
  type SewerSegmentResult,
  type SewerNodeInput,
  type SewerNetworkNode,
  type SewerNetworkEdge,
  type MinCoverAlertPoint,
  type DiameterSummaryRow,
} from "@/engine/qesgEngine";
import { NetworkMapView } from "@/components/hydronetwork/modules/NetworkMapView";
import { GisMapTab } from "@/components/hydronetwork/modules/GisMapTab";
import { ElementTypeAssigner, ElementAssignment } from "@/components/hydronetwork/modules/ElementTypeAssigner";
import { AttributeTableEditor, SewerNodeAttributes, SewerEdgeAttributes } from "@/components/hydronetwork/modules/AttributeTableEditor";
import { LongitudinalProfile } from "@/components/hydronetwork/modules/LongitudinalProfile";
import { SEWER_DEFAULTS, DEMO_UTM_ORIGIN } from "@/config/defaults";
import { useSpatialData } from "@/hooks/useSpatialData";
import { getNodesByOrigin, getAllLayers, getSpatialProject } from "@/core/spatial";
import { useDimensioningPersistence } from "@/hooks/useDimensioningPersistence";
import type { SewerDimensioningState } from "@/engine/sharedPlanningStore";
import { QEsgConfigDialog } from "@/components/hydronetwork/modules/QEsgConfigDialog";
import {
  QESG_EDGE_FIELDS,
  QESG_NODE_FIELDS,
  type QEsgProjectConfig,
  DEFAULT_QESG_CONFIG,
} from "@/engine/qesgFields";
import { sampleElevation, fillNodeElevations, fillEdgeElevations } from "@/engine/elevationExtractor";
import { getRasterGrid } from "@/engine/rasterStore";

// ══════════════════════════════════════
// Interfaces
// ══════════════════════════════════════

interface SewerModuleProps {
  pontos?: PontoTopografico[];
  trechos?: Trecho[];
  onPontosChange?: (p: PontoTopografico[]) => void;
  onTrechosChange?: (t: Trecho[]) => void;
}

// ── Step definitions ──

type StepId =
  | "mapa" | "s00" | "s01" | "s02" | "s03" | "s04" | "s05" | "s06" | "s07" | "s08"
  | "perfil" | "resumo" | "pvnames" | "clearnames" | "impoe" | "relatorio" | "dxfimp" | "dxfexp" | "c3d" | "ajuda";

// Primary sequential steps (00-08) — matches QEsg plugin exactly
// Internal IDs (s04, s05, etc.) map to the panel rendering in switch
const primarySteps: { id: StepId; num: string; label: string }[] = [
  { id: "s00", num: "00", label: "Configurações" },
  { id: "s01", num: "01", label: "Verifica Campos" },
  { id: "s02", num: "02", label: "Numerar Rede" },
  { id: "s03", num: "03", label: "Cria PVs" },
  { id: "s04", num: "04", label: "Cota TN (MDT)" },
  { id: "s05", num: "05", label: "Preenche Campos" },
  { id: "s06", num: "06", label: "Calcula Vazão" },
  { id: "s07", num: "07", label: "Dimensiona" },
  { id: "s08", num: "08", label: "Recobrimento" },
];


// Secondary menu items (utilities)
const secondaryItems: { id: StepId; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "resumo", label: "Resumo DN" },
  { id: "pvnames", label: "Nomes PVs" },
  { id: "clearnames", label: "Apaga Nomes" },
  { id: "impoe", label: "Impõe Vazão" },
  { id: "relatorio", label: "Relatório" },
  { id: "dxfimp", label: "DXF Import" },
  { id: "dxfexp", label: "DXF Export" },
  { id: "c3d", label: "Civil 3D" },
  { id: "ajuda", label: "Ajuda" },
];

// Combined steps list for backward compat
const steps = primarySteps;

// ── Map formatters ──
const formatSewerTooltip = (segId: string, r: SewerSegmentResult) =>
  `${segId} | DN${r.diametroMm} | V=${r.velocidadeMs.toFixed(2)} m/s | τ=${r.tensaoTrativa.toFixed(2)} Pa`;

const formatSewerPopup = (segId: string, r: SewerSegmentResult) => `
  <div style="font-size:12px;line-height:1.6">
    <strong>${segId}</strong><br/>
    <b>DN:</b> ${r.diametroMm} mm<br/>
    <b>V:</b> ${r.velocidadeMs.toFixed(3)} m/s<br/>
    <b>V crit:</b> ${r.velocidadeCriticaMs.toFixed(3)} m/s<br/>
    <b>y/D:</b> ${r.laminaDagua.toFixed(3)}<br/>
    <b>τ:</b> ${r.tensaoTrativa.toFixed(2)} Pa<br/>
    <b>Decliv.:</b> ${(r.declividadeUsada * 100).toFixed(3)}%<br/>
    <b>Status:</b> ${r.atendeNorma ? "OK" : "FALHA"}<br/>
    ${r.observacoes.length > 0 ? `<b>Obs:</b> ${r.observacoes.join("; ")}` : ""}
  </div>`;

// ══════════════════════════════════════
// Main Component — Sequential Toolbar
// ══════════════════════════════════════

export const SewerModule = ({ pontos, trechos, onPontosChange, onTrechosChange }: SewerModuleProps) => {
  // ── Spatial data (primary source) ──
  const spatial = useSpatialData("qesg");

  // ── GIS data ──
  const [gisPontos, setGisPontos] = useState<PontoTopografico[]>(pontos || []);
  const [gisTrechos, setGisTrechos] = useState<Trecho[]>(trechos || []);
  const [assignments, setAssignments] = useState<ElementAssignment>({
    nodeTypes: new Map(), edgeTypes: new Map(),
  });
  const [sewerNodeAttrs, setSewerNodeAttrs] = useState<SewerNodeAttributes[]>([]);
  const [sewerEdgeAttrs, setSewerEdgeAttrs] = useState<SewerEdgeAttributes[]>([]);

  // ── QEsg Config Dialog ──
  const [configOpen, setConfigOpen] = useState(false);
  const [qesgConfig, setQesgConfig] = useState<QEsgProjectConfig>({ ...DEFAULT_QESG_CONFIG });

  // ── MDT Progress ──
  const [mdtProgress, setMdtProgress] = useState<number | null>(null);
  const mdtCancelRef = useRef(false);

  // ── New menu features state ──
  const [minCoverAlerts, setMinCoverAlerts] = useState<MinCoverAlertPoint[]>([]);
  const [diameterSummary, setDiameterSummary] = useState<DiameterSummaryRow[]>([]);
  const [showSecondaryMenu, setShowSecondaryMenu] = useState(false);
  const [impoeVazaoValue, setImpoeVazaoValue] = useState(1.5);
  const [selectedTrechosForImpoe, setSelectedTrechosForImpoe] = useState<Set<string>>(new Set());
  const [c3dSubMenu, setC3dSubMenu] = useState<"prepara" | "importa" | "exporta">("prepara");
  const [relatorioSubMenu, setRelatorioSubMenu] = useState<"dados" | "planilha">("dados");
  const dxfFileRef = useRef<HTMLInputElement>(null);
  const xmlFileRef = useRef<HTMLInputElement>(null);

  // ── Verifica Campos state ──
  const [verificaCamposResult, setVerificaCamposResult] = useState<{
    missing: string[];
    present: string[];
  } | null>(null);
  const [showCreateFieldsConfirm, setShowCreateFieldsConfirm] = useState(false);

  // ── Step state ──
  const [activeStep, setActiveStep] = useState<StepId>("mapa");
  const [stepStatus, setStepStatus] = useState<Record<string, "pending" | "done">>({});
  const markDone = (stepId: StepId) => setStepStatus(prev => ({ ...prev, [stepId]: "done" }));

  // Step dependency map: what prerequisite must be done before running a step
  const stepPrereqs: Partial<Record<StepId, { requires: StepId; label: string }>> = {
    s01: { requires: "s00", label: "00 Configurações" },
    s02: { requires: "s01", label: "01 Verifica Campos" },
    s03: { requires: "s02", label: "02 Numerar Rede" },
    s04: { requires: "s03", label: "03 Cria Layer PVs" },
    s05: { requires: "s04", label: "04 Atualiza Cota TN" },
    s06: { requires: "s05", label: "05 Preenche Campos" },
    s07: { requires: "s06", label: "06 Calcula Vazão" },
    s08: { requires: "s07", label: "07 Dimensiona" },
  };

  // Step dependency validation with "go to step" buttons
  const handleStepChange = (stepId: StepId) => {
    const hasData = activePontos.length > 0 || gisPontos.length > 0;
    if (stepId !== "mapa" && stepId !== "s00" && stepId !== "ajuda" && !hasData) {
      toast.warning("Importe dados no Mapa primeiro", {
        action: { label: "Ir para Mapa", onClick: () => setActiveStep("mapa") },
      });
    }

    // Check sequential prerequisite
    const prereq = stepPrereqs[stepId];
    if (prereq && stepStatus[prereq.requires] !== "done") {
      toast.warning(`Execute "${prereq.label}" antes.`, {
        action: {
          label: `Ir para ${prereq.label}`,
          onClick: () => setActiveStep(prereq.requires),
        },
      });
    }

    // Specific checks
    if (stepId === "s06" && stepStatus["s05"] !== "done" && sewerEdgeAttrs.length === 0) {
      toast.warning("Execute '05 Preenche Campos' primeiro", {
        action: { label: "Ir para 05", onClick: () => setActiveStep("s05") },
      });
    }
    if (stepId === "s07" && stepStatus["s06"] !== "done" && sewerEdgeAttrs.length === 0 && sewerTrechos.length === 0) {
      toast.warning("Execute '06 Calcula Vazão' primeiro", {
        action: { label: "Ir para 06", onClick: () => setActiveStep("s06") },
      });
    }
    setActiveStep(stepId);
  };

  // Sync external data into GIS state on first load
  useEffect(() => {
    if (pontos && pontos.length > 0 && gisPontos.length === 0) setGisPontos(pontos);
  }, [pontos?.length]);
  useEffect(() => {
    if (trechos && trechos.length > 0 && gisTrechos.length === 0) setGisTrechos(trechos);
  }, [trechos?.length]);

  const handleGisPontosChange = useCallback((p: PontoTopografico[]) => {
    setGisPontos(p);
    onPontosChange?.(p);
  }, [onPontosChange]);
  const handleGisTrechosChange = useCallback((t: Trecho[]) => {
    setGisTrechos(t);
    onTrechosChange?.(t);
  }, [onTrechosChange]);

  // ── Derived (must be declared before any useCallback that references them) ──
  const activePontos = spatial.legacyPontos.length > 0
    ? spatial.legacyPontos
    : gisPontos.length > 0
      ? gisPontos
      : (pontos || []);
  const activeTrechos = spatial.legacyTrechos.length > 0
    ? spatial.legacyTrechos
    : gisTrechos.length > 0
      ? gisTrechos
      : (trechos || []);

  // ── Sync node/edge attrs → GIS + SpatialCore ──
  const syncNodeAttrsToGis = useCallback((attrs: SewerNodeAttributes[]) => {
    setSewerNodeAttrs(attrs);
    const newPontos = attrs.map(n => ({ id: n.id, x: n.x, y: n.y, cota: n.cotaTerreno }));
    handleGisPontosChange(newPontos);
    // Sync elevation to SpatialCore
    const project = getSpatialProject();
    for (const n of attrs) {
      const spatialNode = project.nodes.get(n.id);
      if (spatialNode) {
        spatialNode.z = n.cotaTerreno;
        if (n.cotaFundo !== undefined) spatialNode.cotaFundo = n.cotaFundo;
        if (n.profundidade !== undefined) spatialNode.profundidade = n.profundidade;
      }
    }
    spatial.refresh();
  }, [handleGisPontosChange, spatial]);

  const syncEdgeAttrsToGis = useCallback((attrs: SewerEdgeAttributes[]) => {
    setSewerEdgeAttrs(attrs);
    // Update trechos with edge attribute data
    const updatedTrechos = activeTrechos.map(t => {
      const attr = attrs.find(e => e.key === `${t.idInicio}-${t.idFim}` || e.idInicio === t.idInicio && e.idFim === t.idFim);
      if (attr) {
        return {
          ...t,
          cotaInicio: attr.cotaTerrenoM ?? t.cotaInicio,
          cotaFim: attr.cotaTerrenoJ ?? t.cotaFim,
          comprimento: attr.comprimento > 0 ? attr.comprimento : t.comprimento,
          diametroMm: attr.diametro ?? t.diametroMm,
        };
      }
      return t;
    });
    handleGisTrechosChange(updatedTrechos);
  }, [activeTrechos, handleGisTrechosChange]);

  // ── Sync QEsg config → hydraulic parameters ──
  const handleConfigChange = (newConfig: QEsgProjectConfig) => {
    setQesgConfig(newConfig);
    setManning(newConfig.manning);
    setLaminaMax(newConfig.laminaMaxima);
    setVelMinEsg(newConfig.velMinima);
    setVelMaxEsg(newConfig.velMaxima);
    setTensaoMin(newConfig.tensaoMinima);
    setDiamMinEsg(newConfig.diametroMinimo);
    setMaterial(newConfig.material);
    setQpcLitrosDia(newConfig.perCapita);
    setK1(newConfig.k1);
    setK2(newConfig.k2);
    markDone("s00");
  };

  // ── Hydraulic parameters ──
  const [manning, setManning] = useState(SEWER_DEFAULTS.manning.PVC);
  const [laminaMax, setLaminaMax] = useState(SEWER_DEFAULTS.laminaMax);
  const [velMinEsg, setVelMinEsg] = useState(SEWER_DEFAULTS.velMin);
  const [velMaxEsg, setVelMaxEsg] = useState(SEWER_DEFAULTS.velMax);
  const [tensaoMin, setTensaoMin] = useState(SEWER_DEFAULTS.tensaoMin);
  const [diamMinEsg, setDiamMinEsg] = useState(SEWER_DEFAULTS.diamMinMm);
  const [material, setMaterial] = useState(SEWER_DEFAULTS.defaultMaterial);
  const [pontaSecaEnabled, setPontaSecaEnabled] = useState(false);

  // Flow parameters
  const [metodoVazao, setMetodoVazao] = useState<"fixa" | "percapita">("fixa");
  const [vazaoEsg, setVazaoEsg] = useState(SEWER_DEFAULTS.defaultVazaoLps);
  const [qpcLitrosDia, setQpcLitrosDia] = useState(SEWER_DEFAULTS.defaultQpcLitrosDia);
  const [k1, setK1] = useState(SEWER_DEFAULTS.defaultK1);
  const [k2, setK2] = useState(SEWER_DEFAULTS.defaultK2);

  // ── QEsg Results ──
  const [sewerResults, setSewerResults] = useState<SewerSegmentResult[]>([]);
  const [sewerResumo, setSewerResumo] = useState<{ total: number; atendem: number } | null>(null);

  // ── Step messages ──
  const [stepMessage, setStepMessage] = useState<Record<string, string>>({});

  // ── Persistence ──
  const persistence = useDimensioningPersistence("sewer");
  const restoredRef = useRef(false);

  // Load saved state on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    persistence.load().then((saved) => {
      if (!saved) return;
      const s = saved as SewerDimensioningState;
      if (s.nodeAttrs?.length > 0) setSewerNodeAttrs(s.nodeAttrs);
      if (s.edgeAttrs?.length > 0) setSewerEdgeAttrs(s.edgeAttrs);
      if (s.results?.length > 0) {
        setSewerResults(s.results);
        const atendem = s.results.filter((r: any) => r.atendeNorma).length;
        setSewerResumo({ total: s.results.length, atendem });
      }
      if (s.stepStatus) setStepStatus(s.stepStatus);
      if (s.gisPontos?.length > 0) setGisPontos(s.gisPontos);
      if (s.gisTrechos?.length > 0) setGisTrechos(s.gisTrechos);
      if (s.params) {
        if (s.params.manning) setManning(s.params.manning);
        if (s.params.laminaMax) setLaminaMax(s.params.laminaMax);
        if (s.params.velMin) setVelMinEsg(s.params.velMin);
        if (s.params.velMax) setVelMaxEsg(s.params.velMax);
        if (s.params.tensaoMin) setTensaoMin(s.params.tensaoMin);
        if (s.params.diamMin) setDiamMinEsg(s.params.diamMin);
        if (s.params.material) setMaterial(s.params.material);
        if (s.params.metodoVazao) setMetodoVazao(s.params.metodoVazao as "fixa" | "percapita");
        if (s.params.vazao) setVazaoEsg(s.params.vazao);
        if (s.params.qpc) setQpcLitrosDia(s.params.qpc);
        if (s.params.k1) setK1(s.params.k1);
        if (s.params.k2) setK2(s.params.k2);
      }
    });
  }, []);

  // Auto-save on state changes (debounced)
  useEffect(() => {
    if (!restoredRef.current) return;
    const hasData = sewerNodeAttrs.length > 0 || sewerEdgeAttrs.length > 0 || sewerResults.length > 0 || gisPontos.length > 0;
    if (!hasData) return;
    const state: SewerDimensioningState = {
      nodeAttrs: sewerNodeAttrs,
      edgeAttrs: sewerEdgeAttrs,
      results: sewerResults,
      params: {
        manning, laminaMax, velMin: velMinEsg, velMax: velMaxEsg,
        tensaoMin, diamMin: diamMinEsg, material, metodoVazao,
        vazao: vazaoEsg, qpc: qpcLitrosDia, k1, k2,
      },
      stepStatus,
      gisPontos,
      gisTrechos,
    };
    persistence.save(state);
  }, [sewerNodeAttrs, sewerEdgeAttrs, sewerResults, stepStatus,
      gisPontos, gisTrechos, manning, laminaMax, velMinEsg, velMaxEsg,
      tensaoMin, diamMinEsg, material, metodoVazao, vazaoEsg, qpcLitrosDia, k1, k2]);

  // Auto-import from topography if no local data
  useEffect(() => {
    if (gisPontos.length > 0 || spatial.nodes.length > 0) return;
    const topoNodes = getNodesByOrigin("topografia");
    if (topoNodes.length > 0) {
      spatial.importFromTopography();
      toast.info("Rede importada da Topografia automaticamente");
    }
  }, []); // mount only

  const sewerTrechos = useMemo(() =>
    activeTrechos.filter(t => {
      if (!t.tipoRedeManual) return true; // include unclassified trechos
      return t.tipoRedeManual === "esgoto" || t.tipoRedeManual === "outro";
    }), [activeTrechos]);

  // ── Available layers for QEsg config dialog ──
  const availableLayers = useMemo(() => {
    const layers = getAllLayers();
    return layers.map(l => ({
      id: l.id,
      name: l.name,
      type: (l.geometryType === "Point" ? "point"
           : l.geometryType === "LineString" ? "line"
           : "polygon") as "line" | "point" | "raster" | "polygon",
    }));
  }, [spatial.nodes, spatial.edges]);

  const handleMaterialChange = (mat: string) => {
    setMaterial(mat);
    const n = SEWER_DEFAULTS.manning[mat];
    if (n) setManning(n);
  };

  // ── Transfer / Demo ──
  const transferFromTopography = () => {
    spatial.importFromTopography();
    const topoNodes = getNodesByOrigin("topografia");
    if (topoNodes.length === 0 && (!pontos || (pontos.length === 0))) {
      toast.error("Nenhum ponto na topografia"); return;
    }
    // If spatial import worked
    if (spatial.nodes.length > 0) {
      setGisPontos(spatial.legacyPontos);
      // Tag trechos with correct network type
      setGisTrechos(spatial.legacyTrechos.map(t => ({
        ...t,
        tipoRedeManual: t.tipoRedeManual || "esgoto",
      })));
    } else if (pontos && pontos.length > 0) {
      setGisPontos(pontos);
      // Tag trechos with correct network type
      setGisTrechos((trechos || []).map(t => ({
        ...t,
        tipoRedeManual: t.tipoRedeManual || "esgoto",
      })));
    }
    toast.success(`Dados transferidos da topografia`);
  };

  const loadDemo = () => {
    const { x: X0, y: Y0 } = DEMO_UTM_ORIGIN;
    const demoPontos: PontoTopografico[] = [
      { id: "PV1", x: X0,       y: Y0,       cota: 106.0 },
      { id: "PV2", x: X0 + 70,  y: Y0 + 30,  cota: 104.5 },
      { id: "PV3", x: X0 + 140, y: Y0 + 60,  cota: 103.0 },
      { id: "PV4", x: X0 + 180, y: Y0 + 75,  cota: 102.0 },
      { id: "PV5", x: X0 + 210, y: Y0 + 90,  cota: 101.5 },
    ];
    const demoTrechos: Trecho[] = [];
    for (let i = 0; i < demoPontos.length - 1; i++) {
      const p0 = demoPontos[i], p1 = demoPontos[i + 1];
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const comp = Math.sqrt(dx * dx + dy * dy);
      const decl = comp > 0 ? (p0.cota - p1.cota) / comp : 0;
      demoTrechos.push({
        idInicio: p0.id, idFim: p1.id, comprimento: Math.round(comp * 10) / 10,
        declividade: decl, tipoRede: classifyNetworkType(decl), diametroMm: 150, material: "PVC",
        xInicio: p0.x, yInicio: p0.y, cotaInicio: p0.cota,
        xFim: p1.x, yFim: p1.y, cotaFim: p1.cota,
        tipoRedeManual: "esgoto",
      });
    }
    handleGisPontosChange(demoPontos);
    handleGisTrechosChange(demoTrechos);
    toast.success("Demo de esgoto carregado (5 PVs)");
  };

  // ── Dimensioning ──
  const dimensionSewer = useCallback(() => {
    let inputs: SewerSegmentInput[];

    if (sewerEdgeAttrs.length > 0) {
      // From GIS attribute table (priority)
      inputs = sewerEdgeAttrs.map(e => ({
        id: e.key,
        comprimento: e.comprimento,
        cotaMontante: e.cotaColetorM,
        cotaJusante: e.cotaColetorJ,
        vazaoLps: metodoVazao === "fixa" ? vazaoEsg : 0,
        tipoTubo: e.material,
      }));
    } else if (sewerTrechos.length > 0) {
      inputs = sewerTrechos.map(t => ({
        id: `${t.idInicio}-${t.idFim}`,
        comprimento: t.comprimento,
        cotaMontante: t.cotaInicio,
        cotaJusante: t.cotaFim,
        vazaoLps: vazaoEsg,
        tipoTubo: material,
      }));
    } else {
      toast.error("Importe dados no Mapa ou preencha a tabela de Rede.");
      return;
    }

    // Per-capita flow accumulation
    if (metodoVazao === "percapita") {
      const nodeFlows: SewerNodeInput[] = sewerNodeAttrs.length > 0
        ? sewerNodeAttrs.map(n => ({
            id: n.id,
            vazaoLocal: calcPopulationFlow(n.populacao, qpcLitrosDia, k1, k2) + n.vazaoConcentrada,
          }))
        : activePontos.map(p => ({
            id: p.id,
            vazaoLocal: calcPopulationFlow(SEWER_DEFAULTS.defaultPopulacao, qpcLitrosDia, k1, k2),
          }));
      if (nodeFlows.length > 0) inputs = accumulateSewerFlow(inputs, nodeFlows);
    }

    // Ponta Seca: set minimum flow (1.5 L/s) on edges marked as ponta seca
    if (pontaSecaEnabled && sewerEdgeAttrs.length > 0) {
      const psMap = new Map(sewerEdgeAttrs.map(e => [e.key, e.pontaSeca]));
      inputs = inputs.map(inp => {
        const psVal = psMap.get(inp.id);
        if (psVal && psVal > 0) {
          return { ...inp, vazaoLps: SEWER_DEFAULTS.defaultVazaoLps };
        }
        return inp;
      });
    }

    const { resultados, resumo } = dimensionSewerNetwork(inputs, {
      manning, laminaMax, velMin: velMinEsg, velMax: velMaxEsg, tensaoMin, diamMinMm: diamMinEsg,
    });
    setSewerResults(resultados);
    setSewerResumo({ total: resumo.total, atendem: resumo.atendem });

    // Propagate calculated diameters back to trechos
    const resultMap = new Map(resultados.map(r => [r.id, r]));
    const updatedTrechos = activeTrechos.map(t => {
      const r = resultMap.get(`${t.idInicio}-${t.idFim}`);
      return r ? { ...t, diametroMm: r.diametroMm } : t;
    });
    handleGisTrechosChange(updatedTrechos);

    // Write results to Spatial Core edges
    for (const r of resultados) {
      const edge = spatial.edges.find(e => e.id === r.id);
      if (edge) {
        edge.properties.DN = r.diametroMm;
        edge.properties.velocity = r.velocidadeMs;
        edge.properties.compliance = r.atendeNorma;
        edge.properties.tensaoTrativa = r.tensaoTrativa;
      }
    }
    spatial.refresh();

    toast.success(`QEsg: ${resumo.atendem}/${resumo.total} atendem NBR 9649`);
    markDone("s07");
  }, [sewerEdgeAttrs, sewerNodeAttrs, sewerTrechos, activePontos, activeTrechos,
      manning, laminaMax, velMinEsg, velMaxEsg, tensaoMin, diamMinEsg, vazaoEsg,
      material, metodoVazao, qpcLitrosDia, k1, k2, pontaSecaEnabled,
      handleGisTrechosChange, spatial]);

  const applyDiameters = useCallback(() => {
    if (sewerResults.length === 0) return;
    const m = new Map(sewerResults.map(r => [r.id, r.diametroMm]));
    handleGisTrechosChange(activeTrechos.map(t => {
      const d = m.get(`${t.idInicio}-${t.idFim}`);
      return d ? { ...t, diametroMm: d } : t;
    }));
    toast.success("Diâmetros aplicados");
  }, [sewerResults, activeTrechos, handleGisTrechosChange]);

  const exportCSV = () => {
    if (sewerResults.length === 0) return;
    let csv = "Trecho;DN (mm);DN Calc (mm);V (m/s);V Crit (m/s);y/D;Tensao (Pa);Decliv Min;Decliv Usada;Status;Obs\n";
    for (const r of sewerResults) csv += `${r.id};${r.diametroMm};${r.diametroCalculadoMm};${r.velocidadeMs};${r.velocidadeCriticaMs};${r.laminaDagua};${r.tensaoTrativa};${r.declividadeMin};${r.declividadeUsada};${r.atendeNorma ? "OK" : "NAO"};${r.observacoes.join(" | ")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "dimensionamento_esgoto.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Profile data ──
  const profileNodes = useMemo((): SewerNodeAttributes[] => {
    if (sewerNodeAttrs.length > 0) return sewerNodeAttrs;
    return activePontos.map(p => ({
      id: p.id, tipo: "pv", cotaTerreno: p.cota, cotaFundo: p.cota - 1.5,
      profundidade: 1.5, x: p.x, y: p.y, populacao: 0, vazaoConcentrada: 0, observacao: "",
    }));
  }, [sewerNodeAttrs, activePontos]);

  const profileEdges = useMemo((): SewerEdgeAttributes[] => {
    if (sewerEdgeAttrs.length > 0) return sewerEdgeAttrs;
    return sewerTrechos.map((t, i) => ({
      key: `${t.idInicio}-${t.idFim}`, dcId: `C${String(i + 1).padStart(3, "0")}`,
      idInicio: t.idInicio, idFim: t.idFim, comprimento: t.comprimento,
      cotaTerrenoM: t.cotaInicio, cotaTerrenoJ: t.cotaFim,
      cotaColetorM: t.cotaInicio - 1.5, cotaColetorJ: t.cotaFim - 1.5,
      manning, diametro: t.diametroMm, declividade: t.declividade,
      material: t.material || "PVC", contribuicaoLateral: 0, pontaSeca: 0,
      etapa: "1", observacao: "",
    }));
  }, [sewerEdgeAttrs, sewerTrechos, manning]);

  // ── Result-colored connections for map ──
  const resultColoredConnections = useMemo(() => {
    if (sewerResults.length === 0) return undefined;
    const resultMap = new Map(sewerResults.map(r => [r.id, r]));
    const psMap = new Map(sewerEdgeAttrs.map(e => [e.key, e.pontaSeca]));
    return activeTrechos
      .filter(t => !t.tipoRedeManual || t.tipoRedeManual === "esgoto" || t.tipoRedeManual === "outro")
      .map(t => {
        const key = `${t.idInicio}-${t.idFim}`;
        const r = resultMap.get(key);
        const isPontaSeca = (psMap.get(key) ?? 0) > 0;
        return {
          from: t.idInicio,
          to: t.idFim,
          color: isPontaSeca ? "#f59e0b" : (r ? (r.atendeNorma ? "#22c55e" : "#ef4444") : "#ef4444"),
          label: r ? `${key}${isPontaSeca ? " [PS]" : ""} DN${r.diametroMm} V=${r.velocidadeMs.toFixed(2)}` : key,
          dashArray: isPontaSeca ? "8 4" : undefined,
        };
      });
  }, [sewerResults, activeTrechos, sewerEdgeAttrs]);

  // ── Stats ──
  const alertCount = sewerResults.filter(r => !r.atendeNorma).length;
  const compliance = sewerResumo
    ? Math.round((sewerResumo.atendem / Math.max(sewerResumo.total, 1)) * 100) : 0;
  const canDimension = sewerEdgeAttrs.length > 0 || sewerTrechos.length > 0;

  // ══════════════════════════════════════
  // Panel rendering
  // ══════════════════════════════════════

  const renderActivePanel = () => {
    switch (activeStep) {
      // ═══════ MAPA ═══════
      case "mapa":
        return (
          <div className="space-y-4">
            <GisMapTab
              networkType="esgoto"
              pontos={gisPontos}
              trechos={gisTrechos}
              onPontosChange={handleGisPontosChange}
              onTrechosChange={handleGisTrechosChange}
              accentColor="#ef4444"
              originModule="qesg"
              resultConnections={resultColoredConnections}
            />
            <div className="flex gap-2 flex-wrap">
              <Button onClick={transferFromTopography} variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" /> Transferir da Topografia
              </Button>
              <Button onClick={loadDemo} variant="secondary" size="sm">Carregar Demo</Button>
              <Button onClick={async () => {
                const { fillNodeElevations, fillEdgeElevations } = await import("@/engine/elevationExtractor");
                const { updated, noRaster } = fillNodeElevations();
                if (noRaster) { toast.error("Importe um TIF/GeoTIFF primeiro"); return; }
                fillEdgeElevations();
                spatial.refresh();
                toast.success(`${updated} cotas preenchidas do MDT`);
              }} variant="outline" size="sm">
                <Mountain className="h-4 w-4 mr-1" /> Preencher Cota (MDT)
              </Button>
            </div>
          </div>
        );

      // ═══════ S00: CONFIG (QEsg-style modal) ═══════
      case "s00":
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-amber-600" /> Configuração do Projeto
                </CardTitle>
                <CardDescription>
                  Configure layers, parâmetros hidráulicos, tubos padrão e opções de cálculo.
                  Configuração idêntica ao QEsg do QGIS.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => setConfigOpen(true)} size="lg" className="w-full">
                  <Settings className="h-4 w-4 mr-2" /> Abrir Configuração QEsg
                </Button>

                {/* Quick summary of current config */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="bg-muted/50 rounded p-2">
                    <span className="font-medium">Material:</span> {material} (n={manning})
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <span className="font-medium">DN mín:</span> {diamMinEsg} mm
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <span className="font-medium">y/D máx:</span> {laminaMax}
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <span className="font-medium">Norma:</span> {qesgConfig.norma}
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <span className="font-medium">V mín/máx:</span> {velMinEsg}/{velMaxEsg} m/s
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <span className="font-medium">τ mín:</span> {tensaoMin} Pa
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <span className="font-medium">Per capita:</span> {qpcLitrosDia} L/hab.dia
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <span className="font-medium">K1×K2:</span> {k1}×{k2}
                  </div>
                </div>

                {/* Quick inline controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center gap-1">
                        <Waves className="h-4 w-4 text-amber-600" /> Parâmetros Rápidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-3 pb-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Material</Label>
                          <Select value={material} onValueChange={handleMaterialChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PVC">PVC (n=0.013)</SelectItem>
                              <SelectItem value="Concreto">Concreto (n=0.015)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">Manning (n)</Label><Input type="number" step="0.001" value={manning} onChange={e => setManning(Number(e.target.value))} /></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Ponta Seca</Label>
                        <input type="checkbox" checked={pontaSecaEnabled} onChange={e => setPontaSecaEnabled(e.target.checked)} />
                        <span className="text-xs text-muted-foreground">Vazão mín 1.5 L/s</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center gap-1">
                        <Users className="h-4 w-4 text-amber-600" /> Vazão
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-3 pb-3">
                      <div>
                        <Label className="text-xs">Método</Label>
                        <Select value={metodoVazao} onValueChange={v => setMetodoVazao(v as "fixa" | "percapita")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixa">Vazão fixa (L/s)</SelectItem>
                            <SelectItem value="percapita">Per capita (Pop × qpc)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {metodoVazao === "fixa" ? (
                        <div><Label className="text-xs">Vazão (L/s)</Label><Input type="number" step="0.1" value={vazaoEsg} onChange={e => setVazaoEsg(Number(e.target.value))} /></div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-xs">K1</Label><Input type="number" step="0.1" value={k1} onChange={e => setK1(Number(e.target.value))} /></div>
                          <div><Label className="text-xs">K2</Label><Input type="number" step="0.1" value={k2} onChange={e => setK2(Number(e.target.value))} /></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Button variant="outline" onClick={() => { markDone("s00"); toast.success("Configuração aplicada"); }}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Aplicar Configuração Rápida
                </Button>

                {stepStatus.s00 === "done" && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" /> Configuração aplicada
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Config Dialog */}
            <QEsgConfigDialog
              open={configOpen}
              onOpenChange={setConfigOpen}
              config={qesgConfig}
              onConfigChange={handleConfigChange}
              availableLayers={availableLayers}
            />
          </div>
        );

      // ═══════ S01: VERIFICA CAMPOS (QEsg Button 01) ═══════
      case "s01": {
        // Check which standard QEsg fields exist vs. missing
        const checkFields = () => {
          const allRequiredEdge = QESG_EDGE_FIELDS.map(f => f.name);
          const existingEdgeFields = new Set<string>();

          // Check sewerEdgeAttrs for existing field mappings
          if (sewerEdgeAttrs.length > 0) {
            const sample = sewerEdgeAttrs[0];
            if (sample.dcId) existingEdgeFields.add("DC_ID");
            if (sample.idInicio) { existingEdgeFields.add("PVM"); existingEdgeFields.add("PVJ"); }
            if (sample.comprimento) existingEdgeFields.add("LENGTH");
            if (sample.cotaTerrenoM !== undefined) { existingEdgeFields.add("CTM"); existingEdgeFields.add("CTJ"); }
            if (sample.cotaColetorM !== undefined) { existingEdgeFields.add("CCM"); existingEdgeFields.add("CCJ"); }
            if (sample.diametro) existingEdgeFields.add("DIAMETER");
            if (sample.declividade !== undefined) existingEdgeFields.add("DECL");
            if (sample.manning) existingEdgeFields.add("MANNING");
            if (sample.material) existingEdgeFields.add("ETAPA");
            if (sample.contribuicaoLateral !== undefined) existingEdgeFields.add("CONTR_LADO");
            if (sample.pontaSeca !== undefined) existingEdgeFields.add("PONTA_SECA");
            if (sample.observacao !== undefined) existingEdgeFields.add("OBS");
          }

          // For segments coming from trechos
          if (sewerTrechos.length > 0 && sewerEdgeAttrs.length === 0) {
            existingEdgeFields.add("PVM");
            existingEdgeFields.add("PVJ");
            existingEdgeFields.add("LENGTH");
          }

          const missing = allRequiredEdge.filter(f => !existingEdgeFields.has(f));
          const present = allRequiredEdge.filter(f => existingEdgeFields.has(f));

          setVerificaCamposResult({ missing, present });

          if (missing.length === 0) {
            toast.success("Todos os campos QEsg já existem!");
            markDone("s01");
          } else {
            setShowCreateFieldsConfirm(true);
          }
        };

        const createAllFields = () => {
          let nodesCreated = 0;
          let edgesCreated = 0;

          if (sewerNodeAttrs.length === 0 && activePontos.length > 0) {
            const nodes: SewerNodeAttributes[] = activePontos.map(p => ({
              id: p.id,
              tipo: assignments.nodeTypes.get(p.id) || "pv",
              cotaTerreno: p.cota,
              cotaFundo: p.cota - 1.5,
              profundidade: 1.5,
              x: p.x,
              y: p.y,
              populacao: 0,
              vazaoConcentrada: 0,
              observacao: "",
            }));
            setSewerNodeAttrs(nodes);
            nodesCreated = nodes.length;
          }

          if (sewerEdgeAttrs.length === 0 && sewerTrechos.length > 0) {
            const edges: SewerEdgeAttributes[] = sewerTrechos.map((t, i) => ({
              key: `${t.idInicio}-${t.idFim}`,
              dcId: `C${String(i + 1).padStart(3, "0")}`,
              idInicio: t.idInicio,
              idFim: t.idFim,
              comprimento: t.comprimento,
              cotaTerrenoM: t.cotaInicio,
              cotaTerrenoJ: t.cotaFim,
              cotaColetorM: t.cotaInicio - 1.5,
              cotaColetorJ: t.cotaFim - 1.5,
              manning,
              diametro: t.diametroMm || 150,
              declividade: t.declividade,
              material: t.material || "PVC",
              contribuicaoLateral: 0,
              pontaSeca: 0,
              etapa: "1",
              observacao: "",
            }));
            setSewerEdgeAttrs(edges);
            edgesCreated = edges.length;
          } else if (sewerEdgeAttrs.length > 0) {
            edgesCreated = sewerEdgeAttrs.length;
          }

          const msg = `Campos criados: ${nodesCreated} nós, ${edgesCreated} trechos — todos os ${QESG_EDGE_FIELDS.length} campos QEsg disponíveis`;
          setStepMessage(prev => ({ ...prev, s01: msg }));
          toast.success(msg);
          setShowCreateFieldsConfirm(false);
          markDone("s01");
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableProperties className="h-5 w-5 text-amber-600" /> 01 — Verifica Campos
              </CardTitle>
              <CardDescription>
                Verifica se o layer de rede possui todos os {QESG_EDGE_FIELDS.length} campos padrão do QEsg.
                Se não existirem, pergunta se deseja criar automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={checkFields}>
                <TableProperties className="h-4 w-4 mr-1" /> Verificar Campos
              </Button>

              {/* Confirmation dialog */}
              {showCreateFieldsConfirm && verificaCamposResult && verificaCamposResult.missing.length > 0 && (
                <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                  <CardContent className="py-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle className="h-4 w-4" />
                      {verificaCamposResult.missing.length} campo(s) ausente(s). Deseja criar automaticamente?
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-1 text-xs">
                      {QESG_EDGE_FIELDS.map(f => {
                        const isMissing = verificaCamposResult!.missing.includes(f.name);
                        return (
                          <div
                            key={f.name}
                            className={`rounded px-1.5 py-0.5 font-mono ${
                              isMissing
                                ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                : "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                            }`}
                            title={f.description}
                          >
                            {isMissing ? "✗" : "✓"} {f.name}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={createAllFields} size="sm">
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Sim, criar campos
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowCreateFieldsConfirm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {stepMessage.s01 && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2">{stepMessage.s01}</div>
              )}
              <div className="flex gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">{sewerNodeAttrs.length} nós</Badge>
                <Badge variant="outline">{sewerEdgeAttrs.length} trechos</Badge>
                <Badge variant="outline">{QESG_EDGE_FIELDS.length} campos padrão</Badge>
              </div>

              {/* Fields reference */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Campos obrigatórios do QEsg ({QESG_EDGE_FIELDS.length})
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {QESG_EDGE_FIELDS.map(f => (
                    <div key={f.name} className="flex gap-2">
                      <span className="font-mono font-medium w-24">{f.name}</span>
                      <span className="text-muted-foreground">{f.description}</span>
                    </div>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>
        );
      }

      // ═══════ S02: NUMERAR REDE (QEsg Button 02) ═══════
      case "s02": {
        const doNumerarRede = () => {
          const nodes = sewerNodeAttrs.length > 0
            ? sewerNodeAttrs.map(n => ({ id: n.id, x: n.x, y: n.y, cotaTerreno: n.cotaTerreno, cotaFundo: n.cotaFundo }))
            : activePontos.map(p => ({ id: p.id, x: p.x, y: p.y, cotaTerreno: p.cota, cotaFundo: p.cota - 1.5 }));

          const edges = sewerEdgeAttrs.length > 0
            ? sewerEdgeAttrs.map(e => ({
                key: e.key, dcId: e.dcId, idInicio: e.idInicio, idFim: e.idFim,
                comprimento: e.comprimento, cotaTerrenoM: e.cotaTerrenoM, cotaTerrenoJ: e.cotaTerrenoJ,
                cotaColetorM: e.cotaColetorM, cotaColetorJ: e.cotaColetorJ,
                manning: e.manning, diametro: e.diametro, declividade: e.declividade,
              }))
            : sewerTrechos.map((t, i) => ({
                key: `${t.idInicio}-${t.idFim}`, dcId: `C${String(i + 1).padStart(3, "0")}`,
                idInicio: t.idInicio, idFim: t.idFim, comprimento: t.comprimento,
                cotaTerrenoM: t.cotaInicio, cotaTerrenoJ: t.cotaFim,
                cotaColetorM: t.cotaInicio - 1.5, cotaColetorJ: t.cotaFim - 1.5,
                manning, diametro: t.diametroMm, declividade: t.declividade,
              }));

          if (edges.length === 0) {
            toast.error("Nenhum trecho para numerar. Importe dados no Mapa primeiro.");
            return;
          }

          // Detect multivertex polylines (more than 2 vertices per edge)
          let multiVertexCount = 0;
          for (const t of sewerTrechos) {
            const dx = (t.xFim - t.xInicio);
            const dy = (t.yFim - t.yInicio);
            const straightDist = Math.sqrt(dx * dx + dy * dy);
            if (t.comprimento > 0 && straightDist > 0 && t.comprimento / straightDist > 1.05) {
              multiVertexCount++;
            }
          }
          if (multiVertexCount > 0) {
            toast.info(`${multiVertexCount} trecho(s) com múltiplos vértices detectado(s). Usando comprimento real.`);
          }

          let result: ReturnType<typeof numberSewerNetwork>;
          try {
            result = numberSewerNetwork(nodes, edges);
          } catch (err: any) {
            toast.error(err.message || "Erro ao numerar a rede. Verifique a topologia.");
            return;
          }

          // Build old→new ID mapping for nodes
          const nodeIdMap = new Map<string, string>();
          nodes.forEach((n, i) => {
            if (result.nodes[i] && result.nodes[i].id !== n.id) {
              nodeIdMap.set(n.id, result.nodes[i].id);
            }
          });

          // Update sewerEdgeAttrs with new dcId and remapped PVM/PVJ
          if (sewerEdgeAttrs.length > 0) {
            const updatedEdges = sewerEdgeAttrs.map((e, i) => ({
              ...e,
              dcId: result.edges[i]?.dcId ?? e.dcId,
              idInicio: result.edges[i]?.idInicio ?? e.idInicio,
              idFim: result.edges[i]?.idFim ?? e.idFim,
            }));
            setSewerEdgeAttrs(updatedEdges);
          }

          // Update sewerNodeAttrs with renamed IDs
          if (sewerNodeAttrs.length > 0) {
            const updatedNodes = sewerNodeAttrs.map(n => ({
              ...n,
              id: nodeIdMap.get(n.id) ?? n.id,
            }));
            setSewerNodeAttrs(updatedNodes);
          }

          // Also update trechos names to reflect numbering
          const updatedTrechos = activeTrechos.map((t, i) => ({
            ...t,
            nomeTrecho: result.edges[i]?.dcId ?? t.nomeTrecho,
            idInicio: nodeIdMap.get(t.idInicio) ?? t.idInicio,
            idFim: nodeIdMap.get(t.idFim) ?? t.idFim,
          }));
          handleGisTrechosChange(updatedTrechos);

          // BUG FIX: Also update gisPontos with renamed IDs so MDT and
          // subsequent steps can match nodes correctly
          if (nodeIdMap.size > 0) {
            const updatedPontos = activePontos.map(p => ({
              ...p,
              id: nodeIdMap.get(p.id) ?? p.id,
            }));
            handleGisPontosChange(updatedPontos);
          }

          const msg = `Rede numerada: ${result.edges.length} trechos, ${nodes.length} nós (PV-001...PV-${String(nodes.length).padStart(3, "0")})`;
          setStepMessage(prev => ({ ...prev, s02: msg }));
          toast.success(msg);
          markDone("s02");
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-amber-600" /> 02 — Numerar Rede
              </CardTitle>
              <CardDescription>
                Detecta topologia, ordena de montante a jusante e atribui DC_ID, PVM, PVJ, Coletor e Trecho
                seguindo o fluxo do QEsg original.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button onClick={doNumerarRede}>
                  <Hash className="h-4 w-4 mr-1" /> Numerar Rede
                </Button>
              </div>

              {/* Flow direction info */}
              <div className="bg-muted/50 rounded p-3 text-xs space-y-1">
                <p className="font-medium">Fluxo do processo:</p>
                <div className="flex items-center gap-1">
                  <span>Detectar topologia</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Ordenar montante→jusante</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Atribuir DC_ID</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Preencher PVM/PVJ</span>
                </div>
              </div>

              {stepMessage.s02 && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2">{stepMessage.s02}</div>
              )}
            </CardContent>
          </Card>
        );
      }

      // ═══════ S03: CRIA/ATUALIZA LAYER DE PVs (QEsg Button 03) ═══════
      case "s03": {
        const criarOuAtualizarNos = () => {
          // Collect all unique node IDs from edge endpoints
          const nodeIds = new Set<string>();
          for (const t of sewerTrechos) {
            nodeIds.add(t.idInicio);
            nodeIds.add(t.idFim);
          }
          // Also from sewerEdgeAttrs
          for (const e of sewerEdgeAttrs) {
            nodeIds.add(e.idInicio);
            nodeIds.add(e.idFim);
          }

          if (nodeIds.size === 0 && activePontos.length === 0) {
            toast.error("Nenhum dado de rede. Importe no Mapa primeiro.");
            return;
          }

          // Existing node map for update
          const existingMap = new Map(sewerNodeAttrs.map(n => [n.id, n]));
          let created = 0;
          let updated = 0;

          const nodes: SewerNodeAttributes[] = Array.from(nodeIds).map(id => {
            const existing = existingMap.get(id);
            const p = activePontos.find(pt => pt.id === id);

            if (existing) {
              // Update: refresh coordinates from points if available
              updated++;
              return {
                ...existing,
                x: p?.x ?? existing.x,
                y: p?.y ?? existing.y,
                cotaTerreno: p?.cota ?? existing.cotaTerreno,
              };
            }

            // Create new node
            created++;
            return {
              id,
              tipo: assignments.nodeTypes.get(id) || "pv",
              cotaTerreno: p?.cota ?? 0,
              cotaFundo: p ? p.cota - (qesgConfig.recobrimentoMinimo + 0.6) : 0,
              profundidade: qesgConfig.recobrimentoMinimo + 0.6,
              x: p?.x ?? 0,
              y: p?.y ?? 0,
              populacao: 0,
              vazaoConcentrada: 0,
              observacao: "",
            };
          });

          // Also add any isolated points
          for (const p of activePontos) {
            if (!nodeIds.has(p.id)) {
              const existing = existingMap.get(p.id);
              if (!existing) {
                created++;
                nodes.push({
                  id: p.id,
                  tipo: assignments.nodeTypes.get(p.id) || "pv",
                  cotaTerreno: p.cota,
                  cotaFundo: p.cota - (qesgConfig.recobrimentoMinimo + 0.6),
                  profundidade: qesgConfig.recobrimentoMinimo + 0.6,
                  x: p.x,
                  y: p.y,
                  populacao: 0,
                  vazaoConcentrada: 0,
                  observacao: "",
                });
              }
            }
          }

          setSewerNodeAttrs(nodes);

          // Update GIS points to match
          const newPontos = nodes.map(n => ({
            id: n.id,
            x: n.x,
            y: n.y,
            cota: n.cotaTerreno,
          }));
          handleGisPontosChange(newPontos);

          const action = sewerNodeAttrs.length > 0 ? "Atualizado" : "Criado";
          const msg = `${action} layer de PVs: ${created} criados, ${updated} atualizados (${nodes.length} total). Campo COTA_TN preenchido.`;
          setStepMessage(prev => ({ ...prev, s03: msg }));
          toast.success(msg);
          markDone("s03");
        };

        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-amber-600" /> 03 — Cria / Atualiza Layer de PVs
                </CardTitle>
                <CardDescription>
                  Cria automaticamente layer de pontos (Nós/PVs) nos endpoints dos trechos.
                  Gera campo COTA_TN. Se já existir, atualiza.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={criarOuAtualizarNos}>
                    <Layers className="h-4 w-4 mr-1" />
                    {sewerNodeAttrs.length > 0 ? "Atualizar Layer de PVs" : "Criar Layer de PVs"}
                  </Button>
                  {sewerNodeAttrs.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => {
                      setSewerNodeAttrs([]);
                      toast.info("Layer de nós removido. Clique em Criar para recriar.");
                    }}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Resetar Nós
                    </Button>
                  )}
                </div>

                {sewerNodeAttrs.length > 0 && (
                  <div className="border rounded-lg overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">ID</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">COTA_TN</TableHead>
                          <TableHead className="text-xs">Cota Fundo</TableHead>
                          <TableHead className="text-xs">Prof. (m)</TableHead>
                          <TableHead className="text-xs">X</TableHead>
                          <TableHead className="text-xs">Y</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sewerNodeAttrs.slice(0, 20).map(n => (
                          <TableRow key={n.id}>
                            <TableCell className="font-mono text-xs">{n.id}</TableCell>
                            <TableCell className="text-xs">{n.tipo.toUpperCase()}</TableCell>
                            <TableCell className="text-xs font-medium">{n.cotaTerreno.toFixed(2)}</TableCell>
                            <TableCell className="text-xs">{n.cotaFundo.toFixed(2)}</TableCell>
                            <TableCell className="text-xs">{n.profundidade.toFixed(2)}</TableCell>
                            <TableCell className="text-xs">{n.x.toFixed(1)}</TableCell>
                            <TableCell className="text-xs">{n.y.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {sewerNodeAttrs.length > 20 && (
                      <div className="text-xs text-center text-muted-foreground py-1">
                        ... e mais {sewerNodeAttrs.length - 20} nós
                      </div>
                    )}
                  </div>
                )}

                {stepMessage.s03 && (
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2">{stepMessage.s03}</div>
                )}

                <div className="flex gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline">{sewerNodeAttrs.length} nós</Badge>
                  <Badge variant="outline">{sewerTrechos.length} trechos</Badge>
                </div>
              </CardContent>
            </Card>

            <ElementTypeAssigner
              networkType="esgoto"
              pontos={activePontos}
              trechos={sewerTrechos}
              assignments={assignments}
              onAssignmentsChange={setAssignments}
            />
          </div>
        );
      }

      // ═══════ S04: ATUALIZA COTA TN VIA MDT (QEsg Button 04) ═══════
      case "s04": {
        // Import TIF directly without opening Map tab
        const handleDirectTifImport = async () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".tif,.tiff";
          input.onchange = async (ev) => {
            const file = (ev.target as HTMLInputElement).files?.[0];
            if (!file) return;
            setMdtProgress(10);
            try {
              const buffer = await file.arrayBuffer();
              const { parseGeoTIFF } = await import("@/engine/tifReader");
              const { setRasterGrid } = await import("@/engine/rasterStore");
              setMdtProgress(30);
              const result = await parseGeoTIFF(buffer, 10000, -9999, true);
              if (result.grid) {
                setRasterGrid(result.grid, {
                  width: result.width,
                  height: result.height,
                  noDataValue: result.noDataValue,
                });
                toast.success(`MDT carregado: ${result.width}×${result.height} pixels (${file.name})`);
              } else {
                toast.error("Erro: Raster sem dados de grid.");
              }
            } catch (err: any) {
              toast.error(`Erro ao carregar MDT: ${err.message}`);
            }
            setMdtProgress(null);
          };
          input.click();
        };

        // Use existing node cotas (from imported data) to fill edges
        const handleUsarCotasExistentes = () => {
          const nodes = sewerNodeAttrs.length > 0
            ? sewerNodeAttrs.map(n => ({ id: n.id, x: n.x, y: n.y, cotaTerreno: n.cotaTerreno, cotaFundo: n.cotaFundo }))
            : activePontos.map(p => ({ id: p.id, x: p.x, y: p.y, cotaTerreno: p.cota, cotaFundo: p.cota - 1.5 }));
          const validCotas = nodes.filter(n => n.cotaTerreno > 0);
          if (validCotas.length === 0) {
            toast.error("Nenhum nó com cota válida (> 0). Preencha as cotas manualmente na tabela de atributos.");
            return;
          }
          // Mark done since cotas already exist
          const msg = `${validCotas.length}/${nodes.length} nós já possuem cotas. Prossiga para S05 (Preenche Campos).`;
          setStepMessage(prev => ({ ...prev, s04: msg }));
          toast.success(msg);
          markDone("s04");
        };

        const doAtualizaCotaMDT = async () => {
          const raster = getRasterGrid();
          if (!raster) {
            toast.error("Nenhum raster MDT carregado. Use 'Importar TIF Direto' abaixo ou importe na aba Mapa.");
            return;
          }

          const allNodes = sewerNodeAttrs.length > 0 ? [...sewerNodeAttrs] : [];
          if (allNodes.length === 0 && activePontos.length > 0) {
            // Create temporary node list from points
            for (const p of activePontos) {
              allNodes.push({
                id: p.id,
                tipo: "pv",
                cotaTerreno: p.cota,
                cotaFundo: p.cota - 1.5,
                profundidade: 1.5,
                x: p.x,
                y: p.y,
                populacao: 0,
                vazaoConcentrada: 0,
                observacao: "",
              });
            }
          }

          if (allNodes.length === 0) {
            toast.error("Nenhum nó disponível. Execute o passo 03 (Criar PVs) primeiro.");
            return;
          }

          mdtCancelRef.current = false;
          setMdtProgress(0);

          const totalItems = allNodes.length + sewerEdgeAttrs.length + sewerTrechos.length;
          let processed = 0;
          let nodesUpdated = 0;
          let nodesSkipped = 0;

          // Process nodes in batches to keep UI responsive
          const updatedNodes = [...allNodes];
          const batchSize = 50;

          for (let i = 0; i < updatedNodes.length; i += batchSize) {
            if (mdtCancelRef.current) {
              toast.warning("Operação cancelada pelo usuário.");
              setMdtProgress(null);
              return;
            }

            const end = Math.min(i + batchSize, updatedNodes.length);
            for (let j = i; j < end; j++) {
              const node = updatedNodes[j];
              const elevation = sampleElevation(node.x, node.y);
              if (elevation !== null) {
                updatedNodes[j] = {
                  ...node,
                  cotaTerreno: Math.round(elevation * 100) / 100,
                  profundidade: Math.round((elevation - node.cotaFundo) * 100) / 100,
                };
                nodesUpdated++;
              } else {
                nodesSkipped++;
              }
              processed++;
            }

            setMdtProgress(Math.round((processed / totalItems) * 100));
            // Yield to UI
            await new Promise(resolve => setTimeout(resolve, 0));
          }

          setSewerNodeAttrs(updatedNodes);

          // Update CTM/CTJ on edges
          let edgesUpdated = 0;
          if (sewerEdgeAttrs.length > 0) {
            const nodeMap = new Map(updatedNodes.map(n => [n.id, n]));
            const updatedEdges = sewerEdgeAttrs.map(e => {
              const fromNode = nodeMap.get(e.idInicio);
              const toNode = nodeMap.get(e.idFim);
              processed++;
              if (fromNode || toNode) {
                edgesUpdated++;
                const ctm = fromNode?.cotaTerreno ?? e.cotaTerrenoM;
                const ctj = toNode?.cotaTerreno ?? e.cotaTerrenoJ;
                return {
                  ...e,
                  cotaTerrenoM: ctm,
                  cotaTerrenoJ: ctj,
                  declividade: e.comprimento > 0
                    ? Math.round(((e.cotaColetorM - e.cotaColetorJ) / e.comprimento) * 1e6) / 1e6
                    : e.declividade,
                };
              }
              return e;
            });
            setSewerEdgeAttrs(updatedEdges);
            setMdtProgress(Math.round((processed / totalItems) * 100));
          }

          // Update trechos CTM/CTJ
          if (sewerTrechos.length > 0) {
            const nodeMap = new Map(updatedNodes.map(n => [n.id, n]));
            const updatedTrechos = activeTrechos.map(t => {
              const fromNode = nodeMap.get(t.idInicio);
              const toNode = nodeMap.get(t.idFim);
              processed++;
              return {
                ...t,
                cotaInicio: fromNode?.cotaTerreno ?? t.cotaInicio,
                cotaFim: toNode?.cotaTerreno ?? t.cotaFim,
              };
            });
            handleGisTrechosChange(updatedTrechos);
          }

          // Also update SpatialCore
          const spatialResult = fillNodeElevations();
          if (spatialResult.updated > 0) fillEdgeElevations();
          spatial.refresh();

          // Update GIS points
          const newPontos = updatedNodes.map(n => ({
            id: n.id, x: n.x, y: n.y, cota: n.cotaTerreno,
          }));
          handleGisPontosChange(newPontos);

          setMdtProgress(100);

          if (nodesUpdated === 0 && nodesSkipped > 0) {
            // All nodes fell outside the raster — likely CRS mismatch
            const { getRasterExtent } = await import("@/engine/elevationExtractor");
            const extent = getRasterExtent();
            let diagnostic = "Nenhum nó dentro do raster MDT.";
            if (extent && allNodes.length > 0) {
              const sn = allNodes[0];
              diagnostic += ` Nó exemplo: X=${sn.x.toFixed(2)}, Y=${sn.y.toFixed(2)}.` +
                ` Raster: X=[${extent.minX.toFixed(0)}..${extent.maxX.toFixed(0)}], Y=[${extent.minY.toFixed(0)}..${extent.maxY.toFixed(0)}].` +
                ` Verifique se o CRS dos nós é compatível com o raster (ex: ambos em UTM ou ambos em lat/lng).`;
            }
            setStepMessage(prev => ({ ...prev, s04: diagnostic }));
            toast.error(diagnostic);
          } else {
            const msg = `MDT: ${nodesUpdated} nós atualizados, ${nodesSkipped} fora do raster, ${edgesUpdated} trechos CTM/CTJ atualizados`;
            setStepMessage(prev => ({ ...prev, s04: msg }));
            toast.success(msg);
            markDone("s04");
          }

          // Clear progress after 2s
          setTimeout(() => setMdtProgress(null), 2000);
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mountain className="h-5 w-5 text-amber-600" /> 04 — Atualiza Cota TN a partir de um MDT
              </CardTitle>
              <CardDescription>
                Amostra valores do raster MDT para cada nó (COTA_TN) e atualiza CTM/CTJ dos trechos.
                Usa coordenadas reprojetadas (mesmo CRS do raster).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button onClick={doAtualizaCotaMDT} disabled={mdtProgress !== null && mdtProgress < 100}>
                  <Mountain className="h-4 w-4 mr-1" /> Atualizar Cota TN via MDT
                </Button>
                {mdtProgress !== null && mdtProgress < 100 && (
                  <Button variant="destructive" size="sm" onClick={() => { mdtCancelRef.current = true; }}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                  </Button>
                )}
              </div>

              {/* Progress bar */}
              {mdtProgress !== null && (
                <div className="space-y-1">
                  <Progress value={mdtProgress} className="h-3" />
                  <div className="text-xs text-muted-foreground text-center">
                    {mdtProgress < 100 ? `Processando... ${mdtProgress}%` : "Concluído!"}
                  </div>
                </div>
              )}

              {/* Direct TIF import + manual fallback */}
              {!getRasterGrid() && (
                <div className="border border-amber-500/30 bg-amber-50 dark:bg-amber-950/10 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Nenhum MDT carregado. Opções:
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleDirectTifImport}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Importar TIF Direto
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleUsarCotasExistentes}>
                      <TableProperties className="h-3.5 w-3.5 mr-1" /> Usar Cotas Existentes
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setActiveStep("mapa")}>
                      <MapIcon className="h-3.5 w-3.5 mr-1" /> Ir para Mapa
                    </Button>
                  </div>
                </div>
              )}

              {/* Raster status */}
              <div className="flex items-center gap-2 text-xs">
                {getRasterGrid() ? (
                  <Badge className="bg-green-500">MDT carregado</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600">Nenhum MDT</Badge>
                )}
                <Badge variant="outline">{sewerNodeAttrs.length} nós</Badge>
                <Badge variant="outline">{sewerEdgeAttrs.length} trechos</Badge>
              </div>

              {stepMessage.s04 && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2">{stepMessage.s04}</div>
              )}
            </CardContent>
          </Card>
        );
      }

      // ═══════ S05: PREENCHE OS CAMPOS ═══════
      case "s05": {
        const doPreencherCamposS05 = () => {
          const nodes = sewerNodeAttrs.length > 0
            ? sewerNodeAttrs.map(n => ({ id: n.id, x: n.x, y: n.y, cotaTerreno: n.cotaTerreno, cotaFundo: n.cotaFundo }))
            : activePontos.map(p => ({ id: p.id, x: p.x, y: p.y, cotaTerreno: p.cota, cotaFundo: p.cota - 1.5 }));
          const edges = sewerEdgeAttrs.length > 0
            ? sewerEdgeAttrs.map(e => ({
                key: e.key, dcId: e.dcId, idInicio: e.idInicio, idFim: e.idFim,
                comprimento: e.comprimento, cotaTerrenoM: e.cotaTerrenoM, cotaTerrenoJ: e.cotaTerrenoJ,
                cotaColetorM: e.cotaColetorM, cotaColetorJ: e.cotaColetorJ,
                manning: e.manning, diametro: e.diametro, declividade: e.declividade,
              }))
            : sewerTrechos.map((t, i) => ({
                key: `${t.idInicio}-${t.idFim}`, dcId: `C${String(i + 1).padStart(3, "0")}`,
                idInicio: t.idInicio, idFim: t.idFim, comprimento: t.comprimento,
                cotaTerrenoM: t.cotaInicio, cotaTerrenoJ: t.cotaFim,
                cotaColetorM: t.cotaInicio - 1.5, cotaColetorJ: t.cotaFim - 1.5,
                manning, diametro: t.diametroMm, declividade: t.declividade,
              }));
          if (edges.length === 0) { toast.error("Nenhum trecho para preencher."); return; }
          const filledEdges = fillFieldsFromNodes(nodes, edges);
          if (sewerEdgeAttrs.length > 0) {
            const updatedEdges = sewerEdgeAttrs.map((e, i) => ({
              ...e,
              cotaTerrenoM: filledEdges[i]?.cotaTerrenoM ?? e.cotaTerrenoM,
              cotaTerrenoJ: filledEdges[i]?.cotaTerrenoJ ?? e.cotaTerrenoJ,
              cotaColetorM: filledEdges[i]?.cotaColetorM ?? e.cotaColetorM,
              cotaColetorJ: filledEdges[i]?.cotaColetorJ ?? e.cotaColetorJ,
              declividade: filledEdges[i]?.declividade ?? e.declividade,
              comprimento: e.comprimento > 0 ? e.comprimento : filledEdges[i]?.comprimento ?? 0,
            }));
            setSewerEdgeAttrs(updatedEdges);
          }
          const msg = `${filledEdges.length} trechos: LENGTH, CTM/CTJ, CCM/CCJ e DECL atualizados`;
          setStepMessage(prev => ({ ...prev, s05: msg }));
          toast.success(msg);
          markDone("s05");
        };
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableProperties className="h-5 w-5 text-amber-600" /> 05 — Preenche os Campos
              </CardTitle>
              <CardDescription>
                Calcula LENGTH (comprimento real), atualiza CTM/CTJ dos PVs, preenche campos nulos.
                Idêntico ao QEsg plugin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={doPreencherCamposS05}>
                <TableProperties className="h-4 w-4 mr-1" /> Preencher Campos
              </Button>
              {stepMessage.s05 && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2">{stepMessage.s05}</div>
              )}
              <div className="bg-muted/50 rounded p-3 text-xs space-y-1">
                <p className="font-medium">Campos preenchidos:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>LENGTH = comprimento real (geometry.length)</li>
                  <li>CTM / CTJ = Cota Terreno Montante/Jusante (dos PVs)</li>
                  <li>CCM / CCJ = Cota Coletor Montante/Jusante</li>
                  <li>DECL = (CCM - CCJ) / LENGTH</li>
                  <li>Valores nulos preenchidos com defaults</li>
                </ul>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">{sewerEdgeAttrs.length} trechos</Badge>
                <Badge variant="outline">{sewerNodeAttrs.length} nós</Badge>
              </div>
            </CardContent>
          </Card>
        );
      }

      // ═══════ S06: CALCULA VAZÃO ═══════
      case "s06":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Waves className="h-5 w-5 text-amber-600" /> 06 — Calcula Vazão (QEsg)
              </CardTitle>
              <CardDescription>Calcula e acumula vazões na rede por método fixo ou per capita.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Método</Label>
                <Select value={metodoVazao} onValueChange={v => setMetodoVazao(v as "fixa" | "percapita")}>
                  <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixa">Vazão fixa (L/s)</SelectItem>
                    <SelectItem value="percapita">Per capita (Pop × qpc)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {metodoVazao === "fixa" ? (
                <div><Label className="text-xs">Vazão (L/s)</Label><Input type="number" step="0.1" value={vazaoEsg} onChange={e => setVazaoEsg(Number(e.target.value))} className="w-[200px]" /></div>
              ) : (
                <>
                  <div><Label className="text-xs">Quota per capita (L/hab/dia)</Label><Input type="number" step="10" value={qpcLitrosDia} onChange={e => setQpcLitrosDia(Number(e.target.value))} className="w-[200px]" /></div>
                  <div className="grid grid-cols-2 gap-2 max-w-xs">
                    <div><Label className="text-xs">K1</Label><Input type="number" step="0.1" value={k1} onChange={e => setK1(Number(e.target.value))} /></div>
                    <div><Label className="text-xs">K2</Label><Input type="number" step="0.1" value={k2} onChange={e => setK2(Number(e.target.value))} /></div>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-xs text-center max-w-xs">
                    Q = Pop × {qpcLitrosDia} × {k1} × {k2} / 86400
                  </div>
                </>
              )}
              <Button onClick={() => {
                let inputs: SewerSegmentInput[];
                if (sewerEdgeAttrs.length > 0) {
                  inputs = sewerEdgeAttrs.map(e => ({
                    id: e.key, comprimento: e.comprimento,
                    cotaMontante: e.cotaColetorM, cotaJusante: e.cotaColetorJ,
                    vazaoLps: metodoVazao === "fixa" ? vazaoEsg : 0,
                    tipoTubo: e.material,
                  }));
                } else if (sewerTrechos.length > 0) {
                  inputs = sewerTrechos.map(t => ({
                    id: `${t.idInicio}-${t.idFim}`, comprimento: t.comprimento,
                    cotaMontante: t.cotaInicio, cotaJusante: t.cotaFim,
                    vazaoLps: vazaoEsg, tipoTubo: material,
                  }));
                } else {
                  toast.error("Nenhum trecho disponível.");
                  return;
                }

                if (metodoVazao === "percapita") {
                  const nodeFlows: SewerNodeInput[] = sewerNodeAttrs.length > 0
                    ? sewerNodeAttrs.map(n => ({
                        id: n.id,
                        vazaoLocal: calcPopulationFlow(n.populacao, qpcLitrosDia, k1, k2) + n.vazaoConcentrada,
                      }))
                    : activePontos.map(p => ({
                        id: p.id,
                        vazaoLocal: calcPopulationFlow(SEWER_DEFAULTS.defaultPopulacao, qpcLitrosDia, k1, k2),
                      }));
                  if (nodeFlows.length > 0) inputs = accumulateSewerFlow(inputs, nodeFlows);
                }

                // Ponta Seca: set minimum flow on edges marked as ponta seca
                if (pontaSecaEnabled && sewerEdgeAttrs.length > 0) {
                  const psMap = new Map(sewerEdgeAttrs.map(e => [e.key, e.pontaSeca]));
                  let psCount = 0;
                  inputs = inputs.map(inp => {
                    const psVal = psMap.get(inp.id);
                    if (psVal && psVal > 0) {
                      psCount++;
                      return { ...inp, vazaoLps: SEWER_DEFAULTS.defaultVazaoLps };
                    }
                    return inp;
                  });
                  if (psCount > 0) {
                    toast.info(`${psCount} trecho(s) de ponta seca com vazão mínima (${SEWER_DEFAULTS.defaultVazaoLps} L/s)`);
                  }
                }

                const msg = `Vazão calculada para ${inputs.length} trechos (${metodoVazao})`;
                setStepMessage(prev => ({ ...prev, s06: msg }));
                toast.success(msg);
                markDone("s06");
              }}>
                <Calculator className="h-4 w-4 mr-1" /> Calcular Vazão
              </Button>
              {stepMessage.s06 && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2">{stepMessage.s06}</div>
              )}
            </CardContent>
          </Card>
        );

      // ═══════ S07: DIMENSIONA ═══════
      case "s07":
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-amber-600" /> 07 — Dimensiona (NBR 9649)
                </CardTitle>
                <CardDescription className="text-xs">
                  τ = 10000·Rh·I | v_c = 6·√(g·Rh) | I_min = 0.0055·Q^(-0.47)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {sewerEdgeAttrs.length > 0 && (
                    <Badge variant="outline" className="text-amber-600">{sewerEdgeAttrs.length} trechos (atributos)</Badge>
                  )}
                  {sewerEdgeAttrs.length === 0 && sewerTrechos.length > 0 && (
                    <Badge variant="outline" className="text-amber-600">{sewerTrechos.length} trechos (GIS)</Badge>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button onClick={dimensionSewer} disabled={!canDimension}>
                    <Calculator className="h-4 w-4 mr-1" /> Dimensionar
                  </Button>
                  {sewerResults.length > 0 && (
                    <>
                      <Button variant="outline" onClick={applyDiameters}>
                        <Zap className="h-4 w-4 mr-1" /> Aplicar Diâmetros
                      </Button>
                      <Button variant="outline" onClick={exportCSV}>
                        <Download className="h-4 w-4 mr-1" /> CSV
                      </Button>
                    </>
                  )}
                </div>

                {sewerResumo && (
                  <div className="flex gap-3 text-sm">
                    <Badge variant="outline">{sewerResumo.total} trechos</Badge>
                    <Badge className="bg-green-500">{sewerResumo.atendem} OK</Badge>
                    {sewerResumo.total - sewerResumo.atendem > 0 && (
                      <Badge variant="destructive">{sewerResumo.total - sewerResumo.atendem} falha</Badge>
                    )}
                    <Badge variant="outline">{compliance}%</Badge>
                  </div>
                )}

                {sewerResults.length > 0 && (
                  <div className="border rounded-lg overflow-auto max-h-80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Trecho</TableHead>
                          <TableHead>DN (mm)</TableHead>
                          <TableHead>DN Calc</TableHead>
                          <TableHead>V (m/s)</TableHead>
                          <TableHead>V Crít</TableHead>
                          <TableHead>y/D</TableHead>
                          <TableHead>τ (Pa)</TableHead>
                          <TableHead>Decliv (%)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sewerResults.map(r => (
                          <TableRow key={r.id} className={!r.atendeNorma ? "bg-red-50 dark:bg-red-950/20" : ""}>
                            <TableCell className="font-mono text-xs">{r.id}</TableCell>
                            <TableCell className="font-semibold">{r.diametroMm}</TableCell>
                            <TableCell>{r.diametroCalculadoMm}</TableCell>
                            <TableCell>{r.velocidadeMs.toFixed(3)}</TableCell>
                            <TableCell>{r.velocidadeCriticaMs.toFixed(3)}</TableCell>
                            <TableCell>{r.laminaDagua.toFixed(3)}</TableCell>
                            <TableCell>{r.tensaoTrativa.toFixed(2)}</TableCell>
                            <TableCell>{(r.declividadeUsada * 100).toFixed(3)}</TableCell>
                            <TableCell>
                              {r.atendeNorma
                                ? <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                                : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falha</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {alertCount > 0 && (
                  <Card className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="py-3">
                      <div className="max-h-[150px] overflow-auto space-y-1">
                        {sewerResults.filter(r => !r.atendeNorma).map(r => (
                          <div key={r.id} className="text-xs text-yellow-700">
                            <strong>{r.id}:</strong> {r.observacoes.join("; ")}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!canDimension && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" /> Importe dados no "Mapa" ou preencha a "Rede".
                  </div>
                )}
              </CardContent>
            </Card>

            {sewerResults.length > 0 && activePontos.length > 0 && (
              <NetworkMapView<SewerSegmentResult>
                pontos={activePontos}
                trechos={sewerTrechos}
                results={sewerResults}
                okColor={SEWER_DEFAULTS.mapOkColor}
                failColor={SEWER_DEFAULTS.mapFailColor}
                markerColor={SEWER_DEFAULTS.markerColor}
                markerFillColor={SEWER_DEFAULTS.markerFillColor}
                title="Mapa — Rede Dimensionada"
                description="Verde = atende NBR 9649 | Vermelho = falha"
                iconColorClass="text-amber-600"
                formatTooltip={formatSewerTooltip}
                formatPopup={formatSewerPopup}
              />
            )}
          </div>
        );

      // ═══════ S08: RECOBRIMENTO MÍNIMO ═══════
      case "s08": {
        const doCheckCover = () => {
          const nodes: SewerNetworkNode[] = sewerNodeAttrs.length > 0
            ? sewerNodeAttrs.map(n => ({ id: n.id, x: n.x, y: n.y, cotaTerreno: n.cotaTerreno, cotaFundo: n.cotaFundo }))
            : activePontos.map(p => ({ id: p.id, x: p.x, y: p.y, cotaTerreno: p.cota, cotaFundo: p.cota - 1.5 }));
          // BUG FIX: Build edges from sewerEdgeAttrs or fall back to sewerTrechos + results
          let edges: SewerNetworkEdge[];
          if (sewerEdgeAttrs.length > 0) {
            edges = sewerEdgeAttrs.map(e => ({
              key: e.key, dcId: e.dcId, idInicio: e.idInicio, idFim: e.idFim,
              comprimento: e.comprimento, cotaTerrenoM: e.cotaTerrenoM, cotaTerrenoJ: e.cotaTerrenoJ,
              cotaColetorM: e.cotaColetorM, cotaColetorJ: e.cotaColetorJ,
              manning: e.manning, diametro: e.diametro, declividade: e.declividade,
            }));
          } else if (sewerTrechos.length > 0 && sewerResults.length > 0) {
            const resultMap = new Map(sewerResults.map(r => [r.id, r]));
            edges = sewerTrechos.map(t => {
              const key = `${t.idInicio}-${t.idFim}`;
              const r = resultMap.get(key);
              const dn = r?.diametroMm ?? t.diametroMm ?? 150;
              const dnM = dn / 1000;
              return {
                key,
                dcId: t.nomeTrecho || key,
                idInicio: t.idInicio,
                idFim: t.idFim,
                comprimento: t.comprimento,
                cotaTerrenoM: t.cotaInicio,
                cotaTerrenoJ: t.cotaFim,
                cotaColetorM: t.cotaInicio - 1.5,
                cotaColetorJ: t.cotaFim - (1.5 + t.comprimento * (t.declividade || 0.005)),
                manning,
                diametro: dn,
                declividade: t.declividade,
              };
            });
          } else {
            edges = [];
          }
          if (edges.length === 0 || sewerResults.length === 0) {
            toast.error("Execute o dimensionamento (07) primeiro.");
            return;
          }
          const alerts = findMinCoverPoints(nodes, edges, sewerResults, qesgConfig.recobrimentoMinimo);
          setMinCoverAlerts(alerts);
          if (alerts.length === 0) {
            toast.success("Nenhum ponto com recobrimento menor que o mínimo.");
          } else {
            toast.warning(`${alerts.length} ponto(s) com recobrimento insuficiente.`);
          }
          markDone("s08");
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" /> 08 — Recobrimento Mínimo
              </CardTitle>
              <CardDescription>
                Identifica trechos/pontos onde o recobrimento (CTN - CColetor - DN) é menor que o mínimo configurado ({qesgConfig.recobrimentoMinimo} m).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={doCheckCover}>
                <ShieldAlert className="h-4 w-4 mr-1" /> Verificar Recobrimento
              </Button>

              {minCoverAlerts.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">ID</TableHead>
                        <TableHead className="text-xs">Trecho</TableHead>
                        <TableHead className="text-xs">CTN</TableHead>
                        <TableHead className="text-xs">CColetor</TableHead>
                        <TableHead className="text-xs">Recobr. (m)</TableHead>
                        <TableHead className="text-xs">Déficit (m)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {minCoverAlerts.map(a => (
                        <TableRow key={a.id} className="bg-red-50 dark:bg-red-950/20">
                          <TableCell className="font-mono text-xs">{a.id}</TableCell>
                          <TableCell className="text-xs">{a.edgeKey}</TableCell>
                          <TableCell className="text-xs">{a.cotaTerreno.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{a.cotaColetor.toFixed(2)}</TableCell>
                          <TableCell className="text-xs font-semibold text-red-600">{a.recobrimento.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-red-600">{a.deficit.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {minCoverAlerts.length === 0 && stepStatus.s08 === "done" && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" /> Todos os pontos atendem o recobrimento mínimo.
                </div>
              )}

              <div className="flex gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">Recobr. mín: {qesgConfig.recobrimentoMinimo} m</Badge>
                <Badge variant={minCoverAlerts.length > 0 ? "destructive" : "outline"}>
                  {minCoverAlerts.length} alertas
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      }

      // ═══════ PERFIL LONGITUDINAL (Desenha perfil) ═══════
      case "perfil":
        return (
          <div className="space-y-4">
            <LongitudinalProfile
              sewerNodes={profileNodes}
              sewerEdges={profileEdges}
              results={sewerResults.length > 0 ? sewerResults : undefined}
            />
          </div>
        );

      // ═══════ RESUMO DE EXTENSÕES POR DIÂMETRO ═══════
      case "resumo": {
        const doResumo = () => {
          const edges: SewerNetworkEdge[] = sewerEdgeAttrs.length > 0
            ? sewerEdgeAttrs.map(e => ({
                key: e.key, dcId: e.dcId, idInicio: e.idInicio, idFim: e.idFim,
                comprimento: e.comprimento, cotaTerrenoM: e.cotaTerrenoM, cotaTerrenoJ: e.cotaTerrenoJ,
                cotaColetorM: e.cotaColetorM, cotaColetorJ: e.cotaColetorJ,
                manning: e.manning, diametro: e.diametro, declividade: e.declividade,
              }))
            : [];
          if (edges.length === 0 || sewerResults.length === 0) {
            toast.error("Execute o dimensionamento (07) primeiro.");
            return;
          }
          const summary = summarizeByDiameter(edges, sewerResults);
          setDiameterSummary(summary);
        };

        const exportResumoCSV = () => {
          if (diameterSummary.length === 0) return;
          let csv = "Diâmetro (mm);Quantidade;Extensão Total (m);Extensão Média (m)\n";
          for (const r of diameterSummary) {
            csv += `${r.diametro};${r.quantidade};${r.extensaoTotal};${r.extensaoMedia}\n`;
          }
          const totalExt = diameterSummary.reduce((s, r) => s + r.extensaoTotal, 0);
          csv += `;TOTAL;${totalExt.toFixed(2)};\n`;
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url;
          a.download = "resumo_diametros.csv"; a.click();
          URL.revokeObjectURL(url);
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-600" /> Resumo de Extensões por Diâmetro
              </CardTitle>
              <CardDescription>Agrupa trechos por DIAMETER e soma LENGTH.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={doResumo}>
                  <BarChart3 className="h-4 w-4 mr-1" /> Gerar Resumo
                </Button>
                {diameterSummary.length > 0 && (
                  <Button variant="outline" onClick={exportResumoCSV} size="sm">
                    <Download className="h-4 w-4 mr-1" /> Exportar CSV
                  </Button>
                )}
              </div>

              {diameterSummary.length > 0 && (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>DN (mm)</TableHead>
                        <TableHead>Qtde</TableHead>
                        <TableHead>Extensão Total (m)</TableHead>
                        <TableHead>Ext. Média (m)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diameterSummary.map(r => (
                        <TableRow key={r.diametro}>
                          <TableCell className="font-semibold">{r.diametro}</TableCell>
                          <TableCell>{r.quantidade}</TableCell>
                          <TableCell>{r.extensaoTotal.toFixed(2)}</TableCell>
                          <TableCell>{r.extensaoMedia.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell>{diameterSummary.reduce((s, r) => s + r.quantidade, 0)}</TableCell>
                        <TableCell>{diameterSummary.reduce((s, r) => s + r.extensaoTotal, 0).toFixed(2)}</TableCell>
                        <TableCell>—</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      }

      // ═══════ ATUALIZA NOME DOS PVS ═══════
      case "pvnames": {
        const doAtualizaPVNames = () => {
          if (sewerNodeAttrs.length === 0) {
            toast.error("Execute 'Cria PVs' (03) primeiro.");
            return;
          }
          if (sewerEdgeAttrs.length === 0) {
            toast.error("Execute 'Numerar Rede' (02) primeiro.");
            return;
          }

          // Build node name map from node IDs
          const nodeMap = new Map(sewerNodeAttrs.map(n => [n.id, n]));
          let updated = 0;

          const updatedEdges = sewerEdgeAttrs.map(e => {
            const fromNode = nodeMap.get(e.idInicio);
            const toNode = nodeMap.get(e.idFim);
            if (fromNode || toNode) updated++;
            return {
              ...e,
              idInicio: fromNode?.id ?? e.idInicio,
              idFim: toNode?.id ?? e.idFim,
            };
          });
          setSewerEdgeAttrs(updatedEdges);
          toast.success(`PVM/PVJ atualizado em ${updated} trechos a partir dos nós.`);
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-amber-600" /> Atualiza Nome dos PVs
              </CardTitle>
              <CardDescription>
                Sincroniza PVM/PVJ dos trechos com os IDs do layer de nós, conforme regra do plugin QEsg.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={doAtualizaPVNames}>
                <Tag className="h-4 w-4 mr-1" /> Atualizar Nomes PVs
              </Button>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">{sewerNodeAttrs.length} nós</Badge>
                <Badge variant="outline">{sewerEdgeAttrs.length} trechos</Badge>
              </div>
            </CardContent>
          </Card>
        );
      }

      // ═══════ APAGA NOME DOS COLETORES ═══════
      case "clearnames": {
        const doClearNames = () => {
          if (sewerEdgeAttrs.length === 0) {
            toast.error("Nenhum trecho para limpar.");
            return;
          }
          if (!window.confirm("Tem certeza? Isso apagará DC_ID, Coletor e Trecho de todos os trechos. PVM/PVJ serão mantidos.")) return;
          const updatedEdges = sewerEdgeAttrs.map((e, i) => ({
            ...e,
            dcId: "",
          }));
          setSewerEdgeAttrs(updatedEdges);
          toast.success(`DC_ID limpo em ${updatedEdges.length} trechos. Execute 'Numerar Rede' para renumerar.`);
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eraser className="h-5 w-5 text-amber-600" /> Apaga Nome dos Coletores
              </CardTitle>
              <CardDescription>
                Limpa o campo DC_ID (Coletor/Trecho) de todos os trechos. Útil para renumerar a rede do zero.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="destructive" onClick={doClearNames}>
                <Eraser className="h-4 w-4 mr-1" /> Limpar Nomes
              </Button>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">{sewerEdgeAttrs.length} trechos</Badge>
              </div>
            </CardContent>
          </Card>
        );
      }

      // ═══════ IMPÕE VAZÃO NA SELEÇÃO ═══════
      case "impoe": {
        const toggleTrechoSelection = (key: string) => {
          setSelectedTrechosForImpoe(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
          });
        };

        const doImpoeVazao = () => {
          if (selectedTrechosForImpoe.size === 0) {
            toast.error("Selecione ao menos um trecho na tabela abaixo.");
            return;
          }
          const updatedEdges = sewerEdgeAttrs.map(e => {
            if (selectedTrechosForImpoe.has(e.key)) {
              return { ...e, contribuicaoLateral: impoeVazaoValue };
            }
            return e;
          });
          setSewerEdgeAttrs(updatedEdges);
          toast.success(`Vazão ${impoeVazaoValue} L/s imposta em ${selectedTrechosForImpoe.size} trecho(s).`);
          setSelectedTrechosForImpoe(new Set());
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-600" /> Impõe a Vazão na Seleção
              </CardTitle>
              <CardDescription>
                Selecione trechos e defina um valor de vazão manual para gravar nos campos correspondentes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-end">
                <div>
                  <Label className="text-xs">Vazão (L/s)</Label>
                  <Input type="number" step="0.1" value={impoeVazaoValue} onChange={e => setImpoeVazaoValue(Number(e.target.value))} className="w-32" />
                </div>
                <Button onClick={doImpoeVazao} disabled={selectedTrechosForImpoe.size === 0}>
                  <Target className="h-4 w-4 mr-1" /> Impor Vazão ({selectedTrechosForImpoe.size} selecionados)
                </Button>
              </div>

              {sewerEdgeAttrs.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="text-xs">DC_ID</TableHead>
                        <TableHead className="text-xs">PVM</TableHead>
                        <TableHead className="text-xs">PVJ</TableHead>
                        <TableHead className="text-xs">Contr. Lateral</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sewerEdgeAttrs.map(e => (
                        <TableRow key={e.key} className={selectedTrechosForImpoe.has(e.key) ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                          <TableCell>
                            <input type="checkbox" checked={selectedTrechosForImpoe.has(e.key)} onChange={() => toggleTrechoSelection(e.key)} />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{e.dcId}</TableCell>
                          <TableCell className="text-xs">{e.idInicio}</TableCell>
                          <TableCell className="text-xs">{e.idFim}</TableCell>
                          <TableCell className="text-xs">{e.contribuicaoLateral}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      }

      // ═══════ RELATÓRIO ═══════
      case "relatorio": {
        const doExportReport = (tipo: "dados" | "planilha") => {
          if (tipo === "dados") {
            const report = generateProjectReport(qesgConfig, sewerNodeAttrs.length, sewerEdgeAttrs.length);
            const blob = new Blob([report], { type: "text/plain;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url;
            a.download = "dados_projeto_qesg.txt"; a.click();
            URL.revokeObjectURL(url);
            toast.success("Relatório 'Dados do Projeto' exportado.");
          } else {
            const nodes: SewerNetworkNode[] = sewerNodeAttrs.map(n => ({ id: n.id, x: n.x, y: n.y, cotaTerreno: n.cotaTerreno, cotaFundo: n.cotaFundo }));
            const edges: SewerNetworkEdge[] = sewerEdgeAttrs.map(e => ({
              key: e.key, dcId: e.dcId, idInicio: e.idInicio, idFim: e.idFim,
              comprimento: e.comprimento, cotaTerrenoM: e.cotaTerrenoM, cotaTerrenoJ: e.cotaTerrenoJ,
              cotaColetorM: e.cotaColetorM, cotaColetorJ: e.cotaColetorJ,
              manning: e.manning, diametro: e.diametro, declividade: e.declividade,
            }));
            const csv = generateResultsCSV(edges, nodes, sewerResults);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url;
            a.download = "planilha_resultados_qesg.csv"; a.click();
            URL.revokeObjectURL(url);
            toast.success("Planilha de resultados exportada (CSV).");
          }
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-600" /> Relatório
              </CardTitle>
              <CardDescription>Gere relatórios do projeto e planilha de resultados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button onClick={() => doExportReport("dados")} variant="outline" className="justify-start h-auto py-3">
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Dados do Projeto
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">Resumo da configuração + estatísticas</span>
                  </div>
                </Button>
                <Button onClick={() => doExportReport("planilha")} variant="outline" className="justify-start h-auto py-3">
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" /> Planilha de Resultados
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">Exportar tabela de trechos e nós (CSV)</span>
                  </div>
                </Button>
              </div>

              {/* Preview report */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Pré-visualizar Dados do Projeto
                </summary>
                <pre className="mt-2 bg-muted p-3 rounded overflow-auto max-h-60 text-xs font-mono">
                  {generateProjectReport(qesgConfig, sewerNodeAttrs.length, sewerEdgeAttrs.length)}
                </pre>
              </details>
            </CardContent>
          </Card>
        );
      }

      // ═══════ DXF IMPORTA (Cad ou Sancad) ═══════
      case "dxfimp": {
        const handleDxfImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const result = parseDxfText(text);

          if (result.lines.length === 0 && result.points.length === 0) {
            toast.error("Nenhuma entidade LINE/POLYLINE/POINT encontrada no DXF.");
            return;
          }

          // Convert lines to trechos
          const newPontos: PontoTopografico[] = [];
          const pointMap = new Map<string, string>();
          let pidx = 0;

          const getPointId = (x: number, y: number, z: number): string => {
            const key = `${Math.round(x * 100)}_${Math.round(y * 100)}`;
            if (pointMap.has(key)) return pointMap.get(key)!;
            const id = `DXF-${++pidx}`;
            pointMap.set(key, id);
            newPontos.push({ id, x, y, cota: z });
            return id;
          };

          // From imported points
          for (const p of result.points) {
            getPointId(p.x, p.y, p.z);
          }

          // From lines
          const newTrechos: Trecho[] = [];
          for (const l of result.lines) {
            const idFrom = getPointId(l.x1, l.y1, l.z1);
            const idTo = getPointId(l.x2, l.y2, l.z2);
            const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
            const comp = Math.sqrt(dx * dx + dy * dy);
            const decl = comp > 0 ? (l.z1 - l.z2) / comp : 0;
            newTrechos.push({
              idInicio: idFrom, idFim: idTo, comprimento: Math.round(comp * 100) / 100,
              declividade: decl, tipoRede: classifyNetworkType(decl), diametroMm: 150, material: "PVC",
              xInicio: l.x1, yInicio: l.y1, cotaInicio: l.z1,
              xFim: l.x2, yFim: l.y2, cotaFim: l.z2,
              tipoRedeManual: "esgoto",
            });
          }

          handleGisPontosChange(newPontos);
          handleGisTrechosChange(newTrechos);
          toast.success(`DXF importado: ${newPontos.length} pontos, ${newTrechos.length} trechos (layers: ${new Set(result.lines.map(l => l.layer)).size})`);

          // Reset file input
          if (dxfFileRef.current) dxfFileRef.current.value = "";
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileInput className="h-5 w-5 text-amber-600" /> DXF Importa (Cad ou Sancad)
              </CardTitle>
              <CardDescription>
                Lê arquivo DXF e converte entidades LINE/POLYLINE para layer de Rede. Suporta formato CAD e Sancad.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center">
                <input type="file" accept=".dxf" ref={dxfFileRef} onChange={handleDxfImport} className="text-sm" />
              </div>
              <div className="bg-muted/50 rounded p-3 text-xs space-y-1">
                <p className="font-medium">Formatos suportados:</p>
                <ul className="list-disc pl-4">
                  <li>DXF padrão (LINE, LWPOLYLINE, POINT)</li>
                  <li>Sancad (layers SANC_REDE com XDATA)</li>
                  <li>Coordenadas 3D (X, Y, Z) são preservadas</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        );
      }

      // ═══════ DXF EXPORTA (Cad ou Sancad) ═══════
      case "dxfexp": {
        const doExportDXF = () => {
          const nodes: SewerNetworkNode[] = sewerNodeAttrs.map(n => ({ id: n.id, x: n.x, y: n.y, cotaTerreno: n.cotaTerreno, cotaFundo: n.cotaFundo }));
          const edges: SewerNetworkEdge[] = sewerEdgeAttrs.map(e => ({
            key: e.key, dcId: e.dcId, idInicio: e.idInicio, idFim: e.idFim,
            comprimento: e.comprimento, cotaTerrenoM: e.cotaTerrenoM, cotaTerrenoJ: e.cotaTerrenoJ,
            cotaColetorM: e.cotaColetorM, cotaColetorJ: e.cotaColetorJ,
            manning: e.manning, diametro: e.diametro, declividade: e.declividade,
          }));
          if (edges.length === 0) {
            // Fallback to simple DXF export
            import("@/lib/dxfExporter").then(({ downloadDXF }) => {
              downloadDXF(activePontos, sewerTrechos, "qesg_rede.dxf");
              toast.success("DXF exportado (formato simples).");
            });
            return;
          }
          const dxfContent = exportSewerDxf(nodes, edges, sewerResults);
          const blob = new Blob([dxfContent], { type: "application/dxf" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url;
          a.download = "qesg_rede_dimensionada.dxf"; a.click();
          URL.revokeObjectURL(url);
          toast.success("DXF exportado com layers por diâmetro.");
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileOutput className="h-5 w-5 text-amber-600" /> DXF Exporta (Cad ou Sancad)
              </CardTitle>
              <CardDescription>
                Exporta a rede dimensionada em DXF com layers por diâmetro, PVs, e simbologia básica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={doExportDXF}>
                <Download className="h-4 w-4 mr-1" /> Exportar DXF
              </Button>
              <div className="bg-muted/50 rounded p-3 text-xs space-y-1">
                <p className="font-medium">Conteúdo do DXF:</p>
                <ul className="list-disc pl-4">
                  <li>Layer DN150, DN200, ... (por diâmetro)</li>
                  <li>Layer PVs (círculos + texto)</li>
                  <li>Labels DC_ID e DN nos trechos</li>
                  <li>Coordenadas 3D (com cota do coletor)</li>
                </ul>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">{sewerEdgeAttrs.length} trechos</Badge>
                <Badge variant="outline">{sewerNodeAttrs.length} nós</Badge>
                <Badge variant="outline">{sewerResults.length} resultados</Badge>
              </div>
            </CardContent>
          </Card>
        );
      }

      // ═══════ AUTODESK CIVIL 3D (LandXML) ═══════
      case "c3d": {
        const handleXMLImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const result = parseLandXML(text);

          if (result.pipes.length === 0 && result.structures.length === 0) {
            toast.error("Nenhum Pipe/Structure encontrado no XML.");
            return;
          }

          // Convert structures to nodes
          const newPontos = result.structures.map(s => ({
            id: s.name, x: s.x, y: s.y, cota: s.rimElevation,
          }));

          // Convert pipes to trechos
          const structMap = new Map(result.structures.map(s => [s.name, s]));
          const newTrechos: Trecho[] = result.pipes.map(p => {
            const from = structMap.get(p.startStructure);
            const to = structMap.get(p.endStructure);
            return {
              idInicio: p.startStructure, idFim: p.endStructure,
              comprimento: p.length || 0,
              declividade: p.length > 0 ? (p.invertStart - p.invertEnd) / p.length : 0,
              tipoRede: "Esgoto por Gravidade" as const,
              diametroMm: p.diameter, material: p.material,
              xInicio: from?.x || 0, yInicio: from?.y || 0, cotaInicio: from?.rimElevation || 0,
              xFim: to?.x || 0, yFim: to?.y || 0, cotaFim: to?.rimElevation || 0,
              tipoRedeManual: "esgoto" as const,
            };
          });

          handleGisPontosChange(newPontos);
          handleGisTrechosChange(newTrechos);
          toast.success(`LandXML importado: ${newPontos.length} estruturas, ${newTrechos.length} tubos`);
          if (xmlFileRef.current) xmlFileRef.current.value = "";
        };

        const doExportXML = () => {
          const nodes: SewerNetworkNode[] = sewerNodeAttrs.map(n => ({ id: n.id, x: n.x, y: n.y, cotaTerreno: n.cotaTerreno, cotaFundo: n.cotaFundo }));
          const edges: SewerNetworkEdge[] = sewerEdgeAttrs.map(e => ({
            key: e.key, dcId: e.dcId, idInicio: e.idInicio, idFim: e.idFim,
            comprimento: e.comprimento, cotaTerrenoM: e.cotaTerrenoM, cotaTerrenoJ: e.cotaTerrenoJ,
            cotaColetorM: e.cotaColetorM, cotaColetorJ: e.cotaColetorJ,
            manning: e.manning, diametro: e.diametro, declividade: e.declividade,
          }));
          const xml = exportLandXML(nodes, edges, sewerResults);
          const blob = new Blob([xml], { type: "application/xml" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url;
          a.download = "qesg_rede.xml"; a.click();
          URL.revokeObjectURL(url);
          toast.success("LandXML exportado.");
        };

        const doPreparaC3D = () => {
          // Validate data completeness for C3D export
          const issues: string[] = [];
          if (sewerNodeAttrs.length === 0) issues.push("Sem nós (execute 03 Cria PVs)");
          if (sewerEdgeAttrs.length === 0) issues.push("Sem trechos (execute 01 Verifica Campos)");
          if (sewerResults.length === 0) issues.push("Sem resultados (execute 07 Dimensiona)");
          const nodesWithoutCota = sewerNodeAttrs.filter(n => !n.cotaTerreno || n.cotaTerreno === 0);
          if (nodesWithoutCota.length > 0) issues.push(`${nodesWithoutCota.length} nós sem COTA_TN`);
          const edgesWithoutDiam = sewerEdgeAttrs.filter(e => !e.diametro || e.diametro === 0);
          if (edgesWithoutDiam.length > 0) issues.push(`${edgesWithoutDiam.length} trechos sem diâmetro`);

          if (issues.length === 0) {
            toast.success("Dados prontos para Civil 3D. Exporte usando 'Exporta XML'.");
          } else {
            toast.warning(`Pendências: ${issues.join("; ")}`);
          }
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-amber-600" /> Autodesk Civil 3D (LandXML)
              </CardTitle>
              <CardDescription>Importa/Exporta redes no formato LandXML para Autodesk Civil 3D.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button onClick={doPreparaC3D} variant="outline" className="justify-start h-auto py-3">
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" /> Prepara para C3D
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">Valida dados</span>
                  </div>
                </Button>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Importa XML</Label>
                  <input type="file" accept=".xml,.landxml" ref={xmlFileRef} onChange={handleXMLImport} className="text-xs" />
                </div>
                <Button onClick={doExportXML} variant="outline" className="justify-start h-auto py-3">
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4" /> Exporta XML
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">LandXML (Pipes+Structures)</span>
                  </div>
                </Button>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">{sewerNodeAttrs.length} nós</Badge>
                <Badge variant="outline">{sewerEdgeAttrs.length} trechos</Badge>
              </div>
            </CardContent>
          </Card>
        );
      }

      // ═══════ AJUDA ═══════
      case "ajuda":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-600" /> Ajuda — QEsg Web
              </CardTitle>
              <CardDescription>
                Fluxo sequencial de dimensionamento de rede coletora de esgoto sanitário, baseado no plugin QEsg do QGIS.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded p-4 text-sm space-y-3">
                <h4 className="font-semibold">Sequência obrigatória (00 → 08):</h4>
                <ol className="list-decimal pl-5 space-y-2">
                  <li><strong>00 Configurações:</strong> Selecionar layers, definir parâmetros (pop, per capita, K1, K2, material, Manning, DN mín, recobr. mín).</li>
                  <li><strong>01 Verifica Campos:</strong> Verificar se todos os campos padrão QEsg existem. Se não, criar automaticamente.</li>
                  <li><strong>02 Numerar Rede:</strong> Detectar topologia montante→jusante, atribuir DC_ID, PVM, PVJ para cada trecho e coletor.</li>
                  <li><strong>03 Cria PVs:</strong> Criar layer de pontos (PVs) nos endpoints dos trechos com COTA_TN.</li>
                  <li><strong>04 Cota TN (MDT):</strong> Amostrar raster MDT para preencher COTA_TN em massa e atualizar CTM/CTJ.</li>
                  <li><strong>05 Preenche Campos:</strong> Preencher LENGTH, CTM/CTJ, CCM/CCJ, DECL e campos nulos com defaults.</li>
                  <li><strong>06 Calcula Vazão:</strong> Calcular vazão acumulada por coletor (pop × per capita × K1 × K2 / 86400 + infiltração).</li>
                  <li><strong>07 Dimensiona:</strong> Manning (NBR 9649): DN, velocidade, tensão trativa, lâmina, declividade.</li>
                  <li><strong>08 Recobrimento:</strong> Verificar pontos com recobrimento menor que o mínimo.</li>
                </ol>

                <h4 className="font-semibold mt-4">Ferramentas adicionais:</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Perfil:</strong> Perfil longitudinal interativo por coletor.</li>
                  <li><strong>Resumo DN:</strong> Resumo de extensões por diâmetro.</li>
                  <li><strong>Nomes PVs:</strong> Sincronizar nomes PVM/PVJ com layer de nós.</li>
                  <li><strong>Apaga Nomes:</strong> Limpar DC_ID para renumerar.</li>
                  <li><strong>Impõe Vazão:</strong> Definir vazão manual em trechos selecionados.</li>
                  <li><strong>Relatório:</strong> Exportar dados do projeto e planilha de resultados (CSV).</li>
                  <li><strong>DXF Import:</strong> Importar rede de arquivo DXF (CAD/Sancad).</li>
                  <li><strong>DXF Export:</strong> Exportar rede dimensionada em DXF por diâmetro.</li>
                  <li><strong>Civil 3D:</strong> Importar/Exportar LandXML (Pipes + Structures).</li>
                </ul>

                <h4 className="font-semibold mt-4">Fórmulas (NBR 9649 / QEsg):</h4>
                <div className="font-mono text-xs space-y-0.5">
                  <p>D = [n·Q / (√I·(A/D²)·(Rh/D)^(2/3))]^(3/8) × 1000</p>
                  <p>τ = 10000 · Rh · I (Pa)</p>
                  <p>v_c = 6 · √(g · Rh)</p>
                  <p>I_min = 0.0055 · Q^(-0.47)</p>
                  <p>Q = Pop × qpc × K1 × K2 / 86400 (L/s)</p>
                </div>

                <h4 className="font-semibold mt-4">Referência:</h4>
                <p className="text-xs">
                  Baseado no plugin QEsg (jorgealmerio/QEsg) para QGIS.
                  Normas: NBR 9649 — Projeto de redes coletoras de esgoto sanitário.
                </p>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Primary toolbar — Sequential steps 00-08 */}
      <div className="flex flex-wrap gap-1 p-2 bg-muted rounded-lg items-center">
        <Button variant={activeStep === "mapa" ? "default" : "ghost"} size="sm" onClick={() => handleStepChange("mapa")}>
          <MapIcon className="h-3.5 w-3.5 mr-1" />Mapa
        </Button>
        {primarySteps.map(step => (
          <Button key={step.id} variant={activeStep === step.id ? "default" : "ghost"} size="sm"
            onClick={() => handleStepChange(step.id)}
            className={`text-xs ${stepStatus[step.id] === "done" ? "border-green-500 border" : ""}`}>
            <span className="font-mono text-[10px] mr-1">{step.num}</span>{step.label}
            {stepStatus[step.id] === "done" && <CheckCircle className="h-3 w-3 ml-1 text-green-500" />}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {persistence.status === "saving" && (
            <Badge variant="outline" className="text-yellow-600 text-xs animate-pulse">Salvando...</Badge>
          )}
          {persistence.status === "saved" && persistence.lastSaved && (
            <Badge variant="outline" className="text-green-600 text-xs">
              <Save className="h-3 w-3 mr-1" />Salvo {persistence.lastSaved}
            </Badge>
          )}
          {persistence.status === "error" && (
            <Badge variant="outline" className="text-red-600 text-xs">
              <CloudOff className="h-3 w-3 mr-1" />Erro ao salvar
            </Badge>
          )}
        </div>
      </div>

      {/* Secondary toolbar — Utilities (matches QEsg plugin menu) */}
      <div className="flex flex-wrap gap-1 p-1.5 bg-muted/50 rounded-lg items-center border">
        {secondaryItems.map(item => (
          <Button key={item.id} variant={activeStep === item.id ? "default" : "ghost"} size="sm"
            onClick={() => handleStepChange(item.id)}
            className="text-xs h-7">
            {item.id === "perfil" && <Activity className="h-3 w-3 mr-1" />}
            {item.id === "resumo" && <BarChart3 className="h-3 w-3 mr-1" />}
            {item.id === "pvnames" && <Tag className="h-3 w-3 mr-1" />}
            {item.id === "clearnames" && <Eraser className="h-3 w-3 mr-1" />}
            {item.id === "impoe" && <Target className="h-3 w-3 mr-1" />}
            {item.id === "relatorio" && <FileText className="h-3 w-3 mr-1" />}
            {item.id === "dxfimp" && <FileInput className="h-3 w-3 mr-1" />}
            {item.id === "dxfexp" && <FileOutput className="h-3 w-3 mr-1" />}
            {item.id === "c3d" && <Ruler className="h-3 w-3 mr-1" />}
            {item.id === "ajuda" && <HelpCircle className="h-3 w-3 mr-1" />}
            {item.label}
          </Button>
        ))}
      </div>

      {/* Active panel content */}
      {renderActivePanel()}
    </div>
  );
};
