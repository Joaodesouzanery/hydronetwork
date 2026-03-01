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
  type SewerSegmentInput,
  type SewerSegmentResult,
  type SewerNodeInput,
} from "@/engine/qesgEngine";
import { NetworkMapView } from "@/components/hydronetwork/modules/NetworkMapView";
import { GisMapTab } from "@/components/hydronetwork/modules/GisMapTab";
import { ElementTypeAssigner, ElementAssignment } from "@/components/hydronetwork/modules/ElementTypeAssigner";
import { AttributeTableEditor, SewerNodeAttributes, SewerEdgeAttributes } from "@/components/hydronetwork/modules/AttributeTableEditor";
import { LongitudinalProfile } from "@/components/hydronetwork/modules/LongitudinalProfile";
import { SEWER_DEFAULTS, DEMO_UTM_ORIGIN } from "@/config/defaults";
import { useSpatialData } from "@/hooks/useSpatialData";
import { getNodesByOrigin } from "@/core/spatial";
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

type StepId = "mapa" | "s00" | "s01" | "s02" | "s03" | "s04" | "s05" | "s06" | "s07";

const steps: { id: StepId; num: string; label: string }[] = [
  { id: "s00", num: "00", label: "Config" },
  { id: "s01", num: "01", label: "Campos" },
  { id: "s02", num: "02", label: "Numerar" },
  { id: "s03", num: "03", label: "Nós" },
  { id: "s04", num: "04", label: "Preencher" },
  { id: "s05", num: "05", label: "Vazão" },
  { id: "s06", num: "06", label: "Dimensionar" },
  { id: "s07", num: "07", label: "Perfil" },
];

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

  // Step dependency validation
  const handleStepChange = (stepId: StepId) => {
    const hasData = activePontos.length > 0 || gisPontos.length > 0;
    if (stepId !== "mapa" && stepId !== "s00" && !hasData) {
      toast.warning("Importe dados no Mapa primeiro");
    }
    if (stepId === "s04" && sewerEdgeAttrs.length === 0 && sewerNodeAttrs.length === 0) {
      toast.warning("Execute 'Verificar/Criar Campos' (S01) e 'Criar Nós' (S03) primeiro");
    }
    if (stepId === "s05" && stepStatus["s04"] !== "done" && sewerEdgeAttrs.length === 0) {
      toast.warning("Execute 'Preencher Campos' (S04) primeiro");
    }
    if (stepId === "s06" && stepStatus["s05"] !== "done" && sewerEdgeAttrs.length === 0 && sewerTrechos.length === 0) {
      toast.warning("Execute 'Calcular Vazão' (S05) primeiro");
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

  const handleGisPontosChange = (p: PontoTopografico[]) => {
    setGisPontos(p);
    onPontosChange?.(p);
  };
  const handleGisTrechosChange = (t: Trecho[]) => {
    setGisTrechos(t);
    onTrechosChange?.(t);
  };

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

  // ── Derived ──
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
  const sewerTrechos = useMemo(() =>
    activeTrechos.filter(t => {
      if (!t.tipoRedeManual) return true; // include unclassified trechos
      return t.tipoRedeManual === "esgoto" || t.tipoRedeManual === "outro";
    }), [activeTrechos]);

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
    markDone("s06");
  }, [sewerEdgeAttrs, sewerNodeAttrs, sewerTrechos, activePontos, manning, laminaMax,
      velMinEsg, velMaxEsg, tensaoMin, diamMinEsg, vazaoEsg, material, metodoVazao,
      qpcLitrosDia, k1, k2]);

  const applyDiameters = useCallback(() => {
    if (sewerResults.length === 0) return;
    const m = new Map(sewerResults.map(r => [r.id, r.diametroMm]));
    handleGisTrechosChange(activeTrechos.map(t => {
      const d = m.get(`${t.idInicio}-${t.idFim}`);
      return d ? { ...t, diametroMm: d } : t;
    }));
    toast.success("Diâmetros aplicados");
  }, [sewerResults, activeTrechos]);

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
    return activeTrechos
      .filter(t => !t.tipoRedeManual || t.tipoRedeManual === "esgoto" || t.tipoRedeManual === "outro")
      .map(t => {
        const key = `${t.idInicio}-${t.idFim}`;
        const r = resultMap.get(key);
        return {
          from: t.idInicio,
          to: t.idFim,
          color: r ? (r.atendeNorma ? "#22c55e" : "#ef4444") : "#ef4444",
          label: r ? `${key} DN${r.diametroMm} V=${r.velocidadeMs.toFixed(2)}` : key,
        };
      });
  }, [sewerResults, activeTrechos]);

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

          const result = numberSewerNetwork(nodes, edges);

          // Update sewerEdgeAttrs with new dcId and PVM/PVJ
          if (sewerEdgeAttrs.length > 0) {
            const updatedEdges = sewerEdgeAttrs.map((e, i) => ({
              ...e,
              dcId: result.edges[i]?.dcId ?? e.dcId,
            }));
            setSewerEdgeAttrs(updatedEdges);
          }

          // Also update trechos names to reflect numbering
          const updatedTrechos = activeTrechos.map((t, i) => ({
            ...t,
            nomeTrecho: result.edges[i]?.dcId ?? t.nomeTrecho,
          }));
          handleGisTrechosChange(updatedTrechos);

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
        const doAtualizaCotaMDT = async () => {
          const raster = getRasterGrid();
          if (!raster) {
            toast.error("Nenhum raster MDT carregado. Importe um arquivo .tif (GeoTIFF) na aba Mapa primeiro.");
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
          const { updated: spatialUpdated } = fillNodeElevations();
          if (spatialUpdated > 0) fillEdgeElevations();
          spatial.refresh();

          // Update GIS points
          const newPontos = updatedNodes.map(n => ({
            id: n.id, x: n.x, y: n.y, cota: n.cotaTerreno,
          }));
          handleGisPontosChange(newPontos);

          setMdtProgress(100);

          const msg = `MDT: ${nodesUpdated} nós atualizados, ${nodesSkipped} fora do raster, ${edgesUpdated} trechos CTM/CTJ atualizados`;
          setStepMessage(prev => ({ ...prev, s04: msg }));
          toast.success(msg);
          markDone("s04");

          // Clear progress after 2s
          setTimeout(() => setMdtProgress(null), 2000);
        };

        // Also keep the original "fill from nodes" functionality
        const doPreencherCampos = () => {
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
            toast.error("Nenhum trecho para preencher.");
            return;
          }

          const filledEdges = fillFieldsFromNodes(nodes, edges);

          if (sewerEdgeAttrs.length > 0) {
            const updatedEdges = sewerEdgeAttrs.map((e, i) => ({
              ...e,
              cotaTerrenoM: filledEdges[i]?.cotaTerrenoM ?? e.cotaTerrenoM,
              cotaTerrenoJ: filledEdges[i]?.cotaTerrenoJ ?? e.cotaTerrenoJ,
              cotaColetorM: filledEdges[i]?.cotaColetorM ?? e.cotaColetorM,
              cotaColetorJ: filledEdges[i]?.cotaColetorJ ?? e.cotaColetorJ,
              declividade: filledEdges[i]?.declividade ?? e.declividade,
            }));
            setSewerEdgeAttrs(updatedEdges);
          }

          const msg = `${filledEdges.length} trechos preenchidos com dados dos nós`;
          setStepMessage(prev => ({ ...prev, s04: msg }));
          toast.success(msg);
          markDone("s04");
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mountain className="h-5 w-5 text-amber-600" /> 04 — Atualiza Cota TN via MDT
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
                <Button onClick={doPreencherCampos} variant="outline">
                  <TableProperties className="h-4 w-4 mr-1" /> Preencher Campos (Nós→Trechos)
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

              {/* Raster status */}
              <div className="flex items-center gap-2 text-xs">
                {getRasterGrid() ? (
                  <Badge className="bg-green-500">MDT carregado</Badge>
                ) : (
                  <Badge variant="destructive">Nenhum MDT (importe .tif no Mapa)</Badge>
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

      // ═══════ S05: VAZÃO ═══════
      case "s05":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Waves className="h-5 w-5 text-amber-600" /> Cálculo de Vazão
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
                setStepMessage(prev => ({ ...prev, s05: msg }));
                toast.success(msg);
                markDone("s05");
              }}>
                <Calculator className="h-4 w-4 mr-1" /> Calcular Vazão
              </Button>
              {stepMessage.s05 && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2">{stepMessage.s05}</div>
              )}
            </CardContent>
          </Card>
        );

      // ═══════ S06: DIMENSIONAR ═══════
      case "s06":
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Waves className="h-5 w-5 text-amber-600" /> Dimensionamento QEsg (NBR 9649)
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

      // ═══════ S07: PERFIL ═══════
      case "s07":
        return (
          <div className="space-y-4">
            <LongitudinalProfile
              sewerNodes={profileNodes}
              sewerEdges={profileEdges}
              results={sewerResults.length > 0 ? sewerResults : undefined}
            />
            <Button variant="outline" onClick={() => {
              import("@/lib/dxfExporter").then(({ downloadDXF }) => {
                downloadDXF(activePontos, sewerTrechos, "qesg_rede.dxf");
                toast.success("DXF exportado");
              });
            }} size="sm">
              <Download className="h-4 w-4 mr-1" /> Exportar DXF
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Step toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-muted rounded-lg items-center">
        <Button variant={activeStep === "mapa" ? "default" : "ghost"} size="sm" onClick={() => handleStepChange("mapa")}>
          <MapIcon className="h-3.5 w-3.5 mr-1" />Mapa
        </Button>
        {steps.map(step => (
          <Button key={step.id} variant={activeStep === step.id ? "default" : "ghost"} size="sm"
            onClick={() => handleStepChange(step.id)}
            className={stepStatus[step.id] === "done" ? "border-green-500 border" : ""}>
            <span className="font-mono text-xs mr-1">{step.num}</span>{step.label}
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

      {/* Active panel content */}
      {renderActivePanel()}
    </div>
  );
};
