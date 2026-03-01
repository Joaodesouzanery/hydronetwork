import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calculator, Droplets, CheckCircle, XCircle, Download,
  AlertTriangle, Zap, Upload, Settings, MapPin,
  Map, TableProperties, TrendingUp, BarChart3,
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import {
  dimensionWaterNetwork,
  propagateNetworkPressure,
  getHWCoefficient,
  MATERIAIS_AGUA,
  type WaterSegmentInput,
  type WaterSegmentResult,
  type WaterNodeInput,
} from "@/engine/qwaterEngine";
import { NetworkMapView } from "@/components/hydronetwork/modules/NetworkMapView";
import { GisMapTab } from "@/components/hydronetwork/modules/GisMapTab";
import { ElementTypeAssigner, ElementAssignment } from "@/components/hydronetwork/modules/ElementTypeAssigner";
import { AttributeTableEditor, WaterNodeAttributes, WaterEdgeAttributes } from "@/components/hydronetwork/modules/AttributeTableEditor";
import { LongitudinalProfile } from "@/components/hydronetwork/modules/LongitudinalProfile";
import { WATER_DEFAULTS, DEMO_UTM_ORIGIN } from "@/config/defaults";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

// ══════════════════════════════════════
// Interfaces
// ══════════════════════════════════════

interface WaterModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onPontosChange?: (p: PontoTopografico[]) => void;
  onTrechosChange: (t: Trecho[]) => void;
}

// ── Map formatters ──
const formatWaterTooltip = (segId: string, r: WaterSegmentResult) =>
  `${segId} | DN${r.diametroMm} | V=${r.velocidadeMs.toFixed(2)} m/s | P=${r.pressaoJusante?.toFixed(1) ?? "-"} mca`;

const formatWaterPopup = (segId: string, r: WaterSegmentResult) => `
  <div style="font-size:12px;line-height:1.6">
    <strong>${segId}</strong><br/>
    <b>DN:</b> ${r.diametroMm} mm<br/>
    <b>V:</b> ${r.velocidadeMs.toFixed(3)} m/s<br/>
    <b>hf:</b> ${r.perdaCargaM.toFixed(3)} m<br/>
    <b>J:</b> ${r.perdaCargaUnitaria.toFixed(5)} m/m<br/>
    <b>P jus:</b> ${r.pressaoJusante?.toFixed(1) ?? "-"} mca<br/>
    <b>Status:</b> ${r.atendeNorma ? "OK" : "FALHA"}<br/>
    ${r.observacoes.length > 0 ? `<b>Obs:</b> ${r.observacoes.join("; ")}` : ""}
  </div>`;

// ══════════════════════════════════════
// Main Component — 5 GIS Tabs
// ══════════════════════════════════════

export const WaterModule = ({ pontos, trechos, onPontosChange, onTrechosChange }: WaterModuleProps) => {
  // ── GIS data ──
  const [gisPontos, setGisPontos] = useState<PontoTopografico[]>(pontos);
  const [gisTrechos, setGisTrechos] = useState<Trecho[]>(trechos);
  const [assignments, setAssignments] = useState<ElementAssignment>({
    nodeTypes: new Map(), edgeTypes: new Map(),
  });
  const [waterNodeAttrs, setWaterNodeAttrs] = useState<WaterNodeAttributes[]>([]);
  const [waterEdgeAttrs, setWaterEdgeAttrs] = useState<WaterEdgeAttributes[]>([]);

  // Sync external data on first load
  useEffect(() => {
    if (pontos.length > 0 && gisPontos.length === 0) setGisPontos(pontos);
  }, [pontos.length]);
  useEffect(() => {
    if (trechos.length > 0 && gisTrechos.length === 0) setGisTrechos(trechos);
  }, [trechos.length]);

  const handleGisPontosChange = (p: PontoTopografico[]) => {
    setGisPontos(p);
    onPontosChange?.(p);
  };
  const handleGisTrechosChange = (t: Trecho[]) => {
    setGisTrechos(t);
    onTrechosChange(t);
  };

  // ── Hydraulic parameters ──
  const [formula, setFormula] = useState<"hazen-williams" | "colebrook">(WATER_DEFAULTS.formula);
  const [coefHW, setCoefHW] = useState(WATER_DEFAULTS.coefHW);
  const [velMinAgua, setVelMinAgua] = useState(WATER_DEFAULTS.velMin);
  const [velMaxAgua, setVelMaxAgua] = useState(WATER_DEFAULTS.velMax);
  const [pressaoMin, setPressaoMin] = useState(WATER_DEFAULTS.pressaoMin);
  const [pressaoMax, setPressaoMax] = useState(WATER_DEFAULTS.pressaoMax);
  const [diamMinAgua, setDiamMinAgua] = useState(WATER_DEFAULTS.diamMinMm);
  const [materialAgua, setMaterialAgua] = useState(WATER_DEFAULTS.defaultMaterial);
  const [vazaoAgua, setVazaoAgua] = useState(WATER_DEFAULTS.defaultVazaoLps);

  // ── Results ──
  const [waterResults, setWaterResults] = useState<WaterSegmentResult[]>([]);
  const [waterResumo, setWaterResumo] = useState<{ total: number; atendem: number } | null>(null);
  const [pressureData, setPressureData] = useState<{ nodeId: string; pressao: number; hfAcumulada: number }[]>([]);

  // ── Derived ──
  const activePontos = gisPontos.length > 0 ? gisPontos : pontos;
  const activeTrechos = gisTrechos.length > 0 ? gisTrechos : trechos;
  const waterTrechos = useMemo(() =>
    activeTrechos.filter(t => {
      const tipo = t.tipoRedeManual || "esgoto";
      return tipo === "agua" || tipo === "outro";
    }), [activeTrechos]);

  const handleMaterialChange = (mat: string) => {
    setMaterialAgua(mat);
    setCoefHW(getHWCoefficient(mat));
  };

  // ── Transfer / Demo ──
  const transferFromTopography = () => {
    if (pontos.length === 0) { toast.error("Nenhum ponto na topografia"); return; }
    setGisPontos(pontos);
    setGisTrechos(trechos);
    toast.success(`${pontos.length} pontos transferidos da topografia`);
  };

  const loadDemo = () => {
    const { x: X0, y: Y0 } = DEMO_UTM_ORIGIN;
    const demoPontos: PontoTopografico[] = [
      { id: "RES", x: X0,       y: Y0,       cota: 110.0 },
      { id: "N1",  x: X0 + 80,  y: Y0 + 20,  cota: 105.0 },
      { id: "N2",  x: X0 + 160, y: Y0 + 50,  cota: 102.0 },
      { id: "N3",  x: X0 + 220, y: Y0 + 70,  cota: 100.0 },
      { id: "N4",  x: X0 + 280, y: Y0 + 90,  cota: 98.0 },
    ];
    const demoTrechos: Trecho[] = [];
    for (let i = 0; i < demoPontos.length - 1; i++) {
      const p0 = demoPontos[i], p1 = demoPontos[i + 1];
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const comp = Math.sqrt(dx * dx + dy * dy);
      const decl = comp > 0 ? (p0.cota - p1.cota) / comp : 0;
      demoTrechos.push({
        idInicio: p0.id, idFim: p1.id, comprimento: Math.round(comp * 10) / 10,
        declividade: decl, tipoRede: "agua" as any, diametroMm: 100, material: "PVC",
        xInicio: p0.x, yInicio: p0.y, cotaInicio: p0.cota,
        xFim: p1.x, yFim: p1.y, cotaFim: p1.cota,
        tipoRedeManual: "agua",
      });
    }
    handleGisPontosChange(demoPontos);
    handleGisTrechosChange(demoTrechos);
    // Also set demand attributes for demo
    setWaterNodeAttrs([
      { id: "RES", tipo: "reservoir", cota: 110.0, demanda: 0, pressao: 0, x: X0, y: Y0, observacao: "" },
      { id: "N1", tipo: "junction", cota: 105.0, demanda: 0.8, pressao: 0, x: X0 + 80, y: Y0 + 20, observacao: "" },
      { id: "N2", tipo: "junction", cota: 102.0, demanda: 1.2, pressao: 0, x: X0 + 160, y: Y0 + 50, observacao: "" },
      { id: "N3", tipo: "junction", cota: 100.0, demanda: 0.6, pressao: 0, x: X0 + 220, y: Y0 + 70, observacao: "" },
      { id: "N4", tipo: "junction", cota: 98.0, demanda: 0.4, pressao: 0, x: X0 + 280, y: Y0 + 90, observacao: "" },
    ]);
    toast.success("Demo de água carregado (5 nós)");
  };

  // ── Dimensioning ──
  const dimensionWater = useCallback(() => {
    let inputs: WaterSegmentInput[];

    if (waterEdgeAttrs.length > 0) {
      // From attribute table (priority)
      inputs = waterEdgeAttrs.map(e => ({
        id: e.key,
        comprimento: e.comprimento,
        cotaMontante: 0, cotaJusante: 0, // Will use node cotas
        vazaoLps: e.vazao > 0 ? e.vazao : vazaoAgua,
        material: e.material,
      }));
      // Fill cotas from node attributes
      const nodeMap = new Map(waterNodeAttrs.map(n => [n.id, n]));
      inputs = inputs.map(inp => {
        const edge = waterEdgeAttrs.find(e => e.key === inp.id);
        if (!edge) return inp;
        const fromNode = nodeMap.get(edge.idInicio);
        const toNode = nodeMap.get(edge.idFim);
        return {
          ...inp,
          cotaMontante: fromNode?.cota ?? 0,
          cotaJusante: toNode?.cota ?? 0,
        };
      });
    } else if (waterTrechos.length > 0) {
      inputs = waterTrechos.map(t => ({
        id: `${t.idInicio}-${t.idFim}`,
        comprimento: t.comprimento,
        cotaMontante: t.cotaInicio,
        cotaJusante: t.cotaFim,
        vazaoLps: vazaoAgua,
        material: materialAgua,
      }));
    } else {
      toast.error("Importe dados no Mapa ou preencha a tabela de Rede.");
      return;
    }

    const { resultados, resumo } = dimensionWaterNetwork(inputs, {
      formula, coefHW, velMin: velMinAgua, velMax: velMaxAgua, pressaoMin, pressaoMax, diamMinMm: diamMinAgua,
    });
    setWaterResults(resultados);
    setWaterResumo({ total: resumo.total, atendem: resumo.atendem });

    // Propagate pressure
    const nodeInputs: WaterNodeInput[] = waterNodeAttrs.length > 0
      ? waterNodeAttrs.map(n => ({ id: n.id, cota: n.cota, demanda: n.demanda }))
      : activePontos.map(p => ({ id: p.id, cota: p.cota, demanda: vazaoAgua }));

    if (nodeInputs.length >= 2) {
      const sourceElev = nodeInputs[0].cota;
      const pData = propagateNetworkPressure(nodeInputs, resultados, sourceElev);
      setPressureData(pData);
    }

    toast.success(`QWater: ${resumo.atendem}/${resumo.total} atendem NBR 12218`);
  }, [waterEdgeAttrs, waterNodeAttrs, waterTrechos, activePontos, formula, coefHW,
      velMinAgua, velMaxAgua, pressaoMin, pressaoMax, diamMinAgua, vazaoAgua, materialAgua]);

  const applyDiameters = useCallback(() => {
    if (waterResults.length === 0) return;
    const m = new Map(waterResults.map(r => [r.id, r.diametroMm]));
    handleGisTrechosChange(activeTrechos.map(t => {
      const d = m.get(`${t.idInicio}-${t.idFim}`);
      return d ? { ...t, diametroMm: d } : t;
    }));
    toast.success("Diâmetros aplicados");
  }, [waterResults, activeTrechos]);

  const exportCSV = () => {
    if (waterResults.length === 0) return;
    let csv = "Trecho;DN (mm);V (m/s);hf (m);J (m/m);P jus (mca);Status;Obs\n";
    for (const r of waterResults) csv += `${r.id};${r.diametroMm};${r.velocidadeMs};${r.perdaCargaM};${r.perdaCargaUnitaria};${r.pressaoJusante ?? "-"};${r.atendeNorma ? "OK" : "NAO"};${r.observacoes.join(" | ")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "dimensionamento_agua.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Stats ──
  const alertCount = waterResults.filter(r => !r.atendeNorma).length;
  const compliance = waterResumo
    ? Math.round((waterResumo.atendem / Math.max(waterResumo.total, 1)) * 100) : 0;
  const canDimension = waterEdgeAttrs.length > 0 || waterTrechos.length > 0;
  const totalDemanda = waterNodeAttrs.length > 0
    ? waterNodeAttrs.reduce((s, n) => s + n.demanda, 0) : 0;
  const minPressao = pressureData.length > 0
    ? Math.min(...pressureData.map(p => p.pressao)) : null;

  // Chart data
  const pressureChartData = useMemo(() =>
    pressureData.map(p => ({ name: p.nodeId, pressao: p.pressao, hf: p.hfAcumulada })),
    [pressureData]);

  const velocityChartData = useMemo(() =>
    waterResults.map(r => ({ name: r.id, velocidade: r.velocidadeMs, hf: r.perdaCargaM })),
    [waterResults]);

  // Pressure profile data for LongitudinalProfile component
  const pressureProfileData = useMemo(() => {
    if (pressureData.length === 0 || waterNodeAttrs.length === 0) return undefined;
    let cumDist = 0;
    return pressureData.map((p, i) => {
      const nodeAttr = waterNodeAttrs.find(n => n.id === p.nodeId);
      if (i > 0 && waterEdgeAttrs.length > i - 1) {
        cumDist += waterEdgeAttrs[i - 1]?.comprimento ?? 0;
      } else if (i > 0 && waterTrechos.length > i - 1) {
        cumDist += waterTrechos[i - 1]?.comprimento ?? 0;
      }
      return {
        nodeId: p.nodeId,
        distancia: cumDist,
        cota: nodeAttr?.cota ?? 0,
        pressao: p.pressao,
        linhaP: (nodeAttr?.cota ?? 0) + p.pressao,
      };
    });
  }, [pressureData, waterNodeAttrs, waterEdgeAttrs, waterTrechos]);

  const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="mapa">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="mapa"><Map className="h-3.5 w-3.5 mr-1" />Mapa</TabsTrigger>
          <TabsTrigger value="config"><Settings className="h-3.5 w-3.5 mr-1" />Configuração</TabsTrigger>
          <TabsTrigger value="rede"><TableProperties className="h-3.5 w-3.5 mr-1" />Rede</TabsTrigger>
          <TabsTrigger value="dimensionamento"><Calculator className="h-3.5 w-3.5 mr-1" />Dimensionamento</TabsTrigger>
          <TabsTrigger value="resultados"><BarChart3 className="h-3.5 w-3.5 mr-1" />Resultados</TabsTrigger>
        </TabsList>

        {/* ═══════ TAB 1: MAPA ═══════ */}
        <TabsContent value="mapa" className="space-y-4">
          <GisMapTab
            networkType="agua"
            pontos={gisPontos}
            trechos={gisTrechos}
            onPontosChange={handleGisPontosChange}
            onTrechosChange={handleGisTrechosChange}
            accentColor="#3b82f6"
          />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={transferFromTopography} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" /> Transferir da Topografia
            </Button>
            <Button onClick={loadDemo} variant="secondary" size="sm">Carregar Demo</Button>
          </div>
        </TabsContent>

        {/* ═══════ TAB 2: CONFIGURAÇÃO ═══════ */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-blue-600" /> Parâmetros Hidráulicos
                </CardTitle>
                <CardDescription>NBR 12218</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Fórmula</Label>
                    <Select value={formula} onValueChange={v => setFormula(v as "hazen-williams" | "colebrook")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hazen-williams">Hazen-Williams</SelectItem>
                        <SelectItem value="colebrook">Colebrook-White</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Material</Label>
                    <Select value={materialAgua} onValueChange={handleMaterialChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MATERIAIS_AGUA.map(m => (
                          <SelectItem key={m} value={m}>{m} (C={getHWCoefficient(m)})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">C (H-W)</Label><Input type="number" step="5" value={coefHW} onChange={e => setCoefHW(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">DN mín (mm)</Label><Input type="number" step="25" value={diamMinAgua} onChange={e => setDiamMinAgua(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">V mín (m/s)</Label><Input type="number" step="0.1" value={velMinAgua} onChange={e => setVelMinAgua(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">V máx (m/s)</Label><Input type="number" step="0.1" value={velMaxAgua} onChange={e => setVelMaxAgua(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">P mín (mca)</Label><Input type="number" step="1" value={pressaoMin} onChange={e => setPressaoMin(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">P máx (mca)</Label><Input type="number" step="1" value={pressaoMax} onChange={e => setPressaoMax(Number(e.target.value))} /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" /> Demanda
                </CardTitle>
                <CardDescription>Configuração de demanda por nó</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Vazão padrão por nó (L/s)</Label>
                  <Input type="number" step="0.1" value={vazaoAgua} onChange={e => setVazaoAgua(Number(e.target.value))} />
                </div>
                <div className="bg-muted/50 rounded p-2 text-xs space-y-1">
                  <p className="font-semibold">Demandas típicas:</p>
                  <p>Residencial: 0.3 - 0.5 L/s</p>
                  <p>Comercial: 0.8 - 1.5 L/s</p>
                  <p>Industrial: 2.0 - 5.0 L/s</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-2 text-xs">
                  Edite a demanda individual na aba "Rede".
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ TAB 3: REDE ═══════ */}
        <TabsContent value="rede" className="space-y-4">
          <ElementTypeAssigner
            networkType="agua"
            pontos={activePontos}
            trechos={waterTrechos}
            assignments={assignments}
            onAssignmentsChange={setAssignments}
          />
          <AttributeTableEditor
            networkType="agua"
            pontos={activePontos}
            trechos={waterTrechos}
            assignments={assignments}
            waterNodes={waterNodeAttrs}
            waterEdges={waterEdgeAttrs}
            onWaterNodesChange={setWaterNodeAttrs}
            onWaterEdgesChange={setWaterEdgeAttrs}
          />
        </TabsContent>

        {/* ═══════ TAB 4: DIMENSIONAMENTO ═══════ */}
        <TabsContent value="dimensionamento" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-600" /> Dimensionamento QWater (NBR 12218)
              </CardTitle>
              <CardDescription className="text-xs">
                Hazen-Williams: hf = 10.643·Q^1.85 / (C^1.85·D^4.87)·L
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {waterEdgeAttrs.length > 0 && (
                  <Badge variant="outline" className="text-blue-600">{waterEdgeAttrs.length} trechos (atributos)</Badge>
                )}
                {waterEdgeAttrs.length === 0 && waterTrechos.length > 0 && (
                  <Badge variant="outline" className="text-blue-600">{waterTrechos.length} trechos (GIS)</Badge>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={dimensionWater} disabled={!canDimension}>
                  <Calculator className="h-4 w-4 mr-1" /> Dimensionar
                </Button>
                {waterResults.length > 0 && (
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

              {waterResumo && (
                <div className="flex gap-3 text-sm">
                  <Badge variant="outline">{waterResumo.total} trechos</Badge>
                  <Badge className="bg-green-500">{waterResumo.atendem} OK</Badge>
                  {waterResumo.total - waterResumo.atendem > 0 && (
                    <Badge variant="destructive">{waterResumo.total - waterResumo.atendem} falha</Badge>
                  )}
                  <Badge variant="outline">{compliance}%</Badge>
                </div>
              )}

              {waterResults.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trecho</TableHead>
                        <TableHead>DN (mm)</TableHead>
                        <TableHead>V (m/s)</TableHead>
                        <TableHead>hf (m)</TableHead>
                        <TableHead>J (m/m)</TableHead>
                        <TableHead>P jus (mca)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waterResults.map(r => (
                        <TableRow key={r.id} className={!r.atendeNorma ? "bg-red-50 dark:bg-red-950/20" : ""}>
                          <TableCell className="font-mono text-xs">{r.id}</TableCell>
                          <TableCell className="font-semibold">{r.diametroMm}</TableCell>
                          <TableCell>{r.velocidadeMs.toFixed(3)}</TableCell>
                          <TableCell>{r.perdaCargaM.toFixed(3)}</TableCell>
                          <TableCell>{r.perdaCargaUnitaria.toFixed(5)}</TableCell>
                          <TableCell>{r.pressaoJusante?.toFixed(1) ?? "-"}</TableCell>
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
                      {waterResults.filter(r => !r.atendeNorma).map(r => (
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

          {waterResults.length > 0 && activePontos.length > 0 && (
            <NetworkMapView<WaterSegmentResult>
              pontos={activePontos}
              trechos={waterTrechos}
              results={waterResults}
              okColor={WATER_DEFAULTS.mapOkColor}
              failColor={WATER_DEFAULTS.mapFailColor}
              markerColor={WATER_DEFAULTS.markerColor}
              markerFillColor={WATER_DEFAULTS.markerFillColor}
              title="Mapa — Rede Dimensionada"
              description="Azul = atende NBR 12218 | Vermelho = falha"
              iconColorClass="text-blue-600"
              formatTooltip={formatWaterTooltip}
              formatPopup={formatWaterPopup}
            />
          )}
        </TabsContent>

        {/* ═══════ TAB 5: RESULTADOS ═══════ */}
        <TabsContent value="resultados" className="space-y-4">
          {waterResults.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Calcule a rede na aba "Dimensionamento" para ver resultados.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: <MapPin className="h-6 w-6 inline-block text-blue-600" />, label: "Nós", value: waterNodeAttrs.length || activePontos.length },
                  { icon: <Droplets className="h-6 w-6 inline-block text-blue-600" />, label: "Demanda Total", value: `${fmt(totalDemanda, 2)} L/s` },
                  { icon: <TrendingUp className="h-6 w-6 inline-block text-green-600" />, label: "Pressão Mín", value: minPressao !== null ? `${fmt(minPressao, 1)} mca` : "-" },
                  { icon: <AlertTriangle className="h-6 w-6 inline-block text-red-500" />, label: "Conformidade", value: `${compliance}%` },
                ].map((item, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl">{item.icon}</div>
                      <div className="text-xl font-bold mt-1">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pressure chart */}
              {pressureChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" /> Pressão nos Nós (mca)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={pressureChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis fontSize={10} />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="pressao" stroke="hsl(210, 70%, 50%)" name="Pressão (mca)" strokeWidth={2} />
                        <Line type="monotone" dataKey="hf" stroke="hsl(25, 90%, 55%)" name="hf Acum. (m)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Piezometric profile */}
              {pressureProfileData && pressureProfileData.length > 0 && (
                <LongitudinalProfile
                  sewerNodes={[]}
                  sewerEdges={[]}
                  mode="water"
                  pressureData={pressureProfileData}
                />
              )}

              {/* Velocity chart */}
              {velocityChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-600" /> Velocidade e Perda de Carga
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={velocityChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis fontSize={10} />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="velocidade" fill="hsl(210, 70%, 50%)" name="Velocidade (m/s)" />
                        <Bar dataKey="hf" fill="hsl(25, 90%, 55%)" name="hf (m)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
