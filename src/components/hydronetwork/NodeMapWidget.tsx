/**
 * Fully interactive map widget for network modules (Sewer, Water, Drainage, EPANET, SWMM, QGIS).
 * Supports: manual point linking, node dragging, demand editing, layer switching, clear map only.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Plus, Minus, Maximize, MousePointer2, Layers, Link2, Trash2, Undo2, Save, Edit3 } from "lucide-react";
import { getMapCoordinates } from "@/engine/hydraulics";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface NodeData {
  id: string;
  x: number;
  y: number;
  cota?: number;
  demanda?: number;
  label?: string;
}

export interface ConnectionData {
  from: string;
  to: string;
  label?: string;
  color?: string;
}

interface NodeMapWidgetProps {
  nodes: NodeData[];
  connections?: ConnectionData[];
  title?: string;
  onNodeClick?: (nodeId: string) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onConnectionsChange?: (connections: ConnectionData[]) => void;
  onNodeDemandChange?: (nodeId: string, demanda: number) => void;
  height?: number;
  accentColor?: string;
  editable?: boolean;
}

const TILE_LAYERS: Record<string, { url: string; attribution: string; name: string }> = {
  osm: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap", name: "OpenStreetMap" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri", name: "Satélite" },
  topo: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "© OpenTopoMap", name: "Topográfico" },
  dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: "© CartoDB", name: "Escuro" },
  light: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attribution: "© CartoDB", name: "Claro" },
  terrain: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri", name: "Ruas" },
};

export const NodeMapWidget = ({
  nodes,
  connections = [],
  title = "Mapa de Nós",
  onNodeClick,
  onNodeMove,
  onConnectionsChange,
  onNodeDemandChange,
  height = 400,
  accentColor = "#3b82f6",
  editable = true,
}: NodeMapWidgetProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const linesRef = useRef<L.Polyline[]>([]);
  const [tileKey, setTileKey] = useState("osm");
  const [linkMode, setLinkMode] = useState(false);
  const [linkOrigin, setLinkOrigin] = useState<string | null>(null);
  const [localConnections, setLocalConnections] = useState<ConnectionData[]>(connections);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editDemanda, setEditDemanda] = useState<number>(0);

  // Sync connections from parent
  useEffect(() => {
    setLocalConnections(connections);
  }, [connections]);

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

  // Handle link mode click
  const handleNodeClickInternal = useCallback((nodeId: string) => {
    if (linkMode) {
      if (!linkOrigin) {
        setLinkOrigin(nodeId);
        toast.info(`Origem: ${nodeId}. Clique no ponto de destino.`);
      } else {
        if (nodeId === linkOrigin) {
          toast.error("Selecione um ponto diferente.");
          return;
        }
        // Check if connection already exists
        const exists = localConnections.some(c =>
          (c.from === linkOrigin && c.to === nodeId) || (c.from === nodeId && c.to === linkOrigin)
        );
        if (exists) {
          toast.warning("Conexão já existe.");
          setLinkOrigin(null);
          return;
        }
        const newConn: ConnectionData = {
          from: linkOrigin, to: nodeId,
          color: accentColor, label: `${linkOrigin} → ${nodeId}`
        };
        const updated = [...localConnections, newConn];
        setLocalConnections(updated);
        onConnectionsChange?.(updated);
        toast.success(`Trecho ${linkOrigin} → ${nodeId} criado!`);
        setLinkOrigin(null);
      }
    } else {
      setSelectedNode(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (node) setEditDemanda(node.demanda ?? 0);
      onNodeClick?.(nodeId);
    }
  }, [linkMode, linkOrigin, localConnections, accentColor, onConnectionsChange, onNodeClick, nodes]);

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
      if (selectedNode === n.id) color = "#f59e0b";

      const marker = L.circleMarker(coords, {
        radius: 8, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9,
      }).addTo(map);

      const demandaInfo = n.demanda !== undefined ? `<br><b>Demanda:</b> ${n.demanda} L/s` : "";
      marker.bindPopup(`
        <div style="font-family:sans-serif;min-width:150px;">
          <strong style="font-size:13px;">${n.id}</strong>
          <hr style="margin:4px 0;border-color:#e2e8f0;">
          <div style="font-size:11px;line-height:1.5;">
            <b>X:</b> ${n.x.toFixed(3)}<br>
            <b>Y:</b> ${n.y.toFixed(3)}
            ${n.cota !== undefined ? `<br><b>Cota:</b> ${n.cota.toFixed(3)}m` : ""}
            ${demandaInfo}
          </div>
        </div>
      `);

      marker.on("click", () => handleNodeClickInternal(n.id));
      markersRef.current.push(marker);
    });

    localConnections.forEach(c => {
      const from = nodes.find(n => n.id === c.from);
      const to = nodes.find(n => n.id === c.to);
      if (!from || !to) return;
      const line = L.polyline([getCoords(from.x, from.y), getCoords(to.x, to.y)], {
        color: c.color || accentColor, weight: 3, opacity: 0.8,
      }).addTo(map);
      if (c.label) line.bindPopup(`<b>${c.label}</b>`);
      linesRef.current.push(line);
    });

    if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds), { padding: [25, 25] });
  }, [nodes, localConnections, getCoords, accentColor, handleNodeClickInternal, selectedNode]);

  const handleUndo = () => {
    if (localConnections.length === 0) return;
    const updated = localConnections.slice(0, -1);
    setLocalConnections(updated);
    onConnectionsChange?.(updated);
    toast.info("Última conexão removida.");
  };

  const handleClearMap = () => {
    // Only clear map visual connections, NOT the project data
    setLocalConnections([]);
    onConnectionsChange?.([]);
    setLinkOrigin(null);
    setLinkMode(false);
    setSelectedNode(null);
    // Clear visual elements
    markersRef.current.forEach(m => m.remove());
    linesRef.current.forEach(l => l.remove());
    markersRef.current = [];
    linesRef.current = [];
    toast.success("Mapa limpo (conexões removidas).");
  };

  const handleSaveDemand = () => {
    if (selectedNode && onNodeDemandChange) {
      onNodeDemandChange(selectedNode, editDemanda);
      toast.success(`Demanda de ${selectedNode} atualizada para ${editDemanda} L/s`);
    }
  };

  if (nodes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" /> {title}
          <Badge variant="secondary" className="ml-auto">{nodes.length} nós · {localConnections.length} trechos</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Toolbar */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <Button size="sm" variant="outline" onClick={() => {
            if (nodes.length === 0) return;
            const bounds = nodes.map(n => getCoords(n.x, n.y));
            mapRef.current?.fitBounds(L.latLngBounds(bounds), { padding: [25, 25] });
          }}>
            <Maximize className="h-3 w-3 mr-1" /> Ajustar
          </Button>
          {editable && (
            <>
              <Button size="sm" variant={linkMode ? "default" : "outline"} onClick={() => {
                setLinkMode(!linkMode);
                setLinkOrigin(null);
                if (!linkMode) toast.info("Modo ligar pontos: clique origem, depois destino.");
              }}>
                <Link2 className="h-3 w-3 mr-1" /> Ligar Pontos
              </Button>
              <Button size="sm" variant="outline" onClick={handleUndo}>
                <Undo2 className="h-3 w-3 mr-1" /> Desfazer
              </Button>
              <Button size="sm" variant="destructive" onClick={handleClearMap}>
                <Trash2 className="h-3 w-3 mr-1" /> Limpar Mapa
              </Button>
            </>
          )}
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

        {/* Link mode status */}
        {linkMode && (
          <div className="flex items-center gap-2">
            <Badge variant={linkOrigin ? "default" : "secondary"}>
              {linkOrigin ? `Origem: ${linkOrigin} — clique no destino` : "Clique no ponto de origem"}
            </Badge>
            {linkOrigin && (
              <Button size="sm" variant="ghost" onClick={() => setLinkOrigin(null)}>Cancelar</Button>
            )}
          </div>
        )}

        {/* Map */}
        <div ref={containerRef} className="w-full rounded-lg border border-border overflow-hidden" style={{ height }} />

        {/* Selected node editor */}
        {editable && selectedNode && onNodeDemandChange && (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
            <Edit3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{selectedNode}</span>
            <Label className="text-xs">Demanda (L/s):</Label>
            <Input type="number" step="0.1" className="h-7 w-24 text-xs" value={editDemanda}
              onChange={e => setEditDemanda(Number(e.target.value))} />
            <Button size="sm" variant="outline" className="h-7" onClick={handleSaveDemand}>
              <Save className="h-3 w-3 mr-1" /> Salvar
            </Button>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500" /> Início</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /> Fim</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} /> Intermediário</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500" /> Selecionado</div>
        </div>
      </CardContent>
    </Card>
  );
};
