/**
 * RecalqueModule — Sewage Force Main, Water Booster, and Pumping Station Design
 *
 * Integrates with:
 * - TransientModule (hydraulic transient analysis)
 * - EpanetModule / QWater (steady-state network data)
 * - ElevatorStationModule (pump station sizing)
 */

import { useState, useCallback, useMemo } from "react";
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
  AlertTriangle, Zap, Upload, Settings, Activity,
  TrendingUp, BarChart3, Mountain, Play, Waves,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import {
  dimensionRecalque,
  dimensionBooster,
  generateRecalqueReport,
  type RecalqueInput,
  type RecalqueResult,
  type RecalqueType,
  type BoosterInput,
  type BoosterResult,
} from "@/engine/recalqueEngine";

// ══════════════════════════════════════
// Default pump curves (common models)
// ══════════════════════════════════════

const DEFAULT_PUMP_CURVES: Record<string, [number, number][]> = {
  "Submersível 5CV": [[0, 25], [5, 23], [10, 20], [15, 15], [20, 8]],
  "Submersível 10CV": [[0, 40], [10, 36], [20, 30], [30, 20], [40, 8]],
  "Submersível 25CV": [[0, 55], [20, 50], [40, 42], [60, 30], [80, 12]],
  "Centrífuga 15CV": [[0, 35], [15, 32], [30, 26], [45, 18], [55, 8]],
  "Centrífuga 30CV": [[0, 50], [25, 46], [50, 38], [75, 25], [100, 10]],
};

// ══════════════════════════════════════
// Component
// ══════════════════════════════════════

export const RecalqueModule = () => {
  // ── Form state ──
  const [tipo, setTipo] = useState<RecalqueType>("esgoto");
  const [vazaoProjeto, setVazaoProjeto] = useState(20);
  const [vazaoMinima, setVazaoMinima] = useState(5);
  const [vazaoMaxima, setVazaoMaxima] = useState(30);
  const [cotaSuccao, setCotaSuccao] = useState(100);
  const [cotaDescarga, setCotaDescarga] = useState(120);
  const [comprimentoSuccao, setComprimentoSuccao] = useState(5);
  const [comprimentoRecalque, setComprimentoRecalque] = useState(500);
  const [diametroSuccao, setDiametroSuccao] = useState(200);
  const [diametroRecalque, setDiametroRecalque] = useState(150);
  const [material, setMaterial] = useState("PVC");
  const [coefHW, setCoefHW] = useState(140);
  const [numBombas, setNumBombas] = useState(3);
  const [numReserva, setNumReserva] = useState(1);
  const [rendBomba, setRendBomba] = useState(0.75);
  const [rendMotor, setRendMotor] = useState(0.90);
  const [rpmBomba, setRpmBomba] = useState(1750);
  const [inerciaBomba, setInerciaBomba] = useState(0.5);
  const [temValvulaRetencao, setTemValvulaRetencao] = useState(true);
  const [tempoFechamento, setTempoFechamento] = useState(5);
  const [coefKSuccao, setCoefKSuccao] = useState(5);
  const [coefKRecalque, setCoefKRecalque] = useState(15);
  const [selectedPumpCurve, setSelectedPumpCurve] = useState("Submersível 10CV");

  // ── Booster state ──
  const [boosterPressaoEntrada, setBoosterPressaoEntrada] = useState(15);
  const [boosterPressaoSaida, setBoosterPressaoSaida] = useState(30);
  const [boosterVazao, setBoosterVazao] = useState(20);
  const [boosterDiametro, setBoosterDiametro] = useState(150);
  const [boosterComprimento, setBoosterComprimento] = useState(10);
  const [boosterNumBombas, setBoosterNumBombas] = useState(2);
  const [boosterRendimento, setBoosterRendimento] = useState(0.75);

  // ── Results ──
  const [result, setResult] = useState<RecalqueResult | null>(null);
  const [boosterResult, setBoosterResult] = useState<BoosterResult | null>(null);

  // ── HW coefficients ──
  const materialHW: Record<string, number> = {
    PVC: 140, PEAD: 140, "Ferro Fundido": 100, Aço: 120, Concreto: 120,
  };

  const handleMaterialChange = (mat: string) => {
    setMaterial(mat);
    setCoefHW(materialHW[mat] ?? 130);
  };

  // ── Dimensioning ──
  const runDimensioning = useCallback(() => {
    const input: RecalqueInput = {
      id: "REC-01",
      tipo,
      vazaoProjeto,
      vazaoMinima,
      vazaoMaxima,
      cotaSuccao,
      cotaDescarga,
      comprimentoSuccao,
      comprimentoRecalque,
      diametroSuccao,
      diametroRecalque,
      material,
      coefHW,
      numBombas,
      numReserva,
      rendimentoBomba: rendBomba,
      rendimentoMotor: rendMotor,
      rpmBomba,
      inerciaBomba,
      temValvulaRetencao,
      tempoFechamentoValvula: tempoFechamento,
      curvaBomba: DEFAULT_PUMP_CURVES[selectedPumpCurve] ?? DEFAULT_PUMP_CURVES["Submersível 10CV"],
      coefPerdaLocalSuccao: coefKSuccao,
      coefPerdaLocalRecalque: coefKRecalque,
    };

    const res = dimensionRecalque(input);
    setResult(res);

    if (res.atendeNorma) {
      toast.success("Dimensionamento OK — atende normas");
    } else {
      toast.warning(`Dimensionamento com ${res.observacoes.length} alerta(s)`);
    }
  }, [tipo, vazaoProjeto, vazaoMinima, vazaoMaxima, cotaSuccao, cotaDescarga,
      comprimentoSuccao, comprimentoRecalque, diametroSuccao, diametroRecalque,
      material, coefHW, numBombas, numReserva, rendBomba, rendMotor,
      rpmBomba, inerciaBomba, temValvulaRetencao, tempoFechamento,
      selectedPumpCurve, coefKSuccao, coefKRecalque]);

  const runBooster = useCallback(() => {
    const input: BoosterInput = {
      id: "BOOST-01",
      pressaoEntrada: boosterPressaoEntrada,
      pressaoSaida: boosterPressaoSaida,
      vazao: boosterVazao,
      diametro: boosterDiametro,
      comprimento: boosterComprimento,
      material,
      coefHW,
      numBombas: boosterNumBombas,
      rendimento: boosterRendimento,
    };
    const res = dimensionBooster(input);
    setBoosterResult(res);
    toast.success(`Booster: ${res.alturaBoost} m de boost necessário`);
  }, [boosterPressaoEntrada, boosterPressaoSaida, boosterVazao, boosterDiametro,
      boosterComprimento, material, coefHW, boosterNumBombas, boosterRendimento]);

  // ── System curve chart data ──
  const systemCurveData = useMemo(() => {
    if (!result) return [];
    const pumpCurve = DEFAULT_PUMP_CURVES[selectedPumpCurve] ?? [];
    return result.curvaSistema.map(([q, hSys]) => {
      // Interpolate pump curve
      let hPump = 0;
      for (let i = 0; i < pumpCurve.length - 1; i++) {
        if (q >= pumpCurve[i][0] && q <= pumpCurve[i + 1][0]) {
          const t = (q - pumpCurve[i][0]) / (pumpCurve[i + 1][0] - pumpCurve[i][0]);
          hPump = pumpCurve[i][1] + t * (pumpCurve[i + 1][1] - pumpCurve[i][1]);
          break;
        }
      }
      return { q, hSistema: hSys, hBomba: hPump || undefined };
    });
  }, [result, selectedPumpCurve]);

  // ── Export ──
  const exportCSV = () => {
    if (!result) return;
    const report = generateRecalqueReport(result);
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recalque_${result.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Waves className="h-6 w-6 text-primary" /> Recalque / Booster
          </CardTitle>
          <CardDescription>
            Dimensionamento de linhas de recalque (esgoto/água) e estações booster.
            Inclui análise rápida de transientes (golpe de aríete) integrada.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="recalque">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="recalque"><Droplets className="h-3.5 w-3.5 mr-1" />Recalque</TabsTrigger>
          <TabsTrigger value="booster"><Zap className="h-3.5 w-3.5 mr-1" />Booster</TabsTrigger>
          <TabsTrigger value="resultados"><BarChart3 className="h-3.5 w-3.5 mr-1" />Resultados</TabsTrigger>
        </TabsList>

        {/* ═══════ TAB: RECALQUE ═══════ */}
        <TabsContent value="recalque" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Geometric Data */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mountain className="h-4 w-4 text-primary" /> Dados Geométricos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Tipo de Recalque</Label>
                  <Select value={tipo} onValueChange={v => setTipo(v as RecalqueType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="esgoto">Esgoto (NBR 12209)</SelectItem>
                      <SelectItem value="agua">Água (NBR 12214)</SelectItem>
                      <SelectItem value="booster">Booster</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Cota Sucção (m)</Label><Input type="number" value={cotaSuccao} onChange={e => setCotaSuccao(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Cota Descarga (m)</Label><Input type="number" value={cotaDescarga} onChange={e => setCotaDescarga(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Comp. Sucção (m)</Label><Input type="number" value={comprimentoSuccao} onChange={e => setComprimentoSuccao(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Comp. Recalque (m)</Label><Input type="number" value={comprimentoRecalque} onChange={e => setComprimentoRecalque(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">DN Sucção (mm)</Label><Input type="number" value={diametroSuccao} onChange={e => setDiametroSuccao(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">DN Recalque (mm)</Label><Input type="number" value={diametroRecalque} onChange={e => setDiametroRecalque(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Material</Label>
                    <Select value={material} onValueChange={handleMaterialChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(materialHW).map(m => (
                          <SelectItem key={m} value={m}>{m} (C={materialHW[m]})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">C (H-W)</Label><Input type="number" value={coefHW} onChange={e => setCoefHW(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">K local sucção</Label><Input type="number" step="0.5" value={coefKSuccao} onChange={e => setCoefKSuccao(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">K local recalque</Label><Input type="number" step="1" value={coefKRecalque} onChange={e => setCoefKRecalque(Number(e.target.value))} /></div>
                </div>
              </CardContent>
            </Card>

            {/* Flow & Pump Data */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Vazão e Bombeamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Q projeto (L/s)</Label><Input type="number" step="1" value={vazaoProjeto} onChange={e => setVazaoProjeto(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Q mín (L/s)</Label><Input type="number" step="1" value={vazaoMinima} onChange={e => setVazaoMinima(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Q máx (L/s)</Label><Input type="number" step="1" value={vazaoMaxima} onChange={e => setVazaoMaxima(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Bombas (total)</Label><Input type="number" min={1} value={numBombas} onChange={e => setNumBombas(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Reserva</Label><Input type="number" min={0} value={numReserva} onChange={e => setNumReserva(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Rend. Bomba</Label><Input type="number" step="0.05" min={0.1} max={1} value={rendBomba} onChange={e => setRendBomba(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Rend. Motor</Label><Input type="number" step="0.05" min={0.1} max={1} value={rendMotor} onChange={e => setRendMotor(Number(e.target.value))} /></div>
                </div>
                <div>
                  <Label className="text-xs">Curva da Bomba</Label>
                  <Select value={selectedPumpCurve} onValueChange={setSelectedPumpCurve}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(DEFAULT_PUMP_CURVES).map(k => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">RPM bomba</Label><Input type="number" value={rpmBomba} onChange={e => setRpmBomba(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Inércia WR² (kg·m²)</Label><Input type="number" step="0.1" value={inerciaBomba} onChange={e => setInerciaBomba(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={temValvulaRetencao} onChange={e => setTemValvulaRetencao(e.target.checked)} />
                    <Label className="text-xs">Válvula de retenção</Label>
                  </div>
                  <div><Label className="text-xs">Tf fechamento (s)</Label><Input type="number" step="1" value={tempoFechamento} onChange={e => setTempoFechamento(Number(e.target.value))} /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={runDimensioning} className="w-full bg-[#FF6B2C] text-white hover:bg-[#E55A1F]">
            <Calculator className="h-4 w-4 mr-2" /> Dimensionar Recalque
          </Button>

          {/* Quick Results */}
          {result && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 space-y-1">
                  <p className="text-xs text-muted-foreground">AMT (Altura Manométrica Total)</p>
                  <p className="text-2xl font-bold">{result.alturaManometricaTotal} m</p>
                  <p className="text-xs">Hg={result.alturaGeometrica}m + perdas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Potência Motor</p>
                  <p className="text-2xl font-bold">{result.potenciaComercial} CV</p>
                  <p className="text-xs">{result.potenciaKW} kW ({result.potenciaCV.toFixed(1)} CV calc.)</p>
                </CardContent>
              </Card>
              <Card className={result.transiente.riscoCavitacao ? "border-[#EF4444]" : ""}>
                <CardContent className="pt-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Golpe de Aríete</p>
                  <p className="text-2xl font-bold">{result.transiente.golpeArieteAllievi} m</p>
                  <p className="text-xs">
                    a={result.transiente.celeridadeOnda} m/s | Tc={result.transiente.tempoCritico}s
                  </p>
                  {result.transiente.riscoCavitacao && (
                    <Badge variant="destructive">Cavitação</Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ═══════ TAB: BOOSTER ═══════ */}
        <TabsContent value="booster" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Estação Booster
              </CardTitle>
              <CardDescription>
                Dimensionamento de estação de reforço de pressão na rede de distribuição
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Pressão Entrada (mca)</Label><Input type="number" value={boosterPressaoEntrada} onChange={e => setBoosterPressaoEntrada(Number(e.target.value))} /></div>
                <div><Label className="text-xs">Pressão Saída (mca)</Label><Input type="number" value={boosterPressaoSaida} onChange={e => setBoosterPressaoSaida(Number(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Vazão (L/s)</Label><Input type="number" value={boosterVazao} onChange={e => setBoosterVazao(Number(e.target.value))} /></div>
                <div><Label className="text-xs">DN (mm)</Label><Input type="number" value={boosterDiametro} onChange={e => setBoosterDiametro(Number(e.target.value))} /></div>
                <div><Label className="text-xs">Comp. (m)</Label><Input type="number" value={boosterComprimento} onChange={e => setBoosterComprimento(Number(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Bombas</Label><Input type="number" min={1} value={boosterNumBombas} onChange={e => setBoosterNumBombas(Number(e.target.value))} /></div>
                <div><Label className="text-xs">Rendimento</Label><Input type="number" step="0.05" value={boosterRendimento} onChange={e => setBoosterRendimento(Number(e.target.value))} /></div>
              </div>

              <Button onClick={runBooster} className="bg-[#FF6B2C] text-white hover:bg-[#E55A1F]">
                <Calculator className="h-4 w-4 mr-2" /> Dimensionar Booster
              </Button>

              {boosterResult && (
                <div className="border p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><strong>Boost:</strong> {boosterResult.alturaBoost} m</div>
                    <div><strong>Potência:</strong> {boosterResult.potenciaComercial} CV</div>
                    <div><strong>V:</strong> {boosterResult.velocidade} m/s</div>
                  </div>
                  <Badge className={boosterResult.atendeNorma ? "bg-[rgba(165,206,0,0.1)] text-[#FF6B2C]" : "bg-[rgba(239,68,68,0.1)] text-[#EF4444]"}>
                    {boosterResult.atendeNorma ? "Atende" : "Não atende"}
                  </Badge>
                  {boosterResult.observacoes.map((o, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{o}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ TAB: RESULTADOS ═══════ */}
        <TabsContent value="resultados" className="space-y-4">
          {!result && (
            <div className="flex items-center gap-2 p-4 bg-muted text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Execute o dimensionamento primeiro.
            </div>
          )}

          {result && (
            <>
              {/* Summary table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Resumo do Dimensionamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parâmetro</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Unidade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow><TableCell>Altura Geométrica</TableCell><TableCell>{result.alturaGeometrica}</TableCell><TableCell>m</TableCell></TableRow>
                        <TableRow><TableCell>Perda Sucção</TableCell><TableCell>{result.perdaCargaSuccao}</TableCell><TableCell>m</TableCell></TableRow>
                        <TableRow><TableCell>Perda Recalque</TableCell><TableCell>{result.perdaCargaRecalque}</TableCell><TableCell>m</TableCell></TableRow>
                        <TableRow><TableCell>Perdas Localizadas</TableCell><TableCell>{(result.perdasLocalizadasSuccao + result.perdasLocalizadasRecalque).toFixed(3)}</TableCell><TableCell>m</TableCell></TableRow>
                        <TableRow className="font-bold"><TableCell>AMT Total</TableCell><TableCell>{result.alturaManometricaTotal}</TableCell><TableCell>m</TableCell></TableRow>
                        <TableRow><TableCell>Potência KW</TableCell><TableCell>{result.potenciaKW}</TableCell><TableCell>kW</TableCell></TableRow>
                        <TableRow><TableCell>Potência Motor Comercial</TableCell><TableCell>{result.potenciaComercial}</TableCell><TableCell>CV</TableCell></TableRow>
                        <TableRow><TableCell>V Sucção</TableCell><TableCell>{result.velocidadeSuccao}</TableCell><TableCell>m/s</TableCell></TableRow>
                        <TableRow><TableCell>V Recalque</TableCell><TableCell>{result.velocidadeRecalque}</TableCell><TableCell>m/s</TableCell></TableRow>
                        <TableRow><TableCell>NPSH Disponível</TableCell><TableCell>{result.npshDisponivel}</TableCell><TableCell>m</TableCell></TableRow>
                        <TableRow><TableCell>Diâmetro Bresse</TableCell><TableCell>{result.diametroBresse}</TableCell><TableCell>mm</TableCell></TableRow>
                        <TableRow><TableCell>Classe Pressão</TableCell><TableCell>PN {result.classePresao}</TableCell><TableCell>bar</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Transient Summary */}
              <Card className={result.transiente.riscoCavitacao ? "border-[#EF4444]/50 bg-[rgba(239,68,68,0.05)]" : ""}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Waves className="h-4 w-4 text-primary" /> Transientes Hidráulicos (Análise Rápida)
                  </CardTitle>
                  <CardDescription>
                    Golpe de aríete — Joukowsky e Allievi | NBR 12215 / NBR 12214
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Celeridade (a)</p>
                      <p className="text-lg font-bold">{result.transiente.celeridadeOnda} m/s</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Joukowsky</p>
                      <p className="text-lg font-bold">{result.transiente.golpeArieteJoukowsky} m</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Allievi (efetivo)</p>
                      <p className="text-lg font-bold">{result.transiente.golpeArieteAllievi} m</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Tc (2L/a)</p>
                      <p className="text-lg font-bold">{result.transiente.tempoCritico} s</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className={`text-center p-2 rounded ${result.transiente.pressaoMaxima > result.alturaManometricaTotal * 1.5 ? "bg-[rgba(239,68,68,0.1)]" : "bg-[rgba(165,206,0,0.1)]"}`}>
                      <p className="text-xs">Pressão Máxima</p>
                      <p className="text-lg font-bold">{result.transiente.pressaoMaxima} mca</p>
                    </div>
                    <div className={`text-center p-2 rounded ${result.transiente.riscoCavitacao ? "bg-[rgba(239,68,68,0.1)]" : "bg-[rgba(165,206,0,0.1)]"}`}>
                      <p className="text-xs">Pressão Mínima</p>
                      <p className="text-lg font-bold">{result.transiente.pressaoMinima} mca</p>
                    </div>
                  </div>

                  {result.transiente.recomendacoes.length > 0 && (
                    <div className="space-y-1">
                      {result.transiente.recomendacoes.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-warning">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          {rec}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                    Para simulação detalhada (MOC), use a aba "Transientes" no menu principal.
                  </div>
                </CardContent>
              </Card>

              {/* System Curve Chart */}
              {systemCurveData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Curva do Sistema × Curva da Bomba</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={systemCurveData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="q" label={{ value: "Vazão (L/s)", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "H (m)", angle: -90, position: "insideLeft" }} />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="hSistema" stroke="#10367D" name="Sistema" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="hBomba" stroke="#3b82f6" name="Bomba" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Observations */}
              {result.observacoes.length > 0 && (
                <Card className="border-warning/30 bg-warning/5">
                  <CardContent className="py-3 space-y-1">
                    {result.observacoes.map((o, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-warning">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        {o}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button onClick={exportCSV} variant="outline">
                  <Download className="h-4 w-4 mr-1" /> Exportar Relatório
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
