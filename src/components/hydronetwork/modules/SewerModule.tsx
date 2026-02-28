import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
  Calculator, Waves, CheckCircle, XCircle, Download,
  AlertTriangle, Zap, RefreshCw, Map, Plus, Trash2,
  Upload, Settings, Users, ClipboardList, BarChart3,
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import {
  dimensionSewerNetwork,
  accumulateSewerFlow,
  calcPVDepth,
  calcPopulationFlow,
  type SewerSegmentInput,
  type SewerSegmentResult,
  type SewerNodeInput,
} from "@/engine/qesgEngine";
import { detectBatchCRS, getMapCoordinatesWithCRS } from "@/engine/hydraulics";
import { NodeMapWidget, ConnectionData } from "@/components/hydronetwork/NodeMapWidget";
import L from "leaflet";

// ══════════════════════════════════════
// Interfaces
// ══════════════════════════════════════

interface SewerNode {
  id: string;
  x: number;
  y: number;
  cotaTerreno: number;
  cotaFundo: number;
  populacao: number;
}

interface SewerModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange: (t: Trecho[]) => void;
}

// ══════════════════════════════════════
// Leaflet map sub-component (QEsg results)
// ══════════════════════════════════════

const SewerMapView = ({
  pontos, trechos, results,
}: { pontos: PontoTopografico[]; trechos: Trecho[]; results: SewerSegmentResult[] }) => {
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
      const color = ok ? "#22c55e" : "#ef4444";
      const line = L.polyline([coordI, coordF], { color, weight: 4, opacity: 0.85 }).addTo(map);
      const tooltipText = res
        ? `${segId} | DN${res.diametroMm} | V=${res.velocidadeMs.toFixed(2)} m/s | t=${res.tensaoTrativa.toFixed(2)} Pa`
        : segId;
      line.bindTooltip(tooltipText, { sticky: true });
      if (res) {
        line.bindPopup(`
          <div style="font-size:12px;line-height:1.6">
            <strong>${segId}</strong><br/>
            <b>DN:</b> ${res.diametroMm} mm<br/>
            <b>V:</b> ${res.velocidadeMs.toFixed(3)} m/s<br/>
            <b>V crit:</b> ${res.velocidadeCriticaMs.toFixed(3)} m/s<br/>
            <b>y/D:</b> ${res.laminaDagua.toFixed(3)}<br/>
            <b>t:</b> ${res.tensaoTrativa.toFixed(2)} Pa<br/>
            <b>Decliv.:</b> ${(res.declividadeUsada * 100).toFixed(3)}%<br/>
            <b>Status:</b> ${res.atendeNorma ? "OK" : "FALHA"}<br/>
            ${res.observacoes.length > 0 ? `<b>Obs:</b> ${res.observacoes.join("; ")}` : ""}
          </div>
        `);
      }
    });

    pontos.forEach(p => {
      const coords = getCoords(p);
      L.circleMarker(coords, { radius: 5, color: "#92400e", fillColor: "#f59e0b", fillOpacity: 0.8 })
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
          <Map className="h-4 w-4 text-amber-600" /> Mapa da Rede de Esgoto
        </CardTitle>
        <CardDescription className="text-xs">Verde = atende NBR 9649 | Vermelho = falha</CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={mapRef} className="h-[400px] rounded-lg border" />
      </CardContent>
    </Card>
  );
};

// ══════════════════════════════════════
// Main SewerModule
// ══════════════════════════════════════

export const SewerModule = ({ pontos, trechos, onTrechosChange }: SewerModuleProps) => {
  // ── Parameters ──
  const [manning, setManning] = useState(0.013);
  const [laminaMax, setLaminaMax] = useState(0.75);
  const [velMinEsg, setVelMinEsg] = useState(0.6);
  const [velMaxEsg, setVelMaxEsg] = useState(5.0);
  const [tensaoMin, setTensaoMin] = useState(1.0);
  const [diamMinEsg, setDiamMinEsg] = useState(150);
  const [material, setMaterial] = useState("PVC");

  // Flow method: "fixa" or "percapita"
  const [metodoVazao, setMetodoVazao] = useState<"fixa" | "percapita">("fixa");
  const [vazaoEsg, setVazaoEsg] = useState(1.5);
  const [qpcLitrosDia, setQpcLitrosDia] = useState(160);
  const [k1, setK1] = useState(1.2);
  const [k2, setK2] = useState(1.5);

  // ── PV Nodes ──
  const [pvNodes, setPvNodes] = useState<SewerNode[]>([]);
  const [newPV, setNewPV] = useState<SewerNode>({
    id: "PV1", x: 0, y: 0, cotaTerreno: 100, cotaFundo: 98.5, populacao: 50,
  });
  const [mapConnections, setMapConnections] = useState<ConnectionData[]>([]);

  // ── QEsg Results ──
  const [sewerResults, setSewerResults] = useState<SewerSegmentResult[]>([]);
  const [sewerResumo, setSewerResumo] = useState<{ total: number; atendem: number } | null>(null);
  const [autoApply, setAutoApply] = useState(false);

  // ── Derived: trechos de esgoto ──
  const sewerTrechos = useMemo(() =>
    trechos.filter(t => {
      const tipo = t.tipoRedeManual || "esgoto";
      return tipo === "esgoto" || tipo === "outro";
    }), [trechos]);

  // ── Material → Manning auto-fill ──
  const handleMaterialChange = (mat: string) => {
    setMaterial(mat);
    if (mat === "PVC") setManning(0.013);
    else if (mat === "Concreto") setManning(0.015);
  };

  // ── PV management ──
  const addPV = () => {
    if (!newPV.id.trim()) { toast.error("ID obrigatorio"); return; }
    if (pvNodes.some(n => n.id === newPV.id)) { toast.error("ID ja existe"); return; }
    setPvNodes([...pvNodes, { ...newPV }]);
    setNewPV({
      id: `PV${pvNodes.length + 2}`, x: 0, y: 0,
      cotaTerreno: 100, cotaFundo: 98.5, populacao: 50,
    });
  };

  const transferFromTopography = () => {
    if (pontos.length === 0) { toast.error("Nenhum ponto na topografia"); return; }
    const newNodes: SewerNode[] = pontos.map(p => ({
      id: p.id, x: p.x, y: p.y,
      cotaTerreno: p.cota, cotaFundo: p.cota - 1.5,
      populacao: 50,
    }));
    setPvNodes(newNodes);
    setMapConnections(newNodes.slice(0, -1).map((n, i) => ({
      from: n.id, to: newNodes[i + 1].id,
      color: "#f59e0b", label: `${n.id} > ${newNodes[i + 1].id}`,
    })));
    toast.success(`${pontos.length} PVs transferidos da topografia`);
  };

  const loadDemo = () => {
    const demo: SewerNode[] = [
      { id: "PV1", x: 350000, y: 7400000, cotaTerreno: 106.0, cotaFundo: 104.5, populacao: 80 },
      { id: "PV2", x: 350070, y: 7400030, cotaTerreno: 104.5, cotaFundo: 103.0, populacao: 120 },
      { id: "PV3", x: 350140, y: 7400060, cotaTerreno: 103.0, cotaFundo: 101.5, populacao: 60 },
      { id: "PV4", x: 350180, y: 7400075, cotaTerreno: 102.0, cotaFundo: 100.5, populacao: 40 },
      { id: "PV5", x: 350210, y: 7400090, cotaTerreno: 101.5, cotaFundo: 100.0, populacao: 0 },
    ];
    setPvNodes(demo);
    setMapConnections(demo.slice(0, -1).map((n, i) => ({
      from: n.id, to: demo[i + 1].id,
      color: "#f59e0b", label: `${n.id} > ${demo[i + 1].id}`,
    })));
    toast.success("Demo de esgoto carregado (5 PVs)");
  };

  // ── Dimensioning ──
  const dimensionSewer = useCallback(() => {
    if (sewerTrechos.length === 0 && pvNodes.length < 2) {
      toast.error("Minimo 2 PVs ou trechos de esgoto necessarios.");
      return;
    }

    let inputs: SewerSegmentInput[];

    if (sewerTrechos.length > 0) {
      // Mode 1: Use existing trechos from topography
      inputs = sewerTrechos.map(t => {
        const p0 = pontos.find(p => p.id === t.idInicio);
        const p1 = pontos.find(p => p.id === t.idFim);
        return {
          id: `${t.idInicio}-${t.idFim}`,
          comprimento: t.comprimento,
          cotaMontante: p0?.cota ?? 0,
          cotaJusante: p1?.cota ?? 0,
          vazaoLps: vazaoEsg,
          tipoTubo: material,
        };
      });
    } else {
      // Mode 2: Use PV nodes (build segments from consecutive PVs)
      inputs = [];
      for (let i = 0; i < pvNodes.length - 1; i++) {
        const de = pvNodes[i];
        const para = pvNodes[i + 1];
        const dx = para.x - de.x;
        const dy = para.y - de.y;
        const comp = Math.sqrt(dx * dx + dy * dy);
        inputs.push({
          id: `${de.id}-${para.id}`,
          comprimento: Math.round(comp * 10) / 10,
          cotaMontante: de.cotaFundo,
          cotaJusante: para.cotaFundo,
          vazaoLps: vazaoEsg,
          tipoTubo: material,
        });
      }
    }

    // Apply flow accumulation if using per-capita method
    if (metodoVazao === "percapita") {
      const nodeFlows: SewerNodeInput[] = pvNodes.map(n => ({
        id: n.id,
        vazaoLocal: calcPopulationFlow(n.populacao, qpcLitrosDia, k1, k2),
      }));

      if (nodeFlows.length > 0 && inputs.length > 0) {
        inputs = accumulateSewerFlow(inputs, nodeFlows);
      }
    }

    const { resultados, resumo } = dimensionSewerNetwork(inputs, {
      manning, laminaMax, velMin: velMinEsg, velMax: velMaxEsg, tensaoMin, diamMinMm: diamMinEsg,
    });
    setSewerResults(resultados);
    setSewerResumo({ total: resumo.total, atendem: resumo.atendem });
    toast.success(`QEsg: ${resumo.atendem}/${resumo.total} trechos atendem NBR 9649`);
  }, [sewerTrechos, pontos, pvNodes, manning, laminaMax, velMinEsg, velMaxEsg,
      tensaoMin, diamMinEsg, vazaoEsg, material, metodoVazao, qpcLitrosDia, k1, k2]);

  const applyDiameters = useCallback(() => {
    if (sewerResults.length === 0) return;
    const m = new Map(sewerResults.map(r => [r.id, r.diametroMm]));
    onTrechosChange(trechos.map(t => {
      const d = m.get(`${t.idInicio}-${t.idFim}`);
      return d ? { ...t, diametroMm: d } : t;
    }));
    toast.success("Diametros de esgoto aplicados aos trechos");
  }, [sewerResults, trechos, onTrechosChange]);

  useEffect(() => {
    if (autoApply && sewerResults.length > 0) {
      applyDiameters();
      setAutoApply(false);
    }
  }, [autoApply, sewerResults, applyDiameters]);

  const handleRebuild = () => { setAutoApply(true); dimensionSewer(); };

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

  // ── Summary stats ──
  const totalComp = sewerResults.reduce((s, r) => {
    const seg = sewerTrechos.find(t => `${t.idInicio}-${t.idFim}` === r.id);
    return s + (seg?.comprimento ?? 0);
  }, 0) || pvNodes.length > 1 ? pvNodes.reduce((s, n, i) => {
    if (i === 0) return 0;
    const prev = pvNodes[i - 1];
    return s + Math.sqrt((n.x - prev.x) ** 2 + (n.y - prev.y) ** 2);
  }, 0) : 0;

  const maxVazao = sewerResults.length > 0
    ? Math.max(...sewerResults.map(r => r.velocidadeMs)) : 0;
  const alertCount = sewerResults.filter(r => !r.atendeNorma).length;
  const compliance = sewerResumo
    ? Math.round((sewerResumo.atendem / Math.max(sewerResumo.total, 1)) * 100) : 0;

  const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="parametros">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="parametros"><Settings className="h-3.5 w-3.5 mr-1" />Params</TabsTrigger>
          <TabsTrigger value="rede"><Users className="h-3.5 w-3.5 mr-1" />Rede ({pvNodes.length})</TabsTrigger>
          <TabsTrigger value="dimensionamento"><Calculator className="h-3.5 w-3.5 mr-1" />QEsg</TabsTrigger>
          <TabsTrigger value="resultados"><BarChart3 className="h-3.5 w-3.5 mr-1" />Resultados</TabsTrigger>
        </TabsList>

        {/* ═══════ TAB: Parametros ═══════ */}
        <TabsContent value="parametros" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hidraulica */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-amber-600" /> Parametros Hidraulicos
                </CardTitle>
                <CardDescription>NBR 9649 / NBR 14486</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">y/D max</Label><Input type="number" step="0.05" value={laminaMax} onChange={e => setLaminaMax(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">DN min (mm)</Label><Input type="number" step="50" value={diamMinEsg} onChange={e => setDiamMinEsg(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">V min (m/s)</Label><Input type="number" step="0.1" value={velMinEsg} onChange={e => setVelMinEsg(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">V max (m/s)</Label><Input type="number" step="0.1" value={velMaxEsg} onChange={e => setVelMaxEsg(Number(e.target.value))} /></div>
                </div>
                <div>
                  <Label className="text-xs">Tensao trativa min (Pa)</Label>
                  <Input type="number" step="0.1" value={tensaoMin} onChange={e => setTensaoMin(Number(e.target.value))} />
                </div>
              </CardContent>
            </Card>

            {/* Contribuicao de Vazao */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-600" /> Contribuicao de Vazao
                </CardTitle>
                <CardDescription>Metodo de calculo da vazao por trecho</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Metodo</Label>
                  <Select value={metodoVazao} onValueChange={v => setMetodoVazao(v as "fixa" | "percapita")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixa">Vazao fixa (L/s)</SelectItem>
                      <SelectItem value="percapita">Per capita (Pop x qpc)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {metodoVazao === "fixa" ? (
                  <div>
                    <Label className="text-xs">Vazao uniforme (L/s)</Label>
                    <Input type="number" step="0.1" value={vazaoEsg} onChange={e => setVazaoEsg(Number(e.target.value))} />
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="text-xs">Quota per capita (L/hab/dia)</Label>
                      <Input type="number" step="10" value={qpcLitrosDia} onChange={e => setQpcLitrosDia(Number(e.target.value))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">K1 (dia max)</Label><Input type="number" step="0.1" value={k1} onChange={e => setK1(Number(e.target.value))} /></div>
                      <div><Label className="text-xs">K2 (hora max)</Label><Input type="number" step="0.1" value={k2} onChange={e => setK2(Number(e.target.value))} /></div>
                    </div>
                    <div className="bg-muted/50 rounded p-2 text-xs text-center">
                      Q = Pop x {qpcLitrosDia} x {k1} x {k2} / 86400
                      {pvNodes.length > 0 && (
                        <> = {fmt(calcPopulationFlow(pvNodes[0].populacao, qpcLitrosDia, k1, k2), 3)} L/s (PV1)</>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ TAB: Rede (PVs) ═══════ */}
        <TabsContent value="rede" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Adicionar PV (Poco de Visita)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div><Label className="text-xs">ID</Label><Input value={newPV.id} onChange={e => setNewPV({ ...newPV, id: e.target.value })} placeholder="PV1" /></div>
                <div><Label className="text-xs">X</Label><Input type="number" value={newPV.x} onChange={e => setNewPV({ ...newPV, x: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Y</Label><Input type="number" value={newPV.y} onChange={e => setNewPV({ ...newPV, y: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Cota Terreno (m)</Label><Input type="number" step="0.01" value={newPV.cotaTerreno} onChange={e => setNewPV({ ...newPV, cotaTerreno: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Cota Fundo (m)</Label><Input type="number" step="0.01" value={newPV.cotaFundo} onChange={e => setNewPV({ ...newPV, cotaFundo: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Populacao (hab)</Label><Input type="number" step="10" value={newPV.populacao} onChange={e => setNewPV({ ...newPV, populacao: Number(e.target.value) })} /></div>
              </div>
              <Button onClick={addPV} className="w-full"><Plus className="h-4 w-4 mr-1" /> Adicionar PV</Button>
            </CardContent>
          </Card>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={transferFromTopography} variant="outline"><Upload className="h-4 w-4 mr-1" /> Transferir da Topografia</Button>
            <Button onClick={loadDemo} variant="secondary">Carregar Demo</Button>
          </div>

          {pvNodes.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Pocos de Visita ({pvNodes.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>ID</TableHead><TableHead>X</TableHead><TableHead>Y</TableHead>
                      <TableHead>CT (m)</TableHead><TableHead>CF (m)</TableHead>
                      <TableHead>Prof (m)</TableHead><TableHead>Pop</TableHead>
                      {metodoVazao === "percapita" && <TableHead>Q (L/s)</TableHead>}
                      <TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {pvNodes.map(n => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium">{n.id}</TableCell>
                          <TableCell>{n.x.toFixed(1)}</TableCell>
                          <TableCell>{n.y.toFixed(1)}</TableCell>
                          <TableCell>{n.cotaTerreno.toFixed(2)}</TableCell>
                          <TableCell>{n.cotaFundo.toFixed(2)}</TableCell>
                          <TableCell className={calcPVDepth(n.cotaTerreno, n.cotaFundo) > 4 ? "text-red-600 font-semibold" : ""}>
                            {calcPVDepth(n.cotaTerreno, n.cotaFundo).toFixed(2)}
                          </TableCell>
                          <TableCell>{n.populacao}</TableCell>
                          {metodoVazao === "percapita" && (
                            <TableCell>{calcPopulationFlow(n.populacao, qpcLitrosDia, k1, k2).toFixed(3)}</TableCell>
                          )}
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => setPvNodes(pvNodes.filter(nd => nd.id !== n.id))}>
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
            nodes={pvNodes.map(n => ({ id: n.id, x: n.x, y: n.y, cota: n.cotaTerreno, demanda: n.populacao }))}
            connections={mapConnections}
            onConnectionsChange={setMapConnections}
            onNodeDemandChange={(nodeId, demanda) =>
              setPvNodes(pvNodes.map(n => n.id === nodeId ? { ...n, populacao: demanda } : n))
            }
            onNodesDelete={(ids) => setPvNodes(prev => prev.filter(n => !ids.includes(n.id)))}
            title="Mapa da Rede de Esgoto"
            accentColor="#f59e0b"
            editable
          />

          <Button onClick={dimensionSewer} className="w-full" disabled={sewerTrechos.length === 0 && pvNodes.length < 2}>
            <Calculator className="h-4 w-4 mr-1" /> Calcular Rede de Esgoto
          </Button>
        </TabsContent>

        {/* ═══════ TAB: Dimensionamento (QEsg) ═══════ */}
        <TabsContent value="dimensionamento" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Waves className="h-5 w-5 text-amber-600" /> Dimensionamento QEsg (NBR 9649)
              </CardTitle>
              <CardDescription className="text-xs">
                t = 10000 Rh I | v_c = 6 sqrt(g Rh) | I_min = 0.0055 Q^(-0.47)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sewerTrechos.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-amber-600">
                    {sewerTrechos.length} trechos de esgoto (topografia)
                  </Badge>
                </div>
              )}
              {pvNodes.length >= 2 && sewerTrechos.length === 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-amber-600">
                    {pvNodes.length - 1} trechos (PVs)
                  </Badge>
                </div>
              )}

              <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                <div><Label className="text-xs">Vazao (L/s)</Label><Input type="number" step="0.1" value={vazaoEsg} onChange={e => setVazaoEsg(Number(e.target.value))} /></div>
                <div><Label className="text-xs">Manning (n)</Label><Input type="number" step="0.001" value={manning} onChange={e => setManning(Number(e.target.value))} /></div>
                <div><Label className="text-xs">y/D max</Label><Input type="number" step="0.05" value={laminaMax} onChange={e => setLaminaMax(Number(e.target.value))} /></div>
                <div><Label className="text-xs">V min (m/s)</Label><Input type="number" step="0.1" value={velMinEsg} onChange={e => setVelMinEsg(Number(e.target.value))} /></div>
                <div><Label className="text-xs">V max (m/s)</Label><Input type="number" step="0.1" value={velMaxEsg} onChange={e => setVelMaxEsg(Number(e.target.value))} /></div>
                <div><Label className="text-xs">Tensao min (Pa)</Label><Input type="number" step="0.1" value={tensaoMin} onChange={e => setTensaoMin(Number(e.target.value))} /></div>
                <div><Label className="text-xs">DN min (mm)</Label><Input type="number" step="50" value={diamMinEsg} onChange={e => setDiamMinEsg(Number(e.target.value))} /></div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={dimensionSewer} disabled={sewerTrechos.length === 0 && pvNodes.length < 2}>
                  <Calculator className="h-4 w-4 mr-1" /> Dimensionar
                </Button>
                {sewerResults.length > 0 && (
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

              {sewerResumo && (
                <div className="flex gap-3 text-sm">
                  <Badge variant="outline">{sewerResumo.total} trechos</Badge>
                  <Badge className="bg-green-500">{sewerResumo.atendem} OK</Badge>
                  {sewerResumo.total - sewerResumo.atendem > 0 && (
                    <Badge variant="destructive">{sewerResumo.total - sewerResumo.atendem} falha</Badge>
                  )}
                </div>
              )}

              {sewerResults.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trecho</TableHead>
                        <TableHead>DN</TableHead>
                        <TableHead>V (m/s)</TableHead>
                        <TableHead>y/D</TableHead>
                        <TableHead>t (Pa)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sewerResults.map(r => (
                        <TableRow key={r.id} className={!r.atendeNorma ? "bg-red-50 dark:bg-red-950/20" : ""}>
                          <TableCell className="font-mono text-xs">{r.id}</TableCell>
                          <TableCell className="font-semibold">{r.diametroMm}</TableCell>
                          <TableCell>{r.velocidadeMs.toFixed(2)}</TableCell>
                          <TableCell>{r.laminaDagua.toFixed(3)}</TableCell>
                          <TableCell>{r.tensaoTrativa.toFixed(2)}</TableCell>
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

              {sewerTrechos.length === 0 && pvNodes.length < 2 && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" /> Nenhum trecho. Adicione PVs na aba "Rede" ou importe na Topografia.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leaflet map after dimensioning */}
          {sewerResults.length > 0 && pontos.length > 0 && (
            <SewerMapView pontos={pontos} trechos={sewerTrechos} results={sewerResults} />
          )}
        </TabsContent>

        {/* ═══════ TAB: Resultados ═══════ */}
        <TabsContent value="resultados" className="space-y-4">
          {sewerResults.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Calcule a rede na aba "QEsg" ou "Rede" para ver resultados.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: <Users className="h-6 w-6 inline-block text-amber-600" />, label: "PVs", value: pvNodes.length > 0 ? pvNodes.length : sewerTrechos.length + 1 },
                  { icon: <ClipboardList className="h-6 w-6 inline-block text-amber-600" />, label: "Extensao Total", value: `${fmt(totalComp, 1)} m` },
                  { icon: <Waves className="h-6 w-6 inline-block text-amber-600" />, label: "Conformidade", value: `${compliance}%` },
                  { icon: <AlertTriangle className="h-6 w-6 inline-block text-red-500" />, label: "Alertas", value: alertCount },
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
                      <AlertTriangle className="h-5 w-5 text-yellow-600" /> Validacao NBR 9649 ({alertCount} alertas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[200px] overflow-auto space-y-1">
                      {sewerResults.filter(r => !r.atendeNorma).map(r => (
                        <div key={r.id} className="text-sm text-yellow-700">
                          {r.id}: {r.observacoes.join("; ")}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* PV Depth Analysis */}
              {pvNodes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-amber-600" /> Profundidade dos PVs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[200px] overflow-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>PV</TableHead>
                          <TableHead>CT (m)</TableHead>
                          <TableHead>CF (m)</TableHead>
                          <TableHead>Prof. (m)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {pvNodes.map(n => {
                            const depth = calcPVDepth(n.cotaTerreno, n.cotaFundo);
                            return (
                              <TableRow key={n.id}>
                                <TableCell className="font-medium">{n.id}</TableCell>
                                <TableCell>{n.cotaTerreno.toFixed(2)}</TableCell>
                                <TableCell>{n.cotaFundo.toFixed(2)}</TableCell>
                                <TableCell className={depth > 4 ? "font-semibold text-red-600" : ""}>{depth.toFixed(2)}</TableCell>
                                <TableCell>
                                  {depth <= 4
                                    ? <Badge className="bg-green-500/20 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                                    : <Badge variant="destructive" className="bg-yellow-500/20 text-yellow-700"><AlertTriangle className="h-3 w-3 mr-1" />&gt;4m</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
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
                        <TableHead>Trecho</TableHead><TableHead>DN (mm)</TableHead><TableHead>DN Calc</TableHead>
                        <TableHead>V (m/s)</TableHead><TableHead>V Crit</TableHead><TableHead>y/D</TableHead>
                        <TableHead>t (Pa)</TableHead><TableHead>Decl. (%)</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
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
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
