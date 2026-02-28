import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
  AlertTriangle, Zap, RefreshCw, Map,
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import {
  dimensionWaterNetwork,
  type WaterSegmentInput,
  type WaterSegmentResult,
} from "@/engine/qwaterEngine";
import { detectBatchCRS, getMapCoordinatesWithCRS } from "@/engine/hydraulics";
import L from "leaflet";

interface WaterModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange: (t: Trecho[]) => void;
}

/** Inline Leaflet map showing water dimensioning results */
const WaterMapView = ({
  pontos, trechos, results,
}: { pontos: PontoTopografico[]; trechos: Trecho[]; results: WaterSegmentResult[] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  const crs = useMemo(() => detectBatchCRS(pontos), [pontos]);

  const getCoords = useCallback(
    (p: PontoTopografico): [number, number] => getMapCoordinatesWithCRS(p.x, p.y, crs),
    [crs],
  );

  useEffect(() => {
    if (!mapRef.current || pontos.length === 0) return;

    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    const map = L.map(mapRef.current, { zoomControl: true });
    mapInstance.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OSM",
    }).addTo(map);

    const resultMap = new Map(results.map(r => [r.id, r]));
    const bounds: L.LatLngExpression[] = [];

    trechos.forEach(t => {
      const pI = pontos.find(p => p.id === t.idInicio);
      const pF = pontos.find(p => p.id === t.idFim);
      if (!pI || !pF) return;

      const coordI = getCoords(pI);
      const coordF = getCoords(pF);
      bounds.push(coordI, coordF);

      const segId = `${t.idInicio}-${t.idFim}`;
      const res = resultMap.get(segId);
      const ok = res?.atendeNorma ?? true;
      const color = ok ? "#3b82f6" : "#ef4444";

      const line = L.polyline([coordI, coordF], { color, weight: 4, opacity: 0.85 }).addTo(map);

      const tooltipText = res
        ? `${segId} | DN${res.diametroMm} | V=${res.velocidadeMs.toFixed(2)} m/s | P=${res.pressaoJusante?.toFixed(1) ?? "-"} mca`
        : segId;
      line.bindTooltip(tooltipText, { sticky: true });

      if (res) {
        line.bindPopup(`
          <div style="font-size:12px;line-height:1.6">
            <strong>${segId}</strong><br/>
            <b>DN:</b> ${res.diametroMm} mm<br/>
            <b>V:</b> ${res.velocidadeMs.toFixed(3)} m/s<br/>
            <b>hf:</b> ${res.perdaCargaM.toFixed(3)} m<br/>
            <b>J:</b> ${res.perdaCargaUnitaria.toFixed(5)} m/m<br/>
            <b>P jus:</b> ${res.pressaoJusante?.toFixed(1) ?? "-"} mca<br/>
            <b>Status:</b> ${res.atendeNorma ? "OK" : "FALHA"}<br/>
            ${res.observacoes.length > 0 ? `<b>Obs:</b> ${res.observacoes.join("; ")}` : ""}
          </div>
        `);
      }
    });

    pontos.forEach(p => {
      const coords = getCoords(p);
      L.circleMarker(coords, { radius: 5, color: "#1e40af", fillColor: "#60a5fa", fillOpacity: 0.8 })
        .addTo(map)
        .bindTooltip(`${p.id} (${p.cota.toFixed(2)}m)`, { direction: "top" });
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
    }

    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [pontos, trechos, results, getCoords]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Map className="h-4 w-4 text-blue-600" /> Mapa da Rede de Água
        </CardTitle>
        <CardDescription className="text-xs">Azul = atende NBR 12218 | Vermelho = falha</CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={mapRef} className="h-[400px] rounded-lg border" />
      </CardContent>
    </Card>
  );
};

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
  const [vazaoAgua, setVazaoAgua] = useState(0.5);
  const [autoApply, setAutoApply] = useState(false);

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
        vazaoLps: vazaoAgua, material: t.material || "PVC",
      };
    });
    const { resultados, resumo } = dimensionWaterNetwork(inputs, {
      formula, coefHW, velMin: velMinAgua, velMax: velMaxAgua, pressaoMin, pressaoMax, diamMinMm: diamMinAgua,
    });
    setWaterResults(resultados);
    setWaterResumo({ total: resumo.total, atendem: resumo.atendem });
    toast.success(`QWater: ${resumo.atendem}/${resumo.total} trechos atendem NBR 12218`);
  }, [waterTrechos, pontos, formula, coefHW, velMinAgua, velMaxAgua, pressaoMin, pressaoMax, diamMinAgua, vazaoAgua]);

  const applyDiameters = useCallback(() => {
    if (waterResults.length === 0) return;
    const m = new Map(waterResults.map(r => [r.id, r.diametroMm]));
    onTrechosChange(trechos.map(t => {
      const d = m.get(`${t.idInicio}-${t.idFim}`);
      return d ? { ...t, diametroMm: d } : t;
    }));
    toast.success("Diâmetros de água aplicados aos trechos");
  }, [waterResults, trechos, onTrechosChange]);

  useEffect(() => {
    if (autoApply && waterResults.length > 0) {
      applyDiameters();
      setAutoApply(false);
    }
  }, [autoApply, waterResults, applyDiameters]);

  const handleRebuild = () => {
    setAutoApply(true);
    dimensionWater();
  };

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
            <Droplets className="h-5 w-5 text-blue-600" /> Rede de Água — Dimensionamento (NBR 12218)
          </CardTitle>
          <CardDescription className="text-xs">
            Hazen-Williams: hf = 10.643·Q^1.85 / (C^1.85·D^4.87)·L | Motor: QWater
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

          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
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
            <div><Label className="text-xs">Vazão (L/s)</Label><Input type="number" step="0.1" value={vazaoAgua} onChange={e => setVazaoAgua(Number(e.target.value))} /></div>
            <div><Label className="text-xs">C (H-W)</Label><Input type="number" step="5" value={coefHW} onChange={e => setCoefHW(Number(e.target.value))} /></div>
            <div><Label className="text-xs">DN mín (mm)</Label><Input type="number" step="25" value={diamMinAgua} onChange={e => setDiamMinAgua(Number(e.target.value))} /></div>
            <div><Label className="text-xs">V mín (m/s)</Label><Input type="number" step="0.1" value={velMinAgua} onChange={e => setVelMinAgua(Number(e.target.value))} /></div>
            <div><Label className="text-xs">V máx (m/s)</Label><Input type="number" step="0.1" value={velMaxAgua} onChange={e => setVelMaxAgua(Number(e.target.value))} /></div>
            <div><Label className="text-xs">P mín (mca)</Label><Input type="number" step="1" value={pressaoMin} onChange={e => setPressaoMin(Number(e.target.value))} /></div>
            <div><Label className="text-xs">P máx (mca)</Label><Input type="number" step="1" value={pressaoMax} onChange={e => setPressaoMax(Number(e.target.value))} /></div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={dimensionWater} disabled={waterTrechos.length === 0}>
              <Calculator className="h-4 w-4 mr-1" /> Dimensionar ({waterTrechos.length} trechos)
            </Button>
            {waterResults.length > 0 && (
              <>
                <Button variant="secondary" onClick={handleRebuild}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Rebuild Rede
                </Button>
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

      {/* Interactive map — shows after dimensioning */}
      {waterResults.length > 0 && pontos.length > 0 && (
        <WaterMapView pontos={pontos} trechos={waterTrechos} results={waterResults} />
      )}
    </div>
  );
};
