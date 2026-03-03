/**
 * ElevatorStationModule — Pump/Elevator Station dimensioning, budgeting, and timeline.
 *
 * Features:
 * - Station configuration (flow, head, pipes, pumps)
 * - Hydraulic dimensioning (TDH, power, wet well)
 * - Budget estimation (SINAPI-based)
 * - Timeline/Gantt generation
 * - NBR 12209/12214 compliance
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Calculator, Settings, FileText, Clock,
  CheckCircle, XCircle, Download, AlertTriangle,
  Droplets, Zap, DollarSign, BarChart3,
} from "lucide-react";
import {
  dimensionElevatorStation,
  getBudgetTotal,
  getTimelineTotal,
  formatCurrency,
  type StationInput,
  type StationResult,
} from "@/engine/elevatorStationEngine";

// ══════════════════════════════════════
// Main Component
// ══════════════════════════════════════

export const ElevatorStationModule = () => {
  // ── Station parameters ──
  const [stationName, setStationName] = useState("EE-001");
  const [tipo, setTipo] = useState<"esgoto" | "agua" | "drenagem">("esgoto");
  const [vazaoProjeto, setVazaoProjeto] = useState(50);
  const [vazaoMinima, setVazaoMinima] = useState(10);
  const [vazaoMaxima, setVazaoMaxima] = useState(80);
  const [alturaGeometrica, setAlturaGeometrica] = useState(8);
  const [comprimentoSuccao, setComprimentoSuccao] = useState(5);
  const [comprimentoRecalque, setComprimentoRecalque] = useState(200);
  const [diametroSuccao, setDiametroSuccao] = useState(200);
  const [diametroRecalque, setDiametroRecalque] = useState(150);
  const [material, setMaterial] = useState("PVC");
  const [coefHW, setCoefHW] = useState(150);
  const [numBombas, setNumBombas] = useState(3);
  const [numReserva, setNumReserva] = useState(1);
  const [rendimentoBomba, setRendimentoBomba] = useState(0.7);
  const [rendimentoMotor, setRendimentoMotor] = useState(0.9);
  const [tempoRetencao, setTempoRetencao] = useState(15);

  // ── Results ──
  const [result, setResult] = useState<StationResult | null>(null);

  // ── Dimensioning ──
  const dimensionar = () => {
    const input: StationInput = {
      id: stationName,
      vazaoProjeto, vazaoMinima, vazaoMaxima,
      alturaGeometrica, comprimentoSuccao, comprimentoRecalque,
      diametroSuccao, diametroRecalque,
      material, coefHW, numBombas, numReserva,
      rendimentoBomba, rendimentoMotor, tipo, tempoRetencao,
    };

    try {
      const res = dimensionElevatorStation(input);
      setResult(res);
      if (res.atendeNorma) {
        toast.success("Dimensionamento concluído — atende às normas");
      } else {
        toast.warning(`Dimensionamento concluído — ${res.observacoes.length} alerta(s)`);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  // Budget total
  const budgetTotal = useMemo(() =>
    result ? getBudgetTotal(result.orcamento) : 0
  , [result]);

  const timelineTotal = useMemo(() =>
    result ? getTimelineTotal(result.cronograma) : 0
  , [result]);

  // ── CSV Export ──
  const exportBudgetCSV = () => {
    if (!result) return;
    let csv = "Descrição,Unidade,Quantidade,Preço Unitário,Preço Total,Código SINAPI\n";
    result.orcamento.forEach(item => {
      csv += `"${item.descricao}",${item.unidade},${item.quantidade},${item.precoUnitario},${item.precoTotal},${item.codigoSinapi || ""}\n`;
    });
    csv += `\n"TOTAL",,,,${budgetTotal},\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orcamento_${stationName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-red-600" />
            Estação Elevatória / Bombeamento
          </h2>
          <p className="text-sm text-muted-foreground">
            Dimensionamento, orçamentação e cronograma conforme NBR 12209/12214
          </p>
        </div>
        {result && (
          <Badge className={result.atendeNorma ? "bg-green-500" : "bg-red-500"}>
            {result.atendeNorma ? "Atende NBR" : "Não Atende"}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="config">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="config"><Settings className="h-3.5 w-3.5 mr-1" />Configuração</TabsTrigger>
          <TabsTrigger value="resultado"><Calculator className="h-3.5 w-3.5 mr-1" />Resultado</TabsTrigger>
          <TabsTrigger value="orcamento"><DollarSign className="h-3.5 w-3.5 mr-1" />Orçamento</TabsTrigger>
          <TabsTrigger value="cronograma"><Clock className="h-3.5 w-3.5 mr-1" />Cronograma</TabsTrigger>
        </TabsList>

        {/* ═══════ TAB 1: CONFIGURAÇÃO ═══════ */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-600" /> Dados da Estação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nome/ID</Label>
                    <Input value={stationName} onChange={e => setStationName(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={tipo} onValueChange={v => setTipo(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="esgoto">Esgoto</SelectItem>
                        <SelectItem value="agua">Água</SelectItem>
                        <SelectItem value="drenagem">Drenagem</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Q projeto (L/s)</Label>
                    <Input type="number" step="1" value={vazaoProjeto} onChange={e => setVazaoProjeto(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Q mín (L/s)</Label>
                    <Input type="number" step="1" value={vazaoMinima} onChange={e => setVazaoMinima(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Q máx (L/s)</Label>
                    <Input type="number" step="1" value={vazaoMaxima} onChange={e => setVazaoMaxima(Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Altura geométrica (m)</Label>
                  <Input type="number" step="0.5" value={alturaGeometrica} onChange={e => setAlturaGeometrica(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Tempo de retenção poço úmido (min)</Label>
                  <Input type="number" step="1" value={tempoRetencao} onChange={e => setTempoRetencao(Number(e.target.value))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4 text-blue-600" /> Tubulações e Bombas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Material</Label>
                    <Select value={material} onValueChange={v => { setMaterial(v); if (v === "PVC") setCoefHW(150); else if (v === "PEAD") setCoefHW(150); else setCoefHW(120); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PVC">PVC</SelectItem>
                        <SelectItem value="PEAD">PEAD</SelectItem>
                        <SelectItem value="Ferro Fundido">Ferro Fundido</SelectItem>
                        <SelectItem value="Aço">Aço</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">C (HW)</Label>
                    <Input type="number" step="5" value={coefHW} onChange={e => setCoefHW(Number(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">DN sucção (mm)</Label><Input type="number" step="25" value={diametroSuccao} onChange={e => setDiametroSuccao(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Comp. sucção (m)</Label><Input type="number" step="1" value={comprimentoSuccao} onChange={e => setComprimentoSuccao(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">DN recalque (mm)</Label><Input type="number" step="25" value={diametroRecalque} onChange={e => setDiametroRecalque(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Comp. recalque (m)</Label><Input type="number" step="1" value={comprimentoRecalque} onChange={e => setComprimentoRecalque(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Nº bombas (total)</Label><Input type="number" step="1" min="1" value={numBombas} onChange={e => setNumBombas(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Nº reserva</Label><Input type="number" step="1" min="0" value={numReserva} onChange={e => setNumReserva(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">η bomba</Label><Input type="number" step="0.05" value={rendimentoBomba} onChange={e => setRendimentoBomba(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">η motor</Label><Input type="number" step="0.05" value={rendimentoMotor} onChange={e => setRendimentoMotor(Number(e.target.value))} /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={dimensionar} size="lg" className="w-full">
            <Calculator className="h-4 w-4 mr-2" /> Dimensionar Estação
          </Button>
        </TabsContent>

        {/* ═══════ TAB 2: RESULTADO ═══════ */}
        <TabsContent value="resultado" className="space-y-4">
          {!result ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Configure e dimensione na aba anterior.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{result.alturaManometricaTotal.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">AMT (m)</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">{result.potenciaMotorComercial}</div>
                  <div className="text-xs text-muted-foreground">Potência (CV)</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{result.volumePocoUmido.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Vol. poço (m³)</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{result.vazaoPorBomba.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Q/bomba (L/s)</div>
                </Card>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <Table>
                    <TableBody>
                      <TableRow><TableCell className="font-medium">Altura geométrica</TableCell><TableCell>{result.alturaGeometrica} m</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Perda carga sucção</TableCell><TableCell>{result.perdaCargaSuccao.toFixed(3)} m</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Perda carga recalque</TableCell><TableCell>{result.perdaCargaRecalque.toFixed(3)} m</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Perdas localizadas</TableCell><TableCell>{result.perdasLocalizadas.toFixed(3)} m</TableCell></TableRow>
                      <TableRow className="font-bold"><TableCell>AMT Total</TableCell><TableCell>{result.alturaManometricaTotal.toFixed(2)} m</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Potência bomba</TableCell><TableCell>{result.potenciaBomba.toFixed(2)} kW ({result.potenciaMotor.toFixed(2)} CV)</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Potência motor comercial</TableCell><TableCell>{result.potenciaMotorComercial} CV</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Velocidade sucção</TableCell><TableCell>{result.velocidadeSuccao.toFixed(3)} m/s</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Velocidade recalque</TableCell><TableCell>{result.velocidadeRecalque.toFixed(3)} m/s</TableCell></TableRow>
                      <TableRow><TableCell className="font-medium">Poço úmido</TableCell><TableCell>{result.dimensoesPocoUmido.largura}m × {result.dimensoesPocoUmido.comprimento}m × {result.dimensoesPocoUmido.profundidade}m</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {result.observacoes.length > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" /> Alertas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-4 space-y-1 text-sm">
                      {result.observacoes.map((obs, i) => (
                        <li key={i} className="text-yellow-700 dark:text-yellow-400">{obs}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ═══════ TAB 3: ORÇAMENTO ═══════ */}
        <TabsContent value="orcamento" className="space-y-4">
          {!result ? (
            <div className="text-center py-10 text-muted-foreground">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Dimensione a estação primeiro.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold">{formatCurrency(budgetTotal)}</span>
                  <span className="text-sm text-muted-foreground ml-2">Total estimado</span>
                </div>
                <Button variant="outline" onClick={exportBudgetCSV}>
                  <Download className="h-4 w-4 mr-1" /> Exportar CSV
                </Button>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div className="border overflow-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-16">Un</TableHead>
                          <TableHead className="w-16 text-right">Qtd</TableHead>
                          <TableHead className="w-24 text-right">Unit (R$)</TableHead>
                          <TableHead className="w-24 text-right">Total (R$)</TableHead>
                          <TableHead className="w-20">SINAPI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.orcamento.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{item.descricao}</TableCell>
                            <TableCell className="text-sm">{item.unidade}</TableCell>
                            <TableCell className="text-sm text-right">{item.quantidade}</TableCell>
                            <TableCell className="text-sm text-right">{formatCurrency(item.precoUnitario)}</TableCell>
                            <TableCell className="text-sm text-right font-medium">{formatCurrency(item.precoTotal)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.codigoSinapi || "-"}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-muted/50">
                          <TableCell colSpan={4}>TOTAL</TableCell>
                          <TableCell className="text-right">{formatCurrency(budgetTotal)}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="text-xs text-muted-foreground">
                Valores estimados baseados em composições SINAPI. Para orçamento definitivo,
                consulte as tabelas SINAPI/SICRO atualizadas do mês vigente.
              </div>
            </>
          )}
        </TabsContent>

        {/* ═══════ TAB 4: CRONOGRAMA ═══════ */}
        <TabsContent value="cronograma" className="space-y-4">
          {!result ? (
            <div className="text-center py-10 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Dimensione a estação primeiro.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {timelineTotal} dias ({Math.ceil(timelineTotal / 30)} meses)
                </Badge>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {result.cronograma.map((item, i) => {
                      const progress = (item.duracaoDias / timelineTotal) * 100;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>
                              <Badge variant="outline" className="mr-2">{item.etapa}</Badge>
                              {item.descricao}
                            </span>
                            <span className="text-muted-foreground">{item.duracaoDias} dias</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                          {item.dependeDe && (
                            <div className="text-xs text-muted-foreground pl-8">
                              Depende da etapa {item.dependeDe}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
