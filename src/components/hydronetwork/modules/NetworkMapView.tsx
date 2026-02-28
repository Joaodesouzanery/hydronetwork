/**
 * Shared map view for network modules (Sewer & Water).
 *
 * Renders a Leaflet map with segments colored by compliance status
 * and node markers with tooltips. Extracted from the duplicated
 * SewerMapView and WaterMapView components.
 */

import { useRef, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Map } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { detectBatchCRS, getMapCoordinatesWithCRS } from "@/engine/hydraulics";
import { MAP_DEFAULTS } from "@/config/defaults";
import L from "leaflet";

interface SegmentResultBase {
  id: string;
  diametroMm: number;
  atendeNorma: boolean;
  observacoes: string[];
}

interface NetworkMapViewProps<TResult extends SegmentResultBase> {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  results: TResult[];
  /** Color for compliant segments */
  okColor: string;
  /** Color for non-compliant segments */
  failColor: string;
  /** Marker border color */
  markerColor: string;
  /** Marker fill color */
  markerFillColor: string;
  /** Map title */
  title: string;
  /** Description below title */
  description: string;
  /** Icon accent color class */
  iconColorClass: string;
  /** Format tooltip for a segment */
  formatTooltip: (segId: string, r: TResult) => string;
  /** Format popup content for a segment */
  formatPopup: (segId: string, r: TResult) => string;
  /** Map height (default 400) */
  height?: number;
}

export function NetworkMapView<TResult extends SegmentResultBase>({
  pontos,
  trechos,
  results,
  okColor,
  failColor,
  markerColor,
  markerFillColor,
  title,
  description,
  iconColorClass,
  formatTooltip,
  formatPopup,
  height = MAP_DEFAULTS.defaultHeight,
}: NetworkMapViewProps<TResult>) {
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
    L.tileLayer(MAP_DEFAULTS.tileUrl, { attribution: MAP_DEFAULTS.attribution }).addTo(map);

    const resultMap = new window.Map(results.map(r => [r.id, r]));
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
      const color = ok ? okColor : failColor;
      const line = L.polyline([coordI, coordF], {
        color,
        weight: MAP_DEFAULTS.segmentWeight,
        opacity: MAP_DEFAULTS.segmentOpacity,
      }).addTo(map);

      const tooltipText = res ? formatTooltip(segId, res) : segId;
      line.bindTooltip(tooltipText, { sticky: true });
      if (res) {
        line.bindPopup(formatPopup(segId, res));
      }
    });

    pontos.forEach(p => {
      const coords = getCoords(p);
      L.circleMarker(coords, {
        radius: MAP_DEFAULTS.markerRadius,
        color: markerColor,
        fillColor: markerFillColor,
        fillOpacity: MAP_DEFAULTS.markerFillOpacity,
      })
        .addTo(map)
        .bindTooltip(`${p.id} (${p.cota.toFixed(2)}m)`, { direction: "top" });
    });

    if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds), { padding: MAP_DEFAULTS.fitBoundsPadding });
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [pontos, trechos, results, getCoords, okColor, failColor, markerColor, markerFillColor, formatTooltip, formatPopup]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Map className={`h-4 w-4 ${iconColorClass}`} /> {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={mapRef} className="rounded-lg border" style={{ height }} />
      </CardContent>
    </Card>
  );
}
