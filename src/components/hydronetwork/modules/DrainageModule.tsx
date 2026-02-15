import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Calculator, CloudRain, Upload, AlertTriangle, CheckCircle } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { NodeMapWidget } from "@/components/hydronetwork/NodeMapWidget";

// === Interfaces ===
interface DrainageNode {
  id: string; x: number; y: number; cota: number; areaContrib: number;
  tipoSuperficie: string;
}

interface DrainageResult {
  id: string; de: string; para: string; comp: number; dn: number;
  i: number; Q: number; V: number; yD: number; status: "OK" | "WARN";
}

interface DrainageModuleProps {
  pontos: PontoTopografico[];
}

// === Runoff Coefficients ===
const RUNOFF_COEFFICIENTS: Record<string, number> = {
  "Telhado": 0.95, "Asfalto": 0.90, "Concreto": 0.85,
  "Paralelepípedo": 0.75, "Solo compactado": 0.60, "Grama": 0.25,
  "Área verde": 0.15, "Misto urbano": 0.70,
};

const DN_COMERCIAIS = [300, 400, 500, 600, 800, 1000, 1200, 1500, 2000];

export const DrainageModule = ({ pontos }: DrainageModuleProps) => {
  // IDF parameters
  const [tr, setTr] = useState("10");
  const [duracaoMin, setDuracaoMin] = useState(5);
  const [idfK, setIdfK] = useState(3462.6);
  const [idfA, setIdfA] = useState(0.172);
  const [idfB, setIdfB] = useState(20);
  const [idfC, setIdfC] = useState(1.025);

  // Manning parameters
  const [manningConcreto, setManningConcreto] = useState(0.015);
  const [manningPEAD, setManningPEAD] = useState(0.012);
  const [materialGaleria, setMaterialGaleria] = useState("concreto");
  const [declMin, setDeclMin] = useState(0.005);
  const [vMin, setVMin] = useState(0.75);
  const [vMax, setVMax] = useState(5.0);
  const [yDMax, setYDMax] = useState(0.85);
  const [dnMin, setDnMin] = useState("300");

  // Nodes
  const [nodes, setNodes] = useState<DrainageNode[]>([]);
  const [newNode, setNewNode] = useState({ id: "", x: 0, y: 0, cota: 0, areaContrib: 0.5, tipoSuperficie: "Misto urbano" });

  // Results
  const [results, setResults] = useState<DrainageResult[]>([]);

  const addNode = () => {
    if (!newNode.id.trim()) { toast.error("ID obrigatório"); return; }
    setNodes([...nodes, { ...newNode }]);
    setNewNode({ id: `BL${nodes.length + 2}`, x: 0, y: 0, cota: 0, areaContrib: 0.5, tipoSuperficie: "Misto urbano" });
  };

  const transferFromTopography = () => {
    if (pontos.length === 0) { toast.error("Nenhum ponto na topografia"); return; }
    setNodes(pontos.map(p => ({ id: p.id, x: p.x, y: p.y, cota: p.cota, areaContrib: 0.5, tipoSuperficie: "Misto urbano" })));
    toast.success(`${pontos.length} nós transferidos da topografia`);
  };

  const loadDemo = () => {
    setNodes([
      { id: "BL1", x: 350000, y: 7400000, cota: 106.0, areaContrib: 0.8, tipoSuperficie: "Misto urbano" },
      { id: "BL2", x: 350070, y: 7400030, cota: 104.5, areaContrib: 1.2, tipoSuperficie: "Asfalto" },
      { id: "BL3", x: 350140, y: 7400060, cota: 103.0, areaContrib: 0.6, tipoSuperficie: "Misto urbano" },
      { id: "CX1", x: 350180, y: 7400075, cota: 102.0, areaContrib: 0, tipoSuperficie: "Misto urbano" },
      { id: "DESC", x: 350210, y: 7400090, cota: 101.5, areaContrib: 0, tipoSuperficie: "Misto urbano" },
    ]);
    toast.success("Demo de drenagem carregado");
  };

  // IDF intensity: i = K * T^a / (t + b)^c
  const calcIntensidade = () => {
    const T = Number(tr);
    return (idfK * Math.pow(T, idfA)) / Math.pow(duracaoMin + idfB, idfC);
  };

  const manningN = materialGaleria === "concreto" ? manningConcreto : manningPEAD;

  const calcularDrenagem = () => {
    if (nodes.length < 2) { toast.error("Mínimo 2 nós necessários"); return; }

    const intensidade = calcIntensidade(); // mm/h
    const minDN = Number(dnMin);
    const res: DrainageResult[] = [];

    let areaAcumulada = 0;

    for (let i = 0; i < nodes.length - 1; i++) {
      const de = nodes[i];
      const para = nodes[i + 1];
      const dx = para.x - de.x;
      const dy = para.y - de.y;
      const comp = Math.sqrt(dx * dx + dy * dy);
      const dz = de.cota - para.cota;
      const slope = comp > 0 ? Math.abs(dz / comp) : declMin;
      const iCalc = Math.max(slope, declMin);

      // Accumulate contributing area
      areaAcumulada += de.areaContrib;
      const C = RUNOFF_COEFFICIENTS[de.tipoSuperficie] ?? 0.70;

      // Rational method: Q = C * i * A / 360 (Q in m³/s, i in mm/h, A in ha)
      const Qm3s = (C * intensidade * areaAcumulada) / 360;

      // Find minimum DN that carries the flow
      let selectedDN = minDN;
      let V = 0;
      let yD = 0;

      for (const dn of DN_COMERCIAIS) {
        if (dn < minDN) continue;
        const D = dn / 1000; // m
        // Full pipe capacity: Q = (1/n) * A * R^(2/3) * S^(1/2)
        const Afull = Math.PI * D * D / 4;
        const Rfull = D / 4;
        const Qfull = (1 / manningN) * Afull * Math.pow(Rfull, 2 / 3) * Math.pow(iCalc, 0.5);
        const Vfull = Qfull / Afull;

        if (Qfull >= Qm3s) {
          selectedDN = dn;
          V = Vfull * (Qm3s / Qfull > 0.5 ? 1.0 : Qm3s / Qfull * 2);
          // Approximate y/D
          yD = Math.min(Math.pow(Qm3s / Qfull, 0.5) * 0.95, 0.95);
          if (yD < 0.1) yD = Qm3s / Qfull;
          V = (1 / manningN) * Math.pow(D / 4 * (yD > 0 ? yD : 0.5), 2 / 3) * Math.pow(iCalc, 0.5);
          break;
        }
      }

      const status: "OK" | "WARN" = (V >= vMin && V <= vMax && yD <= yDMax) ? "OK" : "WARN";

      res.push({
        id: `G${i + 1}`, de: de.id, para: para.id,
        comp: Math.round(comp * 10) / 10,
        dn: selectedDN, i: Math.round(iCalc * 10000) / 10000,
        Q: Math.round(Qm3s * 10000) / 10000,
        V: Math.round(V * 1000) / 1000,
        yD: Math.round(yD * 1000) / 1000,
        status,
      });
    }

    setResults(res);
    toast.success(`Drenagem calculada: ${res.length} galerias, i=${intensidade.toFixed(1)} mm/h`);
  };

  const totalComp = results.reduce((s, r) => s + r.comp, 0);
  const totalArea = nodes.reduce((s, n) => s + n.areaContrib, 0);
  const maxQ = results.length > 0 ? Math.max(...results.map(r => r.Q)) : 0;
  const alertCount = results.filter(r => r.status === "WARN").length;

  const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="parametros">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          <TabsTrigger value="nos">Nós ({nodes.length})</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="parametros" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chuva */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CloudRain className="h-5 w-5 text-emerald-600" /> Chuva</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Período de Retorno (anos)</Label>
                    <Select value={tr} onValueChange={setTr}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["2", "5", "10", "25", "50"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Duração mín. (min)</Label><Input type="number" value={duracaoMin} onChange={e => setDuracaoMin(Number(e.target.value))} /></div>
                </div>
              </CardContent>
            </Card>

            {/* IDF Curve */}
            <Card>
              <CardHeader>
                <CardTitle>Curva IDF</CardTitle>
                <CardDescription>i = K × T^a / (t + b)^c [mm/h]</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>K</Label><Input type="number" step="0.1" value={idfK} onChange={e => setIdfK(Number(e.target.value))} /></div>
                  <div><Label>a</Label><Input type="number" step="0.001" value={idfA} onChange={e => setIdfA(Number(e.target.value))} /></div>
                  <div><Label>b</Label><Input type="number" value={idfB} onChange={e => setIdfB(Number(e.target.value))} /></div>
                  <div><Label>c</Label><Input type="number" step="0.001" value={idfC} onChange={e => setIdfC(Number(e.target.value))} /></div>
                </div>
                <div className="bg-muted/50 rounded p-2 text-xs text-center">
                  i = {fmt(calcIntensidade(), 1)} mm/h (TR={tr}a, t={duracaoMin}min)
                </div>
              </CardContent>
            </Card>

            {/* Runoff Coefficients */}
            <Card>
              <CardHeader><CardTitle>Coeficientes de Runoff</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-[200px] overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Superfície</TableHead><TableHead>C</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {Object.entries(RUNOFF_COEFFICIENTS).map(([k, v]) => (
                        <TableRow key={k}>
                          <TableCell className="text-xs">{k}</TableCell>
                          <TableCell className="font-medium">{v.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Manning Hydraulics */}
            <Card>
              <CardHeader><CardTitle>Hidráulica (Manning)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Material Galeria</Label>
                    <Select value={materialGaleria} onValueChange={setMaterialGaleria}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="concreto">Concreto</SelectItem>
                        <SelectItem value="pead">PEAD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DN Mínimo (mm)</Label>
                    <Select value={dnMin} onValueChange={setDnMin}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DN_COMERCIAIS.map(v => <SelectItem key={v} value={String(v)}>{v} mm</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Manning (Concreto)</Label><Input type="number" step="0.001" value={manningConcreto} onChange={e => setManningConcreto(Number(e.target.value))} /></div>
                  <div><Label>Manning (PEAD)</Label><Input type="number" step="0.001" value={manningPEAD} onChange={e => setManningPEAD(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Decl. mín. (m/m)</Label><Input type="number" step="0.001" value={declMin} onChange={e => setDeclMin(Number(e.target.value))} /></div>
                  <div><Label>Lâmina máx. (y/D)</Label><Input type="number" step="0.01" value={yDMax} onChange={e => setYDMax(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>V mín. (m/s)</Label><Input type="number" step="0.05" value={vMin} onChange={e => setVMin(Number(e.target.value))} /></div>
                  <div><Label>V máx. (m/s)</Label><Input type="number" step="0.1" value={vMax} onChange={e => setVMax(Number(e.target.value))} /></div>
                </div>
                <div className="bg-muted/50 rounded p-2 text-xs">
                  DNs: {DN_COMERCIAIS.join(", ")} mm
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nos" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Adicionar Nó / Galeria</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div><Label>ID</Label><Input value={newNode.id} onChange={e => setNewNode({ ...newNode, id: e.target.value })} placeholder="BL1" /></div>
                <div><Label>X</Label><Input type="number" value={newNode.x} onChange={e => setNewNode({ ...newNode, x: Number(e.target.value) })} /></div>
                <div><Label>Y</Label><Input type="number" value={newNode.y} onChange={e => setNewNode({ ...newNode, y: Number(e.target.value) })} /></div>
                <div><Label>Cota</Label><Input type="number" step="0.01" value={newNode.cota} onChange={e => setNewNode({ ...newNode, cota: Number(e.target.value) })} /></div>
                <div><Label>Área Contrib. (ha)</Label><Input type="number" step="0.1" value={newNode.areaContrib} onChange={e => setNewNode({ ...newNode, areaContrib: Number(e.target.value) })} /></div>
                <div>
                  <Label>Tipo Superfície</Label>
                  <Select value={newNode.tipoSuperficie} onValueChange={v => setNewNode({ ...newNode, tipoSuperficie: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(RUNOFF_COEFFICIENTS).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={addNode} className="w-full"><Plus className="h-4 w-4 mr-1" /> Adicionar Nó</Button>
            </CardContent>
          </Card>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={transferFromTopography} variant="outline"><Upload className="h-4 w-4 mr-1" /> Transferir da Topografia</Button>
            <Button onClick={loadDemo} variant="secondary">Carregar Demo</Button>
          </div>

          {nodes.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Nós de Drenagem ({nodes.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>ID</TableHead><TableHead>X</TableHead><TableHead>Y</TableHead>
                      <TableHead>Cota</TableHead><TableHead>Área (ha)</TableHead><TableHead>Superfície</TableHead><TableHead>C</TableHead><TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {nodes.map(n => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium">{n.id}</TableCell>
                          <TableCell>{n.x.toFixed(1)}</TableCell>
                          <TableCell>{n.y.toFixed(1)}</TableCell>
                          <TableCell>{n.cota.toFixed(2)}</TableCell>
                          <TableCell>{n.areaContrib.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{n.tipoSuperficie}</TableCell>
                          <TableCell>{(RUNOFF_COEFFICIENTS[n.tipoSuperficie] ?? 0.70).toFixed(2)}</TableCell>
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
              color: "#10b981",
              label: `${n.id} → ${nodes[i + 1].id}`,
            }))}
            title="Mapa da Rede de Drenagem"
            accentColor="#10b981"
          />

          <Button onClick={calcularDrenagem} className="w-full"><Calculator className="h-4 w-4 mr-1" /> Calcular Drenagem</Button>
        </TabsContent>

        <TabsContent value="resultados" className="space-y-4">
          {results.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">Calcule a drenagem na aba "Nós" para ver resultados.</CardContent></Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: "🔗", label: "Galerias", value: results.length },
                  { icon: "📏", label: "Extensão Total", value: `${fmt(totalComp, 1)} m` },
                  { icon: "🌧️", label: "Área Total", value: `${fmt(totalArea, 2)} ha` },
                  { icon: "💨", label: "Vazão Máxima", value: `${fmt(maxQ * 1000, 1)} L/s` },
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

              {alertCount > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-600" /> Validação Normativa ({alertCount} alertas)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="max-h-[200px] overflow-auto space-y-1">
                      {results.filter(r => r.status === "WARN").map(r => (
                        <div key={r.id} className="text-sm text-yellow-700">
                          {r.de}-{r.para}: {r.V < vMin ? `V=${fmt(r.V, 2)} < ${vMin} m/s` : r.V > vMax ? `V=${fmt(r.V, 2)} > ${vMax} m/s` : `y/D=${fmt(r.yD, 3)} > ${yDMax}`}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle>📋 Resultados Detalhados</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>ID</TableHead><TableHead>De</TableHead><TableHead>Para</TableHead>
                        <TableHead>Comp (m)</TableHead><TableHead>DN (mm)</TableHead><TableHead>i (m/m)</TableHead>
                        <TableHead>Q (m³/s)</TableHead><TableHead>V (m/s)</TableHead><TableHead>y/D</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {results.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.id}</TableCell>
                            <TableCell>{r.de}</TableCell>
                            <TableCell>{r.para}</TableCell>
                            <TableCell>{fmt(r.comp, 1)}</TableCell>
                            <TableCell>{r.dn}</TableCell>
                            <TableCell>{r.i.toFixed(4)}</TableCell>
                            <TableCell>{r.Q.toFixed(4)}</TableCell>
                            <TableCell>{fmt(r.V, 3)}</TableCell>
                            <TableCell>{r.yD.toFixed(3)}</TableCell>
                            <TableCell>
                              {r.status === "OK" ? (
                                <Badge className="bg-green-500/20 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                              ) : (
                                <Badge variant="destructive" className="bg-yellow-500/20 text-yellow-700"><AlertTriangle className="h-3 w-3 mr-1" />WARN</Badge>
                              )}
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
