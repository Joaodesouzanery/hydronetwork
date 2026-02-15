import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  MapPin, Plus, Minus, Trash2, Undo2, Save,
  FolderOpen, Maximize, MousePointer2, Layers
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho, createTrechoFromPoints } from "@/engine/domain";
import { getMapCoordinates } from "@/engine/hydraulics";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface TopographyMapProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange?: (trechos: Trecho[]) => void;
  onClearAll?: () => void;
}

const STORAGE_KEY = "hydronetwork_trechos";

const TILE_LAYERS: Record<string, { url: string; attribution: string; name: string }> = {
  osm: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap", name: "OpenStreetMap" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri", name: "Satélite (Esri)" },
  topo: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "© OpenTopoMap", name: "Topográfico" },
  dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: "© CartoDB", name: "Escuro" },
  light: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attribution: "© CartoDB", name: "Claro" },
  terrain: { url: "https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg", attribution: "© Stamen", name: "Terreno" },
};

export const TopographyMap = ({ pontos, trechos, onTrechosChange, onClearAll }: TopographyMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawOrigin, setDrawOrigin] = useState<string | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const [tileKey, setTileKey] = useState("osm");

  const getPointCoords = useCallback((p: PontoTopografico): [number, number] => {
    return getMapCoordinates(p.x, p.y);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([-23.55, -46.63], 14);
    const tile = L.tileLayer(TILE_LAYERS.osm.url, { attribution: TILE_LAYERS.osm.attribution, maxZoom: 19 }).addTo(map);
    tileLayerRef.current = tile;
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Change tile layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) tileLayerRef.current.remove();
    const cfg = TILE_LAYERS[tileKey] || TILE_LAYERS.osm;
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 }).addTo(map);
  }, [tileKey]);

  // Handle draw mode - create trecho when clicking destination
  const handleMarkerClick = useCallback((pointId: string) => {
    if (!drawMode) return;
    if (!drawOrigin) {
      setDrawOrigin(pointId);
      toast.info(`Origem: ${pointId}. Clique no ponto de destino.`);
    } else {
      if (pointId === drawOrigin) {
        toast.error("Selecione um ponto diferente para o destino.");
        return;
      }
      // Create trecho between drawOrigin and pointId
      const pOrigem = pontos.find(p => p.id === drawOrigin);
      const pDestino = pontos.find(p => p.id === pointId);
      if (pOrigem && pDestino) {
        const novoTrecho = createTrechoFromPoints(pOrigem, pDestino);
        onTrechosChange?.([...trechos, novoTrecho]);
        toast.success(`Trecho ${drawOrigin} → ${pointId} criado!`);
      }
      setDrawOrigin(null);
    }
  }, [drawMode, drawOrigin, pontos, trechos, onTrechosChange]);

  // Draw points and segments
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    polylinesRef.current.forEach(p => p.remove());
    markersRef.current = [];
    polylinesRef.current = [];

    if (pontos.length === 0) return;

    const bounds: L.LatLngExpression[] = [];

    pontos.forEach((p, idx) => {
      const coords = getPointCoords(p);
      bounds.push(coords);

      let color = "#3b82f6";
      if (idx === 0) color = "#22c55e";
      else if (idx === pontos.length - 1) color = "#ef4444";

      const marker = L.circleMarker(coords, {
        radius: 8, fillColor: color, color: "#ffffff", weight: 2, fillOpacity: 0.9,
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

      marker.on("click", () => handleMarkerClick(p.id));
      markersRef.current.push(marker);
    });

    trechos.forEach(t => {
      const pInicio = pontos.find(p => p.id === t.idInicio);
      const pFim = pontos.find(p => p.id === t.idFim);
      if (!pInicio || !pFim) return;
      const isGravity = t.tipoRede === "Esgoto por Gravidade";

      const polyline = L.polyline([getPointCoords(pInicio), getPointCoords(pFim)], {
        color: isGravity ? "#22c55e" : "#f59e0b", weight: 4, opacity: 0.8,
      }).addTo(map);

      polyline.bindPopup(`
        <div style="font-family: sans-serif; min-width: 180px;">
          <strong>${t.idInicio} → ${t.idFim}</strong>
          <hr style="margin: 4px 0;">
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

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
    }
  }, [pontos, trechos, getPointCoords, handleMarkerClick]);

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
    onTrechosChange?.(trechos.slice(0, -1));
    toast.info("Último trecho removido.");
  };

  const handleClearAll = () => {
    if (!confirm("Limpar trechos e conexões do mapa? (Os pontos da topografia serão mantidos)")) return;
    // Only clear trechos/connections, NOT topography points
    onTrechosChange?.([]);
    // Clear markers/polylines from the map immediately
    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = [];
    toast.success("Trechos do mapa limpos.");
  };

  const toggleDrawMode = () => {
    setDrawMode(!drawMode);
    setDrawOrigin(null);
    if (!drawMode) toast.info("Modo desenho ativado. Clique em um ponto de origem, depois no destino.");
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
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="outline" onClick={handleFitBounds}>
            <Maximize className="h-4 w-4 mr-1" /> Ajustar
          </Button>
          <Button size="sm" variant={drawMode ? "default" : "outline"} onClick={toggleDrawMode}>
            <MousePointer2 className="h-4 w-4 mr-1" /> Ligar Pontos
          </Button>
          <Button size="sm" variant="outline" onClick={handleZoomIn}><Plus className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={handleZoomOut}><Minus className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={handleUndo}>
            <Undo2 className="h-4 w-4 mr-1" /> Desfazer
          </Button>
          <Button size="sm" variant="destructive" onClick={handleClearAll}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar Tudo
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={handleLoad}>
            <FolderOpen className="h-4 w-4 mr-1" /> Carregar
          </Button>
        </div>

        {drawMode && (
          <div className="flex items-center gap-2">
            <Badge variant={drawOrigin ? "default" : "secondary"}>
              {drawOrigin ? `Origem: ${drawOrigin} — clique no destino` : "Clique no ponto de origem"}
            </Badge>
            {drawOrigin && (
              <Button size="sm" variant="ghost" onClick={() => setDrawOrigin(null)}>Cancelar</Button>
            )}
          </div>
        )}

        {/* Map */}
        <div
          ref={mapContainerRef}
          className="w-full rounded-lg border border-border overflow-hidden"
          style={{ height: 450 }}
        />

        {/* Map Layer Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Camada do mapa:</span>
          <Select value={tileKey} onValueChange={setTileKey}>
            <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TILE_LAYERS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
