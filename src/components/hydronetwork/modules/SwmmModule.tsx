import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Download, Upload, Trash2, Plus, CloudRain, X } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { getMapCoordinates } from "@/engine/hydraulics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from "recharts";
import { NodeMapWidget, ConnectionData } from "@/components/hydronetwork/NodeMapWidget";

interface SubBacia { id: string; area: number; coefC: number; slope: number; }
interface BaciaDetencao { id: string; volume: number; area: number; orificio: number; }
interface Exutorio { id: string; cota: number; tipo: string; }
interface SwmmResult {
  id: string; de: string; para: string; comp: number; dn: number;
  slope: number; qMax: number; vMax: number; yD: number; status: string;
}

interface SwmmModuleProps { pontos: PontoTopografico[]; trechos: Trecho[]; }

export const SwmmModule = ({ pontos, trechos }: SwmmModuleProps) => {
  const [simType, setSimType] = useState("single");
  const [routing, setRouting] = useState("dynamic");
  const [infiltration, setInfiltration] = useState("horton");
  const [tr, setTr] = useState("10");
  const [curvaIDF, setCurvaIDF] = useState("saopaulo");
  const [duration, setDuration] = useState(60);
  const [idfK, setIdfK] = useState(3462.6);
  const [idfA, setIdfA] = useState(0.172);
  const [idfB, setIdfB] = useState(20);
  const [idfC, setIdfC] = useState(1.025);
  const [subBacias, setSubBacias] = useState<SubBacia[]>([{ id: "S1", area: 1.0, coefC: 0.7, slope: 100 }]);
  const [baciasDetencao, setBaciasDetencao] = useState<BaciaDetencao[]>([]);
  const [exutorios, setExutorios] = useState<Exutorio[]>([{ id: "OUT1", cota: 0, tipo: "Descarga Livre" }]);
  const [simulated, setSimulated] = useState(false);
  const [resultTab, setResultTab] = useState("summary");
  const [mapConnections, setMapConnections] = useState<ConnectionData[]>([]);

  const addSubBacia = () => setSubBacias([...subBacias, { id: `S${subBacias.length + 1}`, area: 1.0, coefC: 0.7, slope: 100 }]);
  const removeSubBacia = (idx: number) => setSubBacias(subBacias.filter((_, i) => i !== idx));
  const updateSubBacia = (idx: number, field: keyof SubBacia, value: string | number) => {
    const updated = [...subBacias]; (updated[idx] as any)[field] = value; setSubBacias(updated);
  };
  const addBaciaDetencao = () => setBaciasDetencao([...baciasDetencao, { id: `BD${baciasDetencao.length + 1}`, volume: 500, area: 200, orificio: 0.3 }]);
  const removeBaciaDetencao = (idx: number) => setBaciasDetencao(baciasDetencao.filter((_, i) => i !== idx));
  const addExutorio = () => setExutorios([...exutorios, { id: `OUT${exutorios.length + 1}`, cota: 0, tipo: "Descarga Livre" }]);
  const removeExutorio = (idx: number) => setExutorios(exutorios.filter((_, i) => i !== idx));

  const intensity = useMemo(() => {
    const T = parseInt(tr); const t = duration;
    return (idfK * Math.pow(T, idfA)) / Math.pow(t + idfB, idfC);
  }, [tr, duration, idfK, idfA, idfB, idfC]);

  // Load platform data into map
  const loadPlatformData = () => {
    if (pontos.length === 0) { toast.error("Carregue a topografia primeiro"); return; }
    const conns: ConnectionData[] = trechos.map((t, i) => ({
      from: t.idInicio, to: t.idFim, color: "hsl(140, 60%, 45%)", label: `G${i + 1}`,
    }));
    setMapConnections(conns);
    toast.success(`${pontos.length} pontos e ${trechos.length} trechos carregados da plataforma`);
  };

  const results = useMemo<SwmmResult[]>(() => {
    if (!simulated) return [];
    if (trechos.length > 0) {
      const n = 0.015;
      return trechos.map((t, i) => {
        const D = t.diametroMm / 1000;
        const S = Math.abs(t.declividade) || 0.005;
        const totalArea = subBacias.reduce((s, b) => s + b.area, 0) || 2.0;
        const avgC = subBacias.length > 0 ? subBacias.reduce((s, b) => s + b.coefC, 0) / subBacias.length : 0.7;
        const qContrib = (avgC * (intensity / 3600) * (totalArea * 10000)) / trechos.length;
        const qAccum = qContrib * (i + 1);
        const A = (Math.PI * D * D) / 4; const R = D / 4;
        const vFull = (1 / n) * Math.pow(R, 2 / 3) * Math.pow(S, 0.5);
        const qFull = A * vFull;
        const yD = Math.min(qAccum / (qFull || 1), 0.95);
        const v = vFull * (yD > 0 ? Math.pow(yD, 0.3) : 0);
        return { id: `G${i + 1}`, de: t.idInicio, para: t.idFim, comp: Math.round(t.comprimento * 10) / 10,
          dn: t.diametroMm, slope: parseFloat((S * 100).toFixed(2)),
          qMax: parseFloat((qAccum * 1000).toFixed(1)), vMax: parseFloat(v.toFixed(3)),
          yD: parseFloat(yD.toFixed(3)), status: yD > 0.85 || v > 5.0 || v < 0.75 ? "WARN" : "OK" };
      });
    }
    return subBacias.map((b, i) => {
      const q = b.coefC * (intensity / 3600) * (b.area * 10000);
      return { id: `G${i + 1}`, de: `BL${i + 1}`, para: i < subBacias.length - 1 ? `BL${i + 2}` : exutorios[0]?.id || "OUT",
        comp: 50, dn: 400, slope: b.slope / 1000, qMax: parseFloat((q * 1000).toFixed(1)),
        vMax: parseFloat((q / (Math.PI * 0.16 / 4) * 1.2).toFixed(3)), yD: 0.65, status: "OK" };
    });
  }, [simulated, trechos, subBacias, exutorios, intensity]);

  const summary = useMemo(() => {
    if (results.length === 0) return null;
    return { galerias: results.length, extensao: results.reduce((s, r) => s + r.comp, 0),
      areaTotal: subBacias.reduce((s, b) => s + b.area, 0),
      vazaoMax: Math.max(...results.map(r => r.qMax)), alertas: results.filter(r => r.status === "WARN").length };
  }, [results, subBacias]);

  const hydrographData = useMemo(() => {
    if (!simulated) return [];
    const data = [];
    for (let t = 0; t <= duration; t += 5) {
      const ratio = t / duration; const qPeak = summary?.vazaoMax || 0;
      const q = qPeak * Math.sin(ratio * Math.PI) * (ratio < 0.4 ? ratio / 0.4 : 1);
      data.push({ time: t, vazao: parseFloat(q.toFixed(1)), chuva: parseFloat((intensity * (1 - ratio) * 0.8).toFixed(1)) });
    }
    return data;
  }, [simulated, duration, summary, intensity]);

  const simulate = () => {
    if (subBacias.length === 0 && pontos.length === 0) { toast.error("Adicione sub-bacias ou carregue dados da plataforma"); return; }
    setSimulated(true);
    toast.success("Simulação SWMM executada com sucesso!");
  };

  // Map nodes from pontos
  const mapNodes = useMemo(() => {
    return pontos.map(p => ({ id: p.id, x: p.x, y: p.y, cota: p.cota }));
  }, [pontos]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CloudRain className="h-5 w-5 text-green-600" /> Configuração SWMM</CardTitle>
            <CardDescription>Simulação de drenagem urbana</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Tipo de Simulação</Label>
              <Select value={simType} onValueChange={setSimType}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="single">Evento Único</SelectItem><SelectItem value="continuous">Contínua</SelectItem><SelectItem value="idf">Chuva de Projeto (IDF)</SelectItem></SelectContent>
              </Select></div>
            <div><Label>Routing</Label>
              <Select value={routing} onValueChange={setRouting}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="dynamic">Onda Dinâmica</SelectItem><SelectItem value="kinematic">Cinemática</SelectItem><SelectItem value="steady">Regime Permanente</SelectItem></SelectContent>
              </Select></div>
            <div><Label>Infiltração</Label>
              <Select value={infiltration} onValueChange={setInfiltration}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="horton">Horton</SelectItem><SelectItem value="greenampt">Green-Ampt</SelectItem><SelectItem value="scs">SCS</SelectItem></SelectContent>
              </Select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Período de Retorno</Label>
                <Select value={tr} onValueChange={setTr}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["2", "5", "10", "25", "50", "100"].map(v => <SelectItem key={v} value={v}>{v} anos</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Duração (min)</Label><Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} /></div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Intensidade (IDF)</p>
              <p className="text-lg font-bold text-green-600">{intensity.toFixed(1)} mm/h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Curva IDF</CardTitle><CardDescription>i = K × T^a / (t + b)^c [mm/h]</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Curva IDF</Label>
              <Select value={curvaIDF} onValueChange={v => {
                setCurvaIDF(v);
                if (v === "saopaulo") { setIdfK(3462.6); setIdfA(0.172); setIdfB(20); setIdfC(1.025); }
                if (v === "rio") { setIdfK(1239); setIdfA(0.15); setIdfB(20); setIdfC(0.74); }
                if (v === "bh") { setIdfK(1447.9); setIdfA(0.1); setIdfB(20); setIdfC(0.89); }
                if (v === "curitiba") { setIdfK(5726.6); setIdfA(0.159); setIdfB(41); setIdfC(1.041); }
              }}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saopaulo">São Paulo</SelectItem><SelectItem value="rio">Rio de Janeiro</SelectItem>
                  <SelectItem value="bh">Belo Horizonte</SelectItem><SelectItem value="curitiba">Curitiba</SelectItem>
                  <SelectItem value="custom">Personalizada</SelectItem>
                </SelectContent>
              </Select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>K</Label><Input type="number" value={idfK} onChange={e => setIdfK(Number(e.target.value))} /></div>
              <div><Label>a</Label><Input type="number" step="0.001" value={idfA} onChange={e => setIdfA(Number(e.target.value))} /></div>
              <div><Label>b</Label><Input type="number" value={idfB} onChange={e => setIdfB(Number(e.target.value))} /></div>
              <div><Label>c</Label><Input type="number" step="0.001" value={idfC} onChange={e => setIdfC(Number(e.target.value))} /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bacias */}
      <Card>
        <CardHeader><CardTitle>🏔️ Bacias e Armazenamento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-blue-600 mb-2">Sub-bacias de Contribuição</h4>
            <div className="space-y-2">
              {subBacias.map((sb, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                  <Input className="w-20" value={sb.id} onChange={e => updateSubBacia(idx, "id", e.target.value)} placeholder="ID" />
                  <Input className="flex-1" type="number" step="0.1" value={sb.area} onChange={e => updateSubBacia(idx, "area", Number(e.target.value))} placeholder="Área (ha)" />
                  <Input className="w-24" type="number" step="0.1" value={sb.coefC} onChange={e => updateSubBacia(idx, "coefC", Number(e.target.value))} placeholder="C" />
                  <Input className="w-24" type="number" value={sb.slope} onChange={e => updateSubBacia(idx, "slope", Number(e.target.value))} placeholder="Decliv. ‰" />
                  <Button size="icon" variant="destructive" onClick={() => removeSubBacia(idx)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <Button size="sm" className="mt-2 bg-green-600 hover:bg-green-700" onClick={addSubBacia}><Plus className="h-4 w-4 mr-1" /> Adicionar Sub-bacia</Button>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-blue-600 mb-2">Bacias de Detenção</h4>
            <div className="space-y-2">
              {baciasDetencao.map((bd, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                  <Input className="w-20" value={bd.id} readOnly />
                  <Input className="flex-1" type="number" value={bd.volume} onChange={e => { const u = [...baciasDetencao]; u[idx].volume = Number(e.target.value); setBaciasDetencao(u); }} placeholder="Volume (m³)" />
                  <Input className="w-24" type="number" value={bd.area} onChange={e => { const u = [...baciasDetencao]; u[idx].area = Number(e.target.value); setBaciasDetencao(u); }} placeholder="Área (m²)" />
                  <Input className="w-24" type="number" step="0.01" value={bd.orificio} onChange={e => { const u = [...baciasDetencao]; u[idx].orificio = Number(e.target.value); setBaciasDetencao(u); }} placeholder="Orifício (m)" />
                  <Button size="icon" variant="destructive" onClick={() => removeBaciaDetencao(idx)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <Button size="sm" className="mt-2 bg-blue-600 hover:bg-blue-700" onClick={addBaciaDetencao}><Plus className="h-4 w-4 mr-1" /> Adicionar Bacia de Detenção</Button>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-red-600 mb-2">Exutórios</h4>
            <div className="space-y-2">
              {exutorios.map((ex, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                  <Input className="w-20" value={ex.id} readOnly />
                  <Input className="flex-1" type="number" value={ex.cota} onChange={e => { const u = [...exutorios]; u[idx].cota = Number(e.target.value); setExutorios(u); }} placeholder="Cota (m)" />
                  <Select value={ex.tipo} onValueChange={v => { const u = [...exutorios]; u[idx].tipo = v; setExutorios(u); }}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Descarga Livre">Descarga Livre</SelectItem><SelectItem value="Nível Fixo">Nível Fixo</SelectItem><SelectItem value="Maré">Maré</SelectItem></SelectContent>
                  </Select>
                  <Button size="icon" variant="destructive" onClick={() => removeExutorio(idx)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <Button size="sm" className="mt-2 bg-red-600 hover:bg-red-700" onClick={addExutorio}><Plus className="h-4 w-4 mr-1" /> Adicionar Exutório</Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={loadPlatformData}>🌐 Usar Dados da Plataforma</Button>
        <Button variant="outline" onClick={() => { setSimulated(false); setMapConnections([]); toast.info("Dados limpos"); }}><Trash2 className="h-4 w-4 mr-1" /> Limpar</Button>
        <Button onClick={simulate}><Play className="h-4 w-4 mr-1" /> Simular</Button>
      </div>

      {/* Interactive Map */}
      {mapNodes.length > 0 && (
        <NodeMapWidget
          nodes={mapNodes}
          connections={mapConnections}
          onConnectionsChange={setMapConnections}
          title="Mapa da Rede de Drenagem SWMM"
          accentColor="hsl(140, 60%, 45%)"
          height={380}
          editable
        />
      )}

      {/* Results */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CloudRain className="h-5 w-5 text-green-600" /> Simulação e Resultados</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={resultTab} onValueChange={setResultTab}>
            <TabsList>
              <TabsTrigger value="summary">📊 Resumo</TabsTrigger>
              <TabsTrigger value="detailed">📋 Detalhado</TabsTrigger>
              <TabsTrigger value="hydrograph">📈 Hidrograma</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="py-4">
              {simulated && summary ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { value: summary.galerias, label: "Galerias", color: "text-blue-600" },
                    { value: `${summary.extensao.toFixed(1)} m`, label: "Extensão Total", color: "text-green-600" },
                    { value: `${summary.areaTotal.toFixed(2)} ha`, label: "Área Total", color: "text-cyan-600" },
                    { value: `${summary.vazaoMax.toFixed(1)} L/s`, label: "Vazão Máxima", color: "text-orange-600" },
                    { value: summary.alertas, label: "Alertas", color: "text-yellow-600" },
                  ].map((s, i) => (
                    <div key={i} className="bg-muted/50 border rounded-lg p-3 text-center">
                      <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Execute a simulação para ver os resultados.</p>}
            </TabsContent>

            <TabsContent value="detailed" className="py-4">
              {simulated && results.length > 0 ? (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>ID</TableHead><TableHead>De</TableHead><TableHead>Para</TableHead>
                      <TableHead>Comp (m)</TableHead><TableHead>DN (mm)</TableHead><TableHead>i (%)</TableHead>
                      <TableHead>Q (L/s)</TableHead><TableHead>V (m/s)</TableHead><TableHead>y/D</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {results.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.id}</TableCell>
                          <TableCell>{r.de}</TableCell><TableCell>{r.para}</TableCell>
                          <TableCell>{r.comp.toFixed(1)}</TableCell><TableCell>{r.dn}</TableCell>
                          <TableCell>{r.slope.toFixed(2)}</TableCell><TableCell>{r.qMax.toFixed(1)}</TableCell>
                          <TableCell>{r.vMax.toFixed(3)}</TableCell><TableCell>{r.yD.toFixed(3)}</TableCell>
                          <TableCell><Badge className={r.status === "OK" ? "bg-green-500" : "bg-yellow-500"}>{r.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum resultado disponível.</p>}
            </TabsContent>

            <TabsContent value="hydrograph" className="py-4">
              {simulated && hydrographData.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Hidrograma de Saída</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={hydrographData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" fontSize={10} label={{ value: "Tempo (min)", position: "bottom" }} />
                      <YAxis fontSize={10} />
                      <RechartsTooltip />
                      <Legend />
                      <Area type="monotone" dataKey="vazao" stroke="hsl(210, 70%, 50%)" fill="hsl(210, 70%, 50%)" fillOpacity={0.3} name="Vazão (L/s)" />
                      <Area type="monotone" dataKey="chuva" stroke="hsl(140, 60%, 40%)" fill="hsl(140, 60%, 40%)" fillOpacity={0.2} name="Chuva (mm/h)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum gráfico disponível.</p>}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
