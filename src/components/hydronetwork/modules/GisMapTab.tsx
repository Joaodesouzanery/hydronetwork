/**
 * GisMapTab — Shared GIS map + import tab for Esgoto and Água modules.
 * Provides interactive Leaflet map with file import (SHP, DXF, GeoJSON, CSV, etc.),
 * drawing tools, CRS/DATUM/UTM selection, coordinate transform, and elevation extraction.
 * Matches TopographyMap functionality for consistent UX across all map types.
 */
import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Upload, Map as MapIcon, MapPin, Layers, FileText, Download, RefreshCw, Trash2, Mountain, Globe,
} from "lucide-react";
import { UnifiedImportPanel } from "@/components/hydronetwork/UnifiedImportPanel";
import { NodeMapWidget, NodeData, ConnectionData, OverlayPolyline } from "@/components/hydronetwork/NodeMapWidget";
import { CoordinateTransformDialog } from "@/components/hydronetwork/CoordinateTransformDialog";
import { PontoTopografico } from "@/engine/reader";
import { Trecho, DEFAULT_DIAMETRO_MM, DEFAULT_MATERIAL } from "@/engine/domain";
import { classifyNetworkType } from "@/engine/geometry";
import { setGlobalUtmZone, getGlobalUtmZone } from "@/engine/hydraulics";
import {
  createLayer, addNode, addEdge,
  type OriginModule, type LayerDiscipline,
} from "@/core/spatial";
import { bumpSpatialVersion } from "@/hooks/useSpatialData";

export interface GisMapTabProps {
  networkType: "esgoto" | "agua";
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onPontosChange: (pontos: PontoTopografico[]) => void;
  onTrechosChange: (trechos: Trecho[]) => void;
  accentColor?: string;
  originModule?: OriginModule;
  /** Pre-colored connections from dimensioning results (overrides auto-generated connections) */
  resultConnections?: ConnectionData[];
}

export function GisMapTab({
  networkType,
  pontos,
  trechos,
  onPontosChange,
  onTrechosChange,
  accentColor = networkType === "esgoto" ? "#ef4444" : "#3b82f6",
  originModule,
  resultConnections,
}: GisMapTabProps) {
  const [mapMode, setMapMode] = useState<"view" | "import">("view");
  const [contourOverlay, setContourOverlay] = useState<OverlayPolyline[]>([]);
  const [showTransformDialog, setShowTransformDialog] = useState(false);
  const [utmZone, setUtmZone] = useState<string>(String(getGlobalUtmZone() || "auto"));
  const [utmZoneVersion, setUtmZoneVersion] = useState(0);

  // UTM zone change handler (matches TopographyMap)
  const handleUtmZoneChange = useCallback((value: string) => {
    setUtmZone(value);
    if (value === "auto") {
      setGlobalUtmZone(undefined);
    } else {
      setGlobalUtmZone(parseInt(value));
    }
    setUtmZoneVersion(v => v + 1);
    if (pontos.length > 0) {
      toast.success(`Fuso UTM alterado para ${value === "auto" ? "automático" : `zona ${value}`}`);
    }
  }, [pontos]);

  // Handle transform dialog result
  const handleTransformResult = useCallback((newPontos: PontoTopografico[], newTrechos: Trecho[]) => {
    onPontosChange(newPontos);
    onTrechosChange(newTrechos);
    toast.success(`Coordenadas transformadas: ${newPontos.length} pontos e ${newTrechos.length} trechos atualizados.`);
  }, [onPontosChange, onTrechosChange]);

  // Handle map click for adding new nodes
  const handleMapClick = useCallback((lat: number, lng: number) => {
    const newId = `P${String(pontos.length + 1).padStart(3, "0")}`;
    const newPoint: PontoTopografico = { id: newId, x: lng, y: lat, cota: 0 };
    onPontosChange([...pontos, newPoint]);
    if (originModule) {
      const discipline: LayerDiscipline = networkType === "agua" ? "agua" : "esgoto";
      const layer = createLayer({
        name: `Nodes ${networkType}`,
        discipline,
        geometryType: "Point",
        source: "manual",
        originModule,
      });
      addNode({
        id: newId, x: lng, y: lat, z: 0,
        tipo: "generic", layerId: layer.id, origin_module: originModule,
      });
      bumpSpatialVersion();
    }
    toast.success(`Ponto ${newId} adicionado`);
  }, [pontos, onPontosChange, originModule, networkType]);

  // Handle node deletion
  const handleNodesDelete = useCallback((nodeIds: string[]) => {
    const updated = pontos.filter(p => !nodeIds.includes(p.id));
    onPontosChange(updated);
    // Also remove trechos connected to deleted nodes
    const deletedSet = new Set(nodeIds);
    const updatedTrechos = trechos.filter(t => !deletedSet.has(t.idInicio) && !deletedSet.has(t.idFim));
    onTrechosChange(updatedTrechos);
  }, [pontos, trechos, onPontosChange, onTrechosChange]);

  // Generate contour lines from loaded raster
  const generateContours = useCallback(async () => {
    try {
      const { getRasterGrid } = await import("@/engine/rasterStore");
      const raster = getRasterGrid();
      if (!raster) { toast.error("Importe um arquivo TIF/GeoTIFF primeiro"); return; }
      const { extractContours } = await import("@/engine/contourExtractor");
      const { grid, meta } = raster;
      const result = extractContours(
        grid.data, meta.width, meta.height,
        grid.origin, grid.pixelSize,
        5, meta.noDataValue,
      );
      const overlay: OverlayPolyline[] = result.contours.map((c: any) => ({
        points: c.segments.flat().map((seg: any) => [seg[1], seg[0]] as [number, number]),
        color: "#8B5CF6",
        weight: 1,
        opacity: 0.5,
        label: `${c.elevation.toFixed(0)}m`,
      }));
      setContourOverlay(overlay);
      toast.success(`${result.contours.length} curvas de nível geradas`);
    } catch (err: any) {
      toast.error(`Erro ao gerar contornos: ${err.message}`);
    }
  }, []);

  // Convert pontos to NodeData for map display
  const nodeData = useMemo<NodeData[]>(() =>
    pontos.map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      cota: p.cota,
      label: `${p.id} (${p.cota.toFixed(1)}m)`,
    })),
    [pontos]
  );

  // Convert trechos to ConnectionData for map display
  const connectionData = useMemo<ConnectionData[]>(() =>
    trechos.map(t => ({
      from: t.idInicio,
      to: t.idFim,
      color: accentColor,
      label: `${t.idInicio}→${t.idFim} (${t.comprimento.toFixed(1)}m)`,
    })),
    [trechos, accentColor]
  );

  // Handle file import completion
  const handleImport = useCallback((importedPontos: PontoTopografico[], importedTrechos: Trecho[]) => {
    if (importedPontos.length === 0) {
      toast.error("Nenhum ponto importado");
      return;
    }

    // Merge with existing data, tagging imported trechos with correct network type
    onPontosChange([...pontos, ...importedPontos]);
    const taggedTrechos = importedTrechos.map(t => ({
      ...t,
      tipoRedeManual: t.tipoRedeManual || networkType,
    }));
    onTrechosChange([...trechos, ...taggedTrechos]);

    // Write to Spatial Core if originModule is specified
    if (originModule) {
      const discipline: LayerDiscipline = networkType === "agua" ? "agua" : "esgoto";
      const layer = createLayer({
        name: `Import ${networkType} ${new Date().toLocaleTimeString()}`,
        discipline,
        geometryType: "Mixed",
        source: "imported",
        originModule,
      });
      for (const p of importedPontos) {
        addNode({
          id: p.id, x: p.x, y: p.y, z: p.cota,
          tipo: "generic", layerId: layer.id, origin_module: originModule,
        });
      }
      for (const t of importedTrechos) {
        addEdge({
          id: `${t.idInicio}-${t.idFim}`,
          startNodeId: t.idInicio, endNodeId: t.idFim,
          dn: t.diametroMm, material: t.material, tipoRede: t.tipoRede,
          layerId: layer.id, origin_module: originModule,
          comprimento: t.comprimento, declividade: t.declividade,
        });
      }
      bumpSpatialVersion();
    }

    toast.success(
      `Importados: ${importedPontos.length} pontos, ${importedTrechos.length} trechos`
    );
    setMapMode("view");
  }, [pontos, trechos, onPontosChange, onTrechosChange, originModule, networkType]);

  // Handle node movement on map
  const handleNodeMove = useCallback((nodeId: string, x: number, y: number) => {
    const updated = pontos.map(p =>
      p.id === nodeId ? { ...p, x, y } : p
    );
    onPontosChange(updated);
  }, [pontos, onPontosChange]);

  // Handle connection changes from map
  const handleConnectionsChange = useCallback((connections: ConnectionData[]) => {
    // Convert ConnectionData back to Trecho format
    const newTrechos: Trecho[] = connections.map(c => {
      const fromPt = pontos.find(p => p.id === c.from);
      const toPt = pontos.find(p => p.id === c.to);
      if (!fromPt || !toPt) return null;
      const dx = toPt.x - fromPt.x;
      const dy = toPt.y - fromPt.y;
      const comprimento = Math.sqrt(dx * dx + dy * dy);
      const declividade = comprimento > 0 ? (fromPt.cota - toPt.cota) / comprimento : 0;
      return {
        idInicio: c.from,
        idFim: c.to,
        comprimento: Math.round(comprimento * 10) / 10,
        declividade: Math.round(declividade * 1e6) / 1e6,
        tipoRede: classifyNetworkType(declividade),
        tipoRedeManual: networkType,
        diametroMm: DEFAULT_DIAMETRO_MM,
        material: DEFAULT_MATERIAL,
        xInicio: fromPt.x,
        yInicio: fromPt.y,
        xFim: toPt.x,
        yFim: toPt.y,
        cotaInicio: fromPt.cota,
        cotaFim: toPt.cota,
      };
    }).filter(Boolean) as Trecho[];

    onTrechosChange(newTrechos);
  }, [pontos, networkType, onTrechosChange]);

  const clearAll = () => {
    onPontosChange([]);
    onTrechosChange([]);
    toast.success("Dados limpos");
  };

  const typeLabel = networkType === "esgoto" ? "Esgoto" : "Água";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            {pontos.length} pontos
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Layers className="h-3 w-3 mr-1" />
            {trechos.length} trechos
          </Badge>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant={mapMode === "import" ? "default" : "outline"}
            size="sm"
            onClick={() => setMapMode(mapMode === "import" ? "view" : "import")}
          >
            <Upload className="h-4 w-4 mr-1" />
            {mapMode === "import" ? "Fechar Importação" : "Importar Arquivo"}
          </Button>
          <Button variant={contourOverlay.length > 0 ? "secondary" : "outline"} size="sm" onClick={() => {
            if (contourOverlay.length > 0) { setContourOverlay([]); toast.info("Contornos removidos"); }
            else generateContours();
          }}>
            <Mountain className="h-4 w-4 mr-1" /> {contourOverlay.length > 0 ? "Limpar Contornos" : "Contornos"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowTransformDialog(true)}>
            <RefreshCw className="h-4 w-4 mr-1" /> Transformar CRS
          </Button>
          {/* UTM Zone selector — matches TopographyMap */}
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3 text-muted-foreground" />
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
          {pontos.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Trash2 className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Import Panel (collapsible) */}
      {mapMode === "import" && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Importar Arquivos — Rede de {typeLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Formatos suportados: SHP, DXF, DWG, GeoPackage, GeoJSON, CSV, TXT, XLSX, IFC, INP, SWMM.
              Após importar, atribua o tipo de cada elemento na aba "Rede".
            </p>
            <UnifiedImportPanel
              onImport={handleImport}
              diametroMm={networkType === "esgoto" ? 150 : 50}
              material={networkType === "esgoto" ? "PVC" : "PVC"}
            />
          </CardContent>
        </Card>
      )}

      {/* Coordinate Transform Dialog */}
      {showTransformDialog && (
        <CoordinateTransformDialog
          open={showTransformDialog}
          onOpenChange={setShowTransformDialog}
          pontos={pontos}
          trechos={trechos}
          onTransform={handleTransformResult}
        />
      )}

      {/* Interactive Map */}
      <NodeMapWidget
        nodes={nodeData}
        connections={resultConnections || connectionData}
        title={`Mapa — Rede de ${typeLabel}`}
        onNodeMove={handleNodeMove}
        onConnectionsChange={handleConnectionsChange}
        onMapClick={handleMapClick}
        onNodesDelete={handleNodesDelete}
        overlayPolylines={contourOverlay}
        height={500}
        accentColor={accentColor}
        editable={true}
        utmZoneVersion={utmZoneVersion}
      />

      {/* Info */}
      {pontos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <MapIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum dado carregado. Clique em <strong>"Importar Arquivo"</strong> para carregar
              um arquivo SHP, DXF, GeoJSON ou outro formato, ou use o mapa interativo para
              criar nós manualmente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
