import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  MapPin, Plus, Minus, Trash2, Undo2, Save,
  FolderOpen, Maximize, Link2, Layers, X, Crosshair
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho, createTrechoFromPoints } from "@/engine/domain";
import { getMapCoordinates, setGlobalUtmZone, getGlobalUtmZone } from "@/engine/hydraulics";
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
  const markersRef = useRef<L.CircleMarker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const [tileKey, setTileKey] = useState("osm");
  const [utmZone, setUtmZone] = useState<string>(String(getGlobalUtmZone() || "auto"));

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
        if (drawMode) {
          setDrawMode(false);
          setDrawOrigin(null);
          toast.info("Modo ligação desativado");
        }
        if (addNodeMode) {
          setAddNodeMode(false);
          toast.info("Modo adicionar ponto desativado");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawMode, addNodeMode]);

  // UTM zone change handler
  const handleUtmZoneChange = useCallback((value: string) => {
    setUtmZone(value);
    if (value === "auto") {
      setGlobalUtmZone(undefined);
    } else {
      setGlobalUtmZone(parseInt(value));
    }
    // Force re-render of map points
    if (mapRef.current && pontos.length > 0) {
      toast.success(`Fuso UTM alterado para ${value === "auto" ? "automático (23)" : `zona ${value}`}`);
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

  // Handle marker click - draw mode or select mode
  const handleMarkerClick = useCallback((pointId: string) => {
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
        // Auto-chain: destination becomes next origin
        setDrawOrigin(pointId);
        toast.info(`Continuando de ${pointId} — clique no próximo destino ou ESC para parar`);
      }
    } else {
      // Select mode - toggle selection and show popup
      setSelectedPoint(prev => prev === pointId ? null : pointId);
    }
  }, [drawMode, drawOrigin, pontos, trechos, onTrechosChange]);

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
      // Highlight origin in draw mode
      if (drawMode && drawOrigin === p.id) color = "#f97316";
      // Highlight selected point (yellow) outside draw mode
      if (!drawMode && selectedPoint === p.id) color = "#f59e0b";

      const radius = drawMode ? 11 : 8;

      const marker = L.circleMarker(coords, {
        radius, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9,
      }).addTo(map);

      // Only bind popup if NOT in draw mode (popups block fast clicking)
      if (!drawMode) {
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
      } else {
        // In draw mode, show tooltip instead (doesn't block clicks)
        marker.bindTooltip(p.id, { permanent: false, direction: "top", offset: [0, -10] });
      }

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
      polylinesRef.current.push(polyline);
    });

    if (bounds.length > 0) {
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 18 });
      } catch {
        map.setView(bounds[0] as L.LatLngExpression, 15);
      }
      setTimeout(() => map.invalidateSize(), 200);
      setTimeout(() => map.invalidateSize(), 500);
    }
  }, [pontos, trechos, getPointCoords, handleMarkerClick, drawMode, drawOrigin, selectedPoint]);

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
    const newMode = !drawMode;
    setDrawMode(newMode);
    setDrawOrigin(null);
    setSelectedPoint(null);
    if (newMode) toast.info("Modo ligar pontos ativo: clique origem → destino. Encadeamento automático! ESC para sair.");
    else toast.info("Modo ligação desativado.");
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

        {/* Map */}
        <div
          ref={mapContainerRef}
          className="w-full rounded-lg border border-border overflow-hidden"
          style={{ height: 450 }}
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
          <div className="flex items-center gap-1"><div className="w-4 h-1 bg-green-500 rounded" /> Gravidade</div>
          <div className="flex items-center gap-1"><div className="w-4 h-1 bg-orange-500 rounded" /> Elevatória</div>
        </div>
      </CardContent>
    </Card>
  );
};
