import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calculator, Waves, CheckCircle, XCircle, Download,
  AlertTriangle, Zap, RefreshCw, Map,
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import {
  dimensionSewerNetwork,
  type SewerSegmentInput,
  type SewerSegmentResult,
} from "@/engine/qesgEngine";
import { detectBatchCRS, getMapCoordinatesWithCRS } from "@/engine/hydraulics";
import L from "leaflet";

interface SewerModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange: (t: Trecho[]) => void;
}

/** Inline Leaflet map showing sewer dimensioning results */
const SewerMapView = ({
  pontos, trechos, results,
}: { pontos: PontoTopografico[]; trechos: Trecho[]; results: SewerSegmentResult[] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  const crs = useMemo(() => detectBatchCRS(pontos), [pontos]);

  const getCoords = useCallback(
    (p: PontoTopografico): [number, number] => getMapCoordinatesWithCRS(p.x, p.y, crs),
    [crs],
  );

  useEffect(() => {
    if (!mapRef.current || pontos.length === 0) return;

    // Create or reset map
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    const map = L.map(mapRef.current, { zoomControl: true });
    mapInstance.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OSM",
    }).addTo(map);

    const resultMap = new Map(results.map(r => [r.id, r]));
    const bounds: L.LatLngExpression[] = [];

    // Draw trechos
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
      const color = ok ? "#22c55e" : "#ef4444";

      const line = L.polyline([coordI, coordF], { color, weight: 4, opacity: 0.85 }).addTo(map);

      const tooltipText = res
        ? `${segId} | DN${res.diametroMm} | V=${res.velocidadeMs.toFixed(2)} m/s | τ=${res.tensaoTrativa.toFixed(2)} Pa`
        : segId;
      line.bindTooltip(tooltipText, { sticky: true });

      if (res) {
        line.bindPopup(`
          <div style="font-size:12px;line-height:1.6">
            <strong>${segId}</strong><br/>
            <b>DN:</b> ${res.diametroMm} mm<br/>
            <b>V:</b> ${res.velocidadeMs.toFixed(3)} m/s<br/>
            <b>V crítica:</b> ${res.velocidadeCriticaMs.toFixed(3)} m/s<br/>
            <b>y/D:</b> ${res.laminaDagua.toFixed(3)}<br/>
            <b>τ:</b> ${res.tensaoTrativa.toFixed(2)} Pa<br/>
            <b>Decliv.:</b> ${(res.declividadeUsada * 100).toFixed(3)}%<br/>
            <b>Status:</b> ${res.atendeNorma ? "OK" : "FALHA"}<br/>
            ${res.observacoes.length > 0 ? `<b>Obs:</b> ${res.observacoes.join("; ")}` : ""}
          </div>
        `);
      }
    });

    // Draw pontos as circles
    pontos.forEach(p => {
      const coords = getCoords(p);
      L.circleMarker(coords, { radius: 5, color: "#1e40af", fillColor: "#3b82f6", fillOpacity: 0.8 })
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
          <Map className="h-4 w-4 text-green-600" /> Mapa da Rede de Esgoto
        </CardTitle>
        <CardDescription className="text-xs">Verde = atende NBR 9649 | Vermelho = falha</CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={mapRef} className="h-[400px] rounded-lg border" />
      </CardContent>
    </Card>
  );
};

export const SewerModule = ({ pontos, trechos, onTrechosChange }: SewerModuleProps) => {
  const [sewerResults, setSewerResults] = useState<SewerSegmentResult[]>([]);
  const [sewerResumo, setSewerResumo] = useState<{ total: number; atendem: number } | null>(null);
  const [manning, setManning] = useState(0.013);
  const [laminaMax, setLaminaMax] = useState(0.75);
  const [velMinEsg, setVelMinEsg] = useState(0.6);
  const [velMaxEsg, setVelMaxEsg] = useState(5.0);
  const [tensaoMin, setTensaoMin] = useState(1.0);
  const [diamMinEsg, setDiamMinEsg] = useState(150);
  const [autoApply, setAutoApply] = useState(false);

  const sewerTrechos = useMemo(() =>
    trechos.filter(t => {
      const tipo = t.tipoRedeManual || "esgoto";
      return tipo === "esgoto" || tipo === "outro";
    }), [trechos]);

  const dimensionSewer = useCallback(() => {
    if (sewerTrechos.length === 0) { toast.error("Nenhum trecho de esgoto encontrado."); return; }
    const inputs: SewerSegmentInput[] = sewerTrechos.map(t => {
      const p0 = pontos.find(p => p.id === t.idInicio);
      const p1 = pontos.find(p => p.id === t.idFim);
      return {
        id: `${t.idInicio}-${t.idFim}`, comprimento: t.comprimento,
        cotaMontante: p0?.cota ?? 0, cotaJusante: p1?.cota ?? 0,
        vazaoLps: 1.5, tipoTubo: t.material || "PVC",
      };
    });
    const { resultados, resumo } = dimensionSewerNetwork(inputs, {
      manning, laminaMax, velMin: velMinEsg, velMax: velMaxEsg, tensaoMin, diamMinMm: diamMinEsg,
    });
    setSewerResults(resultados);
    setSewerResumo({ total: resumo.total, atendem: resumo.atendem });
    toast.success(`QEsg: ${resumo.atendem}/${resumo.total} trechos atendem NBR 9649`);
  }, [sewerTrechos, pontos, manning, laminaMax, velMinEsg, velMaxEsg, tensaoMin, diamMinEsg]);

  const applyDiameters = useCallback(() => {
    if (sewerResults.length === 0) return;
    const m = new Map(sewerResults.map(r => [r.id, r.diametroMm]));
    onTrechosChange(trechos.map(t => {
      const d = m.get(`${t.idInicio}-${t.idFim}`);
      return d ? { ...t, diametroMm: d } : t;
    }));
    toast.success("Diâmetros de esgoto aplicados aos trechos");
  }, [sewerResults, trechos, onTrechosChange]);

  // Auto-apply diameters after rebuild
  useEffect(() => {
    if (autoApply && sewerResults.length > 0) {
      applyDiameters();
      setAutoApply(false);
    }
  }, [autoApply, sewerResults, applyDiameters]);

  const handleRebuild = () => {
    setAutoApply(true);
    dimensionSewer();
  };

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Waves className="h-5 w-5 text-amber-600" /> Rede de Esgoto — QEsg (NBR 9649)
          </CardTitle>
          <CardDescription className="text-xs">
            τ = 10000·Rh·I | v_c = 6·√(g·Rh) | I_min = 0.0055·Q^(-0.47)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sewerTrechos.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600">
                {sewerTrechos.length} trechos de esgoto
              </Badge>
              <span className="text-xs text-muted-foreground">
                (filtrados por tipoRedeManual = "esgoto" ou "outro")
              </span>
            </div>
          )}

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
            {sewerResults.length > 0 && (
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

          {sewerResumo && (
            <div className="flex gap-3 text-sm">
              <Badge variant="outline">{sewerResumo.total} trechos</Badge>
              <Badge className="bg-green-500">{sewerResumo.atendem} OK</Badge>
              {sewerResumo.total - sewerResumo.atendem > 0 && (
                <Badge variant="destructive">{sewerResumo.total - sewerResumo.atendem} falha</Badge>
              )}
            </div>
          )}

          {sewerResults.length > 0 && (
            <div className="border rounded-lg overflow-auto max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trecho</TableHead>
                    <TableHead>DN</TableHead>
                    <TableHead>V (m/s)</TableHead>
                    <TableHead>y/D</TableHead>
                    <TableHead>τ (Pa)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sewerResults.map(r => (
                    <TableRow key={r.id} className={!r.atendeNorma ? "bg-red-50 dark:bg-red-950/20" : ""}>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell className="font-semibold">{r.diametroMm}</TableCell>
                      <TableCell>{r.velocidadeMs.toFixed(2)}</TableCell>
                      <TableCell>{r.laminaDagua.toFixed(3)}</TableCell>
                      <TableCell>{r.tensaoTrativa.toFixed(2)}</TableCell>
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

          {sewerTrechos.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Nenhum trecho de esgoto. Importe uma rede na Topografia primeiro.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactive map — shows after dimensioning */}
      {sewerResults.length > 0 && pontos.length > 0 && (
        <SewerMapView pontos={pontos} trechos={sewerTrechos} results={sewerResults} />
      )}
    </div>
  );
};
