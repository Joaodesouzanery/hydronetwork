import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MapPin, Plus, Minus, RotateCcw, Trash2, Undo2, Save,
  FolderOpen, Maximize, MousePointer2, GitBranch
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { getMapCoordinates } from "@/engine/hydraulics";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface TopographyMapProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange?: (trechos: Trecho[]) => void;
}

const STORAGE_KEY = "hydronetwork_trechos";

export const TopographyMap = ({ pontos, trechos, onTrechosChange }: TopographyMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawOrigin, setDrawOrigin] = useState<string | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);

  const getPointCoords = useCallback((p: PontoTopografico): [number, number] => {
    return getMapCoordinates(p.x, p.y);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([-23.55, -46.63], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw points and segments
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing
    markersRef.current.forEach(m => m.remove());
    polylinesRef.current.forEach(p => p.remove());
    markersRef.current = [];
    polylinesRef.current = [];

    if (pontos.length === 0) return;

    const bounds: L.LatLngExpression[] = [];

    // Draw points
    pontos.forEach((p, idx) => {
      const coords = getPointCoords(p);
      bounds.push(coords);

      let color = "#3b82f6"; // blue intermediate
      if (idx === 0) color = "#22c55e"; // green start
      else if (idx === pontos.length - 1) color = "#ef4444"; // red end

      const marker = L.circleMarker(coords, {
        radius: 8,
        fillColor: color,
        color: "#ffffff",
        weight: 2,
        fillOpacity: 0.9,
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 150px;">
          <strong style="font-size: 14px;">${p.id}</strong>
          <hr style="margin: 4px 0; border-color: #e2e8f0;">
          <div style="font-size: 12px; line-height: 1.6;">
            <b>X:</b> ${p.x.toFixed(3)}<br>
            <b>Y:</b> ${p.y.toFixed(3)}<br>
            <b>Cota:</b> ${p.cota.toFixed(3)}m
          </div>
        </div>
      `);

      // Draw mode click handler
      marker.on("click", () => {
        if (!drawMode) return;
        if (!drawOrigin) {
          setDrawOrigin(p.id);
          toast.info(`Origem: ${p.id}. Clique no destino.`);
        }
      });

      markersRef.current.push(marker);
    });

    // Draw segments
    trechos.forEach(t => {
      const pInicio = pontos.find(p => p.id === t.idInicio);
      const pFim = pontos.find(p => p.id === t.idFim);
      if (!pInicio || !pFim) return;

      const coordsInicio = getPointCoords(pInicio);
      const coordsFim = getPointCoords(pFim);
      const isGravity = t.tipoRede === "Esgoto por Gravidade";

      const polyline = L.polyline([coordsInicio, coordsFim], {
        color: isGravity ? "#22c55e" : "#f59e0b",
        weight: 4,
        opacity: 0.8,
      }).addTo(map);

      polyline.bindPopup(`
        <div style="font-family: sans-serif; min-width: 180px;">
          <strong style="font-size: 14px;">${t.idInicio} → ${t.idFim}</strong>
          <hr style="margin: 4px 0; border-color: #e2e8f0;">
          <div style="font-size: 12px; line-height: 1.6;">
            <b>Comprimento:</b> ${t.comprimento.toFixed(2)}m<br>
            <b>Declividade:</b> ${(t.declividade * 100).toFixed(2)}%<br>
            <b>Tipo:</b> ${isGravity ? "Gravidade" : "Elevatória"}<br>
            <b>Diâmetro:</b> DN${t.diametroMm}<br>
            <b>Material:</b> ${t.material}
          </div>
        </div>
      `);

      polylinesRef.current.push(polyline);
    });

    // Fit bounds
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
    }
  }, [pontos, trechos, getPointCoords, drawMode]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleFitBounds = () => {
    if (pontos.length === 0) return;
    const bounds = pontos.map(p => getPointCoords(p));
    mapRef.current?.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trechos));
    toast.success("Trechos salvos com sucesso!");
  };

  const handleLoad = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data && onTrechosChange) {
      onTrechosChange(JSON.parse(data));
      toast.success("Trechos carregados!");
    } else {
      toast.error("Nenhum trecho salvo encontrado.");
    }
  };

  const handleUndo = () => {
    if (trechos.length === 0) return;
    const updated = trechos.slice(0, -1);
    onTrechosChange?.(updated);
    toast.info("Último trecho removido.");
  };

  const handleClearAll = () => {
    if (!confirm("Limpar todos os trechos?")) return;
    onTrechosChange?.([]);
    toast.success("Trechos limpos.");
  };

  const toggleDrawMode = () => {
    setDrawMode(!drawMode);
    setDrawOrigin(null);
    if (!drawMode) toast.info("Modo desenho ativado. Clique em dois pontos.");
    else toast.info("Modo desenho desativado.");
  };

  if (pontos.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" /> Mapa Interativo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleFitBounds}>
            <Maximize className="h-4 w-4 mr-1" /> Ajustar
          </Button>
          <Button size="sm" variant={drawMode ? "default" : "outline"} onClick={toggleDrawMode}>
            <MousePointer2 className="h-4 w-4 mr-1" /> Desenhar Trecho
          </Button>
          <Button size="sm" variant="outline" onClick={handleZoomIn}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleZoomOut}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleUndo}>
            <Undo2 className="h-4 w-4 mr-1" /> Desfazer
          </Button>
          <Button size="sm" variant="destructive" onClick={handleClearAll}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={handleLoad}>
            <FolderOpen className="h-4 w-4 mr-1" /> Carregar
          </Button>
        </div>

        {drawMode && drawOrigin && (
          <Badge variant="secondary">Origem: {drawOrigin} — clique no destino</Badge>
        )}

        {/* Map */}
        <div
          ref={mapContainerRef}
          className="w-full rounded-lg border border-border overflow-hidden"
          style={{ height: 450 }}
        />

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500" /> Ponto Inicial</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /> Ponto Final</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500" /> Intermediário</div>
          <div className="flex items-center gap-1"><div className="w-4 h-1 bg-green-500 rounded" /> Gravidade</div>
          <div className="flex items-center gap-1"><div className="w-4 h-1 bg-orange-500 rounded" /> Elevatória</div>
        </div>

        <p className="text-sm text-muted-foreground">
          {pontos.length} pontos · {trechos.length} trechos carregados
        </p>
      </CardContent>
    </Card>
  );
};
