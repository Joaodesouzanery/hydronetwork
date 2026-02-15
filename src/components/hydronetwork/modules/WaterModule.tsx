import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Calculator, Upload, Droplets, AlertTriangle, Link, Ruler } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { hazenWilliamsHeadloss, hazenWilliamsVelocity } from "@/engine/hydraulics";
import { NodeMapWidget } from "@/components/hydronetwork/NodeMapWidget";

interface WaterNode {
  id: string; x: number; y: number; cota: number; demanda: number;
}

interface WaterResult {
  id: string;
  de: string;
  para: string;
  comp: number;
  dn: number;
  q: number;
  v: number;
  hf: number;
  pressao: number;
  status: "OK" | "WARN";
}

interface WaterModuleProps {
  pontos: PontoTopografico[];
}

export const WaterModule = ({ pontos }: WaterModuleProps) => {
  const [hazenC, setHazenC] = useState(140);
  const [pressaoMin, setPressaoMin] = useState(10);
  const [velMax, setVelMax] = useState(3.5);
  const [dnMin, setDnMin] = useState("50");
  const [nodes, setNodes] = useState<WaterNode[]>([]);
  const [newNode, setNewNode] = useState({ id: "", x: 0, y: 0, cota: 0, demanda: 2.0 });
  const [calculated, setCalculated] = useState(false);

  const addNode = () => {
    if (!newNode.id.trim()) { toast.error("ID obrigatório"); return; }
    setNodes([...nodes, { ...newNode }]);
    setNewNode({ id: `N${nodes.length + 2}`, x: 0, y: 0, cota: 0, demanda: 2.0 });
  };

  const transferFromTopography = () => {
    if (pontos.length === 0) { toast.error("Nenhum ponto na topografia"); return; }
    setNodes(pontos.map(p => ({ id: p.id, x: p.x, y: p.y, cota: p.cota, demanda: 2.0 })));
    toast.success(`${pontos.length} nós transferidos`);
  };

  const loadDemo = () => {
    setNodes([
      { id: "N1", x: 350000, y: 7400000, cota: 105.0, demanda: 3.0 },
      { id: "N2", x: 350060, y: 7400020, cota: 103.5, demanda: 2.5 },
      { id: "N3", x: 350120, y: 7400050, cota: 102.0, demanda: 4.0 },
      { id: "N4", x: 350180, y: 7400080, cota: 101.0, demanda: 1.5 },
    ]);
    setCalculated(false);
    toast.success("Demo de água carregado");
  };

  // Calculate water results
  const results = useMemo<WaterResult[]>(() => {
    if (nodes.length < 2 || !calculated) return [];
    const res: WaterResult[] = [];
    const dn = parseInt(dnMin);
    const D = dn / 1000; // meters
    let cumulativePressureLoss = 0;

    for (let i = 0; i < nodes.length - 1; i++) {
      const n1 = nodes[i];
      const n2 = nodes[i + 1];
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const comp = Math.sqrt(dx * dx + dy * dy);
      if (comp === 0) continue;

      const q = n1.demanda / 1000; // m³/s
      const v = hazenWilliamsVelocity(q, D);
      const hf = hazenWilliamsHeadloss(q, D, comp, hazenC);
      cumulativePressureLoss += hf;

      // Pressure at downstream node (simplified: starting at cota of first node)
      const pressao = nodes[0].cota - n2.cota - cumulativePressureLoss;

      res.push({
        id: `L${i + 1}`,
        de: `P${String(i + 1).padStart(2, "0")}`,
        para: `P${String(i + 2).padStart(2, "0")}`,
        comp: Math.round(comp * 10) / 10,
        dn,
        q: n1.demanda,
        v: parseFloat(v.toFixed(3)),
        hf: parseFloat(hf.toFixed(4)),
        pressao: parseFloat(pressao.toFixed(1)),
        status: pressao < pressaoMin ? "WARN" : "OK",
      });
    }
    return res;
  }, [nodes, calculated, dnMin, hazenC, pressaoMin]);

  // Validation warnings
  const warnings = useMemo(() => {
    return results.filter(r => r.pressao < pressaoMin).map(r => ({
      trecho: `${r.de}-${r.para}`,
      msg: `Pressão ${r.pressao.toFixed(1)} < ${pressaoMin} mca em ${r.para}`,
    }));
  }, [results, pressaoMin]);

  // Summary
  const summary = useMemo(() => {
    if (results.length === 0) return null;
    const totalComp = results.reduce((s, r) => s + r.comp, 0);
    const minPressao = Math.min(...results.map(r => r.pressao));
    return {
      trechos: results.length,
      extensao: totalComp,
      pressaoMin: minPressao,
      alertas: warnings.length,
    };
  }, [results, warnings]);

  const calculate = () => {
    if (nodes.length < 2) { toast.error("Mínimo 2 nós"); return; }
    setCalculated(true);
    toast.success(`Cálculo de água: ${nodes.length} nós, C=${hazenC}, Pmin=${pressaoMin} mca`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Droplets className="h-5 w-5 text-cyan-600" /> Parâmetros de Água</CardTitle>
            <CardDescription>Rede de água pressurizada (Hazen-Williams)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Coef. Hazen-Williams C</Label><Input type="number" value={hazenC} onChange={e => setHazenC(Number(e.target.value))} /></div>
            <div><Label>Pressão mínima (mca)</Label><Input type="number" value={pressaoMin} onChange={e => setPressaoMin(Number(e.target.value))} /></div>
            <div><Label>Velocidade máxima (m/s)</Label><Input type="number" step="0.1" value={velMax} onChange={e => setVelMax(Number(e.target.value))} /></div>
            <div>
              <Label>DN Mínimo (mm)</Label>
              <Select value={dnMin} onValueChange={setDnMin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 mm</SelectItem>
                  <SelectItem value="75">75 mm</SelectItem>
                  <SelectItem value="100">100 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Adicionar Nó</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>ID</Label><Input value={newNode.id} onChange={e => setNewNode({ ...newNode, id: e.target.value })} placeholder="N1" /></div>
              <div><Label>X</Label><Input type="number" value={newNode.x} onChange={e => setNewNode({ ...newNode, x: Number(e.target.value) })} /></div>
              <div><Label>Y</Label><Input type="number" value={newNode.y} onChange={e => setNewNode({ ...newNode, y: Number(e.target.value) })} /></div>
              <div><Label>Cota</Label><Input type="number" step="0.01" value={newNode.cota} onChange={e => setNewNode({ ...newNode, cota: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Demanda (L/s)</Label><Input type="number" step="0.1" value={newNode.demanda} onChange={e => setNewNode({ ...newNode, demanda: Number(e.target.value) })} /></div>
            </div>
            <Button onClick={addNode} className="w-full"><Plus className="h-4 w-4 mr-1" /> Adicionar Nó</Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={transferFromTopography} variant="outline"><Upload className="h-4 w-4 mr-1" /> Transferir da Topografia</Button>
        <Button onClick={calculate}><Calculator className="h-4 w-4 mr-1" /> Calcular Água</Button>
        <Button onClick={loadDemo} variant="secondary">Carregar Demo</Button>
      </div>

      {nodes.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Nós de Água ({nodes.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ID</TableHead><TableHead>X</TableHead><TableHead>Y</TableHead>
                  <TableHead>Cota</TableHead><TableHead>Demanda (L/s)</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {nodes.map(n => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.id}</TableCell>
                      <TableCell>{n.x.toFixed(3)}</TableCell>
                      <TableCell>{n.y.toFixed(3)}</TableCell>
                      <TableCell>{n.cota.toFixed(3)}</TableCell>
                      <TableCell>{n.demanda.toFixed(1)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => setNodes(nodes.filter(nd => nd.id !== n.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
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
        nodes={nodes.map(n => ({ id: n.id, x: n.x, y: n.y, cota: n.cota }))}
        connections={nodes.slice(0, -1).map((n, i) => ({
          from: n.id,
          to: nodes[i + 1].id,
          color: "#06b6d4",
          label: `${n.id} → ${nodes[i + 1].id}`,
        }))}
        title="Mapa da Rede de Água"
        accentColor="#06b6d4"
      />
      {calculated && results.length > 0 && summary && (
        <>
          <Card className="border-cyan-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-cyan-600" /> Resultados - Rede de Água
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
                  <div className="flex items-center justify-center gap-1 mb-1"><Droplets className="h-4 w-4 text-cyan-600" /></div>
                  <div className="text-2xl font-bold text-cyan-600">{summary.pressaoMin.toFixed(1)} mca</div>
                  <div className="text-xs text-muted-foreground">Pressão Mínima</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1"><AlertTriangle className="h-4 w-4 text-yellow-600" /></div>
                  <div className="text-2xl font-bold text-yellow-600">{summary.alertas}</div>
                  <div className="text-xs text-muted-foreground">Alertas</div>
                </div>
              </div>

              {/* Validation warnings */}
              {warnings.length > 0 && (
                <Card className="mb-4 border-yellow-400/30 bg-yellow-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      📋 Validação Normativa
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[200px] overflow-auto space-y-1">
                      {warnings.map((w, i) => (
                        <p key={i} className="text-sm text-yellow-700 dark:text-yellow-400">
                          {w.trecho}: {w.msg}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detailed results table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">📋 Resultados Detalhados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>De</TableHead>
                          <TableHead>Para</TableHead>
                          <TableHead>Comp (m)</TableHead>
                          <TableHead>DN (mm)</TableHead>
                          <TableHead>Q (L/s)</TableHead>
                          <TableHead>V (m/s)</TableHead>
                          <TableHead>hf (m)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.id}</TableCell>
                            <TableCell>{r.de}</TableCell>
                            <TableCell>{r.para}</TableCell>
                            <TableCell>{r.comp.toFixed(1)}</TableCell>
                            <TableCell>{r.dn}</TableCell>
                            <TableCell>{r.q.toFixed(2)}</TableCell>
                            <TableCell>{r.v.toFixed(3)}</TableCell>
                            <TableCell>{r.hf.toFixed(4)}</TableCell>
                            <TableCell>
                              <Badge className={r.status === "OK" ? "bg-green-500" : "bg-yellow-500"}>
                                {r.status}
                              </Badge>
                            </TableCell>
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