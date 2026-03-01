/**
 * GisMapTab — Shared GIS map + import tab for Esgoto and Água modules.
 * Provides interactive Leaflet map with file import (SHP, DXF, GeoJSON, CSV, etc.),
 * drawing tools, CRS selection, and elevation extraction.
 */
import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Upload, Map as MapIcon, MapPin, Layers, FileText, Download, RefreshCw, Trash2,
} from "lucide-react";
import { UnifiedImportPanel } from "@/components/hydronetwork/UnifiedImportPanel";
import { NodeMapWidget, NodeData, ConnectionData } from "@/components/hydronetwork/NodeMapWidget";
import { PontoTopografico } from "@/engine/reader";
import { Trecho, DEFAULT_DIAMETRO_MM, DEFAULT_MATERIAL } from "@/engine/domain";
import { classifyNetworkType } from "@/engine/geometry";

export interface GisMapTabProps {
  networkType: "esgoto" | "agua";
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onPontosChange: (pontos: PontoTopografico[]) => void;
  onTrechosChange: (trechos: Trecho[]) => void;
  accentColor?: string;
}

export function GisMapTab({
  networkType,
  pontos,
  trechos,
  onPontosChange,
  onTrechosChange,
  accentColor = networkType === "esgoto" ? "#ef4444" : "#3b82f6",
}: GisMapTabProps) {
  const [mapMode, setMapMode] = useState<"view" | "import">("view");

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

    // Merge with existing data or replace
    onPontosChange([...pontos, ...importedPontos]);
    onTrechosChange([...trechos, ...importedTrechos]);

    toast.success(
      `Importados: ${importedPontos.length} pontos, ${importedTrechos.length} trechos`
    );
    setMapMode("view");
  }, [pontos, trechos, onPontosChange, onTrechosChange]);

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
        <div className="flex gap-2">
          <Button
            variant={mapMode === "import" ? "default" : "outline"}
            size="sm"
            onClick={() => setMapMode(mapMode === "import" ? "view" : "import")}
          >
            <Upload className="h-4 w-4 mr-1" />
            {mapMode === "import" ? "Fechar Importação" : "Importar Arquivo"}
          </Button>
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

      {/* Interactive Map */}
      <NodeMapWidget
        nodes={nodeData}
        connections={connectionData}
        title={`Mapa — Rede de ${typeLabel}`}
        onNodeMove={handleNodeMove}
        onConnectionsChange={handleConnectionsChange}
        height={500}
        accentColor={accentColor}
        editable={true}
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
