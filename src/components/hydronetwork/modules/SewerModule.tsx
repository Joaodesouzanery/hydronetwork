import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Calculator, Upload, Droplets, AlertTriangle, Link, Ruler, Zap } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { manningVelocity, raioHidraulico, areaCircular } from "@/engine/hydraulics";
import { NodeMapWidget, ConnectionData } from "@/components/hydronetwork/NodeMapWidget";

interface SewerModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange: (t: Trecho[]) => void;
}

interface SewerNode {
  id: string; x: number; y: number; cotaTerreno: number; cotaFundo: number; demanda?: number;
}

interface SewerResult {
  id: string; de: string; para: string; comp: number; dn: number;
  i: number; q: number; v: number; yD: number; status: "OK" | "WARN";
}

export const SewerModule = ({ pontos, trechos, onTrechosChange }: SewerModuleProps) => {
  const [qpc, setQpc] = useState(160);
  const [manning, setManning] = useState(0.013);
  const [velMin, setVelMin] = useState(0.6);
  const [velMax, setVelMax] = useState(5.0);
  const [laminaMax, setLaminaMax] = useState(0.75);
  const [nodes, setNodes] = useState<SewerNode[]>([]);
  const [newNode, setNewNode] = useState({ id: "", x: 0, y: 0, cotaTerreno: 0, cotaFundo: 0 });
  const [calculated, setCalculated] = useState(false);
  const [mapConnections, setMapConnections] = useState<ConnectionData[]>([]);

  const addNode = () => {
    if (!newNode.id.trim()) { toast.error("ID obrigatório"); return; }
    setNodes([...nodes, { ...newNode }]);
    setNewNode({ id: `PV${nodes.length + 2}`, x: 0, y: 0, cotaTerreno: 0, cotaFundo: 0 });
    toast.success("Nó adicionado");
  };

  const removeNode = (id: string) => setNodes(nodes.filter(n => n.id !== id));

  const transferFromTopography = () => {
    if (pontos.length === 0) { toast.error("Nenhum ponto na topografia"); return; }
    const newNodes: SewerNode[] = pontos.map(p => ({
      id: p.id, x: p.x, y: p.y, cotaTerreno: p.cota, cotaFundo: p.cota - 1.5
    }));
    setNodes(newNodes);
    // Auto-generate sequential connections
    const conns: ConnectionData[] = newNodes.slice(0, -1).map((n, i) => ({
      from: n.id, to: newNodes[i + 1].id, color: "#22c55e", label: `${n.id} → ${newNodes[i + 1].id}`
    }));
    setMapConnections(conns);
    toast.success(`${newNodes.length} nós transferidos da topografia`);
  };

  const results = useMemo<SewerResult[]>(() => {
    if (nodes.length < 2 || !calculated) return [];
    const res: SewerResult[] = [];
    const iMin = 0.005;
    const qDesign = 19.61;
    for (let i = 0; i < nodes.length - 1; i++) {
      const n1 = nodes[i]; const n2 = nodes[i + 1];
      const dx = n2.x - n1.x; const dy = n2.y - n1.y;
      const comp = Math.sqrt(dx * dx + dy * dy);
      if (comp === 0) continue;
      const slope = (n1.cotaFundo - n2.cotaFundo) / comp;
      const dn = comp > 40 ? 500 : 600;
      const D = dn / 1000;
      const sCalc = Math.abs(slope) < iMin ? iMin : Math.abs(slope);
      const yD = slope < iMin ? 0.736 : Math.min(laminaMax, 0.75);
      const yAbs = yD * D;
      const R = raioHidraulico(D, yAbs);
      const v = manningVelocity(R, sCalc, manning);
      const isWarn = slope < iMin || slope < 0;
      res.push({
        id: `T${String(i + 1).padStart(2, "0")}`, de: `P${String(i + 1).padStart(2, "0")}`,
        para: `P${String(i + 2).padStart(2, "0")}`, comp: Math.round(comp * 10) / 10,
        dn, i: slope, q: qDesign, v: parseFloat(v.toFixed(3)),
        yD: parseFloat(yD.toFixed(3)), status: isWarn ? "WARN" : "OK",
      });
    }
    return res;
  }, [nodes, calculated, manning, laminaMax]);

  const warnings = useMemo(() => results.filter(r => r.i < 0.005).map(r => ({
    trecho: `${r.de}-${r.para}`, msg: `Declividade ${(r.i * 100).toFixed(2)}% < 0.5%`,
  })), [results]);

  const summary = useMemo(() => {
    if (results.length === 0) return null;
    const totalComp = results.reduce((s, r) => s + r.comp, 0);
    const avgV = results.reduce((s, r) => s + r.v, 0) / results.length;
    return { trechos: results.length, extensao: totalComp, velMedia: avgV, alertas: warnings.length };
  }, [results, warnings]);

  const calculate = () => {
    if (nodes.length < 2) { toast.error("Mínimo 2 nós"); return; }
    setCalculated(true);
    toast.success(`Cálculo de esgoto executado com ${nodes.length} nós.`);
  };

  const loadDemo = () => {
    const demo: SewerNode[] = [
      { id: "PV1", x: 350000, y: 7400000, cotaTerreno: 105.0, cotaFundo: 103.5 },
      { id: "PV2", x: 350050, y: 7400030, cotaTerreno: 104.2, cotaFundo: 102.7 },
      { id: "PV3", x: 350100, y: 7400060, cotaTerreno: 103.5, cotaFundo: 102.0 },
      { id: "PV4", x: 350150, y: 7400090, cotaTerreno: 102.8, cotaFundo: 101.3 },
      { id: "PV5", x: 350200, y: 7400120, cotaTerreno: 102.0, cotaFundo: 100.5 },
    ];
    setNodes(demo);
    setMapConnections(demo.slice(0, -1).map((n, i) => ({
      from: n.id, to: demo[i + 1].id, color: "#22c55e", label: `${n.id} → ${demo[i + 1].id}`
    })));
    setCalculated(false);
    toast.success("Demo de esgoto carregado");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Droplets className="h-5 w-5 text-green-600" /> Parâmetros de Esgoto</CardTitle>
            <CardDescription>Rede de esgoto por gravidade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Contribuição per capita qpc (L/hab/dia)</Label><Input type="number" value={qpc} onChange={e => setQpc(Number(e.target.value))} /></div>
            <div><Label>Coeficiente de Manning</Label><Input type="number" step="0.001" value={manning} onChange={e => setManning(Number(e.target.value))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Vel. Mínima (m/s)</Label><Input type="number" step="0.1" value={velMin} onChange={e => setVelMin(Number(e.target.value))} /></div>
              <div><Label>Vel. Máxima (m/s)</Label><Input type="number" step="0.1" value={velMax} onChange={e => setVelMax(Number(e.target.value))} /></div>
            </div>
            <div><Label>Lâmina máxima y/D</Label><Input type="number" step="0.01" value={laminaMax} onChange={e => setLaminaMax(Number(e.target.value))} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Adicionar Nó</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>ID</Label><Input value={newNode.id} onChange={e => setNewNode({ ...newNode, id: e.target.value })} placeholder="PV1" /></div>
              <div><Label>X</Label><Input type="number" value={newNode.x} onChange={e => setNewNode({ ...newNode, x: Number(e.target.value) })} /></div>
              <div><Label>Y</Label><Input type="number" value={newNode.y} onChange={e => setNewNode({ ...newNode, y: Number(e.target.value) })} /></div>
              <div><Label>Cota Terreno</Label><Input type="number" step="0.01" value={newNode.cotaTerreno} onChange={e => setNewNode({ ...newNode, cotaTerreno: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Cota de Fundo</Label><Input type="number" step="0.01" value={newNode.cotaFundo} onChange={e => setNewNode({ ...newNode, cotaFundo: Number(e.target.value) })} /></div>
            </div>
            <Button onClick={addNode} className="w-full"><Plus className="h-4 w-4 mr-1" /> Adicionar Nó</Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={transferFromTopography} variant="outline"><Upload className="h-4 w-4 mr-1" /> Transferir da Topografia</Button>
        <Button onClick={calculate}><Calculator className="h-4 w-4 mr-1" /> Calcular Esgoto</Button>
        <Button onClick={loadDemo} variant="secondary">Carregar Demo</Button>
      </div>

      {nodes.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Nós de Esgoto ({nodes.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ID</TableHead><TableHead>X</TableHead><TableHead>Y</TableHead>
                  <TableHead>Cota Terreno</TableHead><TableHead>Cota Fundo</TableHead><TableHead>Prof.</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {nodes.map(n => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.id}</TableCell>
                      <TableCell>{n.x.toFixed(3)}</TableCell><TableCell>{n.y.toFixed(3)}</TableCell>
                      <TableCell>{n.cotaTerreno.toFixed(3)}</TableCell><TableCell>{n.cotaFundo.toFixed(3)}</TableCell>
                      <TableCell><Badge>{(n.cotaTerreno - n.cotaFundo).toFixed(2)}m</Badge></TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => removeNode(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
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
        nodes={nodes.map(n => ({ id: n.id, x: n.x, y: n.y, cota: n.cotaTerreno }))}
        connections={mapConnections}
        onConnectionsChange={setMapConnections}
        title="Mapa da Rede de Esgoto"
        accentColor="#22c55e"
        editable
      />

      {calculated && results.length > 0 && summary && (
        <>
          <Card className="border-green-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-green-600" /> Resultados - Rede de Esgoto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1"><Link className="h-4 w-4 text-blue-600" /></div>
                  <div className="text-2xl font-bold text-blue-600">{summary.trechos}</div>
                  <div className="text-xs text-muted-foreground">Trechos</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1"><Ruler className="h-4 w-4 text-green-600" /></div>
                  <div className="text-2xl font-bold text-green-600">{summary.extensao.toFixed(1)} m</div>
                  <div className="text-xs text-muted-foreground">Extensão Total</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1"><Zap className="h-4 w-4 text-purple-600" /></div>
                  <div className="text-2xl font-bold text-purple-600">{summary.velMedia.toFixed(2)} m/s</div>
                  <div className="text-xs text-muted-foreground">Velocidade Média</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1"><AlertTriangle className="h-4 w-4 text-yellow-600" /></div>
                  <div className="text-2xl font-bold text-yellow-600">{summary.alertas}</div>
                  <div className="text-xs text-muted-foreground">Alertas</div>
                </div>
              </div>
              {warnings.length > 0 && (
                <Card className="mb-4 border-yellow-400/30 bg-yellow-500/5">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">📋 Validação Normativa</CardTitle></CardHeader>
                  <CardContent>
                    <div className="max-h-[200px] overflow-auto space-y-1">
                      {warnings.map((w, i) => <p key={i} className="text-sm text-yellow-700 dark:text-yellow-400">{w.trecho}: {w.msg}</p>)}
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">📋 Resultados Detalhados</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>ID</TableHead><TableHead>De</TableHead><TableHead>Para</TableHead>
                        <TableHead>Comp (m)</TableHead><TableHead>DN (mm)</TableHead><TableHead>i (m/m)</TableHead>
                        <TableHead>Q (L/s)</TableHead><TableHead>V (m/s)</TableHead><TableHead>y/D</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {results.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.id}</TableCell>
                            <TableCell>{r.de}</TableCell><TableCell>{r.para}</TableCell>
                            <TableCell>{r.comp.toFixed(1)}</TableCell><TableCell>{r.dn}</TableCell>
                            <TableCell>{r.i.toFixed(4)}</TableCell><TableCell>{r.q.toFixed(2)}</TableCell>
                            <TableCell>{r.v.toFixed(3)}</TableCell><TableCell>{r.yD.toFixed(3)}</TableCell>
                            <TableCell><Badge className={r.status === "OK" ? "bg-green-500" : "bg-yellow-500"}>{r.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
