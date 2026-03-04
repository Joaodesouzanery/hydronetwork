/**
 * CAESBModule — Isolated CAESB/SABESP Compliance Module
 *
 * Provides a standalone UI for checking project compliance against
 * CAESB (DF) and SABESP (SP) technical standards.
 *
 * Features:
 * - Network type selector (agua, esgoto, adutora, elevatoria)
 * - Parameter input forms per network type
 * - Automated compliance checking
 * - Visual report with pass/fail/warning badges
 * - Document submission checklist
 * - PDF export of compliance report
 *
 * References: CAESB NTS 181-183, SABESP NTS 019/025, NBR 9649,
 *             NBR 12211, NBR 12214, NBR 12215, NBR 12218
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Shield, CheckCircle, XCircle, AlertTriangle,
  FileText, Download, Droplets, Waves, Activity, Building2,
  ClipboardList, Info,
} from "lucide-react";

import {
  checkWaterNetwork,
  checkSewerNetwork,
  checkTransient,
  checkElevatorStation,
  generateCAESBReport,
  getCAESBSubmissionChecklist,
  type NetworkType,
  type CAESBComplianceReport,
  type CAESBCheckResult,
  type CAESBDocumentItem,
  type WaterNetworkInput,
  type SewerNetworkInput,
  type TransientInput,
  type ElevatorStationInput,
} from "@/engine/caesbEngine";

// ══════════════════════════════════════
// Severity Badge Component
// ══════════════════════════════════════

function SeverityBadge({ severity }: { severity: CAESBCheckResult["severity"] }) {
  switch (severity) {
    case "ok":
      return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" /> Aprovado</Badge>;
    case "warning":
      return <Badge className="bg-yellow-500 text-black"><AlertTriangle className="w-3 h-3 mr-1" /> Atenção</Badge>;
    case "critical":
      return <Badge className="bg-red-600 text-white"><XCircle className="w-3 h-3 mr-1" /> Crítico</Badge>;
    case "info":
      return <Badge variant="outline"><Info className="w-3 h-3 mr-1" /> Info</Badge>;
  }
}

function OverallStatusBadge({ status }: { status: CAESBComplianceReport["overallStatus"] }) {
  switch (status) {
    case "aprovado":
      return <Badge className="bg-green-600 text-white text-lg px-4 py-1"><CheckCircle className="w-4 h-4 mr-2" /> APROVADO</Badge>;
    case "com_ressalvas":
      return <Badge className="bg-yellow-500 text-black text-lg px-4 py-1"><AlertTriangle className="w-4 h-4 mr-2" /> COM RESSALVAS</Badge>;
    case "reprovado":
      return <Badge className="bg-red-600 text-white text-lg px-4 py-1"><XCircle className="w-4 h-4 mr-2" /> REPROVADO</Badge>;
  }
}

// ══════════════════════════════════════
// Main Component
// ══════════════════════════════════════

export const CAESBModule = () => {
  const [networkType, setNetworkType] = useState<NetworkType>("agua");
  const [report, setReport] = useState<CAESBComplianceReport | null>(null);
  const [checklist, setChecklist] = useState<CAESBDocumentItem[]>([]);
  const [checklistStatus, setChecklistStatus] = useState<Record<number, boolean>>({});

  // ── Water inputs ──
  const [wDiameters, setWDiameters] = useState("100, 150, 200");
  const [wVelocities, setWVelocities] = useState("0.8, 1.2, 1.5");
  const [wPressuresMin, setWPressuresMin] = useState("12, 15, 10");
  const [wPressuresMax, setWPressuresMax] = useState("45, 38, 42");
  const [wCoverDepth, setWCoverDepth] = useState("0.8, 0.9, 0.7");
  const [wPipeLength, setWPipeLength] = useState(1500);
  const [wPipeMaterial, setWPipeMaterial] = useState("PVC");
  const [wHasCheckValve, setWHasCheckValve] = useState(true);
  const [wHasPressureReducer, setWHasPressureReducer] = useState(false);
  const [wFlowRate, setWFlowRate] = useState(15);
  const [wDemandDay, setWDemandDay] = useState(200);
  const [wPopulation, setWPopulation] = useState(5000);

  // ── Sewer inputs ──
  const [sDiameters, setSDiameters] = useState("150, 200, 200");
  const [sVelocities, setSVelocities] = useState("0.7, 0.9, 1.1");
  const [sSlopes, setSSlopes] = useState("0.005, 0.004, 0.006");
  const [sDepthsUp, setSDepthsUp] = useState("1.2, 1.5, 1.8");
  const [sDepthsDown, setSDepthsDown] = useState("1.5, 1.8, 2.1");
  const [sTractiveStress, setSTractiveStress] = useState("1.2, 1.5, 1.8");
  const [sWaterLevel, setSWaterLevel] = useState("0.6, 0.55, 0.5");
  const [sPipeMaterial, setSPipeMaterial] = useState("PVC");
  const [sHasManholeVent, setSHasManholeVent] = useState(true);
  const [sManholeSpacing, setSManholeSpacing] = useState("60, 75, 80");

  // ── Transient inputs ──
  const [tDiameter, setTDiameter] = useState(300);
  const [tLength, setTLength] = useState(2000);
  const [tWaveSpeed, setTWaveSpeed] = useState(400);
  const [tVelocity, setTVelocity] = useState(1.5);
  const [tSteadyPressure, setTSteadyPressure] = useState(40);
  const [tClosureTime, setTClosureTime] = useState(5);
  const [tMaxPressure, setTMaxPressure] = useState(65);
  const [tMinPressure, setTMinPressure] = useState(-5);
  const [tHasMOC, setTHasMOC] = useState(true);
  const [tHasProtection, setTHasProtection] = useState(false);
  const [tPipeMaterial, setTPipeMaterial] = useState("FoFo");
  const [tPressureClass, setTPressureClass] = useState(75);

  // ── Elevator inputs ──
  const [eFlowRate, setEFlowRate] = useState(20);
  const [eTdh, setETdh] = useState(35);
  const [ePower, setEPower] = useState(15);
  const [eEfficiency, setEEfficiency] = useState(72);
  const [eNpshA, setENpshA] = useState(5);
  const [eNpshR, setENpshR] = useState(3.5);
  const [eNumPumps, setENumPumps] = useState(2);
  const [eNumReserve, setENumReserve] = useState(1);
  const [eSuctionV, setESuctionV] = useState(1.2);
  const [eDischargeV, setEDischargeV] = useState(1.8);
  const [eNetType, setENetType] = useState<"agua" | "esgoto">("agua");

  // ── Helpers ──
  const parseArr = (s: string): number[] => s.split(",").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));

  // ── Run checks ──
  const runCheck = () => {
    let checks: CAESBCheckResult[] = [];

    switch (networkType) {
      case "agua": {
        const input: WaterNetworkInput = {
          diameters: parseArr(wDiameters),
          velocities: parseArr(wVelocities),
          pressuresMin: parseArr(wPressuresMin),
          pressuresMax: parseArr(wPressuresMax),
          coverDepth: parseArr(wCoverDepth),
          pipeLength: wPipeLength,
          pipeMaterial: wPipeMaterial,
          hasCheckValve: wHasCheckValve,
          hasPressureReducer: wHasPressureReducer,
          flowRate: wFlowRate,
          demandDay: wDemandDay,
          population: wPopulation,
        };
        checks = checkWaterNetwork(input);
        break;
      }
      case "esgoto": {
        const input: SewerNetworkInput = {
          diameters: parseArr(sDiameters),
          velocities: parseArr(sVelocities),
          slopes: parseArr(sSlopes),
          depthsUpstream: parseArr(sDepthsUp),
          depthsDownstream: parseArr(sDepthsDown),
          tractiveStress: parseArr(sTractiveStress),
          waterLevel: parseArr(sWaterLevel),
          pipeMaterial: sPipeMaterial,
          hasManholeVent: sHasManholeVent,
          manholeSpacing: parseArr(sManholeSpacing),
        };
        checks = checkSewerNetwork(input);
        break;
      }
      case "adutora": {
        const input: TransientInput = {
          diameter: tDiameter,
          length: tLength,
          waveSpeed: tWaveSpeed,
          velocity: tVelocity,
          steadyPressure: tSteadyPressure,
          closureTime: tClosureTime,
          maxPressure: tMaxPressure,
          minPressure: tMinPressure,
          hasMOCSimulation: tHasMOC,
          hasProtectionDevices: tHasProtection,
          pipeMaterial: tPipeMaterial,
          pressureClass: tPressureClass,
        };
        checks = checkTransient(input);
        break;
      }
      case "elevatoria": {
        const input: ElevatorStationInput = {
          flowRate: eFlowRate,
          tdh: eTdh,
          power: ePower,
          efficiency: eEfficiency,
          npshAvailable: eNpshA,
          npshRequired: eNpshR,
          numPumps: eNumPumps,
          numReserve: eNumReserve,
          suctionVelocity: eSuctionV,
          dischargeVelocity: eDischargeV,
          networkType: eNetType,
        };
        checks = checkElevatorStation(input);
        break;
      }
    }

    const rpt = generateCAESBReport(networkType, checks);
    setReport(rpt);
    setChecklist(getCAESBSubmissionChecklist(networkType));
    setChecklistStatus({});
    toast.success(`Verificação concluída: ${rpt.totalChecks} itens verificados`);
  };

  const networkTypeLabel: Record<NetworkType, string> = {
    agua: "Rede de Água",
    esgoto: "Rede de Esgoto",
    drenagem: "Drenagem Pluvial",
    adutora: "Adutora / Transientes",
    elevatoria: "Elevatória",
  };

  const networkTypeIcon: Record<NetworkType, React.ReactNode> = {
    agua: <Droplets className="w-4 h-4" />,
    esgoto: <Waves className="w-4 h-4" />,
    drenagem: <Waves className="w-4 h-4" />,
    adutora: <Activity className="w-4 h-4" />,
    elevatoria: <Building2 className="w-4 h-4" />,
  };

  // ── Export report as text ──
  const exportReport = () => {
    if (!report) return;
    const lines: string[] = [
      "═══════════════════════════════════════════════════════",
      "RELATÓRIO DE CONFORMIDADE CAESB/SABESP",
      `Tipo: ${networkTypeLabel[report.networkType]}`,
      `Data: ${new Date(report.generatedAt).toLocaleString("pt-BR")}`,
      `Status: ${report.overallStatus.toUpperCase()}`,
      "═══════════════════════════════════════════════════════",
      "",
      `Total de verificações: ${report.totalChecks}`,
      `Aprovados: ${report.passed}`,
      `Atenção: ${report.warnings}`,
      `Críticos: ${report.critical}`,
      "",
      "─── DETALHAMENTO ───",
      "",
    ];

    report.checks.forEach(c => {
      lines.push(`[${c.severity.toUpperCase()}] ${c.category}`);
      lines.push(`  ${c.description}`);
      lines.push(`  Norma: ${c.normReference}`);
      if (c.value) lines.push(`  Valor: ${c.value}`);
      if (c.limit) lines.push(`  Limite: ${c.limit}`);
      if (c.recommendation) lines.push(`  Recomendação: ${c.recommendation}`);
      lines.push("");
    });

    if (checklist.length > 0) {
      lines.push("─── CHECKLIST DE DOCUMENTOS ───");
      lines.push("");
      checklist.forEach(doc => {
        const status = checklistStatus[doc.id] ? "[X]" : "[ ]";
        lines.push(`${status} ${doc.document} ${doc.required ? "(OBRIGATÓRIO)" : "(opcional)"}`);
        lines.push(`    ${doc.description}`);
        lines.push(`    Ref: ${doc.normReference}`);
        lines.push("");
      });
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-caesb-${report.networkType}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado com sucesso");
  };

  // ── Checklist progress ──
  const checklistProgress = useMemo(() => {
    if (checklist.length === 0) return 0;
    const checked = Object.values(checklistStatus).filter(Boolean).length;
    return Math.round((checked / checklist.length) * 100);
  }, [checklist, checklistStatus]);

  // ══════════════════════════════════════
  // Render
  // ══════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Aprovações de Projetos — Conformidade Normativa
          </CardTitle>
          <CardDescription>
            Verificação automática de conformidade com normas técnicas CAESB, SABESP, ABNT e TCU.
            NTS 181-183 | NBR 9649 | NBR 12214 | NBR 12215 | NBR 12218 | Acórdão TCU 2622/2013
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="check" className="w-full">
        <TabsList className="w-full grid grid-cols-3 text-[10px] sm:text-sm">
          <TabsTrigger value="check" className="px-1 sm:px-3">Verificação</TabsTrigger>
          <TabsTrigger value="report" disabled={!report} className="px-1 sm:px-3">Relatório</TabsTrigger>
          <TabsTrigger value="checklist" disabled={checklist.length === 0} className="px-1 sm:px-3">Checklist</TabsTrigger>
        </TabsList>

        {/* ─── Tab: Verificação ─── */}
        <TabsContent value="check" className="space-y-4">
          {/* Network Type Selector */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Rede / Sistema</Label>
                  <Select value={networkType} onValueChange={(v) => setNetworkType(v as NetworkType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agua">
                        <span className="flex items-center gap-2"><Droplets className="w-4 h-4" /> Rede de Água</span>
                      </SelectItem>
                      <SelectItem value="esgoto">
                        <span className="flex items-center gap-2"><Waves className="w-4 h-4" /> Rede de Esgoto</span>
                      </SelectItem>
                      <SelectItem value="adutora">
                        <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> Adutora / Transientes</span>
                      </SelectItem>
                      <SelectItem value="elevatoria">
                        <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Elevatória</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Water Form ── */}
          {networkType === "agua" && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Droplets className="w-4 h-4" /> Dados da Rede de Água</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs">Diâmetros DN (mm) — separados por vírgula</Label>
                  <Input value={wDiameters} onChange={e => setWDiameters(e.target.value)} placeholder="100, 150, 200" />
                </div>
                <div>
                  <Label className="text-xs">Velocidades (m/s)</Label>
                  <Input value={wVelocities} onChange={e => setWVelocities(e.target.value)} placeholder="0.8, 1.2, 1.5" />
                </div>
                <div>
                  <Label className="text-xs">Pressões Mínimas (mca)</Label>
                  <Input value={wPressuresMin} onChange={e => setWPressuresMin(e.target.value)} placeholder="12, 15, 10" />
                </div>
                <div>
                  <Label className="text-xs">Pressões Máximas (mca)</Label>
                  <Input value={wPressuresMax} onChange={e => setWPressuresMax(e.target.value)} placeholder="45, 38, 42" />
                </div>
                <div>
                  <Label className="text-xs">Profundidade de Recobrimento (m)</Label>
                  <Input value={wCoverDepth} onChange={e => setWCoverDepth(e.target.value)} placeholder="0.8, 0.9, 0.7" />
                </div>
                <div>
                  <Label className="text-xs">Comprimento total (m)</Label>
                  <Input type="number" value={wPipeLength} onChange={e => setWPipeLength(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Material</Label>
                  <Select value={wPipeMaterial} onValueChange={setWPipeMaterial}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PVC">PVC</SelectItem>
                      <SelectItem value="PEAD">PEAD</SelectItem>
                      <SelectItem value="FoFo">Ferro Fundido</SelectItem>
                      <SelectItem value="Aço">Aço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Vazão (L/s)</Label>
                  <Input type="number" value={wFlowRate} onChange={e => setWFlowRate(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Demanda Per Capita (L/hab.dia)</Label>
                  <Input type="number" value={wDemandDay} onChange={e => setWDemandDay(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">População</Label>
                  <Input type="number" value={wPopulation} onChange={e => setWPopulation(+e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={wHasCheckValve} onCheckedChange={setWHasCheckValve} />
                  <Label className="text-xs">Válvula de Retenção</Label>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={wHasPressureReducer} onCheckedChange={setWHasPressureReducer} />
                  <Label className="text-xs">VRP (Redutora de Pressão)</Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Sewer Form ── */}
          {networkType === "esgoto" && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Waves className="w-4 h-4" /> Dados da Rede de Esgoto</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs">Diâmetros DN (mm)</Label>
                  <Input value={sDiameters} onChange={e => setSDiameters(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Velocidades (m/s)</Label>
                  <Input value={sVelocities} onChange={e => setSVelocities(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Declividades (m/m)</Label>
                  <Input value={sSlopes} onChange={e => setSSlopes(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Profundidade PV Montante (m)</Label>
                  <Input value={sDepthsUp} onChange={e => setSDepthsUp(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Profundidade PV Jusante (m)</Label>
                  <Input value={sDepthsDown} onChange={e => setSDepthsDown(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Tensão Trativa (Pa)</Label>
                  <Input value={sTractiveStress} onChange={e => setSTractiveStress(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Lâmina d'Água (Y/D)</Label>
                  <Input value={sWaterLevel} onChange={e => setSWaterLevel(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Espaçamento PVs (m)</Label>
                  <Input value={sManholeSpacing} onChange={e => setSManholeSpacing(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Material</Label>
                  <Select value={sPipeMaterial} onValueChange={setSPipeMaterial}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PVC">PVC</SelectItem>
                      <SelectItem value="PEAD">PEAD</SelectItem>
                      <SelectItem value="Concreto">Concreto</SelectItem>
                      <SelectItem value="FoFo">Ferro Fundido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Transient / Adutora Form ── */}
          {networkType === "adutora" && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> Dados da Adutora / Transientes</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs">Diâmetro DN (mm)</Label>
                  <Input type="number" value={tDiameter} onChange={e => setTDiameter(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Comprimento (m)</Label>
                  <Input type="number" value={tLength} onChange={e => setTLength(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Celeridade da Onda (m/s)</Label>
                  <Input type="number" value={tWaveSpeed} onChange={e => setTWaveSpeed(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Velocidade Regime (m/s)</Label>
                  <Input type="number" value={tVelocity} onChange={e => setTVelocity(+e.target.value)} step="0.1" />
                </div>
                <div>
                  <Label className="text-xs">Pressão Estática (mca)</Label>
                  <Input type="number" value={tSteadyPressure} onChange={e => setTSteadyPressure(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Tempo de Fechamento (s)</Label>
                  <Input type="number" value={tClosureTime} onChange={e => setTClosureTime(+e.target.value)} step="0.5" />
                </div>
                <div>
                  <Label className="text-xs">Pressão Máxima Transiente (mca)</Label>
                  <Input type="number" value={tMaxPressure} onChange={e => setTMaxPressure(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Pressão Mínima Transiente (mca)</Label>
                  <Input type="number" value={tMinPressure} onChange={e => setTMinPressure(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Classe de Pressão (PN)</Label>
                  <Input type="number" value={tPressureClass} onChange={e => setTPressureClass(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Material</Label>
                  <Select value={tPipeMaterial} onValueChange={setTPipeMaterial}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FoFo">Ferro Fundido</SelectItem>
                      <SelectItem value="Aço">Aço</SelectItem>
                      <SelectItem value="PVC">PVC</SelectItem>
                      <SelectItem value="PEAD">PEAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={tHasMOC} onCheckedChange={setTHasMOC} />
                  <Label className="text-xs">Simulação MOC realizada</Label>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={tHasProtection} onCheckedChange={setTHasProtection} />
                  <Label className="text-xs">Dispositivos de proteção</Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Elevator Station Form ── */}
          {networkType === "elevatoria" && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> Dados da Elevatória</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs">Tipo de Rede</Label>
                  <Select value={eNetType} onValueChange={(v) => setENetType(v as "agua" | "esgoto")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agua">Água</SelectItem>
                      <SelectItem value="esgoto">Esgoto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Vazão (L/s)</Label>
                  <Input type="number" value={eFlowRate} onChange={e => setEFlowRate(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">TDH - Altura Manométrica (m)</Label>
                  <Input type="number" value={eTdh} onChange={e => setETdh(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Potência (CV)</Label>
                  <Input type="number" value={ePower} onChange={e => setEPower(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Rendimento (%)</Label>
                  <Input type="number" value={eEfficiency} onChange={e => setEEfficiency(+e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">NPSH Disponível (m)</Label>
                  <Input type="number" value={eNpshA} onChange={e => setENpshA(+e.target.value)} step="0.1" />
                </div>
                <div>
                  <Label className="text-xs">NPSH Requerido (m)</Label>
                  <Input type="number" value={eNpshR} onChange={e => setENpshR(+e.target.value)} step="0.1" />
                </div>
                <div>
                  <Label className="text-xs">Nº Bombas Operação</Label>
                  <Input type="number" value={eNumPumps} onChange={e => setENumPumps(+e.target.value)} min={1} />
                </div>
                <div>
                  <Label className="text-xs">Nº Bombas Reserva</Label>
                  <Input type="number" value={eNumReserve} onChange={e => setENumReserve(+e.target.value)} min={0} />
                </div>
                <div>
                  <Label className="text-xs">Vel. Sucção (m/s)</Label>
                  <Input type="number" value={eSuctionV} onChange={e => setESuctionV(+e.target.value)} step="0.1" />
                </div>
                <div>
                  <Label className="text-xs">Vel. Recalque (m/s)</Label>
                  <Input type="number" value={eDischargeV} onChange={e => setEDischargeV(+e.target.value)} step="0.1" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Run button */}
          <Button onClick={runCheck} className="w-full" size="lg">
            <Shield className="w-4 h-4 mr-2" />
            Executar Verificação CAESB / SABESP
          </Button>
        </TabsContent>

        {/* ─── Tab: Relatório ─── */}
        <TabsContent value="report" className="space-y-4">
          {report && (
            <>
              {/* Summary */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        {networkTypeIcon[report.networkType]}
                        {networkTypeLabel[report.networkType]}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(report.generatedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <OverallStatusBadge status={report.overallStatus} />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="text-center p-3 rounded bg-muted">
                      <p className="text-2xl font-bold">{report.totalChecks}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center p-3 rounded bg-green-50 dark:bg-green-900/20">
                      <p className="text-2xl font-bold text-green-600">{report.passed}</p>
                      <p className="text-xs text-muted-foreground">Aprovados</p>
                    </div>
                    <div className="text-center p-3 rounded bg-yellow-50 dark:bg-yellow-900/20">
                      <p className="text-2xl font-bold text-yellow-600">{report.warnings}</p>
                      <p className="text-xs text-muted-foreground">Atenção</p>
                    </div>
                    <div className="text-center p-3 rounded bg-red-50 dark:bg-red-900/20">
                      <p className="text-2xl font-bold text-red-600">{report.critical}</p>
                      <p className="text-xs text-muted-foreground">Críticos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detail table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm sm:text-base">Detalhamento das Verificações</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto -mx-6 px-6">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Status</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Norma</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Limite</TableHead>
                        <TableHead>Recomendação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.checks.map(c => (
                        <TableRow key={c.id}>
                          <TableCell><SeverityBadge severity={c.severity} /></TableCell>
                          <TableCell className="font-medium text-xs">{c.category}</TableCell>
                          <TableCell className="text-xs max-w-[200px]">{c.description}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.normReference}</TableCell>
                          <TableCell className="text-xs font-mono">{c.value || "-"}</TableCell>
                          <TableCell className="text-xs font-mono">{c.limit || "-"}</TableCell>
                          <TableCell className="text-xs max-w-[200px]">{c.recommendation || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Export */}
              <Button onClick={exportReport} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar Relatório
              </Button>
            </>
          )}
        </TabsContent>

        {/* ─── Tab: Checklist Documental ─── */}
        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Checklist de Documentos para Submissão CAESB
              </CardTitle>
              <CardDescription>
                Marque os documentos já preparados. Progresso: {checklistProgress}%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-muted rounded-full h-2 mb-4">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">OK</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Obrigatório</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklist.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Switch
                          checked={!!checklistStatus[doc.id]}
                          onCheckedChange={(v) =>
                            setChecklistStatus(prev => ({ ...prev, [doc.id]: v }))
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{doc.document}</TableCell>
                      <TableCell>
                        {doc.required
                          ? <Badge className="bg-red-600 text-white text-xs">Obrigatório</Badge>
                          : <Badge variant="outline" className="text-xs">Opcional</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{doc.normReference}</TableCell>
                      <TableCell className="text-xs">{doc.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CAESBModule;
