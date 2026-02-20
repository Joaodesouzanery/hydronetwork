import { useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MapPin, Download, Image } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { RDO, SegmentProgress } from "@/engine/rdo";
import { detectBatchCRS, getMapCoordinatesWithCRS } from "@/engine/hydraulics";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState } from "react";

interface RDOProgressMapProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  rdos: RDO[];
}

type StatusFilter = "todos" | "concluido" | "em_execucao" | "nao_iniciado";

export const RDOProgressMap = ({ pontos, trechos, rdos }: RDOProgressMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  // Batch CRS detection for consistent coordinate conversion
  const detectedCRS = useMemo(() => {
    if (pontos.length === 0) return detectBatchCRS([]);
    return detectBatchCRS(pontos);
  }, [pontos]);

  // Calculate segment statuses from RDOs
  const getSegmentStatus = (trecho: Trecho): { status: string; percent: number; executed: number; planned: number; lastRDO?: string } => {
    const allSegs = rdos.flatMap(r => r.segments);
    const matchingSegs = allSegs.filter(s =>
      s.segmentName === `${trecho.idInicio}-${trecho.idFim}` ||
      s.segmentName === trecho.idInicio
    );

    if (matchingSegs.length === 0) {
      return { status: "Não Iniciado", percent: 0, executed: 0, planned: trecho.comprimento };
    }

    const totalExecuted = matchingSegs.reduce((sum, s) => sum + s.executedBefore + s.executedToday, 0);
    const planned = matchingSegs[0]?.plannedTotal || trecho.comprimento;
    const pct = planned > 0 ? (totalExecuted / planned) * 100 : 0;

    const lastRDODate = rdos.filter(r =>
      r.segments.some(s => s.segmentName === `${trecho.idInicio}-${trecho.idFim}`)
    ).sort((a, b) => b.date.localeCompare(a.date))[0]?.date;

    if (pct >= 100) return { status: "Concluído", percent: 100, executed: totalExecuted, planned, lastRDO: lastRDODate };
    if (pct > 0) return { status: "Em Execução", percent: pct, executed: totalExecuted, planned, lastRDO: lastRDODate };
    return { status: "Não Iniciado", percent: 0, executed: 0, planned };
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([-23.55, -46.63], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    const bounds: L.LatLngExpression[] = [];

    trechos.forEach(t => {
      const pInicio = pontos.find(p => p.id === t.idInicio);
      const pFim = pontos.find(p => p.id === t.idFim);
      if (!pInicio || !pFim) return;

      const coordsInicio = getMapCoordinatesWithCRS(pInicio.x, pInicio.y, detectedCRS);
      const coordsFim = getMapCoordinatesWithCRS(pFim.x, pFim.y, detectedCRS);
      bounds.push(coordsInicio, coordsFim);

      const seg = getSegmentStatus(t);

      // Filter
      if (statusFilter !== "todos") {
        if (statusFilter === "concluido" && seg.status !== "Concluído") return;
        if (statusFilter === "em_execucao" && seg.status !== "Em Execução") return;
        if (statusFilter === "nao_iniciado" && seg.status !== "Não Iniciado") return;
      }

      let color = "#ef4444";
      let weight = 2;
      if (seg.status === "Concluído") { color = "#22c55e"; weight = 6; }
      else if (seg.status === "Em Execução") { color = "#f59e0b"; weight = 4; }

      const polyline = L.polyline([coordsInicio, coordsFim], {
        color,
        weight,
        opacity: 0.85,
      }).addTo(map);

      polyline.bindPopup(`
        <div style="font-family: sans-serif; min-width: 200px;">
          <strong style="font-size: 14px;">Trecho ${t.idInicio} → ${t.idFim}</strong>
          <hr style="margin: 4px 0; border-color: #e2e8f0;">
          <div style="font-size: 12px; line-height: 1.8;">
            <b>Status:</b> <span style="color: ${color}; font-weight: bold;">${seg.status}</span><br>
            <b>Planejado:</b> ${seg.planned.toFixed(1)}m<br>
            <b>Executado:</b> ${seg.executed.toFixed(1)}m<br>
            <div style="background: #f1f5f9; border-radius: 4px; height: 8px; margin: 4px 0; overflow: hidden;">
              <div style="width: ${Math.min(seg.percent, 100)}%; height: 100%; background: ${color}; border-radius: 4px;"></div>
            </div>
            <b>${seg.percent.toFixed(1)}%</b>
            ${seg.lastRDO ? `<br><b>Último RDO:</b> ${new Date(seg.lastRDO).toLocaleDateString("pt-BR")}` : ""}
          </div>
        </div>
      `);
    });

    // Points
    pontos.forEach(p => {
      const coords = getMapCoordinatesWithCRS(p.x, p.y, detectedCRS);
      L.circleMarker(coords, {
        radius: 5,
        fillColor: "#6366f1",
        color: "#fff",
        weight: 1,
        fillOpacity: 0.8,
      }).addTo(map);
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [pontos, trechos, rdos, statusFilter, detectedCRS]);

  if (pontos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-semibold">Sem dados no mapa</p>
          <p className="text-sm text-muted-foreground">Importe topografia primeiro.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Mapa de Progresso
          </CardTitle>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="em_execucao">Em Execução</SelectItem>
                <SelectItem value="nao_iniciado">Não Iniciado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={mapContainerRef}
          className="w-full rounded-lg border border-border overflow-hidden"
          style={{ height: 400 }}
        />
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><div className="w-6 h-1 rounded bg-green-500" style={{ height: 6 }} /> Concluído</div>
          <div className="flex items-center gap-1"><div className="w-5 h-1 rounded bg-orange-500" style={{ height: 4 }} /> Em Execução</div>
          <div className="flex items-center gap-1"><div className="w-4 h-1 rounded bg-red-500" style={{ height: 2 }} /> Não Iniciado</div>
        </div>
      </CardContent>
    </Card>
  );
};
