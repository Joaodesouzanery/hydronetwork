import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  MapPin, Plus, Minus, Trash2, Undo2, Save,
  FolderOpen, Maximize, Link2, Layers, X, Crosshair, MousePointerClick, Move, RefreshCw
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho, createTrechoFromPoints } from "@/engine/domain";
import { detectBatchCRS, getMapCoordinatesWithCRS, setGlobalUtmZone, getGlobalUtmZone, DetectedCRS } from "@/engine/hydraulics";
import { CoordinateTransformDialog } from "@/components/hydronetwork/CoordinateTransformDialog";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface TopographyMapProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange?: (trechos: Trecho[]) => void;
  onClearAll?: () => void;
  onPontosChange?: (pontos: PontoTopografico[]) => void;
}

const STORAGE_KEY = "hydronetwork_trechos";

const TILE_LAYERS: Record<string, { url: string; attribution: string; name: string }> = {
  osm: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap", name: "OpenStreetMap" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri", name: "Satélite (Esri)" },
  topo: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "© OpenTopoMap", name: "Topográfico" },
  dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: "© CartoDB", name: "Escuro" },
  light: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attribution: "© CartoDB", name: "Claro" },
  terrain: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri", name: "Ruas" },
};

export const TopographyMap = ({ pontos, trechos, onTrechosChange, onClearAll, onPontosChange }: TopographyMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [addNodeMode, setAddNodeMode] = useState(false);
  const [drawOrigin, setDrawOrigin] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<"nodes" | "trechos" | false>(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [selectedTrechosForDelete, setSelectedTrechosForDelete] = useState<Set<number>>(new Set());
  const [bulkMoveMode, setBulkMoveMode] = useState(false);
  const [bulkMoveStart, setBulkMoveStart] = useState<L.LatLng | null>(null);
  const [showTransformDialog, setShowTransformDialog] = useState(false);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const [tileKey, setTileKey] = useState("osm");
  const [utmZone, setUtmZone] = useState<string>(String(getGlobalUtmZone() || "auto"));
  const [utmZoneVersion, setUtmZoneVersion] = useState(0);

  // Batch CRS detection: analyze ALL points together for consistent conversion
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const detectedCRS = useMemo((): DetectedCRS => {
    if (pontos.length === 0) return { type: "unknown" };
    return detectBatchCRS(pontos);
  }, [pontos, utmZoneVersion]);

  const getPointCoords = useCallback((p: PontoTopografico): [number, number] => {
    return getMapCoordinatesWithCRS(p.x, p.y, detectedCRS);
  }, [detectedCRS]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([-23.55, -46.63], 14);
    const tile = L.tileLayer(TILE_LAYERS.osm.url, { attribution: TILE_LAYERS.osm.attribution, maxZoom: 19 }).addTo(map);
    tileLayerRef.current = tile;
    mapRef.current = map;

    const doInvalidate = () => { if (mapRef.current) mapRef.current.invalidateSize(); };
    setTimeout(doInvalidate, 100);
    setTimeout(doInvalidate, 300);
    setTimeout(doInvalidate, 600);
    setTimeout(doInvalidate, 1000);
    setTimeout(doInvalidate, 2000);

    const observer = new ResizeObserver(() => setTimeout(doInvalidate, 50));
    observer.observe(mapContainerRef.current);

    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // Change tile layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) tileLayerRef.current.remove();
    const cfg = TILE_LAYERS[tileKey] || TILE_LAYERS.osm;
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 }).addTo(map);
  }, [tileKey]);

  // ESC key to exit modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (drawMode) { setDrawMode(false); setDrawOrigin(null); toast.info("Modo ligação desativado"); }
        if (addNodeMode) { setAddNodeMode(false); toast.info("Modo adicionar ponto desativado"); }
        if (deleteMode) { setDeleteMode(false); setSelectedForDelete(new Set()); setSelectedTrechosForDelete(new Set()); toast.info("Modo exclusão desativado"); }
        if (bulkMoveMode) { setBulkMoveMode(false); setBulkMoveStart(null); toast.info("Modo mover em massa desativado"); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawMode, addNodeMode, deleteMode, bulkMoveMode]);

  // UTM zone change handler
  const handleUtmZoneChange = useCallback((value: string) => {
    setUtmZone(value);
    if (value === "auto") {
      setGlobalUtmZone(undefined);
    } else {
      setGlobalUtmZone(parseInt(value));
    }
    setUtmZoneVersion(v => v + 1); // trigger CRS re-detection
    if (mapRef.current && pontos.length > 0) {
      toast.success(`Fuso UTM alterado para ${value === "auto" ? "automático" : `zona ${value}`}`);
    }
  }, [pontos]);

  // Handle map click for adding nodes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!addNodeMode || !onPontosChange) return;
      const { lat, lng } = e.latlng;
      const newId = `P${String(pontos.length + 1).padStart(3, "0")}`;
      const newPoint: PontoTopografico = { id: newId, x: lng, y: lat, cota: 0 };
      onPontosChange([...pontos, newPoint]);
      toast.success(`Ponto ${newId} adicionado (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
    };

    map.on("click", handleMapClick);
    return () => { map.off("click", handleMapClick); };
  }, [addNodeMode, pontos, onPontosChange]);

  // Handle bulk move mode - click to set origin, then click to set destination
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bulkMoveMode || !onPontosChange) return;

    const handleBulkMoveClick = (e: L.LeafletMouseEvent) => {
      if (!bulkMoveMode) return;

      if (!bulkMoveStart) {
        setBulkMoveStart(e.latlng);
        toast.info("Ponto de origem marcado. Agora clique onde os pontos devem estar.");
      } else {
        // Calculate offset in map coordinates and apply to all pontos
        const startLatLng = bulkMoveStart;
        const endLatLng = e.latlng;

        // For UTM data, we need the delta in UTM coords
        // We'll use a simple approach: apply delta in lat/lng to get approximate offset
        const deltaLat = endLatLng.lat - startLatLng.lat;
        const deltaLng = endLatLng.lng - startLatLng.lng;

        // Check if data is UTM (large coordinate values) or geographic
        const isUTMData = pontos.length > 0 && (Math.abs(pontos[0].x) > 1000 || Math.abs(pontos[0].y) > 1000);

        if (isUTMData) {
          // For UTM data: convert both clicks to UTM space to get delta
          // Approximate: 1 degree lat ≈ 111320m, 1 degree lng ≈ 111320 * cos(lat)
          const cosLat = Math.cos(startLatLng.lat * Math.PI / 180);
          const deltaXMeters = deltaLng * 111320 * cosLat;
          const deltaYMeters = deltaLat * 111320;

          const newPontos = pontos.map(p => ({
            ...p,
            x: p.x + deltaXMeters,
            y: p.y + deltaYMeters,
          }));
          onPontosChange(newPontos);
          toast.success(`${pontos.length} pontos movidos: dX=${deltaXMeters.toFixed(1)}m, dY=${deltaYMeters.toFixed(1)}m`);
        } else {
          // For geographic data, apply lat/lng delta directly
          const newPontos = pontos.map(p => ({
            ...p,
            x: p.x + deltaLng,
            y: p.y + deltaLat,
          }));
          onPontosChange(newPontos);
          toast.success(`${pontos.length} pontos movidos: dLat=${deltaLat.toFixed(6)}, dLng=${deltaLng.toFixed(6)}`);
        }

        setBulkMoveMode(false);
        setBulkMoveStart(null);
      }
    };

    map.on("click", handleBulkMoveClick);
    return () => { map.off("click", handleBulkMoveClick); };
  }, [bulkMoveMode, bulkMoveStart, pontos, onPontosChange]);

  // Handle transform dialog result
  const handleTransformResult = useCallback((newPontos: PontoTopografico[], newTrechos: Trecho[]) => {
    onPontosChange?.(newPontos);
    onTrechosChange?.(newTrechos);
    toast.success(`Coordenadas transformadas: ${newPontos.length} pontos e ${newTrechos.length} trechos atualizados.`);
  }, [onPontosChange, onTrechosChange]);

  // Handle marker click - draw mode or select mode
  const handleTrechoClick = useCallback((idx: number) => {
    if (deleteMode === "trechos") {
      setSelectedTrechosForDelete(prev => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        return next;
      });
    }
  }, [deleteMode]);

  const handleMarkerClick = useCallback((pointId: string) => {
    if (deleteMode === "nodes") {
      setSelectedForDelete(prev => {
        const next = new Set(prev);
        if (next.has(pointId)) next.delete(pointId);
        else next.add(pointId);
        return next;
      });
      return;
    }
    if (drawMode) {
      if (!drawOrigin) {
        setDrawOrigin(pointId);
        toast.info(`Origem: ${pointId} — clique no destino`);
      } else {
        if (pointId === drawOrigin) {
          toast.error("Selecione um ponto diferente para o destino.");
          return;
        }
        const exists = trechos.some(t =>
          (t.idInicio === drawOrigin && t.idFim === pointId) ||
          (t.idInicio === pointId && t.idFim === drawOrigin)
        );
        if (exists) {
          toast.warning("Trecho já existe entre esses pontos.");
          setDrawOrigin(null);
          return;
        }
        const pOrigem = pontos.find(p => p.id === drawOrigin);
        const pDestino = pontos.find(p => p.id === pointId);
        if (pOrigem && pDestino) {
          const novoTrecho = createTrechoFromPoints(pOrigem, pDestino);
          onTrechosChange?.([...trechos, novoTrecho]);
          toast.success(`Trecho ${drawOrigin} → ${pointId} criado!`);
        }
        setDrawOrigin(pointId);
        toast.info(`Continuando de ${pointId} — clique no próximo destino ou ESC para parar`);
      }
    } else {
      setSelectedPoint(prev => prev === pointId ? null : pointId);
    }
  }, [deleteMode, drawMode, drawOrigin, pontos, trechos, onTrechosChange]);

  // Track last data signature to only fitBounds on actual data changes
  const lastDataSigRef = useRef("");

  // Draw points and segments
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();

    markersRef.current.forEach(m => m.remove());
    polylinesRef.current.forEach(p => p.remove());
    markersRef.current = [];
    polylinesRef.current = [];

    if (pontos.length === 0) return;

    const bounds: L.LatLngExpression[] = [];

    pontos.forEach((p, idx) => {
      const coords = getPointCoords(p);
      if (!isFinite(coords[0]) || !isFinite(coords[1])) return;
      bounds.push(coords);

      let color = "#3b82f6";
      if (idx === 0) color = "#22c55e";
      else if (idx === pontos.length - 1) color = "#ef4444";
      if (drawMode && drawOrigin === p.id) color = "#f97316";
      if (!drawMode && !deleteMode && selectedPoint === p.id) color = "#f59e0b";
      if (deleteMode === "nodes" && selectedForDelete.has(p.id)) color = "#dc2626";

      const radius = (drawMode || deleteMode) ? 11 : 8;

      const marker = L.circleMarker(coords, {
        radius, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9,
      }).addTo(map);

      // In draw/delete mode, use tooltips (don't block clicks). Otherwise popups.
      if (drawMode || deleteMode) {
        marker.bindTooltip(p.id, { permanent: false, direction: "top", offset: [0, -10] });
      } else {
        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:150px;">
            <strong style="font-size:14px;">${p.id}</strong>
            <hr style="margin:4px 0;border-color:#e2e8f0;">
            <div style="font-size:12px;line-height:1.6;">
              <b>X:</b> ${p.x.toFixed(3)}<br>
              <b>Y:</b> ${p.y.toFixed(3)}<br>
              <b>Cota:</b> ${p.cota.toFixed(3)}m
            </div>
          </div>
        `);
      }

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        handleMarkerClick(p.id);
      });
      markersRef.current.push(marker);
    });

    trechos.forEach((t, idx) => {
      const pInicio = pontos.find(p => p.id === t.idInicio);
      const pFim = pontos.find(p => p.id === t.idFim);
      if (!pInicio || !pFim) return;
      const isGravity = t.tipoRede === "Esgoto por Gravidade";
      const isSelectedForDel = deleteMode === "trechos" && selectedTrechosForDelete.has(idx);

      const polyline = L.polyline([getPointCoords(pInicio), getPointCoords(pFim)], {
        color: isSelectedForDel ? "#dc2626" : isGravity ? "#22c55e" : "#f59e0b",
        weight: isSelectedForDel ? 6 : 4,
        opacity: isSelectedForDel ? 1 : 0.8,
      }).addTo(map);

      polyline.bindTooltip(`${t.idInicio} → ${t.idFim} (${t.comprimento.toFixed(1)}m)`, { sticky: true });
      if (deleteMode !== "trechos") {
        polyline.bindPopup(`
          <div style="font-family:sans-serif;min-width:180px;">
            <strong>${t.idInicio} → ${t.idFim}</strong>
            <hr style="margin:4px 0;">
            <div style="font-size:12px;line-height:1.6;">
              <b>Comprimento:</b> ${t.comprimento.toFixed(2)}m<br>
              <b>Declividade:</b> ${(t.declividade * 100).toFixed(2)}%<br>
              <b>Tipo:</b> ${isGravity ? "Gravidade" : "Elevatória"}<br>
              <b>Diâmetro:</b> DN${t.diametroMm}<br>
              <b>Material:</b> ${t.material}
            </div>
          </div>
        `);
      }
      polyline.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        handleTrechoClick(idx);
      });
      polylinesRef.current.push(polyline);
    });

    // Only fitBounds when actual data changes, not selection state
    const dataSig = `${pontos.map(p => p.id).join(",")}|${trechos.length}`;
    if (bounds.length > 0 && dataSig !== lastDataSigRef.current) {
      lastDataSigRef.current = dataSig;
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 18 });
      } catch {
        map.setView(bounds[0] as L.LatLngExpression, 15);
      }
      setTimeout(() => map.invalidateSize(), 200);
      setTimeout(() => map.invalidateSize(), 500);
    }
  }, [pontos, trechos, getPointCoords, handleMarkerClick, handleTrechoClick, drawMode, drawOrigin, selectedPoint, deleteMode, selectedForDelete, selectedTrechosForDelete]);

  const handleFitBounds = () => {
    if (pontos.length === 0) return;
    const bounds = pontos.map(p => getPointCoords(p)).filter(c => isFinite(c[0]) && isFinite(c[1]));
    if (bounds.length > 0) mapRef.current?.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
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
    onTrechosChange?.([]);
    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = [];
    setDrawOrigin(null);
    setSelectedPoint(null);
    toast.success("Trechos do mapa limpos. Pontos mantidos.");
  };

  const toggleDrawMode = () => {
    if (deleteMode) { setDeleteMode(false); setSelectedForDelete(new Set()); }
    const newMode = !drawMode;
    setDrawMode(newMode);
    setDrawOrigin(null);
    setSelectedPoint(null);
    if (newMode) toast.info("Modo ligar pontos ativo: clique origem → destino. Encadeamento automático! ESC para sair.");
    else toast.info("Modo ligação desativado.");
  };

  const toggleDeleteMode = (mode: "nodes" | "trechos") => {
    if (drawMode) { setDrawMode(false); setDrawOrigin(null); }
    if (addNodeMode) setAddNodeMode(false);
    if (deleteMode === mode) {
      setDeleteMode(false);
      setSelectedForDelete(new Set());
      setSelectedTrechosForDelete(new Set());
      toast.info("Modo exclusão desativado.");
    } else {
      setDeleteMode(mode);
      setSelectedForDelete(new Set());
      setSelectedTrechosForDelete(new Set());
      setSelectedPoint(null);
      toast.info(mode === "nodes"
        ? "Modo excluir nós: clique para selecionar, depois confirme. ESC para sair."
        : "Modo excluir trechos: clique nos trechos para selecionar. ESC para sair.");
    }
  };

  const handleDeleteSelected = () => {
    if (deleteMode === "nodes") {
      if (selectedForDelete.size === 0) { toast.error("Nenhum nó selecionado."); return; }
      const ids = Array.from(selectedForDelete);
      if (!confirm(`Excluir ${ids.length} ponto(s)? (${ids.join(", ")})\nTrechos conectados serão removidos automaticamente.`)) return;
      const updatedTrechos = trechos.filter(t => !selectedForDelete.has(t.idInicio) && !selectedForDelete.has(t.idFim));
      onTrechosChange?.(updatedTrechos);
      const updatedPontos = pontos.filter(p => !selectedForDelete.has(p.id));
      onPontosChange?.(updatedPontos);
      setSelectedForDelete(new Set());
      setDeleteMode(false);
      toast.success(`${ids.length} ponto(s) excluído(s) e ${trechos.length - updatedTrechos.length} trecho(s) removido(s).`);
    } else if (deleteMode === "trechos") {
      if (selectedTrechosForDelete.size === 0) { toast.error("Nenhum trecho selecionado."); return; }
      if (!confirm(`Excluir ${selectedTrechosForDelete.size} trecho(s)?`)) return;
      const updatedTrechos = trechos.filter((_, idx) => !selectedTrechosForDelete.has(idx));
      onTrechosChange?.(updatedTrechos);
      setSelectedTrechosForDelete(new Set());
      setDeleteMode(false);
      toast.success(`${selectedTrechosForDelete.size} trecho(s) excluído(s).`);
    }
  };

  const handleSelectAllForDelete = () => {
    if (deleteMode === "nodes") {
      if (selectedForDelete.size === pontos.length) setSelectedForDelete(new Set());
      else setSelectedForDelete(new Set(pontos.map(p => p.id)));
    } else if (deleteMode === "trechos") {
      if (selectedTrechosForDelete.size === trechos.length) setSelectedTrechosForDelete(new Set());
      else setSelectedTrechosForDelete(new Set(trechos.map((_, i) => i)));
    }
  };

  if (pontos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" /> Mapa Interativo
          <Badge variant="secondary" className="ml-auto">{pontos.length} pontos · {trechos.length} trechos</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Toolbar - inline like EPANET */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <Button size="sm" variant="outline" onClick={handleFitBounds}>
            <Maximize className="h-3 w-3 mr-1" /> Ajustar
          </Button>
          <Button size="sm" variant={drawMode ? "default" : "outline"} onClick={toggleDrawMode}
            className={drawMode ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}>
            <Link2 className="h-3 w-3 mr-1" /> {drawMode ? "Ligando..." : "Ligar Pontos"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => mapRef.current?.zoomIn()}><Plus className="h-3 w-3" /></Button>
          <Button size="sm" variant="outline" onClick={() => mapRef.current?.zoomOut()}><Minus className="h-3 w-3" /></Button>
          <Button size="sm" variant="outline" onClick={handleUndo} disabled={trechos.length === 0}>
            <Undo2 className="h-3 w-3 mr-1" /> Desfazer
          </Button>
          <Button size="sm" variant="destructive" onClick={handleClearAll}>
            <Trash2 className="h-3 w-3 mr-1" /> Limpar
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Save className="h-3 w-3 mr-1" /> Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={handleLoad}>
            <FolderOpen className="h-3 w-3 mr-1" /> Carregar
          </Button>
          <Button size="sm" variant={addNodeMode ? "default" : "outline"} onClick={() => {
            const newMode = !addNodeMode;
            setAddNodeMode(newMode);
            if (newMode) { setDrawMode(false); setDrawOrigin(null); }
            toast.info(newMode ? "Clique no mapa para adicionar pontos. ESC para sair." : "Modo adicionar ponto desativado.");
          }} className={addNodeMode ? "bg-green-600 hover:bg-green-700 text-white" : ""} disabled={!onPontosChange}>
            <Crosshair className="h-3 w-3 mr-1" /> {addNodeMode ? "Adicionando..." : "Adicionar Ponto"}
          </Button>
          {onPontosChange && (
            <Button size="sm" variant={deleteMode === "nodes" ? "default" : "outline"} onClick={() => toggleDeleteMode("nodes")}
              className={deleteMode === "nodes" ? "bg-red-600 hover:bg-red-700 text-white" : ""}>
              <MousePointerClick className="h-3 w-3 mr-1" /> {deleteMode === "nodes" ? "Selecionando Nós..." : "Excluir Nós"}
            </Button>
          )}
          <Button size="sm" variant={deleteMode === "trechos" ? "default" : "outline"} onClick={() => toggleDeleteMode("trechos")}
            className={deleteMode === "trechos" ? "bg-red-600 hover:bg-red-700 text-white" : ""}>
            <Trash2 className="h-3 w-3 mr-1" /> {deleteMode === "trechos" ? "Selecionando Trechos..." : "Excluir Trechos"}
          </Button>
          {/* Bulk move button */}
          {onPontosChange && (
            <Button size="sm" variant={bulkMoveMode ? "default" : "outline"} onClick={() => {
              const newMode = !bulkMoveMode;
              setBulkMoveMode(newMode);
              setBulkMoveStart(null);
              if (newMode) {
                setDrawMode(false); setDrawOrigin(null); setAddNodeMode(false); setDeleteMode(false);
                toast.info("Mover em Massa: clique no ponto de referência (posição errada), depois clique onde deveria estar. ESC para cancelar.");
              } else { toast.info("Modo mover em massa desativado."); }
            }} className={bulkMoveMode ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}>
              <Move className="h-3 w-3 mr-1" /> {bulkMoveMode ? "Movendo..." : "Mover em Massa"}
            </Button>
          )}
          {/* Transform Coordinates dialog trigger */}
          <Button size="sm" variant="outline" onClick={() => setShowTransformDialog(true)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Transformar CRS
          </Button>
          {/* UTM Zone selector */}
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-muted-foreground">UTM:</span>
            <Select value={utmZone} onValueChange={handleUtmZoneChange}>
              <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (23)</SelectItem>
                {Array.from({ length: 8 }, (_, i) => i + 18).map(z => (
                  <SelectItem key={z} value={String(z)}>Zona {z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Layer selector inline */}
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

        {/* Add node mode status bar */}
        {addNodeMode && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200">
            <Crosshair className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Clique no mapa para adicionar um novo ponto topográfico
            </span>
            <Button size="sm" variant="ghost" className="h-6 text-xs ml-auto" onClick={() => setAddNodeMode(false)}>
              <X className="h-3 w-3 mr-1" /> Sair (ESC)
            </Button>
          </div>
        )}

        {/* Draw mode status bar */}
        {drawMode && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200">
            <Link2 className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
              {drawOrigin
                ? `Origem: ${drawOrigin} — clique no destino (encadeamento automático)`
                : "Clique no ponto de origem"}
            </span>
            <div className="ml-auto flex gap-1">
              {drawOrigin && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setDrawOrigin(null)}>Resetar Origem</Button>
              )}
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setDrawMode(false); setDrawOrigin(null); }}>
                <X className="h-3 w-3 mr-1" /> Sair (ESC)
              </Button>
            </div>
          </div>
        )}

        {/* Delete mode status bar */}
        {deleteMode && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200">
            <MousePointerClick className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              {deleteMode === "nodes"
                ? (selectedForDelete.size > 0 ? `${selectedForDelete.size} ponto(s) selecionado(s)` : "Clique nos pontos para selecionar")
                : (selectedTrechosForDelete.size > 0 ? `${selectedTrechosForDelete.size} trecho(s) selecionado(s)` : "Clique nos trechos para selecionar")}
            </span>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleSelectAllForDelete}>
                {(deleteMode === "nodes" ? selectedForDelete.size === pontos.length : selectedTrechosForDelete.size === trechos.length) ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
              <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={handleDeleteSelected}
                disabled={deleteMode === "nodes" ? selectedForDelete.size === 0 : selectedTrechosForDelete.size === 0}>
                <Trash2 className="h-3 w-3 mr-1" /> Excluir ({deleteMode === "nodes" ? selectedForDelete.size : selectedTrechosForDelete.size})
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setDeleteMode(false); setSelectedForDelete(new Set()); setSelectedTrechosForDelete(new Set()); }}>
                <X className="h-3 w-3 mr-1" /> Sair (ESC)
              </Button>
            </div>
          </div>
        )}

        {/* Bulk move status bar */}
        {bulkMoveMode && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200">
            <Move className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
              {bulkMoveStart
                ? "Agora clique onde os pontos devem estar (posição correta)"
                : "Clique no mapa na posição de referência (posição errada)"}
            </span>
            <div className="ml-auto flex gap-1">
              {bulkMoveStart && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setBulkMoveStart(null)}>Resetar</Button>
              )}
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setBulkMoveMode(false); setBulkMoveStart(null); }}>
                <X className="h-3 w-3 mr-1" /> Sair (ESC)
              </Button>
            </div>
          </div>
        )}

        {/* Map */}
        <div
          ref={mapContainerRef}
          className="w-full rounded-lg border border-border overflow-hidden"
          style={{ height: 450, position: "relative", zIndex: 0 }}
        />

        {/* Selected point info (outside draw mode) */}
        {!drawMode && selectedPoint && (() => {
          const pt = pontos.find(p => p.id === selectedPoint);
          if (!pt) return null;
          return (
            <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{pt.id}</span>
              <span className="text-muted-foreground">X: {pt.x.toFixed(3)}</span>
              <span className="text-muted-foreground">Y: {pt.y.toFixed(3)}</span>
              <span className="text-muted-foreground">Cota: {pt.cota.toFixed(3)}m</span>
              <Button size="sm" variant="ghost" className="h-6 text-xs ml-auto" onClick={() => setSelectedPoint(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })()}

        {/* Connections list with individual delete */}
        {trechos.length > 0 && (
          <div className="max-h-32 overflow-auto border border-border rounded-lg p-2">
            <p className="text-xs font-medium mb-1">Trechos ({trechos.length})</p>
            <div className="space-y-1">
              {trechos.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                  <span>{t.idInicio} → {t.idFim} ({t.comprimento.toFixed(1)}m)</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => {
                    const updated = trechos.filter((_, idx) => idx !== i);
                    onTrechosChange?.(updated);
                    toast.info(`Trecho ${t.idInicio} → ${t.idFim} removido.`);
                  }}>
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
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500" /> Intermediário</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500" /> Selecionado</div>
          {drawMode && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-500" /> Origem (ligação)</div>}
          {deleteMode && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-600" /> Selecionado p/ exclusão</div>}
          {bulkMoveMode && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-600" /> Mover em massa</div>}
          <div className="flex items-center gap-1"><div className="w-4 h-1 bg-green-500 rounded" /> Gravidade</div>
          <div className="flex items-center gap-1"><div className="w-4 h-1 bg-orange-500 rounded" /> Elevatória</div>
        </div>

        {/* Coordinate Transform Dialog */}
        <CoordinateTransformDialog
          open={showTransformDialog}
          onOpenChange={setShowTransformDialog}
          pontos={pontos}
          trechos={trechos}
          onTransform={handleTransformResult}
        />
      </CardContent>
    </Card>
  );
};
