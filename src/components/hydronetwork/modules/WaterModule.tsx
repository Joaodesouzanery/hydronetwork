import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calculator, Droplets, CheckCircle, XCircle, Download,
  AlertTriangle, Zap,
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import {
  dimensionWaterNetwork,
  type WaterSegmentInput,
  type WaterSegmentResult,
} from "@/engine/qwaterEngine";

interface WaterModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange: (t: Trecho[]) => void;
}

export const WaterModule = ({ pontos, trechos, onTrechosChange }: WaterModuleProps) => {
  const [waterResults, setWaterResults] = useState<WaterSegmentResult[]>([]);
  const [waterResumo, setWaterResumo] = useState<{ total: number; atendem: number } | null>(null);
  const [formula, setFormula] = useState<"hazen-williams" | "colebrook">("hazen-williams");
  const [coefHW, setCoefHW] = useState(140);
  const [velMinAgua, setVelMinAgua] = useState(0.6);
  const [velMaxAgua, setVelMaxAgua] = useState(3.5);
  const [pressaoMin, setPressaoMin] = useState(10.0);
  const [pressaoMax, setPressaoMax] = useState(50.0);
  const [diamMinAgua, setDiamMinAgua] = useState(50);

  const waterTrechos = useMemo(() =>
    trechos.filter(t => {
      const tipo = t.tipoRedeManual || "esgoto";
      return tipo === "agua" || tipo === "outro";
    }), [trechos]);

  const dimensionWater = useCallback(() => {
    if (waterTrechos.length === 0) { toast.error("Nenhum trecho de água encontrado."); return; }
    const inputs: WaterSegmentInput[] = waterTrechos.map(t => {
      const p0 = pontos.find(p => p.id === t.idInicio);
      const p1 = pontos.find(p => p.id === t.idFim);
      return {
        id: `${t.idInicio}-${t.idFim}`, comprimento: t.comprimento,
        cotaMontante: p0?.cota ?? 0, cotaJusante: p1?.cota ?? 0,
        vazaoLps: 0.5, material: t.material || "PVC",
      };
    });
    const { resultados, resumo } = dimensionWaterNetwork(inputs, {
      formula, coefHW, velMin: velMinAgua, velMax: velMaxAgua, pressaoMin, pressaoMax, diamMinMm: diamMinAgua,
    });
    setWaterResults(resultados);
    setWaterResumo({ total: resumo.total, atendem: resumo.atendem });
    toast.success(`QWater: ${resumo.atendem}/${resumo.total} trechos atendem NBR 12218`);
  }, [waterTrechos, pontos, formula, coefHW, velMinAgua, velMaxAgua, pressaoMin, pressaoMax, diamMinAgua]);

  const applyDiameters = useCallback(() => {
    if (waterResults.length === 0) return;
    const m = new Map(waterResults.map(r => [r.id, r.diametroMm]));
    onTrechosChange(trechos.map(t => {
      const d = m.get(`${t.idInicio}-${t.idFim}`);
      return d ? { ...t, diametroMm: d } : t;
    }));
    toast.success("Diâmetros de água aplicados aos trechos");
  }, [waterResults, trechos, onTrechosChange]);

  const exportCSV = () => {
    if (waterResults.length === 0) return;
    let csv = "Trecho;DN (mm);V (m/s);hf (m);J (m/m);P jus (mca);Status;Obs\n";
    for (const r of waterResults) csv += `${r.id};${r.diametroMm};${r.velocidadeMs};${r.perdaCargaM};${r.perdaCargaUnitaria};${r.pressaoJusante ?? "-"};${r.atendeNorma ? "OK" : "NAO"};${r.observacoes.join(" | ")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "dimensionamento_agua.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-600" /> Rede de Água — QWater (NBR 12218)
          </CardTitle>
          <CardDescription className="text-xs">
            Hazen-Williams: hf = 10.643·Q^1.85 / (C^1.85·D^4.87)·L
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {waterTrechos.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-blue-600">
                {waterTrechos.length} trechos de água
              </Badge>
              <span className="text-xs text-muted-foreground">
                (filtrados por tipoRedeManual = "agua" ou "outro")
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">Fórmula</Label>
              <Select value={formula} onValueChange={v => setFormula(v as "hazen-williams" | "colebrook")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hazen-williams">Hazen-Williams</SelectItem>
                  <SelectItem value="colebrook">Colebrook-White</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            {waterResults.length > 0 && (
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

          {waterResumo && (
            <div className="flex gap-3 text-sm">
              <Badge variant="outline">{waterResumo.total} trechos</Badge>
              <Badge className="bg-green-500">{waterResumo.atendem} OK</Badge>
              {waterResumo.total - waterResumo.atendem > 0 && (
                <Badge variant="destructive">{waterResumo.total - waterResumo.atendem} falha</Badge>
              )}
            </div>
          )}

          {waterResults.length > 0 && (
            <div className="border rounded-lg overflow-auto max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trecho</TableHead>
                    <TableHead>DN</TableHead>
                    <TableHead>V (m/s)</TableHead>
                    <TableHead>hf (m)</TableHead>
                    <TableHead>P jus (mca)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waterResults.map(r => (
                    <TableRow key={r.id} className={!r.atendeNorma ? "bg-red-50 dark:bg-red-950/20" : ""}>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell className="font-semibold">{r.diametroMm}</TableCell>
                      <TableCell>{r.velocidadeMs.toFixed(2)}</TableCell>
                      <TableCell>{r.perdaCargaM.toFixed(3)}</TableCell>
                      <TableCell>{r.pressaoJusante?.toFixed(1) ?? "-"}</TableCell>
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

          {waterTrechos.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Nenhum trecho de água. Importe uma rede e marque trechos como "Água" na Topografia.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
