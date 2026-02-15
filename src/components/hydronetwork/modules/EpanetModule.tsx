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
import { Play, Download, Upload, Trash2, ZoomIn, ZoomOut, Maximize, MousePointer2, GitBranch, Circle, Square, Minus, Droplets } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { hazenWilliamsHeadloss, hazenWilliamsVelocity, getMapCoordinates } from "@/engine/hydraulics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type ToolType = "select" | "junction" | "reservoir" | "tank" | "pipe" | "pump" | "valve" | "delete";

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
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [resultTab, setResultTab] = useState("summary");
  const [nodes, setNodes] = useState<EpanetNode[]>([]);
  const [links, setLinks] = useState<EpanetLink[]>([]);
  const [simulated, setSimulated] = useState(false);
  const [selectedElement, setSelectedElement] = useState<EpanetNode | null>(null);

  const tools: { id: ToolType; label: string; icon: any }[] = [
    { id: "select", label: "Selecionar", icon: MousePointer2 },
    { id: "junction", label: "Junção", icon: Circle },
    { id: "reservoir", label: "Reservatório", icon: Square },
    { id: "tank", label: "Tanque", icon: Square },
    { id: "pipe", label: "Tubo", icon: Minus },
    { id: "pump", label: "Bomba", icon: GitBranch },
    { id: "valve", label: "Válvula", icon: GitBranch },
    { id: "delete", label: "Excluir", icon: Trash2 },
  ];

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
    toast.success(`${newNodes.length} nós e ${newLinks.length} trechos carregados da plataforma`);
  };

  const clearData = () => {
    setNodes([]); setLinks([]); setSimulated(false); setSelectedElement(null);
    toast.info("Dados limpos");
  };

  // Simulate
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
    return {
      demandaTotal: totalDemanda,
      pressaoMin: Math.min(...pressoes),
      velMax: Math.max(...velocidades),
    };
  }, [simulated, nodeResults, linkResults, nodes]);

  const simulate = () => {
    if (nodes.length < 2) { toast.error("Carregue dados primeiro"); return; }
    setSimulated(true);
    toast.success("Simulação EPANET executada com sucesso!");
  };

  // Leaflet map
  const epanetMapRef = useRef<L.Map | null>(null);
  const epanetMapContainerRef = useRef<HTMLDivElement>(null);
  const epanetMarkersRef = useRef<L.CircleMarker[]>([]);
  const epanetLinesRef = useRef<L.Polyline[]>([]);

  useEffect(() => {
    if (!epanetMapContainerRef.current || epanetMapRef.current) return;
    const map = L.map(epanetMapContainerRef.current, { zoomControl: true }).setView([-23.55, -46.63], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
    epanetMapRef.current = map;
    return () => { map.remove(); epanetMapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = epanetMapRef.current;
    if (!map || nodes.length === 0) return;
    epanetMarkersRef.current.forEach(m => m.remove());
    epanetLinesRef.current.forEach(l => l.remove());
    epanetMarkersRef.current = [];
    epanetLinesRef.current = [];

    const bounds: L.LatLngExpression[] = [];
    nodes.forEach(n => {
      const coords = getMapCoordinates(n.x, n.y);
      bounds.push(coords);
      const nr = nodeResults.find(r => r.id === n.id);
      const color = nr ? (nr.pressao >= 10 ? "#22c55e" : "#ef4444") : "#3b82f6";
      const marker = L.circleMarker(coords, { radius: 8, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9 }).addTo(map);
      marker.bindPopup(`<b>${n.id}</b><br>Cota: ${n.cota.toFixed(3)}m<br>Demanda: ${n.demanda} L/s${nr ? `<br>Pressão: ${nr.pressao.toFixed(2)} mca` : ""}`);
      marker.on("click", () => setSelectedElement(n));
      epanetMarkersRef.current.push(marker);
    });

    links.forEach(l => {
      const n1 = nodes.find(n => n.id === l.de);
      const n2 = nodes.find(n => n.id === l.para);
      if (!n1 || !n2) return;
      const c1 = getMapCoordinates(n1.x, n1.y);
      const c2 = getMapCoordinates(n2.x, n2.y);
      const lr = linkResults.find(r => r.id === l.id);
      const color = lr?.status === "WARN" ? "#ef4444" : "#3b82f6";
      const line = L.polyline([c1, c2], { color, weight: 3, opacity: 0.8 }).addTo(map);
      line.bindPopup(`<b>${l.id}</b><br>DN${l.dn} | C=${l.c}<br>Comp: ${l.comp}m${lr ? `<br>V: ${lr.v} m/s | hf: ${lr.hf}m` : ""}`);
      epanetLinesRef.current.push(line);
    });

    if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
  }, [nodes, links, nodeResults, linkResults]);

  // Chart data
  const pressureChartData = useMemo(() => {
    return nodeResults.map(n => ({ name: n.id, pressao: n.pressao, cota: n.cota }));
  }, [nodeResults]);

  const velocityChartData = useMemo(() => {
    return linkResults.map(l => ({ name: l.id, velocidade: l.v, hf: l.hf }));
  }, [linkResults]);

  const stats = {
    juncoes: nodes.length,
    reservatorios: 0,
    tanques: 0,
    tubos: links.length,
    bombas: 0,
    valvulas: 0,
    extensao: links.reduce((s, l) => s + l.comp, 0),
  };

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Droplets className="h-5 w-5 text-blue-600" /> EPANET - Análise Hidráulica de Redes de Água</CardTitle>
          <CardDescription>Importe seus dados ou use os dados já carregados na plataforma. Suporta arquivos .INP (EPANET), CSV, e dados do módulo de Topografia.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4 text-center">
              <div className="text-3xl">📍</div>
              <div className="text-3xl font-bold text-blue-600">{stats.juncoes}</div>
              <div className="text-xs font-semibold text-muted-foreground">NÓS CARREGADOS</div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 border-2 border-green-300 dark:border-green-700 rounded-xl p-4 text-center">
              <div className="text-3xl">🔗</div>
              <div className="text-3xl font-bold text-green-600">{stats.tubos}</div>
              <div className="text-xs font-semibold text-muted-foreground">TRECHOS CARREGADOS</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-4 text-center">
              <div className="text-3xl">🏔️</div>
              <div className="text-3xl font-bold text-yellow-600">{stats.reservatorios}</div>
              <div className="text-xs font-semibold text-muted-foreground">RESERVATÓRIOS</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-4 text-center">
              <div className="text-3xl">⚡</div>
              <div className="text-3xl font-bold text-purple-600">{stats.bombas}</div>
              <div className="text-xs font-semibold text-muted-foreground">BOMBAS</div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="bg-blue-600 text-white hover:bg-blue-700"><Upload className="h-4 w-4 mr-1" /> Importar Arquivo .INP</Button>
            <Button variant="outline" className="bg-emerald-600 text-white hover:bg-emerald-700"><Upload className="h-4 w-4 mr-1" /> Importar CSV</Button>
            <Button variant="outline" onClick={loadPlatformData}>🌐 Usar Dados da Plataforma</Button>
            <Button variant="outline" onClick={clearData}><Trash2 className="h-4 w-4 mr-1" /> Limpar Dados</Button>
          </div>
        </CardContent>
      </Card>

      {/* Main layout: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_260px] gap-4">
        {/* Left sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ferramentas</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-1">
                {tools.map(t => (
                  <Button key={t.id} size="icon" variant={activeTool === t.id ? "default" : "outline"} onClick={() => setActiveTool(t.id)} title={t.label}>
                    <t.icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Elementos da Rede</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>📍 Junções ( {stats.juncoes} )</p>
              <p>🏔️ Reservatórios ( {stats.reservatorios} )</p>
              <p>🟥 Tanques ( {stats.tanques} )</p>
              <p>➖ Tubos ( {stats.tubos} )</p>
              <p>⚡ Bombas ( {stats.bombas} )</p>
              <p>🔧 Válvulas ( {stats.valvulas} )</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Configurações</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-xs">Tipo de Análise</Label>
                <Select value={analysisType} onValueChange={setAnalysisType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="steady">Regime Permanente</SelectItem>
                    <SelectItem value="extended">Período Estendido</SelectItem>
                    <SelectItem value="quality">Qualidade da Água</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Unidades de Vazão</Label>
                <Select value={flowUnits} onValueChange={setFlowUnits}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LPS">LPS (L/s)</SelectItem>
                    <SelectItem value="CMH">CMH (m³/h)</SelectItem>
                    <SelectItem value="GPM">GPM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Perda de Carga</Label>
                <Select value={headloss} onValueChange={setHeadloss}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HW">Hazen-Williams</SelectItem>
                    <SelectItem value="DW">Darcy-Weisbach</SelectItem>
                    <SelectItem value="CM">Chezy-Manning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Duração (horas)</Label><Input type="number" className="h-8 text-xs" value={duration} onChange={e => setDuration(Number(e.target.value))} /></div>
            </CardContent>
          </Card>
        </div>

        {/* Center - Canvas */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline"><ZoomIn className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline"><ZoomOut className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline"><Maximize className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground ml-2">Zoom: 100%</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={simulate}><Play className="h-4 w-4 mr-1" /> Simular</Button>
              <Button size="sm" variant="outline" className="bg-emerald-600 text-white hover:bg-emerald-700"><Download className="h-4 w-4 mr-1" /> Exportar .INP</Button>
              <Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-1" /> Importar .INP</Button>
              <Button size="sm" variant="outline">📂 Carregar Rede</Button>
            </div>
          </div>
          <Card>
            <CardContent className="p-2">
              <div
                ref={epanetMapContainerRef}
                className="w-full rounded-lg border border-border overflow-hidden"
                style={{ height: 400 }}
              />
            </CardContent>
          </Card>

          {/* Results tabs */}
          <Card>
            <CardContent className="pt-4">
              <Tabs value={resultTab} onValueChange={setResultTab}>
                <TabsList>
                  <TabsTrigger value="summary">📊 Resumo</TabsTrigger>
                  <TabsTrigger value="nodes">📍 Nós</TabsTrigger>
                  <TabsTrigger value="links">➖ Trechos</TabsTrigger>
                  <TabsTrigger value="charts">📈 Gráficos</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="py-4">
                  {simulated && summary ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4 text-center">
                        <div className="text-3xl mb-1">💧</div>
                        <div className="text-2xl font-bold text-blue-600">{summary.demandaTotal.toFixed(1)}</div>
                        <div className="text-xs font-semibold text-muted-foreground">DEMANDA TOTAL (L/S)</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/30 border-2 border-green-300 dark:border-green-700 rounded-xl p-4 text-center">
                        <div className="text-3xl mb-1">📉</div>
                        <div className="text-2xl font-bold text-green-600">{summary.pressaoMin.toFixed(1)}</div>
                        <div className="text-xs font-semibold text-muted-foreground">PRESSÃO MÍN (MCA)</div>
                      </div>
                      <div className="bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-4 text-center">
                        <div className="text-3xl mb-1">📈</div>
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
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead><TableHead>Cota (m)</TableHead>
                            <TableHead>Demanda (L/s)</TableHead><TableHead>Pressão (mca)</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {nodeResults.map(n => (
                            <TableRow key={n.id}>
                              <TableCell className="font-medium">{n.id}</TableCell>
                              <TableCell>{n.cota.toFixed(3)}</TableCell>
                              <TableCell>{n.demanda.toFixed(1)}</TableCell>
                              <TableCell>{n.pressao.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge className={n.pressao >= 10 ? "bg-green-500" : "bg-yellow-500"}>
                                  {n.pressao >= 10 ? "OK" : "WARN"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum nó simulado.</p>
                  )}
                </TabsContent>

                <TabsContent value="links" className="py-4">
                  {simulated && linkResults.length > 0 ? (
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead><TableHead>De</TableHead><TableHead>Para</TableHead>
                            <TableHead>Comp (m)</TableHead><TableHead>DN (mm)</TableHead>
                            <TableHead>Q (L/s)</TableHead><TableHead>V (m/s)</TableHead>
                            <TableHead>hf (m)</TableHead><TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {linkResults.map(l => (
                            <TableRow key={l.id}>
                              <TableCell className="font-medium">{l.id}</TableCell>
                              <TableCell>{l.de}</TableCell>
                              <TableCell>{l.para}</TableCell>
                              <TableCell>{l.comp.toFixed(1)}</TableCell>
                              <TableCell>{l.dn}</TableCell>
                              <TableCell>{l.q.toFixed(2)}</TableCell>
                              <TableCell>{l.v.toFixed(3)}</TableCell>
                              <TableCell>{l.hf.toFixed(4)}</TableCell>
                              <TableCell>
                                <Badge className={l.status === "OK" ? "bg-green-500" : "bg-yellow-500"}>{l.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum trecho simulado.</p>
                  )}
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
                        <h4 className="text-sm font-semibold mb-2">Velocidade e Perda de Carga por Trecho</h4>
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
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum gráfico disponível.</p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Propriedades</CardTitle></CardHeader>
            <CardContent>
              {selectedElement ? (
                <div className="space-y-2 text-sm">
                  <p><strong>ID:</strong> {selectedElement.id}</p>
                  <p><strong>X:</strong> {selectedElement.x.toFixed(3)}</p>
                  <p><strong>Y:</strong> {selectedElement.y.toFixed(3)}</p>
                  <p><strong>Cota:</strong> {selectedElement.cota.toFixed(3)} m</p>
                  <p><strong>Demanda:</strong> {selectedElement.demanda.toFixed(1)} L/s</p>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <div className="text-3xl mb-2">🔍</div>
                  <p className="text-sm">Selecione um elemento para ver suas propriedades</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Estatísticas da Rede</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="flex justify-between"><span>Junções:</span><span className="font-bold">{stats.juncoes}</span></div>
              <div className="flex justify-between"><span>Reservatórios:</span><span className="font-bold">{stats.reservatorios}</span></div>
              <div className="flex justify-between"><span>Tanques:</span><span className="font-bold">{stats.tanques}</span></div>
              <div className="flex justify-between"><span>Tubos:</span><span className="font-bold">{stats.tubos}</span></div>
              <div className="flex justify-between"><span>Bombas:</span><span className="font-bold">{stats.bombas}</span></div>
              <div className="flex justify-between"><span>Válvulas:</span><span className="font-bold">{stats.valvulas}</span></div>
              <hr className="my-2" />
              <div className="flex justify-between"><span>Extensão Total:</span><span className="font-bold">{stats.extensao.toFixed(1)} m</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
