import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Download, Upload, Trash2, Droplets, MapPin, Link, Mountain, Zap, Globe, BarChart3, TrendingUp } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { hazenWilliamsHeadloss, hazenWilliamsVelocity } from "@/engine/hydraulics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { NodeMapWidget, ConnectionData } from "@/components/hydronetwork/NodeMapWidget";

interface EpanetNode {
  id: string; x: number; y: number; cota: number; demanda: number;
}

interface EpanetLink {
  id: string; de: string; para: string; comp: number; dn: number; c: number;
}

interface EpanetModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
}

export const EpanetModule = ({ pontos, trechos }: EpanetModuleProps) => {
  const [analysisType, setAnalysisType] = useState("steady");
  const [flowUnits, setFlowUnits] = useState("LPS");
  const [headloss, setHeadloss] = useState("HW");
  const [duration, setDuration] = useState(24);
  const [resultTab, setResultTab] = useState("summary");
  const [nodes, setNodes] = useState<EpanetNode[]>([]);
  const [links, setLinks] = useState<EpanetLink[]>([]);
  const [simulated, setSimulated] = useState(false);
  const [selectedElement, setSelectedElement] = useState<EpanetNode | null>(null);
  const [mapConnections, setMapConnections] = useState<ConnectionData[]>([]);

  const loadPlatformData = () => {
    if (pontos.length === 0) { toast.error("Nenhum dado na plataforma. Carregue a topografia primeiro."); return; }
    const newNodes = pontos.map(p => ({ id: p.id, x: p.x, y: p.y, cota: p.cota, demanda: 2.0 }));
    const newLinks = trechos.map((t, i) => ({
      id: `L${i + 1}`, de: t.idInicio, para: t.idFim,
      comp: Math.round(t.comprimento * 10) / 10, dn: t.diametroMm, c: 140,
    }));
    setNodes(newNodes);
    setLinks(newLinks);
    setSimulated(false);
    // Auto-generate map connections
    const conns: ConnectionData[] = newLinks.map(l => ({
      from: l.de, to: l.para, color: "hsl(210, 70%, 50%)", label: `${l.id}: DN${l.dn}`,
    }));
    setMapConnections(conns);
    toast.success(`${newNodes.length} nós e ${newLinks.length} trechos carregados da plataforma`);
  };

  const clearData = () => {
    setNodes([]); setLinks([]); setSimulated(false); setSelectedElement(null);
    setMapConnections([]);
    toast.info("Dados limpos");
  };

  const nodeResults = useMemo(() => {
    if (!simulated || nodes.length === 0) return [];
    let cumulativeHf = 0;
    return nodes.map((n, i) => {
      if (i > 0 && links[i - 1]) {
        const l = links[i - 1];
        const q = n.demanda / 1000;
        const D = l.dn / 1000;
        const hf = hazenWilliamsHeadloss(q, D, l.comp, l.c);
        cumulativeHf += hf;
      }
      const pressao = nodes[0].cota - n.cota - cumulativeHf;
      return { ...n, pressao: parseFloat(pressao.toFixed(2)), hf: parseFloat(cumulativeHf.toFixed(4)) };
    });
  }, [simulated, nodes, links]);

  const linkResults = useMemo(() => {
    if (!simulated || links.length === 0) return [];
    return links.map(l => {
      const node = nodes.find(n => n.id === l.de);
      const q = (node?.demanda || 2) / 1000;
      const D = l.dn / 1000;
      const v = hazenWilliamsVelocity(q, D);
      const hf = hazenWilliamsHeadloss(q, D, l.comp, l.c);
      return { ...l, q: node?.demanda || 2, v: parseFloat(v.toFixed(3)), hf: parseFloat(hf.toFixed(4)), status: v > 3.5 ? "WARN" : "OK" };
    });
  }, [simulated, links, nodes]);

  const summary = useMemo(() => {
    if (!simulated || nodeResults.length === 0) return null;
    const totalDemanda = nodes.reduce((s, n) => s + n.demanda, 0);
    const pressoes = nodeResults.map(n => n.pressao);
    const velocidades = linkResults.map(l => l.v);
    return { demandaTotal: totalDemanda, pressaoMin: Math.min(...pressoes), velMax: Math.max(...velocidades) };
  }, [simulated, nodeResults, linkResults, nodes]);

  const simulate = () => {
    if (nodes.length < 2) { toast.error("Carregue dados primeiro"); return; }
    setSimulated(true);
    toast.success("Simulação EPANET executada com sucesso!");
  };

  const pressureChartData = useMemo(() => nodeResults.map(n => ({ name: n.id, pressao: n.pressao, cota: n.cota })), [nodeResults]);
  const velocityChartData = useMemo(() => linkResults.map(l => ({ name: l.id, velocidade: l.v, hf: l.hf })), [linkResults]);

  const handleNodeDemandChange = (nodeId: string, demanda: number) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, demanda } : n));
    setSimulated(false);
  };

  const stats = {
    juncoes: nodes.length, reservatorios: 0, tanques: 0, tubos: links.length,
    bombas: 0, valvulas: 0, extensao: links.reduce((s, l) => s + l.comp, 0),
  };

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Droplets className="h-5 w-5 text-blue-600" /> EPANET - Análise Hidráulica de Redes de Água</CardTitle>
          <CardDescription>Importe seus dados ou use os dados já carregados na plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { icon: <MapPin className="h-7 w-7 inline-block text-blue-600" />, value: stats.juncoes, label: "NÓS CARREGADOS", color: "text-blue-600" },
              { icon: <Link className="h-7 w-7 inline-block text-green-600" />, value: stats.tubos, label: "TRECHOS CARREGADOS", color: "text-green-600" },
              { icon: <Mountain className="h-7 w-7 inline-block text-yellow-600" />, value: stats.reservatorios, label: "RESERVATÓRIOS", color: "text-yellow-600" },
              { icon: <Zap className="h-7 w-7 inline-block text-purple-600" />, value: stats.bombas, label: "BOMBAS", color: "text-purple-600" },
            ].map((s, i) => (
              <div key={i} className="bg-muted/50 border p-4 text-center">
                <div className="text-3xl">{s.icon}</div>
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs font-semibold text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={loadPlatformData}><Globe className="h-4 w-4 inline-block mr-1" /> Usar Dados da Plataforma</Button>
            <Button variant="outline" onClick={clearData}><Trash2 className="h-4 w-4 mr-1" /> Limpar Dados</Button>
            <Button onClick={simulate} disabled={nodes.length < 2}><Play className="h-4 w-4 mr-1" /> Simular</Button>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Map */}
      {nodes.length > 0 && (
        <NodeMapWidget
          nodes={nodes.map(n => ({ id: n.id, x: n.x, y: n.y, cota: n.cota, demanda: n.demanda }))}
          connections={mapConnections}
          onConnectionsChange={setMapConnections}
          onNodeClick={(id) => setSelectedElement(nodes.find(n => n.id === id) || null)}
          onNodeDemandChange={handleNodeDemandChange}
          onNodesDelete={(ids) => {
            setNodes(prev => prev.filter(n => !ids.includes(n.id)));
            setLinks(prev => prev.filter(l => !ids.includes(l.de) && !ids.includes(l.para)));
            setSimulated(false);
          }}
          title="Mapa da Rede EPANET"
          accentColor="hsl(210, 70%, 50%)"
          height={400}
          editable
        />
      )}

      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Tipo de Análise</Label>
          <Select value={analysisType} onValueChange={setAnalysisType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="steady">Regime Permanente</SelectItem>
              <SelectItem value="extended">Período Estendido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Unidades</Label>
          <Select value={flowUnits} onValueChange={setFlowUnits}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LPS">LPS (L/s)</SelectItem>
              <SelectItem value="CMH">CMH (m³/h)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Perda de Carga</Label>
          <Select value={headloss} onValueChange={setHeadloss}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HW">Hazen-Williams</SelectItem>
              <SelectItem value="DW">Darcy-Weisbach</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Duração (h)</Label><Input type="number" className="h-8 text-xs" value={duration} onChange={e => setDuration(Number(e.target.value))} /></div>
      </div>

      {/* Results */}
      <Card>
        <CardContent className="pt-4">
          <Tabs value={resultTab} onValueChange={setResultTab}>
            <TabsList>
              <TabsTrigger value="summary"><><BarChart3 className="h-4 w-4 inline-block mr-1" /> Resumo</></TabsTrigger>
              <TabsTrigger value="nodes"><><MapPin className="h-4 w-4 inline-block mr-1" /> Nós</></TabsTrigger>
              <TabsTrigger value="links">Trechos</TabsTrigger>
              <TabsTrigger value="charts"><><TrendingUp className="h-4 w-4 inline-block mr-1" /> Gráficos</></TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="py-4">
              {simulated && summary ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-muted/50 border p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{summary.demandaTotal.toFixed(1)}</div>
                    <div className="text-xs font-semibold text-muted-foreground">DEMANDA TOTAL (L/S)</div>
                  </div>
                  <div className="bg-muted/50 border p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{summary.pressaoMin.toFixed(1)}</div>
                    <div className="text-xs font-semibold text-muted-foreground">PRESSÃO MÍN (MCA)</div>
                  </div>
                  <div className="bg-muted/50 border p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{summary.velMax.toFixed(2)}</div>
                    <div className="text-xs font-semibold text-muted-foreground">VELOCIDADE MÁX (M/S)</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Execute uma simulação para ver os resultados.</p>
              )}
            </TabsContent>

            <TabsContent value="nodes" className="py-4">
              {simulated && nodeResults.length > 0 ? (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>ID</TableHead><TableHead>Cota (m)</TableHead>
                      <TableHead>Demanda (L/s)</TableHead><TableHead>Pressão (mca)</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {nodeResults.map(n => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium">{n.id}</TableCell>
                          <TableCell>{n.cota.toFixed(3)}</TableCell>
                          <TableCell>{n.demanda.toFixed(1)}</TableCell>
                          <TableCell>{n.pressao.toFixed(2)}</TableCell>
                          <TableCell><Badge className={n.pressao >= 10 ? "bg-green-500" : "bg-yellow-500"}>{n.pressao >= 10 ? "OK" : "WARN"}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum nó simulado.</p>}
            </TabsContent>

            <TabsContent value="links" className="py-4">
              {simulated && linkResults.length > 0 ? (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>ID</TableHead><TableHead>De</TableHead><TableHead>Para</TableHead>
                      <TableHead>Comp (m)</TableHead><TableHead>DN (mm)</TableHead>
                      <TableHead>Q (L/s)</TableHead><TableHead>V (m/s)</TableHead>
                      <TableHead>hf (m)</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {linkResults.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.id}</TableCell>
                          <TableCell>{l.de}</TableCell><TableCell>{l.para}</TableCell>
                          <TableCell>{l.comp.toFixed(1)}</TableCell><TableCell>{l.dn}</TableCell>
                          <TableCell>{l.q.toFixed(2)}</TableCell><TableCell>{l.v.toFixed(3)}</TableCell>
                          <TableCell>{l.hf.toFixed(4)}</TableCell>
                          <TableCell><Badge className={l.status === "OK" ? "bg-green-500" : "bg-yellow-500"}>{l.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum trecho simulado.</p>}
            </TabsContent>

            <TabsContent value="charts" className="py-4">
              {simulated && nodeResults.length > 0 ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Pressão nos Nós (mca)</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={pressureChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis fontSize={10} />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="pressao" stroke="hsl(210, 70%, 50%)" name="Pressão (mca)" strokeWidth={2} />
                        <Line type="monotone" dataKey="cota" stroke="hsl(140, 60%, 40%)" name="Cota (m)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Velocidade e Perda de Carga</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={velocityChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis fontSize={10} />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="velocidade" fill="hsl(25, 90%, 55%)" name="Velocidade (m/s)" />
                        <Bar dataKey="hf" fill="hsl(210, 70%, 50%)" name="hf (m)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum gráfico disponível.</p>}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Properties sidebar */}
      {selectedElement && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Propriedades: {selectedElement.id}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><strong>X:</strong> {selectedElement.x.toFixed(3)}</p>
            <p><strong>Y:</strong> {selectedElement.y.toFixed(3)}</p>
            <p><strong>Cota:</strong> {selectedElement.cota.toFixed(3)} m</p>
            <p><strong>Demanda:</strong> {selectedElement.demanda.toFixed(1)} L/s</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
