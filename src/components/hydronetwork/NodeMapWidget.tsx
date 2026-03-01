/**
 * Fully interactive map widget for network modules.
 * Supports: manual point linking (one-by-one), node dragging, demand editing, layer switching.
 * Improved UX: click origin then destination with visual feedback, auto-continue linking mode.
 */
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { MapPin, Plus, Minus, Maximize, Layers, Link2, Trash2, Undo2, Save, Edit3, X, MousePointerClick } from "lucide-react";
import { detectBatchCRS, getMapCoordinatesWithCRS, setGlobalUtmZone, getGlobalUtmZone, DetectedCRS } from "@/engine/hydraulics";
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
  vertices?: [number, number][];
}

export interface OverlayPolyline {
  points: [number, number][];
  color?: string;
  weight?: number;
  opacity?: number;
  label?: string;
}

interface NodeMapWidgetProps {
  nodes: NodeData[];
  connections?: ConnectionData[];
  title?: string;
  onNodeClick?: (nodeId: string) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onConnectionsChange?: (connections: ConnectionData[]) => void;
  onNodeDemandChange?: (nodeId: string, demanda: number) => void;
  onNodesDelete?: (nodeIds: string[]) => void;
  onConnectionsDelete?: (indices: number[]) => void;
  onMapClick?: (lat: number, lng: number) => void;
  overlayPolylines?: OverlayPolyline[];
  height?: number;
  accentColor?: string;
  editable?: boolean;
  /** UTM zone version trigger for CRS re-detection (increment to force re-detect) */
  utmZoneVersion?: number;
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
  onNodesDelete,
  onConnectionsDelete,
  onMapClick,
  overlayPolylines,
  height = 400,
  accentColor = "#3b82f6",
  editable = true,
  utmZoneVersion = 0,
}: NodeMapWidgetProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const linesRef = useRef<L.Polyline[]>([]);
  const overlayRef = useRef<L.Polyline[]>([]);
  const [tileKey, setTileKey] = useState("osm");
  const [linkMode, setLinkMode] = useState(false);
  const [linkOrigin, setLinkOrigin] = useState<string | null>(null);
  const [localConnections, setLocalConnections] = useState<ConnectionData[]>(connections);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editDemanda, setEditDemanda] = useState<number>(0);
  const [mapReady, setMapReady] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"nodes" | "connections" | false>(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [selectedConnsForDelete, setSelectedConnsForDelete] = useState<Set<number>>(new Set());
  const [addNodeMode, setAddNodeMode] = useState(false);

  useEffect(() => { setLocalConnections(connections); }, [connections]);

  // Batch CRS detection for consistent coordinate conversion
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const detectedCRS = useMemo((): DetectedCRS => {
    if (nodes.length === 0) return { type: "unknown" };
    return detectBatchCRS(nodes);
  }, [nodes, utmZoneVersion]);

  const getCoords = useCallback((x: number, y: number): [number, number] => {
    return getMapCoordinatesWithCRS(x, y, detectedCRS);
  }, [detectedCRS]);

  // Init map - always create even if no nodes
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView([-23.55, -46.63], 14);
    const tile = L.tileLayer(TILE_LAYERS.osm.url, { attribution: TILE_LAYERS.osm.attribution, maxZoom: 19 }).addTo(map);
    tileLayerRef.current = tile;
    mapRef.current = map;
    
    // invalidateSize for dynamic containers/tabs (reduced from 5 to 2 timeouts)
    const doInvalidate = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    setTimeout(doInvalidate, 150);
    setTimeout(doInvalidate, 500);

    // ResizeObserver for container visibility changes
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(doInvalidate);
    });
    observer.observe(containerRef.current);
    
    setMapReady(true);
    
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Change tile layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) tileLayerRef.current.remove();
    const cfg = TILE_LAYERS[tileKey] || TILE_LAYERS.osm;
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 }).addTo(map);
  }, [tileKey]);

  // Handle link mode click - improved: auto-continue after linking
  const handleConnClickInternal = useCallback((idx: number) => {
    if (deleteMode === "connections") {
      setSelectedConnsForDelete(prev => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        return next;
      });
    }
  }, [deleteMode]);

  const handleNodeClickInternal = useCallback((nodeId: string) => {
    if (deleteMode === "nodes") {
      setSelectedForDelete(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
      return;
    }
    if (linkMode) {
      if (!linkOrigin) {
        setLinkOrigin(nodeId);
        toast.info(`Origem: ${nodeId} — clique no destino`);
      } else {
        if (nodeId === linkOrigin) { toast.error("Selecione um ponto diferente."); return; }
        const exists = localConnections.some(c =>
          (c.from === linkOrigin && c.to === nodeId) || (c.from === nodeId && c.to === linkOrigin)
        );
        if (exists) { toast.warning("Conexão já existe."); setLinkOrigin(null); return; }
        const newConn: ConnectionData = {
          from: linkOrigin, to: nodeId,
          color: accentColor, label: `${linkOrigin} → ${nodeId}`
        };
        const updated = [...localConnections, newConn];
        setLocalConnections(updated);
        onConnectionsChange?.(updated);
        toast.success(`Trecho ${linkOrigin} → ${nodeId} criado!`);
        setLinkOrigin(nodeId);
        toast.info(`Continuando de ${nodeId} — clique no próximo destino ou ESC para parar`);
      }
    } else {
      setSelectedNode(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (node) setEditDemanda(node.demanda ?? 0);
      onNodeClick?.(nodeId);
    }
  }, [deleteMode, linkMode, linkOrigin, localConnections, accentColor, onConnectionsChange, onNodeClick, nodes]);

  // ESC key to exit link mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (linkMode) {
          setLinkMode(false);
          setLinkOrigin(null);
          toast.info("Modo de ligação desativado");
        }
        if (deleteMode) {
          setDeleteMode(false);
          setSelectedForDelete(new Set());
          setSelectedConnsForDelete(new Set());
          toast.info("Modo de exclusão desativado");
        }
        if (addNodeMode) {
          setAddNodeMode(false);
          toast.info("Modo de adicionar nó desativado");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [linkMode, deleteMode, addNodeMode]);

  // Handle map click for addNodeMode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !addNodeMode || !onMapClick) return;
    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [addNodeMode, onMapClick]);

  // Track last data signature to only fitBounds on actual data changes
  const lastDataSigRef = useRef("");

  // Draw nodes and connections
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();
    
    markersRef.current.forEach(m => m.remove());
    linesRef.current.forEach(l => l.remove());
    markersRef.current = [];
    linesRef.current = [];

    if (nodes.length === 0) return;
    const bounds: L.LatLngExpression[] = [];

    nodes.forEach((n, idx) => {
      const coords = getCoords(n.x, n.y);
      if (!isFinite(coords[0]) || !isFinite(coords[1])) return;
      bounds.push(coords);

      let color = accentColor;
      if (idx === 0) color = "#22c55e";
      else if (idx === nodes.length - 1) color = "#ef4444";
      if (selectedNode === n.id) color = "#f59e0b";
      if (linkMode && linkOrigin === n.id) color = "#f97316";
      if (deleteMode === "nodes" && selectedForDelete.has(n.id)) color = "#dc2626";

      const radius = (linkMode || deleteMode) ? 10 : 8;
      const marker = L.circleMarker(coords, {
        radius, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9,
      }).addTo(map);

      // In link/delete mode use tooltips only (popups block fast clicking)
      if (linkMode || deleteMode) {
        marker.bindTooltip(n.id, { permanent: false, direction: "top", offset: [0, -10] });
      } else {
        const demandaInfo = n.demanda !== undefined ? `<br><b>Demanda:</b> ${n.demanda} L/s` : "";
        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:150px;">
            <strong style="font-size:13px;">${n.id}</strong>
            ${n.label ? `<br><em style="font-size:11px;color:#888;">${n.label}</em>` : ""}
            <hr style="margin:4px 0;border-color:#e2e8f0;">
            <div style="font-size:11px;line-height:1.5;">
              <b>X:</b> ${n.x.toFixed(3)}<br>
              <b>Y:</b> ${n.y.toFixed(3)}
              ${n.cota !== undefined ? `<br><b>Cota:</b> ${n.cota.toFixed(3)}m` : ""}
              ${demandaInfo}
            </div>
          </div>
        `);
      }

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        handleNodeClickInternal(n.id);
      });
      markersRef.current.push(marker);
    });

    localConnections.forEach((c, idx) => {
      const from = nodes.find(n => n.id === c.from);
      const to = nodes.find(n => n.id === c.to);
      if (!from || !to) return;
      const fromCoords = getCoords(from.x, from.y);
      const toCoords = getCoords(to.x, to.y);
      if (!isFinite(fromCoords[0]) || !isFinite(toCoords[0])) return;
      const isSelectedForDel = deleteMode === "connections" && selectedConnsForDelete.has(idx);

      // Build polyline path: start → intermediate vertices → end
      const intermediatePts: [number, number][] = c.vertices
        ? c.vertices.map(v => getCoords(v[0], v[1])).filter(pt => isFinite(pt[0]) && isFinite(pt[1]))
        : [];
      const pathPoints: [number, number][] = [fromCoords, ...intermediatePts, toCoords];

      const line = L.polyline(pathPoints, {
        color: isSelectedForDel ? "#dc2626" : (c.color || accentColor),
        weight: isSelectedForDel ? 6 : 3,
        opacity: isSelectedForDel ? 1 : 0.8,
      }).addTo(map);
      if (c.label) line.bindTooltip(c.label || `${c.from} → ${c.to}`, { sticky: true });
      line.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        handleConnClickInternal(idx);
      });
      linesRef.current.push(line);
    });

    // Only fitBounds when actual data changes (not selection/mode changes)
    const dataSig = `${nodes.map(n => n.id).join(",")}|${localConnections.length}`;
    if (bounds.length > 0 && dataSig !== lastDataSigRef.current) {
      lastDataSigRef.current = dataSig;
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 18 });
      } catch (e) {
        map.setView(bounds[0] as L.LatLngExpression, 15);
      }
      setTimeout(() => map.invalidateSize(), 200);
      setTimeout(() => map.invalidateSize(), 500);
    }
  }, [nodes, localConnections, getCoords, accentColor, handleNodeClickInternal, handleConnClickInternal, selectedNode, linkMode, linkOrigin, deleteMode, selectedForDelete, selectedConnsForDelete]);

  // Draw overlay polylines (contour lines, etc.)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    overlayRef.current.forEach(l => l.remove());
    overlayRef.current = [];
    if (!overlayPolylines || overlayPolylines.length === 0) return;
    for (const poly of overlayPolylines) {
      if (poly.points.length < 2) continue;
      const line = L.polyline(poly.points, {
        color: poly.color || "#8B5CF6",
        weight: poly.weight || 1.5,
        opacity: poly.opacity || 0.6,
      }).addTo(map);
      if (poly.label) line.bindTooltip(poly.label, { sticky: true });
      overlayRef.current.push(line);
    }
  }, [overlayPolylines]);

  const handleUndo = () => {
    if (localConnections.length === 0) return;
    const updated = localConnections.slice(0, -1);
    setLocalConnections(updated);
    onConnectionsChange?.(updated);
    toast.info("Última conexão removida.");
  };

  const handleDeleteConnection = (from: string, to: string) => {
    const updated = localConnections.filter(c => !(c.from === from && c.to === to));
    setLocalConnections(updated);
    onConnectionsChange?.(updated);
    toast.info(`Conexão ${from} → ${to} removida.`);
  };

  const handleClearMap = () => {
    if (!confirm("Limpar todas as conexões do mapa? (Os pontos/nós serão mantidos)")) return;
    setLocalConnections([]);
    onConnectionsChange?.([]);
    setLinkOrigin(null);
    setLinkMode(false);
    setSelectedNode(null);
    // Only clear polylines, NOT markers (nodes stay visible)
    linesRef.current.forEach(l => l.remove());
    linesRef.current = [];
    toast.success("Conexões do mapa limpas (nós mantidos).");
  };

  const handleSaveDemand = () => {
    if (selectedNode && onNodeDemandChange) {
      onNodeDemandChange(selectedNode, editDemanda);
      toast.success(`Demanda de ${selectedNode} atualizada para ${editDemanda} L/s`);
    }
  };

  const toggleLinkMode = () => {
    if (deleteMode) { setDeleteMode(false); setSelectedForDelete(new Set()); }
    const newMode = !linkMode;
    setLinkMode(newMode);
    setLinkOrigin(null);
    if (newMode) toast.info("Modo ligar pontos ativo: clique no ponto de origem, depois no destino. ESC para sair.");
    else toast.info("Modo ligar pontos desativado.");
  };

  const toggleDeleteMode = (mode: "nodes" | "connections") => {
    if (linkMode) { setLinkMode(false); setLinkOrigin(null); }
    if (deleteMode === mode) {
      setDeleteMode(false);
      setSelectedForDelete(new Set());
      setSelectedConnsForDelete(new Set());
    } else {
      setDeleteMode(mode);
      setSelectedForDelete(new Set());
      setSelectedConnsForDelete(new Set());
      toast.info(mode === "nodes" ? "Modo excluir nós ativo. ESC para sair." : "Modo excluir trechos ativo: clique nos trechos. ESC para sair.");
    }
  };

  const handleDeleteSelected = () => {
    if (deleteMode === "nodes") {
      if (selectedForDelete.size === 0) { toast.error("Nenhum nó selecionado"); return; }
      const ids = Array.from(selectedForDelete);
      if (!confirm(`Excluir ${ids.length} nó(s)? (${ids.join(", ")})`)) return;
      const updatedConns = localConnections.filter(c => !selectedForDelete.has(c.from) && !selectedForDelete.has(c.to));
      setLocalConnections(updatedConns);
      onConnectionsChange?.(updatedConns);
      onNodesDelete?.(ids);
      setSelectedForDelete(new Set());
      setDeleteMode(false);
      toast.success(`${ids.length} nó(s) excluído(s)`);
    } else if (deleteMode === "connections") {
      if (selectedConnsForDelete.size === 0) { toast.error("Nenhum trecho selecionado"); return; }
      if (!confirm(`Excluir ${selectedConnsForDelete.size} trecho(s)?`)) return;
      const updatedConns = localConnections.filter((_, idx) => !selectedConnsForDelete.has(idx));
      setLocalConnections(updatedConns);
      onConnectionsChange?.(updatedConns);
      setSelectedConnsForDelete(new Set());
      setDeleteMode(false);
      toast.success(`${selectedConnsForDelete.size} trecho(s) excluído(s)`);
    }
  };

  const handleSelectAllForDelete = () => {
    if (deleteMode === "nodes") {
      if (selectedForDelete.size === nodes.length) setSelectedForDelete(new Set());
      else setSelectedForDelete(new Set(nodes.map(n => n.id)));
    } else if (deleteMode === "connections") {
      if (selectedConnsForDelete.size === localConnections.length) setSelectedConnsForDelete(new Set());
      else setSelectedConnsForDelete(new Set(localConnections.map((_, i) => i)));
    }
  };

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
            const bounds = nodes.map(n => getCoords(n.x, n.y)).filter(c => isFinite(c[0]) && isFinite(c[1]));
            if (bounds.length > 0) {
              mapRef.current?.fitBounds(L.latLngBounds(bounds), { padding: [25, 25], maxZoom: 18 });
            }
          }}>
            <Maximize className="h-3 w-3 mr-1" /> Ajustar
          </Button>
          {editable && (
            <>
              {onMapClick && (
                <Button size="sm" variant={addNodeMode ? "default" : "outline"} onClick={() => {
                  if (linkMode) { setLinkMode(false); setLinkOrigin(null); }
                  if (deleteMode) { setDeleteMode(false); setSelectedForDelete(new Set()); setSelectedConnsForDelete(new Set()); }
                  const newMode = !addNodeMode;
                  setAddNodeMode(newMode);
                  if (newMode) toast.info("Clique no mapa para adicionar nó. ESC para sair.");
                  else toast.info("Modo de adicionar nó desativado.");
                }} className={addNodeMode ? "bg-green-600 hover:bg-green-700 text-white" : ""}>
                  <Plus className="h-3 w-3 mr-1" /> {addNodeMode ? "Adicionando..." : "Adicionar Nó"}
                </Button>
              )}
              <Button size="sm" variant={linkMode ? "default" : "outline"} onClick={toggleLinkMode}
                className={linkMode ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}>
                <Link2 className="h-3 w-3 mr-1" /> {linkMode ? "Ligando..." : "Ligar Pontos"}
              </Button>
              {onNodesDelete && (
                <Button size="sm" variant={deleteMode === "nodes" ? "default" : "outline"} onClick={() => toggleDeleteMode("nodes")}
                  className={deleteMode === "nodes" ? "bg-red-600 hover:bg-red-700 text-white" : ""}>
                  <MousePointerClick className="h-3 w-3 mr-1" /> {deleteMode === "nodes" ? "Selecionando Nós..." : "Excluir Nós"}
                </Button>
              )}
              <Button size="sm" variant={deleteMode === "connections" ? "default" : "outline"} onClick={() => toggleDeleteMode("connections")}
                className={deleteMode === "connections" ? "bg-red-600 hover:bg-red-700 text-white" : ""}>
                <Trash2 className="h-3 w-3 mr-1" /> {deleteMode === "connections" ? "Selecionando Trechos..." : "Excluir Trechos"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleUndo} disabled={localConnections.length === 0}>
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

        {/* Add node mode status */}
        {addNodeMode && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200">
            <Plus className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Clique no mapa para adicionar um nó. ESC para sair.
            </span>
            <Button size="sm" variant="ghost" className="h-6 text-xs ml-auto" onClick={() => setAddNodeMode(false)}>
              <X className="h-3 w-3 mr-1" /> Sair
            </Button>
          </div>
        )}

        {/* Link mode status */}
        {linkMode && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200">
            <Link2 className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
              {linkOrigin ? `Origem: ${linkOrigin} — clique no destino (encadeamento automático)` : "Clique no ponto de origem"}
            </span>
            <div className="ml-auto flex gap-1">
              {linkOrigin && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setLinkOrigin(null)}>Resetar Origem</Button>
              )}
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setLinkMode(false); setLinkOrigin(null); }}>
                <X className="h-3 w-3 mr-1" /> Sair
              </Button>
            </div>
          </div>
        )}

        {/* Delete mode status */}
        {deleteMode && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200">
            <MousePointerClick className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              {deleteMode === "nodes"
                ? (selectedForDelete.size > 0 ? `${selectedForDelete.size} nó(s) selecionado(s)` : "Clique nos nós para selecionar")
                : (selectedConnsForDelete.size > 0 ? `${selectedConnsForDelete.size} trecho(s) selecionado(s)` : "Clique nos trechos para selecionar")}
            </span>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleSelectAllForDelete}>
                {(deleteMode === "nodes" ? selectedForDelete.size === nodes.length : selectedConnsForDelete.size === localConnections.length)
                  ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
              <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={handleDeleteSelected}
                disabled={deleteMode === "nodes" ? selectedForDelete.size === 0 : selectedConnsForDelete.size === 0}>
                <Trash2 className="h-3 w-3 mr-1" /> Excluir ({deleteMode === "nodes" ? selectedForDelete.size : selectedConnsForDelete.size})
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setDeleteMode(false); setSelectedForDelete(new Set()); setSelectedConnsForDelete(new Set()); }}>
                <X className="h-3 w-3 mr-1" /> Sair
              </Button>
            </div>
          </div>
        )}

        {/* Map - always render the container */}
        <div ref={containerRef} className="w-full rounded-lg border border-border overflow-hidden" style={{ height }} />

        {nodes.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-2">
            Carregue ou adicione nós para visualizar no mapa
          </div>
        )}

        {/* Selected node editor */}
        {editable && selectedNode && onNodeDemandChange && !linkMode && !deleteMode && (
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

        {/* Connections list - editable */}
        {editable && localConnections.length > 0 && (
          <div className="max-h-32 overflow-auto border border-border rounded-lg p-2">
            <p className="text-xs font-medium mb-1">Conexões ({localConnections.length})</p>
            <div className="space-y-1">
              {localConnections.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                  <span>{c.from} → {c.to}</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleDeleteConnection(c.from, c.to)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500" /> Início</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /> Fim</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} /> Intermediário</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500" /> Selecionado</div>
          {linkMode && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-500" /> Origem (ligação)</div>}
          {deleteMode && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-600" /> Selecionado p/ exclusão</div>}
        </div>
      </CardContent>
    </Card>
  );
};