import { useState, useCallback, useEffect, useMemo } from "react";
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
  AlertTriangle, Zap, Upload, Settings, Users,
  Map, TableProperties, Activity,
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import {
  dimensionSewerNetwork,
  accumulateSewerFlow,
  calcPopulationFlow,
  type SewerSegmentInput,
  type SewerSegmentResult,
  type SewerNodeInput,
} from "@/engine/qesgEngine";
import { NetworkMapView } from "@/components/hydronetwork/modules/NetworkMapView";
import { GisMapTab } from "@/components/hydronetwork/modules/GisMapTab";
import { ElementTypeAssigner, ElementAssignment } from "@/components/hydronetwork/modules/ElementTypeAssigner";
import { AttributeTableEditor, SewerNodeAttributes, SewerEdgeAttributes } from "@/components/hydronetwork/modules/AttributeTableEditor";
import { LongitudinalProfile } from "@/components/hydronetwork/modules/LongitudinalProfile";
import { SEWER_DEFAULTS, DEMO_UTM_ORIGIN } from "@/config/defaults";

// ══════════════════════════════════════
// Interfaces
// ══════════════════════════════════════

interface SewerModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onPontosChange?: (p: PontoTopografico[]) => void;
  onTrechosChange: (t: Trecho[]) => void;
}

// ── Map formatters ──
const formatSewerTooltip = (segId: string, r: SewerSegmentResult) =>
  `${segId} | DN${r.diametroMm} | V=${r.velocidadeMs.toFixed(2)} m/s | τ=${r.tensaoTrativa.toFixed(2)} Pa`;

const formatSewerPopup = (segId: string, r: SewerSegmentResult) => `
  <div style="font-size:12px;line-height:1.6">
    <strong>${segId}</strong><br/>
    <b>DN:</b> ${r.diametroMm} mm<br/>
    <b>V:</b> ${r.velocidadeMs.toFixed(3)} m/s<br/>
    <b>V crit:</b> ${r.velocidadeCriticaMs.toFixed(3)} m/s<br/>
    <b>y/D:</b> ${r.laminaDagua.toFixed(3)}<br/>
    <b>τ:</b> ${r.tensaoTrativa.toFixed(2)} Pa<br/>
    <b>Decliv.:</b> ${(r.declividadeUsada * 100).toFixed(3)}%<br/>
    <b>Status:</b> ${r.atendeNorma ? "OK" : "FALHA"}<br/>
    ${r.observacoes.length > 0 ? `<b>Obs:</b> ${r.observacoes.join("; ")}` : ""}
  </div>`;

// ══════════════════════════════════════
// Main Component — 5 GIS Tabs
// ══════════════════════════════════════

export const SewerModule = ({ pontos, trechos, onPontosChange, onTrechosChange }: SewerModuleProps) => {
  // ── GIS data ──
  const [gisPontos, setGisPontos] = useState<PontoTopografico[]>(pontos);
  const [gisTrechos, setGisTrechos] = useState<Trecho[]>(trechos);
  const [assignments, setAssignments] = useState<ElementAssignment>({
    nodeTypes: new Map(), edgeTypes: new Map(),
  });
  const [sewerNodeAttrs, setSewerNodeAttrs] = useState<SewerNodeAttributes[]>([]);
  const [sewerEdgeAttrs, setSewerEdgeAttrs] = useState<SewerEdgeAttributes[]>([]);

  // Sync external data into GIS state on first load
  useEffect(() => {
    if (pontos.length > 0 && gisPontos.length === 0) setGisPontos(pontos);
  }, [pontos.length]);
  useEffect(() => {
    if (trechos.length > 0 && gisTrechos.length === 0) setGisTrechos(trechos);
  }, [trechos.length]);

  const handleGisPontosChange = (p: PontoTopografico[]) => {
    setGisPontos(p);
    onPontosChange?.(p);
  };
  const handleGisTrechosChange = (t: Trecho[]) => {
    setGisTrechos(t);
    onTrechosChange(t);
  };

  // ── Hydraulic parameters ──
  const [manning, setManning] = useState(SEWER_DEFAULTS.manning.PVC);
  const [laminaMax, setLaminaMax] = useState(SEWER_DEFAULTS.laminaMax);
  const [velMinEsg, setVelMinEsg] = useState(SEWER_DEFAULTS.velMin);
  const [velMaxEsg, setVelMaxEsg] = useState(SEWER_DEFAULTS.velMax);
  const [tensaoMin, setTensaoMin] = useState(SEWER_DEFAULTS.tensaoMin);
  const [diamMinEsg, setDiamMinEsg] = useState(SEWER_DEFAULTS.diamMinMm);
  const [material, setMaterial] = useState(SEWER_DEFAULTS.defaultMaterial);

  // Flow parameters
  const [metodoVazao, setMetodoVazao] = useState<"fixa" | "percapita">("fixa");
  const [vazaoEsg, setVazaoEsg] = useState(SEWER_DEFAULTS.defaultVazaoLps);
  const [qpcLitrosDia, setQpcLitrosDia] = useState(SEWER_DEFAULTS.defaultQpcLitrosDia);
  const [k1, setK1] = useState(SEWER_DEFAULTS.defaultK1);
  const [k2, setK2] = useState(SEWER_DEFAULTS.defaultK2);

  // ── QEsg Results ──
  const [sewerResults, setSewerResults] = useState<SewerSegmentResult[]>([]);
  const [sewerResumo, setSewerResumo] = useState<{ total: number; atendem: number } | null>(null);

  // ── Derived ──
  const activePontos = gisPontos.length > 0 ? gisPontos : pontos;
  const activeTrechos = gisTrechos.length > 0 ? gisTrechos : trechos;
  const sewerTrechos = useMemo(() =>
    activeTrechos.filter(t => {
      const tipo = t.tipoRedeManual || "esgoto";
      return tipo === "esgoto" || tipo === "outro";
    }), [activeTrechos]);

  const handleMaterialChange = (mat: string) => {
    setMaterial(mat);
    const n = SEWER_DEFAULTS.manning[mat];
    if (n) setManning(n);
  };

  // ── Transfer / Demo ──
  const transferFromTopography = () => {
    if (pontos.length === 0) { toast.error("Nenhum ponto na topografia"); return; }
    setGisPontos(pontos);
    setGisTrechos(trechos);
    toast.success(`${pontos.length} pontos transferidos da topografia`);
  };

  const loadDemo = () => {
    const { x: X0, y: Y0 } = DEMO_UTM_ORIGIN;
    const demoPontos: PontoTopografico[] = [
      { id: "PV1", x: X0,       y: Y0,       cota: 106.0 },
      { id: "PV2", x: X0 + 70,  y: Y0 + 30,  cota: 104.5 },
      { id: "PV3", x: X0 + 140, y: Y0 + 60,  cota: 103.0 },
      { id: "PV4", x: X0 + 180, y: Y0 + 75,  cota: 102.0 },
      { id: "PV5", x: X0 + 210, y: Y0 + 90,  cota: 101.5 },
    ];
    const demoTrechos: Trecho[] = [];
    for (let i = 0; i < demoPontos.length - 1; i++) {
      const p0 = demoPontos[i], p1 = demoPontos[i + 1];
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const comp = Math.sqrt(dx * dx + dy * dy);
      const decl = comp > 0 ? (p0.cota - p1.cota) / comp : 0;
      demoTrechos.push({
        idInicio: p0.id, idFim: p1.id, comprimento: Math.round(comp * 10) / 10,
        declividade: decl, tipoRede: "esgoto" as any, diametroMm: 150, material: "PVC",
        xInicio: p0.x, yInicio: p0.y, cotaInicio: p0.cota,
        xFim: p1.x, yFim: p1.y, cotaFim: p1.cota,
        tipoRedeManual: "esgoto",
      });
    }
    handleGisPontosChange(demoPontos);
    handleGisTrechosChange(demoTrechos);
    toast.success("Demo de esgoto carregado (5 PVs)");
  };

  // ── Dimensioning ──
  const dimensionSewer = useCallback(() => {
    let inputs: SewerSegmentInput[];

    if (sewerEdgeAttrs.length > 0) {
      // From GIS attribute table (priority)
      inputs = sewerEdgeAttrs.map(e => ({
        id: e.key,
        comprimento: e.comprimento,
        cotaMontante: e.cotaColetorM,
        cotaJusante: e.cotaColetorJ,
        vazaoLps: metodoVazao === "fixa" ? vazaoEsg : 0,
        tipoTubo: e.material,
      }));
    } else if (sewerTrechos.length > 0) {
      inputs = sewerTrechos.map(t => ({
        id: `${t.idInicio}-${t.idFim}`,
        comprimento: t.comprimento,
        cotaMontante: t.cotaInicio,
        cotaJusante: t.cotaFim,
        vazaoLps: vazaoEsg,
        tipoTubo: material,
      }));
    } else {
      toast.error("Importe dados no Mapa ou preencha a tabela de Rede.");
      return;
    }

    // Per-capita flow accumulation
    if (metodoVazao === "percapita") {
      const nodeFlows: SewerNodeInput[] = sewerNodeAttrs.length > 0
        ? sewerNodeAttrs.map(n => ({
            id: n.id,
            vazaoLocal: calcPopulationFlow(n.populacao, qpcLitrosDia, k1, k2) + n.vazaoConcentrada,
          }))
        : activePontos.map(p => ({
            id: p.id,
            vazaoLocal: calcPopulationFlow(SEWER_DEFAULTS.defaultPopulacao, qpcLitrosDia, k1, k2),
          }));
      if (nodeFlows.length > 0) inputs = accumulateSewerFlow(inputs, nodeFlows);
    }

    const { resultados, resumo } = dimensionSewerNetwork(inputs, {
      manning, laminaMax, velMin: velMinEsg, velMax: velMaxEsg, tensaoMin, diamMinMm: diamMinEsg,
    });
    setSewerResults(resultados);
    setSewerResumo({ total: resumo.total, atendem: resumo.atendem });
    toast.success(`QEsg: ${resumo.atendem}/${resumo.total} atendem NBR 9649`);
  }, [sewerEdgeAttrs, sewerNodeAttrs, sewerTrechos, activePontos, manning, laminaMax,
      velMinEsg, velMaxEsg, tensaoMin, diamMinEsg, vazaoEsg, material, metodoVazao,
      qpcLitrosDia, k1, k2]);

  const applyDiameters = useCallback(() => {
    if (sewerResults.length === 0) return;
    const m = new Map(sewerResults.map(r => [r.id, r.diametroMm]));
    handleGisTrechosChange(activeTrechos.map(t => {
      const d = m.get(`${t.idInicio}-${t.idFim}`);
      return d ? { ...t, diametroMm: d } : t;
    }));
    toast.success("Diâmetros aplicados");
  }, [sewerResults, activeTrechos]);

  const exportCSV = () => {
    if (sewerResults.length === 0) return;
    let csv = "Trecho;DN (mm);DN Calc (mm);V (m/s);V Crit (m/s);y/D;Tensao (Pa);Decliv Min;Decliv Usada;Status;Obs\n";
    for (const r of sewerResults) csv += `${r.id};${r.diametroMm};${r.diametroCalculadoMm};${r.velocidadeMs};${r.velocidadeCriticaMs};${r.laminaDagua};${r.tensaoTrativa};${r.declividadeMin};${r.declividadeUsada};${r.atendeNorma ? "OK" : "NAO"};${r.observacoes.join(" | ")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "dimensionamento_esgoto.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Profile data ──
  const profileNodes = useMemo((): SewerNodeAttributes[] => {
    if (sewerNodeAttrs.length > 0) return sewerNodeAttrs;
    return activePontos.map(p => ({
      id: p.id, tipo: "pv", cotaTerreno: p.cota, cotaFundo: p.cota - 1.5,
      profundidade: 1.5, x: p.x, y: p.y, populacao: 0, vazaoConcentrada: 0, observacao: "",
    }));
  }, [sewerNodeAttrs, activePontos]);

  const profileEdges = useMemo((): SewerEdgeAttributes[] => {
    if (sewerEdgeAttrs.length > 0) return sewerEdgeAttrs;
    return sewerTrechos.map((t, i) => ({
      key: `${t.idInicio}-${t.idFim}`, dcId: `C${String(i + 1).padStart(3, "0")}`,
      idInicio: t.idInicio, idFim: t.idFim, comprimento: t.comprimento,
      cotaTerrenoM: t.cotaInicio, cotaTerrenoJ: t.cotaFim,
      cotaColetorM: t.cotaInicio - 1.5, cotaColetorJ: t.cotaFim - 1.5,
      manning, diametro: t.diametroMm, declividade: t.declividade,
      material: t.material || "PVC", contribuicaoLateral: 0, pontaSeca: 0,
      etapa: "1", observacao: "",
    }));
  }, [sewerEdgeAttrs, sewerTrechos, manning]);

  // ── Stats ──
  const alertCount = sewerResults.filter(r => !r.atendeNorma).length;
  const compliance = sewerResumo
    ? Math.round((sewerResumo.atendem / Math.max(sewerResumo.total, 1)) * 100) : 0;
  const canDimension = sewerEdgeAttrs.length > 0 || sewerTrechos.length > 0;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="mapa">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="mapa"><Map className="h-3.5 w-3.5 mr-1" />Mapa</TabsTrigger>
          <TabsTrigger value="config"><Settings className="h-3.5 w-3.5 mr-1" />Configuração</TabsTrigger>
          <TabsTrigger value="rede"><TableProperties className="h-3.5 w-3.5 mr-1" />Rede</TabsTrigger>
          <TabsTrigger value="dimensionamento"><Calculator className="h-3.5 w-3.5 mr-1" />Dimensionamento</TabsTrigger>
          <TabsTrigger value="perfil"><Activity className="h-3.5 w-3.5 mr-1" />Perfil</TabsTrigger>
        </TabsList>

        {/* ═══════ TAB 1: MAPA ═══════ */}
        <TabsContent value="mapa" className="space-y-4">
          <GisMapTab
            networkType="esgoto"
            pontos={gisPontos}
            trechos={gisTrechos}
            onPontosChange={handleGisPontosChange}
            onTrechosChange={handleGisTrechosChange}
            accentColor="#ef4444"
          />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={transferFromTopography} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" /> Transferir da Topografia
            </Button>
            <Button onClick={loadDemo} variant="secondary" size="sm">Carregar Demo</Button>
          </div>
        </TabsContent>

        {/* ═══════ TAB 2: CONFIGURAÇÃO ═══════ */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-amber-600" /> Parâmetros Hidráulicos
                </CardTitle>
                <CardDescription>NBR 9649 / NBR 14486</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Material</Label>
                    <Select value={material} onValueChange={handleMaterialChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PVC">PVC (n=0.013)</SelectItem>
                        <SelectItem value="Concreto">Concreto (n=0.015)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Manning (n)</Label><Input type="number" step="0.001" value={manning} onChange={e => setManning(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">y/D máx</Label><Input type="number" step="0.05" value={laminaMax} onChange={e => setLaminaMax(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">DN mín (mm)</Label><Input type="number" step="50" value={diamMinEsg} onChange={e => setDiamMinEsg(Number(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">V mín (m/s)</Label><Input type="number" step="0.1" value={velMinEsg} onChange={e => setVelMinEsg(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">V máx (m/s)</Label><Input type="number" step="0.1" value={velMaxEsg} onChange={e => setVelMaxEsg(Number(e.target.value))} /></div>
                </div>
                <div>
                  <Label className="text-xs">Tensão trativa mín (Pa)</Label>
                  <Input type="number" step="0.1" value={tensaoMin} onChange={e => setTensaoMin(Number(e.target.value))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-600" /> Contribuição de Vazão
                </CardTitle>
                <CardDescription>Método de cálculo da vazão</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Método</Label>
                  <Select value={metodoVazao} onValueChange={v => setMetodoVazao(v as "fixa" | "percapita")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixa">Vazão fixa (L/s)</SelectItem>
                      <SelectItem value="percapita">Per capita (Pop × qpc)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {metodoVazao === "fixa" ? (
                  <div><Label className="text-xs">Vazão (L/s)</Label><Input type="number" step="0.1" value={vazaoEsg} onChange={e => setVazaoEsg(Number(e.target.value))} /></div>
                ) : (
                  <>
                    <div><Label className="text-xs">Quota per capita (L/hab/dia)</Label><Input type="number" step="10" value={qpcLitrosDia} onChange={e => setQpcLitrosDia(Number(e.target.value))} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">K1</Label><Input type="number" step="0.1" value={k1} onChange={e => setK1(Number(e.target.value))} /></div>
                      <div><Label className="text-xs">K2</Label><Input type="number" step="0.1" value={k2} onChange={e => setK2(Number(e.target.value))} /></div>
                    </div>
                    <div className="bg-muted/50 rounded p-2 text-xs text-center">
                      Q = Pop × {qpcLitrosDia} × {k1} × {k2} / 86400
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ TAB 3: REDE ═══════ */}
        <TabsContent value="rede" className="space-y-4">
          <ElementTypeAssigner
            networkType="esgoto"
            pontos={activePontos}
            trechos={sewerTrechos}
            assignments={assignments}
            onAssignmentsChange={setAssignments}
          />
          <AttributeTableEditor
            networkType="esgoto"
            pontos={activePontos}
            trechos={sewerTrechos}
            assignments={assignments}
            sewerNodes={sewerNodeAttrs}
            sewerEdges={sewerEdgeAttrs}
            onSewerNodesChange={setSewerNodeAttrs}
            onSewerEdgesChange={setSewerEdgeAttrs}
          />
        </TabsContent>

        {/* ═══════ TAB 4: DIMENSIONAMENTO ═══════ */}
        <TabsContent value="dimensionamento" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Waves className="h-5 w-5 text-amber-600" /> Dimensionamento QEsg (NBR 9649)
              </CardTitle>
              <CardDescription className="text-xs">
                τ = 10000·Rh·I | v_c = 6·√(g·Rh) | I_min = 0.0055·Q^(-0.47)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {sewerEdgeAttrs.length > 0 && (
                  <Badge variant="outline" className="text-amber-600">{sewerEdgeAttrs.length} trechos (atributos)</Badge>
                )}
                {sewerEdgeAttrs.length === 0 && sewerTrechos.length > 0 && (
                  <Badge variant="outline" className="text-amber-600">{sewerTrechos.length} trechos (GIS)</Badge>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={dimensionSewer} disabled={!canDimension}>
                  <Calculator className="h-4 w-4 mr-1" /> Dimensionar
                </Button>
                {sewerResults.length > 0 && (
                  <>
                    <Button variant="outline" onClick={applyDiameters}>
                      <Zap className="h-4 w-4 mr-1" /> Aplicar Diâmetros
                    </Button>
                    <Button variant="outline" onClick={exportCSV}>
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                  </>
                )}
              </div>

              {sewerResumo && (
                <div className="flex gap-3 text-sm">
                  <Badge variant="outline">{sewerResumo.total} trechos</Badge>
                  <Badge className="bg-green-500">{sewerResumo.atendem} OK</Badge>
                  {sewerResumo.total - sewerResumo.atendem > 0 && (
                    <Badge variant="destructive">{sewerResumo.total - sewerResumo.atendem} falha</Badge>
                  )}
                  <Badge variant="outline">{compliance}%</Badge>
                </div>
              )}

              {sewerResults.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trecho</TableHead>
                        <TableHead>DN (mm)</TableHead>
                        <TableHead>DN Calc</TableHead>
                        <TableHead>V (m/s)</TableHead>
                        <TableHead>V Crít</TableHead>
                        <TableHead>y/D</TableHead>
                        <TableHead>τ (Pa)</TableHead>
                        <TableHead>Decliv (%)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sewerResults.map(r => (
                        <TableRow key={r.id} className={!r.atendeNorma ? "bg-red-50 dark:bg-red-950/20" : ""}>
                          <TableCell className="font-mono text-xs">{r.id}</TableCell>
                          <TableCell className="font-semibold">{r.diametroMm}</TableCell>
                          <TableCell>{r.diametroCalculadoMm}</TableCell>
                          <TableCell>{r.velocidadeMs.toFixed(3)}</TableCell>
                          <TableCell>{r.velocidadeCriticaMs.toFixed(3)}</TableCell>
                          <TableCell>{r.laminaDagua.toFixed(3)}</TableCell>
                          <TableCell>{r.tensaoTrativa.toFixed(2)}</TableCell>
                          <TableCell>{(r.declividadeUsada * 100).toFixed(3)}</TableCell>
                          <TableCell>
                            {r.atendeNorma
                              ? <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                              : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falha</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {alertCount > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardContent className="py-3">
                    <div className="max-h-[150px] overflow-auto space-y-1">
                      {sewerResults.filter(r => !r.atendeNorma).map(r => (
                        <div key={r.id} className="text-xs text-yellow-700">
                          <strong>{r.id}:</strong> {r.observacoes.join("; ")}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {!canDimension && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" /> Importe dados no "Mapa" ou preencha a "Rede".
                </div>
              )}
            </CardContent>
          </Card>

          {sewerResults.length > 0 && activePontos.length > 0 && (
            <NetworkMapView<SewerSegmentResult>
              pontos={activePontos}
              trechos={sewerTrechos}
              results={sewerResults}
              okColor={SEWER_DEFAULTS.mapOkColor}
              failColor={SEWER_DEFAULTS.mapFailColor}
              markerColor={SEWER_DEFAULTS.markerColor}
              markerFillColor={SEWER_DEFAULTS.markerFillColor}
              title="Mapa — Rede Dimensionada"
              description="Verde = atende NBR 9649 | Vermelho = falha"
              iconColorClass="text-amber-600"
              formatTooltip={formatSewerTooltip}
              formatPopup={formatSewerPopup}
            />
          )}
        </TabsContent>

        {/* ═══════ TAB 5: PERFIL ═══════ */}
        <TabsContent value="perfil" className="space-y-4">
          <LongitudinalProfile
            sewerNodes={profileNodes}
            sewerEdges={profileEdges}
            results={sewerResults.length > 0 ? sewerResults : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
