/**
 * QEsg/QWater Panel — Reusable dimensioning panel.
 * Used inline in TopografiaModule AND as standalone via QEsgWaterModule.
 */

import { useState, useMemo, useCallback } from "react";
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
  Calculator, Droplets, Waves, CheckCircle, XCircle,
  Zap, Download, AlertTriangle,
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import {
  dimensionSewerNetwork,
  type SewerSegmentInput,
  type SewerSegmentResult,
} from "@/engine/qesgEngine";
import {
  dimensionWaterNetwork,
  type WaterSegmentInput,
  type WaterSegmentResult,
} from "@/engine/qwaterEngine";

interface QEsgWaterPanelProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange?: (t: Trecho[]) => void;
}

export const QEsgWaterPanel = ({ pontos, trechos, onTrechosChange }: QEsgWaterPanelProps) => {
  const [activeTab, setActiveTab] = useState<"qesg" | "qwater">("qesg");

  const [sewerResults, setSewerResults] = useState<SewerSegmentResult[]>([]);
  const [sewerResumo, setSewerResumo] = useState<{ total: number; atendem: number } | null>(null);
  const [manning, setManning] = useState(0.013);
  const [laminaMax, setLaminaMax] = useState(0.75);
  const [velMinEsg, setVelMinEsg] = useState(0.6);
  const [velMaxEsg, setVelMaxEsg] = useState(5.0);
  const [tensaoMin, setTensaoMin] = useState(1.0);
  const [diamMinEsg, setDiamMinEsg] = useState(150);

  const [waterResults, setWaterResults] = useState<WaterSegmentResult[]>([]);
  const [waterResumo, setWaterResumo] = useState<{ total: number; atendem: number } | null>(null);
  const [formula, setFormula] = useState<"hazen-williams" | "colebrook">("hazen-williams");
  const [coefHW, setCoefHW] = useState(140);
  const [velMinAgua, setVelMinAgua] = useState(0.6);
  const [velMaxAgua, setVelMaxAgua] = useState(3.5);
  const [pressaoMin, setPressaoMin] = useState(10.0);
  const [pressaoMax, setPressaoMax] = useState(50.0);
  const [diamMinAgua, setDiamMinAgua] = useState(50);

  const sewerTrechos = useMemo(() =>
    trechos.filter(t => t.tipoRede === "esgoto" || t.tipoRede === "outro"), [trechos]);
  const waterTrechos = useMemo(() =>
    trechos.filter(t => t.tipoRede === "agua" || t.tipoRede === "outro"), [trechos]);

  const dimensionSewer = useCallback(() => {
    if (sewerTrechos.length === 0) { toast.error("Nenhum trecho de esgoto encontrado."); return; }
    const inputs: SewerSegmentInput[] = sewerTrechos.map(t => {
      const p0 = pontos.find(p => p.id === t.idInicio);
      const p1 = pontos.find(p => p.id === t.idFim);
      return { id: `${t.idInicio}-${t.idFim}`, comprimento: t.comprimento,
        cotaMontante: p0?.cota ?? 0, cotaJusante: p1?.cota ?? 0, vazaoLps: 1.5, tipoTubo: t.material || "PVC" };
    });
    const { resultados, resumo } = dimensionSewerNetwork(inputs, {
      manning, laminaMax, velMin: velMinEsg, velMax: velMaxEsg, tensaoMin, diamMinMm: diamMinEsg });
    setSewerResults(resultados);
    setSewerResumo({ total: resumo.total, atendem: resumo.atendem });
    toast.success(`QEsg: ${resumo.atendem}/${resumo.total} trechos atendem NBR 9649`);
  }, [sewerTrechos, pontos, manning, laminaMax, velMinEsg, velMaxEsg, tensaoMin, diamMinEsg]);

  const dimensionWater = useCallback(() => {
    if (waterTrechos.length === 0) { toast.error("Nenhum trecho de água encontrado."); return; }
    const inputs: WaterSegmentInput[] = waterTrechos.map(t => {
      const p0 = pontos.find(p => p.id === t.idInicio);
      const p1 = pontos.find(p => p.id === t.idFim);
      return { id: `${t.idInicio}-${t.idFim}`, comprimento: t.comprimento,
        cotaMontante: p0?.cota ?? 0, cotaJusante: p1?.cota ?? 0, vazaoLps: 0.5, material: t.material || "PVC" };
    });
    const { resultados, resumo } = dimensionWaterNetwork(inputs, {
      formula, coefHW, velMin: velMinAgua, velMax: velMaxAgua, pressaoMin, pressaoMax, diamMinMm: diamMinAgua });
    setWaterResults(resultados);
    setWaterResumo({ total: resumo.total, atendem: resumo.atendem });
    toast.success(`QWater: ${resumo.atendem}/${resumo.total} trechos atendem NBR 12218`);
  }, [waterTrechos, pontos, formula, coefHW, velMinAgua, velMaxAgua, pressaoMin, pressaoMax, diamMinAgua]);

  const applyDiameters = (type: "sewer" | "water") => {
    const results = type === "sewer" ? sewerResults : waterResults;
    if (results.length === 0 || !onTrechosChange) return;
    const m = new Map(results.map(r => [r.id, r.diametroMm]));
    onTrechosChange(trechos.map(t => { const d = m.get(`${t.idInicio}-${t.idFim}`); return d ? { ...t, diametroMm: d } : t; }));
    toast.success(`Diâmetros de ${type === "sewer" ? "esgoto" : "água"} aplicados`);
  };

  const exportCSV = (type: "sewer" | "water") => {
    const results = type === "sewer" ? sewerResults : waterResults;
    if (results.length === 0) return;
    let csv: string;
    if (type === "sewer") {
      csv = "Trecho;DN (mm);DN Calc (mm);V (m/s);V Crit (m/s);y/D;Tensao (Pa);Decliv Min;Decliv Usada;Status;Obs\n";
      for (const r of sewerResults) csv += `${r.id};${r.diametroMm};${r.diametroCalculadoMm};${r.velocidadeMs};${r.velocidadeCriticaMs};${r.laminaDagua};${r.tensaoTrativa};${r.declividadeMin};${r.declividadeUsada};${r.atendeNorma ? "OK" : "NAO"};${r.observacoes.join(" | ")}\n`;
    } else {
      csv = "Trecho;DN (mm);V (m/s);hf (m);J (m/m);P jus (mca);Status;Obs\n";
      for (const r of waterResults) csv += `${r.id};${r.diametroMm};${r.velocidadeMs};${r.perdaCargaM};${r.perdaCargaUnitaria};${r.pressaoJusante ?? "-"};${r.atendeNorma ? "OK" : "NAO"};${r.observacoes.join(" | ")}\n`;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `dimensionamento_${type === "sewer" ? "esgoto" : "agua"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "qesg" | "qwater")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="qesg" className="flex items-center gap-1">
          <Waves className="h-4 w-4" /> QEsg — Esgoto
        </TabsTrigger>
        <TabsTrigger value="qwater" className="flex items-center gap-1">
          <Droplets className="h-4 w-4" /> QWater — Água
        </TabsTrigger>
      </TabsList>

      {/* QEsg */}
      <TabsContent value="qesg">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Waves className="h-5 w-5 text-amber-600" /> Rede de Esgoto (NBR 9649)
            </CardTitle>
            <CardDescription className="text-xs">
              τ = 10000·Rh·I | v_c = 6·√(g·Rh) | I_min = 0.0055·Q^(-0.47)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <div><Label className="text-xs">Manning (n)</Label><Input type="number" step="0.001" value={manning} onChange={e => setManning(Number(e.target.value))} /></div>
              <div><Label className="text-xs">y/D máx</Label><Input type="number" step="0.05" value={laminaMax} onChange={e => setLaminaMax(Number(e.target.value))} /></div>
              <div><Label className="text-xs">V mín (m/s)</Label><Input type="number" step="0.1" value={velMinEsg} onChange={e => setVelMinEsg(Number(e.target.value))} /></div>
              <div><Label className="text-xs">V máx (m/s)</Label><Input type="number" step="0.1" value={velMaxEsg} onChange={e => setVelMaxEsg(Number(e.target.value))} /></div>
              <div><Label className="text-xs">Tensão mín (Pa)</Label><Input type="number" step="0.1" value={tensaoMin} onChange={e => setTensaoMin(Number(e.target.value))} /></div>
              <div><Label className="text-xs">DN mín (mm)</Label><Input type="number" step="50" value={diamMinEsg} onChange={e => setDiamMinEsg(Number(e.target.value))} /></div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={dimensionSewer} disabled={sewerTrechos.length === 0}>
                <Calculator className="h-4 w-4 mr-1" /> Dimensionar ({sewerTrechos.length} trechos)
              </Button>
              {sewerResults.length > 0 && (<>
                <Button variant="outline" onClick={() => applyDiameters("sewer")}><Zap className="h-4 w-4 mr-1" /> Aplicar</Button>
                <Button variant="outline" onClick={() => exportCSV("sewer")}><Download className="h-4 w-4 mr-1" /> CSV</Button>
              </>)}
            </div>
            {sewerResumo && (<div className="flex gap-3 text-sm">
              <Badge variant="outline">{sewerResumo.total} trechos</Badge>
              <Badge className="bg-green-500">{sewerResumo.atendem} OK</Badge>
              {sewerResumo.total - sewerResumo.atendem > 0 && <Badge variant="destructive">{sewerResumo.total - sewerResumo.atendem} falha</Badge>}
            </div>)}
            {sewerResults.length > 0 && (
              <div className="border rounded-lg overflow-auto max-h-80">
                <Table><TableHeader><TableRow>
                  <TableHead>Trecho</TableHead><TableHead>DN</TableHead><TableHead>V (m/s)</TableHead>
                  <TableHead>y/D</TableHead><TableHead>τ (Pa)</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader><TableBody>
                  {sewerResults.map(r => (
                    <TableRow key={r.id} className={!r.atendeNorma ? "bg-red-50 dark:bg-red-950/20" : ""}>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell className="font-semibold">{r.diametroMm}</TableCell>
                      <TableCell>{r.velocidadeMs.toFixed(2)}</TableCell>
                      <TableCell>{r.laminaDagua.toFixed(3)}</TableCell>
                      <TableCell>{r.tensaoTrativa.toFixed(2)}</TableCell>
                      <TableCell>{r.atendeNorma ? <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge> : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falha</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              </div>
            )}
            {sewerTrechos.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" /> Nenhum trecho de esgoto. Importe uma rede primeiro.
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* QWater */}
      <TabsContent value="qwater">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-600" /> Rede de Água (NBR 12218)
            </CardTitle>
            <CardDescription className="text-xs">
              Hazen-Williams: hf = 10.643·Q^1.85 / (C^1.85·D^4.87)·L
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <div><Label className="text-xs">Fórmula</Label>
                <Select value={formula} onValueChange={v => setFormula(v as any)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="hazen-williams">Hazen-Williams</SelectItem><SelectItem value="colebrook">Colebrook-White</SelectItem></SelectContent>
                </Select></div>
              <div><Label className="text-xs">C (H-W)</Label><Input type="number" step="5" value={coefHW} onChange={e => setCoefHW(Number(e.target.value))} /></div>
              <div><Label className="text-xs">V mín (m/s)</Label><Input type="number" step="0.1" value={velMinAgua} onChange={e => setVelMinAgua(Number(e.target.value))} /></div>
              <div><Label className="text-xs">V máx (m/s)</Label><Input type="number" step="0.1" value={velMaxAgua} onChange={e => setVelMaxAgua(Number(e.target.value))} /></div>
              <div><Label className="text-xs">P mín (mca)</Label><Input type="number" step="1" value={pressaoMin} onChange={e => setPressaoMin(Number(e.target.value))} /></div>
              <div><Label className="text-xs">DN mín (mm)</Label><Input type="number" step="25" value={diamMinAgua} onChange={e => setDiamMinAgua(Number(e.target.value))} /></div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={dimensionWater} disabled={waterTrechos.length === 0}>
                <Calculator className="h-4 w-4 mr-1" /> Dimensionar ({waterTrechos.length} trechos)
              </Button>
              {waterResults.length > 0 && (<>
                <Button variant="outline" onClick={() => applyDiameters("water")}><Zap className="h-4 w-4 mr-1" /> Aplicar</Button>
                <Button variant="outline" onClick={() => exportCSV("water")}><Download className="h-4 w-4 mr-1" /> CSV</Button>
              </>)}
            </div>
            {waterResumo && (<div className="flex gap-3 text-sm">
              <Badge variant="outline">{waterResumo.total} trechos</Badge>
              <Badge className="bg-green-500">{waterResumo.atendem} OK</Badge>
              {waterResumo.total - waterResumo.atendem > 0 && <Badge variant="destructive">{waterResumo.total - waterResumo.atendem} falha</Badge>}
            </div>)}
            {waterResults.length > 0 && (
              <div className="border rounded-lg overflow-auto max-h-80">
                <Table><TableHeader><TableRow>
                  <TableHead>Trecho</TableHead><TableHead>DN</TableHead><TableHead>V (m/s)</TableHead>
                  <TableHead>hf (m)</TableHead><TableHead>P jus (mca)</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader><TableBody>
                  {waterResults.map(r => (
                    <TableRow key={r.id} className={!r.atendeNorma ? "bg-red-50 dark:bg-red-950/20" : ""}>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell className="font-semibold">{r.diametroMm}</TableCell>
                      <TableCell>{r.velocidadeMs.toFixed(2)}</TableCell>
                      <TableCell>{r.perdaCargaM.toFixed(3)}</TableCell>
                      <TableCell>{r.pressaoJusante?.toFixed(1) ?? "-"}</TableCell>
                      <TableCell>{r.atendeNorma ? <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge> : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falha</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              </div>
            )}
            {waterTrechos.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" /> Nenhum trecho de água. Importe uma rede primeiro.
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
