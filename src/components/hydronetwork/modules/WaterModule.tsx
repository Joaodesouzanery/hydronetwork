import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
  AlertTriangle, Zap, RefreshCw, Map, Plus, Trash2,
  Upload, Settings, MapPin, ClipboardList, BarChart3, TrendingUp,
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
import { detectBatchCRS, getMapCoordinatesWithCRS } from "@/engine/hydraulics";
import { NodeMapWidget, ConnectionData } from "@/components/hydronetwork/NodeMapWidget";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import L from "leaflet";

// ══════════════════════════════════════
// Interfaces
// ══════════════════════════════════════

interface WaterNode {
  id: string;
  x: number;
  y: number;
  cota: number;
  demanda: number; // L/s
}

interface WaterModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange: (t: Trecho[]) => void;
}

// ══════════════════════════════════════
// Leaflet map sub-component (QWater results)
// ══════════════════════════════════════

const WaterMapView = ({
  pontos, trechos, results,
}: { pontos: PontoTopografico[]; trechos: Trecho[]; results: WaterSegmentResult[] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const crs = useMemo(() => detectBatchCRS(pontos), [pontos]);
  const getCoords = useCallback(
    (p: PontoTopografico): [number, number] => getMapCoordinatesWithCRS(p.x, p.y, crs),
    [crs],
  );

  useEffect(() => {
    if (!mapRef.current || pontos.length === 0) return;
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    const map = L.map(mapRef.current, { zoomControl: true });
    mapInstance.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OSM" }).addTo(map);

    const resultMap = new Map(results.map(r => [r.id, r]));
    const bounds: L.LatLngExpression[] = [];

    trechos.forEach(t => {
      const pI = pontos.find(p => p.id === t.idInicio);
      const pF = pontos.find(p => p.id === t.idFim);
      if (!pI || !pF) return;
      const coordI = getCoords(pI);
      const coordF = getCoords(pF);
      bounds.push(coordI, coordF);

      const segId = `${t.idInicio}-${t.idFim}`;
      const res = resultMap.get(segId);
      const ok = res?.atendeNorma ?? true;
      const color = ok ? "#3b82f6" : "#ef4444";
      const line = L.polyline([coordI, coordF], { color, weight: 4, opacity: 0.85 }).addTo(map);
      const tooltipText = res
        ? `${segId} | DN${res.diametroMm} | V=${res.velocidadeMs.toFixed(2)} m/s | P=${res.pressaoJusante?.toFixed(1) ?? "-"} mca`
        : segId;
      line.bindTooltip(tooltipText, { sticky: true });
      if (res) {
        line.bindPopup(`
          <div style="font-size:12px;line-height:1.6">
            <strong>${segId}</strong><br/>
            <b>DN:</b> ${res.diametroMm} mm<br/>
            <b>V:</b> ${res.velocidadeMs.toFixed(3)} m/s<br/>
            <b>hf:</b> ${res.perdaCargaM.toFixed(3)} m<br/>
            <b>J:</b> ${res.perdaCargaUnitaria.toFixed(5)} m/m<br/>
            <b>P jus:</b> ${res.pressaoJusante?.toFixed(1) ?? "-"} mca<br/>
            <b>Status:</b> ${res.atendeNorma ? "OK" : "FALHA"}<br/>
            ${res.observacoes.length > 0 ? `<b>Obs:</b> ${res.observacoes.join("; ")}` : ""}
          </div>
        `);
      }
    });

    pontos.forEach(p => {
      const coords = getCoords(p);
      L.circleMarker(coords, { radius: 5, color: "#1e40af", fillColor: "#60a5fa", fillOpacity: 0.8 })
        .addTo(map)
        .bindTooltip(`${p.id} (${p.cota.toFixed(2)}m)`, { direction: "top" });
    });

    if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [pontos, trechos, results, getCoords]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Map className="h-4 w-4 text-blue-600" /> Mapa da Rede de Agua
        </CardTitle>
        <CardDescription className="text-xs">Azul = atende NBR 12218 | Vermelho = falha</CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={mapRef} className="h-[400px] rounded-lg border" />
      </CardContent>
    </Card>
  );
};

// ══════════════════════════════════════
// Main WaterModule
// ══════════════════════════════════════

export const WaterModule = ({ pontos, trechos, onTrechosChange }: WaterModuleProps) => {
  // ── Parameters ──
  const [formula, setFormula] = useState<"hazen-williams" | "colebrook">("hazen-williams");
  const [coefHW, setCoefHW] = useState(140);
  const [velMinAgua, setVelMinAgua] = useState(0.6);
  const [velMaxAgua, setVelMaxAgua] = useState(3.5);
  const [pressaoMin, setPressaoMin] = useState(10.0);
  const [pressaoMax, setPressaoMax] = useState(50.0);
  const [diamMinAgua, setDiamMinAgua] = useState(50);
  const [materialAgua, setMaterialAgua] = useState("PVC");
  const [vazaoAgua, setVazaoAgua] = useState(0.5);

  // ── Water Nodes ──
  const [waterNodes, setWaterNodes] = useState<WaterNode[]>([]);
  const [newNode, setNewNode] = useState<WaterNode>({
    id: "N1", x: 0, y: 0, cota: 100, demanda: 0.5,
  });
  const [mapConnections, setMapConnections] = useState<ConnectionData[]>([]);

  // ── QWater Results ──
  const [waterResults, setWaterResults] = useState<WaterSegmentResult[]>([]);
  const [waterResumo, setWaterResumo] = useState<{ total: number; atendem: number } | null>(null);
  const [pressureData, setPressureData] = useState<{ nodeId: string; pressao: number; hfAcumulada: number }[]>([]);
  const [autoApply, setAutoApply] = useState(false);

  // ── Derived: trechos de agua ──
  const waterTrechos = useMemo(() =>
    trechos.filter(t => {
      const tipo = t.tipoRedeManual || "esgoto";
      return tipo === "agua" || tipo === "outro";
    }), [trechos]);

  // ── Material → C auto-fill ──
  const handleMaterialChange = (mat: string) => {
    setMaterialAgua(mat);
    setCoefHW(getHWCoefficient(mat));
  };

  // ── Node management ──
  const addNode = () => {
    if (!newNode.id.trim()) { toast.error("ID obrigatorio"); return; }
    if (waterNodes.some(n => n.id === newNode.id)) { toast.error("ID ja existe"); return; }
    setWaterNodes([...waterNodes, { ...newNode }]);
    setNewNode({
      id: `N${waterNodes.length + 2}`, x: 0, y: 0, cota: 100, demanda: 0.5,
    });
  };

  const transferFromTopography = () => {
    if (pontos.length === 0) { toast.error("Nenhum ponto na topografia"); return; }
    const newNodes: WaterNode[] = pontos.map(p => ({
      id: p.id, x: p.x, y: p.y, cota: p.cota, demanda: 0.5,
    }));
    setWaterNodes(newNodes);
    setMapConnections(newNodes.slice(0, -1).map((n, i) => ({
      from: n.id, to: newNodes[i + 1].id,
      color: "#3b82f6", label: `${n.id} > ${newNodes[i + 1].id}`,
    })));
    toast.success(`${pontos.length} nos transferidos da topografia`);
  };

  const loadDemo = () => {
    const demo: WaterNode[] = [
      { id: "RES", x: 350000, y: 7400000, cota: 110.0, demanda: 0 },
      { id: "N1", x: 350080, y: 7400020, cota: 105.0, demanda: 0.8 },
      { id: "N2", x: 350160, y: 7400050, cota: 102.0, demanda: 1.2 },
      { id: "N3", x: 350220, y: 7400070, cota: 100.0, demanda: 0.6 },
      { id: "N4", x: 350280, y: 7400090, cota: 98.0, demanda: 0.4 },
    ];
    setWaterNodes(demo);
    setMapConnections(demo.slice(0, -1).map((n, i) => ({
      from: n.id, to: demo[i + 1].id,
      color: "#3b82f6", label: `${n.id} > ${demo[i + 1].id}`,
    })));
    toast.success("Demo de agua carregado (5 nos)");
  };

  // ── Dimensioning ──
  const dimensionWater = useCallback(() => {
    if (waterTrechos.length === 0 && waterNodes.length < 2) {
      toast.error("Minimo 2 nos ou trechos de agua necessarios.");
      return;
    }

    let inputs: WaterSegmentInput[];

    if (waterTrechos.length > 0) {
      // Mode 1: Use existing trechos from topography
      inputs = waterTrechos.map(t => {
        const p0 = pontos.find(p => p.id === t.idInicio);
        const p1 = pontos.find(p => p.id === t.idFim);
        return {
          id: `${t.idInicio}-${t.idFim}`,
          comprimento: t.comprimento,
          cotaMontante: p0?.cota ?? 0,
          cotaJusante: p1?.cota ?? 0,
          vazaoLps: vazaoAgua,
          material: materialAgua,
        };
      });
    } else {
      // Mode 2: Use water nodes (build segments from consecutive nodes)
      inputs = [];
      for (let i = 0; i < waterNodes.length - 1; i++) {
        const de = waterNodes[i];
        const para = waterNodes[i + 1];
        const dx = para.x - de.x;
        const dy = para.y - de.y;
        const comp = Math.sqrt(dx * dx + dy * dy);
        inputs.push({
          id: `${de.id}-${para.id}`,
          comprimento: Math.round(comp * 10) / 10,
          cotaMontante: de.cota,
          cotaJusante: para.cota,
          vazaoLps: para.demanda > 0 ? para.demanda : vazaoAgua,
          material: materialAgua,
        });
      }
    }

    const { resultados, resumo } = dimensionWaterNetwork(inputs, {
      formula, coefHW, velMin: velMinAgua, velMax: velMaxAgua, pressaoMin, pressaoMax, diamMinMm: diamMinAgua,
    });
    setWaterResults(resultados);
    setWaterResumo({ total: resumo.total, atendem: resumo.atendem });

    // Propagate pressure if we have nodes
    if (waterNodes.length >= 2) {
      const nodeInputs: WaterNodeInput[] = waterNodes.map(n => ({
        id: n.id, cota: n.cota, demanda: n.demanda,
      }));
      const pData = propagateNetworkPressure(nodeInputs, resultados, waterNodes[0].cota);
      setPressureData(pData);
    }

    toast.success(`QWater: ${resumo.atendem}/${resumo.total} trechos atendem NBR 12218`);
  }, [waterTrechos, pontos, waterNodes, formula, coefHW, velMinAgua, velMaxAgua,
      pressaoMin, pressaoMax, diamMinAgua, vazaoAgua, materialAgua]);

  const applyDiameters = useCallback(() => {
    if (waterResults.length === 0) return;
    const m = new Map(waterResults.map(r => [r.id, r.diametroMm]));
    onTrechosChange(trechos.map(t => {
      const d = m.get(`${t.idInicio}-${t.idFim}`);
      return d ? { ...t, diametroMm: d } : t;
    }));
    toast.success("Diametros de agua aplicados aos trechos");
  }, [waterResults, trechos, onTrechosChange]);

  useEffect(() => {
    if (autoApply && waterResults.length > 0) {
      applyDiameters();
      setAutoApply(false);
    }
  }, [autoApply, waterResults, applyDiameters]);

  const handleRebuild = () => { setAutoApply(true); dimensionWater(); };

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

  // ── Summary stats ──
  const totalDemanda = waterNodes.length > 0
    ? waterNodes.reduce((s, n) => s + n.demanda, 0) : 0;
  const minPressao = pressureData.length > 0
    ? Math.min(...pressureData.map(p => p.pressao)) : null;
  const maxVelocidade = waterResults.length > 0
    ? Math.max(...waterResults.map(r => r.velocidadeMs)) : 0;
  const alertCount = waterResults.filter(r => !r.atendeNorma).length;
  const compliance = waterResumo
    ? Math.round((waterResumo.atendem / Math.max(waterResumo.total, 1)) * 100) : 0;

  // Chart data
  const pressureChartData = useMemo(() =>
    pressureData.map(p => ({ name: p.nodeId, pressao: p.pressao, hf: p.hfAcumulada })),
    [pressureData]);

  const velocityChartData = useMemo(() =>
    waterResults.map(r => ({ name: r.id, velocidade: r.velocidadeMs, hf: r.perdaCargaM })),
    [waterResults]);

  const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="parametros">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="parametros"><Settings className="h-3.5 w-3.5 mr-1" />Params</TabsTrigger>
          <TabsTrigger value="rede"><MapPin className="h-3.5 w-3.5 mr-1" />Rede ({waterNodes.length})</TabsTrigger>
          <TabsTrigger value="dimensionamento"><Calculator className="h-3.5 w-3.5 mr-1" />QWater</TabsTrigger>
          <TabsTrigger value="resultados"><BarChart3 className="h-3.5 w-3.5 mr-1" />Resultados</TabsTrigger>
        </TabsList>

        {/* ═══════ TAB: Parametros ═══════ */}
        <TabsContent value="parametros" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hidraulica */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-blue-600" /> Parametros Hidraulicos
                </CardTitle>
                <CardDescription>NBR 12218</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Formula</Label>
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
                  <div><Label className="text-xs">C (Hazen-Williams)</Label><Input type="number" step="5" value={coefHW} onChange={e => setCoefHW(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">DN min (mm)</Label><Input type="number" step="25" value={diamMinAgua} onChange={e => setDiamMinAgua(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">V min (m/s)</Label><Input type="number" step="0.1" value={velMinAgua} onChange={e => setVelMinAgua(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">V max (m/s)</Label><Input type="number" step="0.1" value={velMaxAgua} onChange={e => setVelMaxAgua(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">P min (mca)</Label><Input type="number" step="1" value={pressaoMin} onChange={e => setPressaoMin(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">P max (mca)</Label><Input type="number" step="1" value={pressaoMax} onChange={e => setPressaoMax(Number(e.target.value))} /></div>
                </div>
              </CardContent>
            </Card>

            {/* Demanda */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" /> Demanda
                </CardTitle>
                <CardDescription>Configuracao de demanda por no</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Vazao padrao por no (L/s)</Label>
                  <Input type="number" step="0.1" value={vazaoAgua} onChange={e => setVazaoAgua(Number(e.target.value))} />
                </div>
                <div className="bg-muted/50 rounded p-2 text-xs space-y-1">
                  <p className="font-semibold">Demandas tipicas:</p>
                  <p>Residencial: 0.3 - 0.5 L/s</p>
                  <p>Comercial: 0.8 - 1.5 L/s</p>
                  <p>Industrial: 2.0 - 5.0 L/s</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-2 text-xs">
                  Edite a demanda individual de cada no na aba "Rede" ou diretamente no mapa interativo.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ TAB: Rede (Nos) ═══════ */}
        <TabsContent value="rede" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Adicionar No de Demanda</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div><Label className="text-xs">ID</Label><Input value={newNode.id} onChange={e => setNewNode({ ...newNode, id: e.target.value })} placeholder="N1" /></div>
                <div><Label className="text-xs">X</Label><Input type="number" value={newNode.x} onChange={e => setNewNode({ ...newNode, x: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Y</Label><Input type="number" value={newNode.y} onChange={e => setNewNode({ ...newNode, y: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Cota (m)</Label><Input type="number" step="0.01" value={newNode.cota} onChange={e => setNewNode({ ...newNode, cota: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Demanda (L/s)</Label><Input type="number" step="0.1" value={newNode.demanda} onChange={e => setNewNode({ ...newNode, demanda: Number(e.target.value) })} /></div>
              </div>
              <Button onClick={addNode} className="w-full"><Plus className="h-4 w-4 mr-1" /> Adicionar No</Button>
            </CardContent>
          </Card>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={transferFromTopography} variant="outline"><Upload className="h-4 w-4 mr-1" /> Transferir da Topografia</Button>
            <Button onClick={loadDemo} variant="secondary">Carregar Demo</Button>
          </div>

          {waterNodes.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Nos de Demanda ({waterNodes.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>ID</TableHead><TableHead>X</TableHead><TableHead>Y</TableHead>
                      <TableHead>Cota (m)</TableHead><TableHead>Demanda (L/s)</TableHead><TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {waterNodes.map(n => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium">{n.id}</TableCell>
                          <TableCell>{n.x.toFixed(1)}</TableCell>
                          <TableCell>{n.y.toFixed(1)}</TableCell>
                          <TableCell>{n.cota.toFixed(2)}</TableCell>
                          <TableCell>{n.demanda.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => setWaterNodes(waterNodes.filter(nd => nd.id !== n.id))}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Interactive Node Map */}
          <NodeMapWidget
            nodes={waterNodes.map(n => ({ id: n.id, x: n.x, y: n.y, cota: n.cota, demanda: n.demanda }))}
            connections={mapConnections}
            onConnectionsChange={setMapConnections}
            onNodeDemandChange={(nodeId, demanda) =>
              setWaterNodes(waterNodes.map(n => n.id === nodeId ? { ...n, demanda } : n))
            }
            onNodesDelete={(ids) => setWaterNodes(prev => prev.filter(n => !ids.includes(n.id)))}
            title="Mapa da Rede de Agua"
            accentColor="#3b82f6"
            editable
          />

          <Button onClick={dimensionWater} className="w-full" disabled={waterTrechos.length === 0 && waterNodes.length < 2}>
            <Calculator className="h-4 w-4 mr-1" /> Calcular Rede de Agua
          </Button>
        </TabsContent>

        {/* ═══════ TAB: Dimensionamento (QWater) ═══════ */}
        <TabsContent value="dimensionamento" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-600" /> Dimensionamento QWater (NBR 12218)
              </CardTitle>
              <CardDescription className="text-xs">
                Hazen-Williams: hf = 10.643 Q^1.85 / (C^1.85 D^4.87) L
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {waterTrechos.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-blue-600">
                    {waterTrechos.length} trechos de agua (topografia)
                  </Badge>
                </div>
              )}
              {waterNodes.length >= 2 && waterTrechos.length === 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-blue-600">
                    {waterNodes.length - 1} trechos (nos)
                  </Badge>
                </div>
              )}

              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Formula</Label>
                  <Select value={formula} onValueChange={v => setFormula(v as "hazen-williams" | "colebrook")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hazen-williams">Hazen-Williams</SelectItem>
                      <SelectItem value="colebrook">Colebrook-White</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Vazao (L/s)</Label><Input type="number" step="0.1" value={vazaoAgua} onChange={e => setVazaoAgua(Number(e.target.value))} /></div>
                <div><Label className="text-xs">C (H-W)</Label><Input type="number" step="5" value={coefHW} onChange={e => setCoefHW(Number(e.target.value))} /></div>
                <div><Label className="text-xs">DN min (mm)</Label><Input type="number" step="25" value={diamMinAgua} onChange={e => setDiamMinAgua(Number(e.target.value))} /></div>
                <div><Label className="text-xs">V min (m/s)</Label><Input type="number" step="0.1" value={velMinAgua} onChange={e => setVelMinAgua(Number(e.target.value))} /></div>
                <div><Label className="text-xs">V max (m/s)</Label><Input type="number" step="0.1" value={velMaxAgua} onChange={e => setVelMaxAgua(Number(e.target.value))} /></div>
                <div><Label className="text-xs">P min (mca)</Label><Input type="number" step="1" value={pressaoMin} onChange={e => setPressaoMin(Number(e.target.value))} /></div>
                <div><Label className="text-xs">P max (mca)</Label><Input type="number" step="1" value={pressaoMax} onChange={e => setPressaoMax(Number(e.target.value))} /></div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={dimensionWater} disabled={waterTrechos.length === 0 && waterNodes.length < 2}>
                  <Calculator className="h-4 w-4 mr-1" /> Dimensionar
                </Button>
                {waterResults.length > 0 && (
                  <>
                    <Button variant="secondary" onClick={handleRebuild}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Rebuild Rede
                    </Button>
                    <Button variant="outline" onClick={applyDiameters}>
                      <Zap className="h-4 w-4 mr-1" /> Aplicar Diametros
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
                </div>
              )}

              {waterResults.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trecho</TableHead>
                        <TableHead>DN</TableHead>
                        <TableHead>V (m/s)</TableHead>
                        <TableHead>hf (m)</TableHead>
                        <TableHead>P jus (mca)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waterResults.map(r => (
                        <TableRow key={r.id} className={!r.atendeNorma ? "bg-red-50 dark:bg-red-950/20" : ""}>
                          <TableCell className="font-mono text-xs">{r.id}</TableCell>
                          <TableCell className="font-semibold">{r.diametroMm}</TableCell>
                          <TableCell>{r.velocidadeMs.toFixed(2)}</TableCell>
                          <TableCell>{r.perdaCargaM.toFixed(3)}</TableCell>
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

              {waterTrechos.length === 0 && waterNodes.length < 2 && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" /> Nenhum trecho. Adicione nos na aba "Rede" ou importe na Topografia.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leaflet map after dimensioning */}
          {waterResults.length > 0 && pontos.length > 0 && (
            <WaterMapView pontos={pontos} trechos={waterTrechos} results={waterResults} />
          )}
        </TabsContent>

        {/* ═══════ TAB: Resultados ═══════ */}
        <TabsContent value="resultados" className="space-y-4">
          {waterResults.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Calcule a rede na aba "QWater" ou "Rede" para ver resultados.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: <MapPin className="h-6 w-6 inline-block text-blue-600" />, label: "Nos", value: waterNodes.length > 0 ? waterNodes.length : waterTrechos.length + 1 },
                  { icon: <Droplets className="h-6 w-6 inline-block text-blue-600" />, label: "Demanda Total", value: `${fmt(totalDemanda, 2)} L/s` },
                  { icon: <TrendingUp className="h-6 w-6 inline-block text-green-600" />, label: "Pressao Min", value: minPressao !== null ? `${fmt(minPressao, 1)} mca` : "-" },
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

              {/* Alerts */}
              {alertCount > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" /> Validacao NBR 12218 ({alertCount} alertas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[200px] overflow-auto space-y-1">
                      {waterResults.filter(r => !r.atendeNorma).map(r => (
                        <div key={r.id} className="text-sm text-yellow-700">
                          {r.id}: {r.observacoes.join("; ")}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pressure Chart */}
              {pressureChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" /> Pressao nos Nos (mca)
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
                        <Line type="monotone" dataKey="pressao" stroke="hsl(210, 70%, 50%)" name="Pressao (mca)" strokeWidth={2} />
                        <Line type="monotone" dataKey="hf" stroke="hsl(25, 90%, 55%)" name="hf Acum. (m)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Velocity Chart */}
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

              {/* Full Results Table */}
              <Card>
                <CardHeader>
                  <CardTitle><ClipboardList className="h-4 w-4 inline-block mr-1" /> Resultados Detalhados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Trecho</TableHead><TableHead>DN (mm)</TableHead>
                        <TableHead>V (m/s)</TableHead><TableHead>hf (m)</TableHead>
                        <TableHead>J (m/m)</TableHead><TableHead>P jus (mca)</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
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
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
