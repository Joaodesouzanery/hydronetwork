/**
 * Reusable interactive map widget for network modules (Sewer, Water, Drainage).
 * Shows nodes on map, allows clicking to add/move nodes, and manual point linking.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Minus, Maximize, MousePointer2, Layers } from "lucide-react";
import { getMapCoordinates } from "@/engine/hydraulics";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface NodeData {
  id: string;
  x: number;
  y: number;
  cota?: number;
  label?: string;
}

interface NodeMapWidgetProps {
  nodes: NodeData[];
  connections?: { from: string; to: string; label?: string; color?: string }[];
  title?: string;
  onNodeClick?: (nodeId: string) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  height?: number;
  accentColor?: string;
}

const TILE_LAYERS: Record<string, { url: string; attribution: string; name: string }> = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap",
    name: "OpenStreetMap",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    name: "Satélite",
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap",
    name: "Topográfico",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© CartoDB",
    name: "Escuro",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "© CartoDB",
    name: "Claro",
  },
};

export const NodeMapWidget = ({
  nodes,
  connections = [],
  title = "Mapa de Nós",
  onNodeClick,
  onNodeMove,
  height = 350,
  accentColor = "#3b82f6",
}: NodeMapWidgetProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const linesRef = useRef<L.Polyline[]>([]);
  const [tileKey, setTileKey] = useState("osm");

  const getCoords = useCallback((x: number, y: number): [number, number] => {
    return getMapCoordinates(x, y);
  }, []);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView([-23.55, -46.63], 14);
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

  // Draw nodes and connections
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    linesRef.current.forEach(l => l.remove());
    markersRef.current = [];
    linesRef.current = [];

    if (nodes.length === 0) return;
    const bounds: L.LatLngExpression[] = [];

    nodes.forEach((n, idx) => {
      const coords = getCoords(n.x, n.y);
      bounds.push(coords);
      let color = accentColor;
      if (idx === 0) color = "#22c55e";
      else if (idx === nodes.length - 1) color = "#ef4444";

      const marker = L.circleMarker(coords, {
        radius: 7, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9,
      }).addTo(map);

      marker.bindPopup(`<b>${n.id}</b><br>X: ${n.x.toFixed(2)}<br>Y: ${n.y.toFixed(2)}${n.cota !== undefined ? `<br>Cota: ${n.cota.toFixed(2)}m` : ""}`);
      marker.on("click", () => onNodeClick?.(n.id));
      markersRef.current.push(marker);
    });

    connections.forEach(c => {
      const from = nodes.find(n => n.id === c.from);
      const to = nodes.find(n => n.id === c.to);
      if (!from || !to) return;
      const line = L.polyline([getCoords(from.x, from.y), getCoords(to.x, to.y)], {
        color: c.color || accentColor, weight: 3, opacity: 0.7,
      }).addTo(map);
      if (c.label) line.bindPopup(c.label);
      linesRef.current.push(line);
    });

    if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
  }, [nodes, connections, getCoords, accentColor, onNodeClick]);

  if (nodes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" /> {title}
          <Badge variant="secondary" className="ml-auto">{nodes.length} nós</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <Button size="sm" variant="outline" onClick={() => {
            if (nodes.length === 0) return;
            const bounds = nodes.map(n => getCoords(n.x, n.y));
            mapRef.current?.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
          }}>
            <Maximize className="h-3 w-3 mr-1" /> Ajustar
          </Button>
          <Button size="sm" variant="outline" onClick={() => mapRef.current?.zoomIn()}><Plus className="h-3 w-3" /></Button>
          <Button size="sm" variant="outline" onClick={() => mapRef.current?.zoomOut()}><Minus className="h-3 w-3" /></Button>
          <div className="flex items-center gap-1 ml-auto">
            <Layers className="h-3 w-3 text-muted-foreground" />
            <Select value={tileKey} onValueChange={setTileKey}>
              <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TILE_LAYERS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div ref={containerRef} className="w-full rounded-lg border border-border overflow-hidden" style={{ height }} />
      </CardContent>
    </Card>
  );
};
