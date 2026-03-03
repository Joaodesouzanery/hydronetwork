/**
 * TransientModule — Hydraulic Transient (Water Hammer) Simulation UI
 *
 * Full MOC simulation with:
 * - Pressure envelope visualization
 * - Time-series charts
 * - Cavitation risk assessment
 * - Integration with Recalque and EPANET data
 *
 * References: NBR 12215, NBR 12214, AWWA M11, CAESB NTS
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
  Calculator, Waves, CheckCircle, XCircle, Download,
  AlertTriangle, Zap, Play, Settings, Activity,
  TrendingUp, BarChart3,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ReferenceLine,
} from "recharts";
import {
  runTransientSimulation,
  quickTransientAnalysis,
  buildTransientFromRecalque,
  calculateWaveSpeed,
  joukowskySurge,
  criticalTime,
  type TransientPipe,
  type TransientInput,
  type TransientResult,
  type QuickTransientResult,
  type PipeMaterial,
  type TransientScenario,
} from "@/engine/transientEngine";

// ══════════════════════════════════════
// Component
// ══════════════════════════════════════

export const TransientModule = () => {
  // ── Quick Analysis state ──
  const [pipeLength, setPipeLength] = useState(500);
  const [pipeDiameter, setPipeDiameter] = useState(150);
  const [pipeWallThickness, setPipeWallThickness] = useState(5);
  const [pipeMaterial, setPipeMaterial] = useState<PipeMaterial>("PVC");
  const [steadyFlow, setSteadyFlow] = useState(20); // L/s
  const [steadyPressure, setSteadyPressure] = useState(40); // mca
  const [closureTime, setClosureTime] = useState(5); // s
  const [frictionFactor, setFrictionFactor] = useState(0.02);

  // ── MOC Simulation state ──
  const [eventType, setEventType] = useState<TransientScenario["eventType"]>("pump_trip");
  const [simDuration, setSimDuration] = useState(60);
  const [eventTime, setEventTime] = useState(1);

  // Pump data for MOC
  const [pumpRatedFlow, setPumpRatedFlow] = useState(20); // L/s
  const [pumpRatedHead, setPumpRatedHead] = useState(40); // m
  const [pumpRpm, setPumpRpm] = useState(1750);
  const [pumpInertia, setPumpInertia] = useState(0.5);
  const [hasCheckValve, setHasCheckValve] = useState(true);

  // Geometric
  const [elevUp, setElevUp] = useState(100);
  const [elevDown, setElevDown] = useState(120);

  // ── Results ──
  const [quickResult, setQuickResult] = useState<QuickTransientResult | null>(null);
  const [mocResult, setMocResult] = useState<TransientResult | null>(null);

  // ── Derived ──
  const waveSpeed = useMemo(
    () => calculateWaveSpeed(pipeDiameter, pipeWallThickness, pipeMaterial),
    [pipeDiameter, pipeWallThickness, pipeMaterial],
  );
  const Tc = useMemo(
    () => criticalTime(pipeLength, waveSpeed),
    [pipeLength, waveSpeed],
  );
  const velocity = useMemo(() => {
    const A = Math.PI * (pipeDiameter / 1000) * (pipeDiameter / 1000) / 4;
    return A > 0 ? (steadyFlow / 1000) / A : 0;
  }, [steadyFlow, pipeDiameter]);
  const joukowsky = useMemo(
    () => joukowskySurge(waveSpeed, velocity),
    [waveSpeed, velocity],
  );

  // ── Quick analysis ──
  const runQuickAnalysis = useCallback(() => {
    const pipe: TransientPipe = {
      id: "pipe-1",
      nodeUp: "up",
      nodeDown: "down",
      length: pipeLength,
      diameter: pipeDiameter,
      wallThickness: pipeWallThickness,
      frictionFactor,
      material: pipeMaterial,
    };
    const result = quickTransientAnalysis(pipe, steadyFlow / 1000, steadyPressure, closureTime);
    setQuickResult(result);

    if (result.cavitationRisk) {
      toast.warning("RISCO DE CAVITAÇÃO detectado!");
    } else {
      toast.success(`Análise rápida: ΔH = ${result.allieviSurge} m (${result.closureType === "fast" ? "rápido" : "lento"})`);
    }
  }, [pipeLength, pipeDiameter, pipeWallThickness, frictionFactor, pipeMaterial, steadyFlow, steadyPressure, closureTime]);

  // ── MOC simulation ──
  const runMOC = useCallback(() => {
    toast.info("Executando simulação MOC...");

    try {
      const input = buildTransientFromRecalque({
        vazaoProjeto: steadyFlow,
        alturaGeometrica: elevDown - elevUp,
        comprimentoRecalque: pipeLength,
        diametroRecalque: pipeDiameter,
        material: pipeMaterial,
        coefHW: 140,
        rendimentoBomba: 0.75,
        rpmBomba: pumpRpm,
        inerciaBomba: pumpInertia,
        temValvulaRetencao: hasCheckValve,
      }, {
        name: `Simulação ${eventType}`,
        eventType,
        duration: simDuration,
        eventTime,
      });

      const result = runTransientSimulation(input);
      setMocResult(result);

      if (result.cavitationRisk.length > 0) {
        toast.warning(`MOC: ${result.cavitationRisk.length} ponto(s) com risco de cavitação`);
      } else {
        toast.success(`MOC: simulação concluída em ${result.simulationTime}ms (${result.timeSteps} passos)`);
      }
    } catch (err: any) {
      toast.error(`Erro na simulação MOC: ${err.message}`);
    }
  }, [steadyFlow, elevUp, elevDown, pipeLength, pipeDiameter, pipeMaterial,
      pumpRpm, pumpInertia, hasCheckValve, eventType, simDuration, eventTime]);

  // ── Chart data ──
  const envelopeChartData = useMemo(() => {
    if (!mocResult || mocResult.pipeEnvelope.length === 0) return [];
    const env = mocResult.pipeEnvelope[0];
    return env.stations.map(s => ({
      distancia: s.distance,
      terreno: s.elevation,
      maxHead: s.maxHead,
      minHead: s.minHead,
      steadyHead: s.steadyHead,
    }));
  }, [mocResult]);

  const headTimeData = useMemo(() => {
    if (!mocResult) return [];
    // Get first node time series
    const entries = Array.from(mocResult.nodeHeads.entries());
    if (entries.length === 0) return [];

    // Pick pump node and reservoir node
    const [nodeId1, series1] = entries[0];
    const [nodeId2, series2] = entries.length > 1 ? entries[1] : entries[0];

    return series1.map(([t, h1], i) => ({
      tempo: Math.round(t * 100) / 100,
      [nodeId1]: Math.round(h1 * 100) / 100,
      [nodeId2]: series2[i] ? Math.round(series2[i][1] * 100) / 100 : undefined,
    }));
  }, [mocResult]);

  const flowTimeData = useMemo(() => {
    if (!mocResult) return [];
    const entries = Array.from(mocResult.pipeFlows.entries());
    if (entries.length === 0) return [];
    const [pipeId, series] = entries[0];
    return series.map(([t, q]) => ({
      tempo: Math.round(t * 100) / 100,
      vazao: Math.round(q * 1000 * 100) / 100, // m³/s → L/s
    }));
  }, [mocResult]);

  // Material wall thickness defaults
  const materialDefaults: Record<PipeMaterial, number> = {
    PVC: 5, PEAD: 8, FoFo: 10, Aco: 6, Concreto: 40, PRFV: 6,
  };

  const handleMaterialChange = (mat: PipeMaterial) => {
    setPipeMaterial(mat);
    setPipeWallThickness(materialDefaults[mat]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Waves className="h-6 w-6 text-primary" /> Transientes Hidráulicos (Golpe de Aríete)
          </CardTitle>
          <CardDescription>
            Simulação por Método das Características (MOC) | Joukowsky ΔH = a·ΔV/g |
            NBR 12215 · NBR 12214 · AWWA M11 · CAESB NTS
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Real-time parameter indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 text-center">
            <p className="text-[10px] text-muted-foreground">Celeridade (a)</p>
            <p className="text-xl font-bold text-primary">{waveSpeed.toFixed(0)} m/s</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 text-center">
            <p className="text-[10px] text-muted-foreground">Joukowsky (ΔH)</p>
            <p className="text-xl font-bold text-primary">{joukowsky.toFixed(1)} m</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 text-center">
            <p className="text-[10px] text-muted-foreground">Tempo Crítico (2L/a)</p>
            <p className="text-xl font-bold">{Tc.toFixed(2)} s</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 text-center">
            <p className="text-[10px] text-muted-foreground">Velocidade</p>
            <p className="text-xl font-bold">{velocity.toFixed(2)} m/s</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rapido">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="rapido"><Zap className="h-3.5 w-3.5 mr-1" />Análise Rápida</TabsTrigger>
          <TabsTrigger value="moc"><Play className="h-3.5 w-3.5 mr-1" />Simulação MOC</TabsTrigger>
          <TabsTrigger value="resultados"><BarChart3 className="h-3.5 w-3.5 mr-1" />Resultados</TabsTrigger>
        </TabsList>

        {/* ═══════ TAB: ANÁLISE RÁPIDA ═══════ */}
        <TabsContent value="rapido" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tubulação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Comprimento (m)</Label><Input type="number" value={pipeLength} onChange={e => setPipeLength(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">DN (mm)</Label><Input type="number" value={pipeDiameter} onChange={e => setPipeDiameter(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Material</Label>
                    <Select value={pipeMaterial} onValueChange={v => handleMaterialChange(v as PipeMaterial)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PVC">PVC</SelectItem>
                        <SelectItem value="PEAD">PEAD</SelectItem>
                        <SelectItem value="FoFo">Ferro Fundido</SelectItem>
                        <SelectItem value="Aco">Aço</SelectItem>
                        <SelectItem value="Concreto">Concreto</SelectItem>
                        <SelectItem value="PRFV">PRFV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Espessura (mm)</Label><Input type="number" step="0.5" value={pipeWallThickness} onChange={e => setPipeWallThickness(Number(e.target.value))} /></div>
                </div>
                <div><Label className="text-xs">Fator de fricção (f)</Label><Input type="number" step="0.001" value={frictionFactor} onChange={e => setFrictionFactor(Number(e.target.value))} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Condições Operacionais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Vazão (L/s)</Label><Input type="number" step="1" value={steadyFlow} onChange={e => setSteadyFlow(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Pressão estática (mca)</Label><Input type="number" value={steadyPressure} onChange={e => setSteadyPressure(Number(e.target.value))} /></div>
                </div>
                <div><Label className="text-xs">Tempo de fechamento/evento (s)</Label><Input type="number" step="0.5" value={closureTime} onChange={e => setClosureTime(Number(e.target.value))} /></div>
                <div className="bg-muted/50 rounded p-2 text-xs space-y-1">
                  <p className="font-semibold">Referência NBR 12215:</p>
                  <p>Tempo fechamento ≥ 2L/a = {Tc.toFixed(2)}s para evitar golpe total</p>
                  <p>Pressão máx. admissível ≤ PN da tubulação</p>
                  <p>Pressão mín. &gt; 0 mca (evitar cavitação)</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={runQuickAnalysis} className="w-full bg-[#FF6B2C] text-white hover:bg-[#E55A1F]">
            <Zap className="h-4 w-4 mr-2" /> Análise Rápida (Joukowsky / Allievi)
          </Button>

          {quickResult && (
            <Card className={quickResult.cavitationRisk ? "border-[#EF4444]/50 bg-[rgba(239,68,68,0.05)]" : ""}>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-2 bg-muted rounded">
                    <p className="text-[10px] text-muted-foreground">Celeridade</p>
                    <p className="text-lg font-bold">{quickResult.waveSpeed} m/s</p>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <p className="text-[10px] text-muted-foreground">Joukowsky</p>
                    <p className="text-lg font-bold">{quickResult.joukowskySurge} m</p>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <p className="text-[10px] text-muted-foreground">Allievi (efetivo)</p>
                    <p className="text-lg font-bold">{quickResult.allieviSurge} m</p>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <p className="text-[10px] text-muted-foreground">Tc (2L/a)</p>
                    <p className="text-lg font-bold">{quickResult.criticalTime} s</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className={`text-center p-2 rounded ${quickResult.maxPressure > steadyPressure * 2 ? "bg-[rgba(239,68,68,0.1)]" : "bg-[rgba(165,206,0,0.1)]"}`}>
                    <p className="text-xs">P Máxima</p>
                    <p className="text-lg font-bold">{quickResult.maxPressure} mca</p>
                  </div>
                  <div className={`text-center p-2 rounded ${quickResult.cavitationRisk ? "bg-[rgba(239,68,68,0.1)]" : "bg-[rgba(165,206,0,0.1)]"}`}>
                    <p className="text-xs">P Mínima</p>
                    <p className="text-lg font-bold">{quickResult.minPressure} mca</p>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <p className="text-xs">Classe Pressão</p>
                    <p className="text-lg font-bold">PN {quickResult.pressureClassNeeded}</p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Badge className={quickResult.closureType === "fast" ? "bg-[rgba(239,68,68,0.1)] text-[#EF4444]" : "bg-[rgba(165,206,0,0.1)] text-[#FF6B2C]"}>
                    Fechamento {quickResult.closureType === "fast" ? "RÁPIDO" : "LENTO"}
                  </Badge>
                  {quickResult.cavitationRisk && <Badge variant="destructive">CAVITAÇÃO</Badge>}
                </div>

                {quickResult.recommendations.length > 0 && (
                  <div className="space-y-1 border-t pt-2">
                    <p className="text-xs font-semibold">Recomendações:</p>
                    {quickResult.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-warning">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        {r}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════ TAB: SIMULAÇÃO MOC ═══════ */}
        <TabsContent value="moc" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cenário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Tipo de Evento</Label>
                  <Select value={eventType} onValueChange={v => setEventType(v as TransientScenario["eventType"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pump_trip">Parada Brusca de Bomba</SelectItem>
                      <SelectItem value="pump_start">Partida de Bomba</SelectItem>
                      <SelectItem value="valve_closure">Fechamento de Válvula</SelectItem>
                      <SelectItem value="valve_opening">Abertura de Válvula</SelectItem>
                      <SelectItem value="power_failure">Falha de Energia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Duração (s)</Label><Input type="number" value={simDuration} onChange={e => setSimDuration(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Início evento (s)</Label><Input type="number" step="0.5" value={eventTime} onChange={e => setEventTime(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Cota montante (m)</Label><Input type="number" value={elevUp} onChange={e => setElevUp(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Cota jusante (m)</Label><Input type="number" value={elevDown} onChange={e => setElevDown(Number(e.target.value))} /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bomba</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">RPM</Label><Input type="number" value={pumpRpm} onChange={e => setPumpRpm(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Inércia WR² (kg·m²)</Label><Input type="number" step="0.1" value={pumpInertia} onChange={e => setPumpInertia(Number(e.target.value))} /></div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={hasCheckValve} onChange={e => setHasCheckValve(e.target.checked)} />
                  <Label className="text-xs">Válvula de retenção na descarga</Label>
                </div>
                <div className="bg-muted/50 rounded p-2 text-xs">
                  <p className="font-semibold">CAESB / SABESP:</p>
                  <p>Avaliação obrigatória para DN ≥ 300mm</p>
                  <p>Parada brusca + falha de energia</p>
                  <p>Pressão máx &lt; PN tubulação</p>
                  <p>Pressão mín &gt; pressão de vapor</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={runMOC} className="w-full bg-[#FF6B2C] text-white hover:bg-[#E55A1F]">
            <Play className="h-4 w-4 mr-2" /> Executar Simulação MOC
          </Button>

          {mocResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-3 text-center">
                  <p className="text-[10px] text-muted-foreground">P Máxima</p>
                  <p className="text-lg font-bold text-primary">{mocResult.maxPressure} mca</p>
                </CardContent>
              </Card>
              <Card className={mocResult.minPressure < 0 ? "border-[#EF4444]" : ""}>
                <CardContent className="pt-3 text-center">
                  <p className="text-[10px] text-muted-foreground">P Mínima</p>
                  <p className="text-lg font-bold text-info">{mocResult.minPressure} mca</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Cavitação</p>
                  <p className="text-lg font-bold">{mocResult.cavitationRisk.length}</p>
                  <p className="text-[10px]">pontos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Tempo sim.</p>
                  <p className="text-lg font-bold">{mocResult.simulationTime} ms</p>
                  <p className="text-[10px]">{mocResult.timeSteps} passos</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ═══════ TAB: RESULTADOS ═══════ */}
        <TabsContent value="resultados" className="space-y-4">
          {!mocResult && (
            <div className="flex items-center gap-2 p-4 bg-muted text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Execute a simulação MOC primeiro.
            </div>
          )}

          {mocResult && (
            <>
              {/* Pressure Envelope */}
              {envelopeChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Envoltória de Pressão (Perfil Piezométrico)</CardTitle>
                    <CardDescription>Pressão máxima e mínima ao longo da adutora</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={envelopeChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="distancia" label={{ value: "Distância (m)", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "Cota (m)", angle: -90, position: "insideLeft" }} />
                        <RechartsTooltip />
                        <Legend />
                        <Area type="monotone" dataKey="maxHead" fill="rgba(16,54,125,0.1)" stroke="#10367D" name="Máx. Piezométrica" strokeWidth={2} />
                        <Area type="monotone" dataKey="minHead" fill="rgba(59,130,246,0.1)" stroke="#3b82f6" name="Mín. Piezométrica" strokeWidth={2} />
                        <Line type="monotone" dataKey="steadyHead" stroke="#FF6B2C" name="Regime Permanente" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="terreno" stroke="#0A2456" name="Terreno" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Head vs Time */}
              {headTimeData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cota Piezométrica × Tempo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={headTimeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="tempo" label={{ value: "Tempo (s)", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "H (m)", angle: -90, position: "insideLeft" }} />
                        <RechartsTooltip />
                        <Legend />
                        {Array.from(mocResult.nodeHeads.keys()).map((nodeId, i) => (
                          <Line
                            key={nodeId}
                            type="monotone"
                            dataKey={nodeId}
                            stroke={i === 0 ? "#10367D" : "#3b82f6"}
                            name={nodeId}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Flow vs Time */}
              {flowTimeData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Vazão × Tempo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={flowTimeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="tempo" label={{ value: "Tempo (s)", position: "insideBottom", offset: -5 }} />
                        <YAxis label={{ value: "Q (L/s)", angle: -90, position: "insideLeft" }} />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="vazao" stroke="#F59E0B" name="Vazão" strokeWidth={2} dot={false} />
                        <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Envelope Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Envoltória — Pressões nos Nós</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border overflow-auto max-h-60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nó</TableHead>
                          <TableHead>Cota (m)</TableHead>
                          <TableHead>H Perm. (m)</TableHead>
                          <TableHead>H Máx. (m)</TableHead>
                          <TableHead>H Mín. (m)</TableHead>
                          <TableHead>P Máx. (mca)</TableHead>
                          <TableHead>P Mín. (mca)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mocResult.envelope.map(e => (
                          <TableRow key={e.nodeId} className={e.minPressure < 0 ? "bg-red-50 dark:bg-red-950/20" : ""}>
                            <TableCell className="font-mono text-xs">{e.nodeId}</TableCell>
                            <TableCell>{e.elevation}</TableCell>
                            <TableCell>{e.steadyHead}</TableCell>
                            <TableCell className="text-primary font-semibold">{e.maxHead}</TableCell>
                            <TableCell className="text-info font-semibold">{e.minHead}</TableCell>
                            <TableCell>{e.maxPressure}</TableCell>
                            <TableCell>{e.minPressure}</TableCell>
                            <TableCell>
                              {e.minPressure < 0
                                ? <Badge variant="destructive">Cavitação</Badge>
                                : <Badge className="bg-[rgba(165,206,0,0.1)] text-[#FF6B2C]">OK</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              {mocResult.warnings.length > 0 && (
                <Card className="border-warning/30">
                  <CardContent className="py-3 space-y-1">
                    {mocResult.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-warning">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        {w}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Wave speeds */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Celeridades por Trecho</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {mocResult.waveSpeeds.map(ws => (
                      <Badge key={ws.pipeId} variant="outline">
                        {ws.pipeId}: {ws.waveSpeed} m/s
                      </Badge>
                    ))}
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
