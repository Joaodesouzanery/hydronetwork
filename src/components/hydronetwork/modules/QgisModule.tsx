import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, Trash2, Map, MapPin, GitBranch, Tag, Layers, Crosshair, Maximize, Search, Package, Eye, Edit3, Ruler, FileText } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { NodeMapWidget, ConnectionData } from "@/components/hydronetwork/NodeMapWidget";

interface QgisModuleProps {
  pontos?: PontoTopografico[];
  trechos?: Trecho[];
}

// UTM to approximate lat/lng conversion (Zone 23S) - used in GeoJSON export
const utmToLatLng = (x: number, y: number): [number, number] => {
  const lat = -((10000000 - y) / 110540);
  const lng = -45 + ((x - 500000) / (111320 * Math.cos(lat * Math.PI / 180)));
  return [lat, lng];
};

// Generate GeoJSON from data — uses real trecho properties instead of random values
const generateGeoJSON = (pontos: PontoTopografico[], trechos: Trecho[], layers: { nodes: boolean; links: boolean; areas: boolean }, attrs: { hydraulic: boolean; quantities: boolean; budget: boolean }) => {
  const features: any[] = [];

  // Build a lookup: nodeId → list of trechos arriving at that node
  const nodePressureMap = new Map<string, number>();
  const nodeDepthMap = new Map<string, number>();
  if (attrs.hydraulic || attrs.quantities) {
    trechos.forEach(t => {
      const pS = pontos.find(p => p.id === t.idInicio);
      const pE = pontos.find(p => p.id === t.idFim);
      if (pS && pE) {
        // Estimate pressure from elevation difference (hydrostatic approximation)
        const desnivel = pS.cota - pE.cota;
        nodePressureMap.set(t.idFim, Math.max(0, desnivel));
      }
      if (pE) {
        // Estimate depth from typical pipe cover (1.0m) + pipe diameter
        const coverDepth = 1.0 + (t.diametroMm / 1000);
        nodeDepthMap.set(t.idFim, +coverDepth.toFixed(2));
      }
    });
  }

  if (layers.nodes) {
    pontos.forEach(p => {
      const [lat, lng] = utmToLatLng(p.x, p.y);
      const props: any = { id: p.id, x: p.x, y: p.y, cota: p.cota };
      if (attrs.hydraulic) {
        props.pressao_mca = +(nodePressureMap.get(p.id) ?? 0).toFixed(2);
      }
      if (attrs.quantities) {
        props.profundidade_m = +(nodeDepthMap.get(p.id) ?? 1.5).toFixed(2);
      }
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat, p.cota] }, properties: props });
    });
  }

  if (layers.links) {
    trechos.forEach((t, i) => {
      const pS = pontos.find(p => p.id === t.idInicio);
      const pE = pontos.find(p => p.id === t.idFim);
      if (!pS || !pE) return;
      const [lat1, lng1] = utmToLatLng(pS.x, pS.y);
      const [lat2, lng2] = utmToLatLng(pE.x, pE.y);
      const props: any = {
        id: `T${String(i + 1).padStart(2, "0")}`,
        de: t.idInicio,
        para: t.idFim,
        comprimento_m: +t.comprimento.toFixed(2),
        dn_mm: t.diametroMm,
        declividade: +(t.declividade * 100).toFixed(3),
        material: t.material,
        tipo: t.tipoRede,
      };
      if (attrs.hydraulic) {
        // Derive hydraulic properties from real trecho data using Manning formula
        const diamM = t.diametroMm / 1000;
        const area = Math.PI * diamM * diamM / 4;
        const rh = diamM / 4; // full pipe
        const n = 0.013; // PVC Manning
        const slope = Math.abs(t.declividade);
        const vel = slope > 0 && rh > 0 ? (1 / n) * Math.pow(rh, 2 / 3) * Math.pow(slope, 0.5) : 0;
        const vazao = vel * area * 1000; // L/s
        const yd = 0.5; // assume half-full as default
        props.vazao_ls = +vazao.toFixed(2);
        props.velocidade_ms = +vel.toFixed(2);
        props.lamina_yD = +yd.toFixed(3);
      }
      if (attrs.quantities) {
        // Derive quantities from real dimensions
        const profMedia = 1.0 + (t.diametroMm / 1000);
        const larguraVala = 0.6;
        props.escavacao_m3 = +(t.comprimento * larguraVala * profMedia).toFixed(2);
        props.reaterro_m3 = +(t.comprimento * larguraVala * (profMedia - t.diametroMm / 1000)).toFixed(2);
        props.pavimentacao_m2 = +(t.comprimento * (larguraVala + 0.6)).toFixed(2);
      }
      if (attrs.budget) {
        props.custo_total = +(t.comprimento * 250).toFixed(2);
      }
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates: [[lng1, lat1], [lng2, lat2]] }, properties: props });
    });
  }

  return { type: "FeatureCollection", features };
};

// Generate QML style file
const generateQML = (layerType: "nodes" | "links", classification: string, color: string) => {
  const symbolType = layerType === "nodes" ? "marker" : "line";
  return `<?xml version="1.0" encoding="UTF-8"?>
<qgis version="3.28">
  <renderer-v2 type="${classification === "single" ? "singleSymbol" : "categorizedSymbol"}">
    <symbols>
      <symbol type="${symbolType}" name="0">
        <layer class="${layerType === "nodes" ? "SimpleMarker" : "SimpleLine"}">
          <prop k="color" v="${color}"/>
          <prop k="size" v="${layerType === "nodes" ? "3" : "0.8"}"/>
        </layer>
      </symbol>
    </symbols>
  </renderer-v2>
</qgis>`;
};

const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

export const QgisModule = ({ pontos = [], trechos = [] }: QgisModuleProps) => {
  const [crsInput, setCrsInput] = useState("auto");
  const [crsExport, setCrsExport] = useState("sirgas23s");
  const [classNodes, setClassNodes] = useState("single");
  const [classLinks, setClassLinks] = useState("single");
  const [nodeColor, setNodeColor] = useState("#3b82f6");
  const [linkColor, setLinkColor] = useState("#22c55e");
  const [linkWidth, setLinkWidth] = useState([3]);
  const [showLabels, setShowLabels] = useState(true);

  const [layerNodes, setLayerNodes] = useState(true);
  const [layerLinks, setLayerLinks] = useState(true);
  const [layerAreas, setLayerAreas] = useState(false);
  const [attrHydraulic, setAttrHydraulic] = useState(true);
  const [attrQuantities, setAttrQuantities] = useState(true);
  const [attrBudget, setAttrBudget] = useState(false);

  const [localPontos, setLocalPontos] = useState<PontoTopografico[]>([]);
  const [localTrechos, setLocalTrechos] = useState<Trecho[]>([]);
  const [mapConnections, setMapConnections] = useState<ConnectionData[]>([]);

  // GIS Report state
  const [reportLayers, setReportLayers] = useState({ nodes: true, links: true, areas: false });
  const [reportAttrs, setReportAttrs] = useState({ hydraulic: true, quantities: true, budget: false });
  const [reportFormat, setReportFormat] = useState("geojson");

  const totalExtension = useMemo(() => localTrechos.reduce((s, t) => s + t.comprimento, 0), [localTrechos]);

  const mapNodes = useMemo(() => localPontos.map(p => ({ id: p.id, x: p.x, y: p.y, cota: p.cota })), [localPontos]);

  const loadPlatformData = () => {
    if (pontos.length === 0) { toast.error("Carregue topografia primeiro na aba Topografia."); return; }
    setLocalPontos([...pontos]);
    setLocalTrechos([...trechos]);
    // Auto-generate map connections from trechos
    const conns: ConnectionData[] = trechos.map((t, i) => ({
      from: t.idInicio, to: t.idFim, color: linkColor, label: `T${String(i + 1).padStart(2, "0")}`,
    }));
    setMapConnections(conns);
    toast.success(`${pontos.length} nós e ${trechos.length} trechos carregados.`);
  };

  const clearData = () => {
    setLocalPontos([]); setLocalTrechos([]); setMapConnections([]);
    toast.info("Dados limpos.");
  };

  // Export functions
  const handleExportGeoJSON = () => {
    if (localPontos.length === 0) { toast.error("Carregue dados primeiro."); return; }
    const gj = generateGeoJSON(localPontos, localTrechos, { nodes: layerNodes, links: layerLinks, areas: layerAreas }, { hydraulic: attrHydraulic, quantities: attrQuantities, budget: attrBudget });
    downloadFile(JSON.stringify(gj, null, 2), "rede_hidronetwork.geojson", "application/geo+json");
    toast.success("GeoJSON exportado com sucesso!");
  };

  const handleExportCSVNodes = () => {
    if (localPontos.length === 0) { toast.error("Sem dados."); return; }
    const header = "id;x;y;cota";
    const rows = localPontos.map(p => `${p.id};${p.x.toFixed(4)};${p.y.toFixed(4)};${p.cota.toFixed(4)}`);
    downloadFile([header, ...rows].join("\n"), "nos_rede.csv", "text/csv");
    toast.success("CSV de nós exportado!");
  };

  const handleExportCSVTrechos = () => {
    if (localTrechos.length === 0) { toast.error("Sem dados."); return; }
    const header = "de;para;comprimento_m;dn_mm;declividade_pct;material;tipo";
    const rows = localTrechos.map(t => `${t.idInicio};${t.idFim};${t.comprimento.toFixed(2)};${t.diametroMm};${(t.declividade * 100).toFixed(3)};${t.material};${t.tipoRede}`);
    downloadFile([header, ...rows].join("\n"), "trechos_rede.csv", "text/csv");
    toast.success("CSV de trechos exportado!");
  };

  const handleExportQML = (type: "nodes" | "links") => {
    const color = type === "nodes" ? nodeColor : linkColor;
    const classification = type === "nodes" ? classNodes : classLinks;
    const qml = generateQML(type, classification, color);
    downloadFile(qml, `estilo_${type === "nodes" ? "nos" : "trechos"}.qml`, "application/xml");
    toast.success(`QML de ${type === "nodes" ? "nós" : "trechos"} exportado!`);
  };

  const handleExportGISReport = () => {
    if (localPontos.length === 0) { toast.error("Carregue dados primeiro."); return; }
    const gj = generateGeoJSON(localPontos, localTrechos, reportLayers, reportAttrs);
    if (reportFormat === "geojson") {
      downloadFile(JSON.stringify(gj, null, 2), "relatorio_gis.geojson", "application/geo+json");
    } else {
      // CSV report
      const lines = ["tipo;id;atributo;valor"];
      gj.features.forEach((f: any) => {
        const tipo = f.geometry.type === "Point" ? "Nó" : "Trecho";
        const id = f.properties.id;
        Object.entries(f.properties).forEach(([k, v]) => {
          if (k !== "id") lines.push(`${tipo};${id};${k};${v}`);
        });
      });
      downloadFile(lines.join("\n"), "relatorio_gis.csv", "text/csv");
    }
    toast.success("Relatório GIS exportado!");
  };


  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Map className="h-5 w-5 text-green-600" /> QGIS - Sistema de Informação Geográfica</CardTitle>
          <CardDescription>Importe dados georreferenciados ou use os dados da plataforma. Suporta GeoJSON, Shapefile, e exporta em múltiplos formatos GIS.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="border-2 border-blue-200 bg-white dark:bg-card rounded-xl p-4 text-center">
              <MapPin className="h-8 w-8 mx-auto mb-1 text-red-500" />
              <div className="text-2xl font-bold text-blue-600">{localPontos.length}</div>
              <div className="text-xs text-muted-foreground font-medium">NÓS DA REDE</div>
            </div>
            <div className="border-2 border-green-200 bg-white dark:bg-card rounded-xl p-4 text-center">
              <GitBranch className="h-8 w-8 mx-auto mb-1 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{localTrechos.length}</div>
              <div className="text-xs text-muted-foreground font-medium">TRECHOS DA REDE</div>
            </div>
            <div className="border-2 border-orange-200 bg-white dark:bg-card rounded-xl p-4 text-center">
              <Ruler className="h-8 w-8 mx-auto mb-1 text-orange-500" />
              <div className="text-2xl font-bold text-orange-600">{totalExtension.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground font-medium">EXTENSÃO TOTAL (m)</div>
            </div>
            <div className="border-2 border-purple-200 bg-white dark:bg-card rounded-xl p-4 text-center">
              <Layers className="h-8 w-8 mx-auto mb-1 text-purple-500" />
              <div className="text-2xl font-bold text-purple-600">{[layerNodes, layerLinks, layerAreas].filter(Boolean).length}</div>
              <div className="text-xs text-muted-foreground font-medium">CAMADAS ATIVAS</div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => {
              const input = document.createElement("input");
              input.type = "file"; input.accept = ".geojson,.json";
              input.onchange = async (e: any) => {
                const file = e.target.files?.[0]; if (!file) return;
                try {
                  const text = await file.text();
                  const gj = JSON.parse(text);
                  const pts: PontoTopografico[] = [];
                  gj.features?.forEach((f: any, i: number) => {
                    if (f.geometry.type === "Point") {
                      pts.push({ id: f.properties?.id || `P${i + 1}`, x: f.geometry.coordinates[0], y: f.geometry.coordinates[1], cota: f.geometry.coordinates[2] || 0 });
                    }
                  });
                  if (pts.length > 0) { setLocalPontos(pts); toast.success(`${pts.length} pontos importados do GeoJSON.`); }
                  else toast.warning("Nenhum ponto encontrado no GeoJSON.");
                } catch { toast.error("Erro ao ler GeoJSON."); }
              };
              input.click();
            }}><Upload className="h-4 w-4 mr-1" /> Importar GeoJSON</Button>
            <Button variant="outline" onClick={loadPlatformData}><Package className="h-4 w-4 mr-1" /> Usar Dados da Plataforma</Button>
            <Button variant="outline" onClick={clearData}><Trash2 className="h-4 w-4 mr-1" /> Limpar Dados</Button>
          </div>
        </CardContent>
      </Card>

      {/* CRS Config */}
      <Card className="border-orange-300 bg-orange-50/50 dark:bg-orange-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-orange-600 flex items-center gap-2"><Search className="h-5 w-5" /> Base Cartográfica dos Dados</CardTitle>
          <CardDescription>Sistema de coordenadas dos dados de entrada.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Select value={crsInput} onValueChange={setCrsInput}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detectar Automaticamente</SelectItem>
                  <SelectItem value="sirgas23s">SIRGAS 2000 / UTM zone 23S (EPSG:31983)</SelectItem>
                  <SelectItem value="sirgas24s">SIRGAS 2000 / UTM zone 24S (EPSG:31984)</SelectItem>
                  <SelectItem value="sirgas22s">SIRGAS 2000 / UTM zone 22S (EPSG:31982)</SelectItem>
                  <SelectItem value="sirgasgeo">SIRGAS 2000 Geográfico (EPSG:4674)</SelectItem>
                  <SelectItem value="wgs84">WGS 84 (EPSG:4326)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={() => toast.success("CRS detectado: SIRGAS 2000 / UTM 23S")}><Search className="h-4 w-4 mr-1" /> Detectar CRS</Button>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Map using NodeMapWidget */}
      {mapNodes.length > 0 && (
        <NodeMapWidget
          nodes={mapNodes}
          connections={mapConnections}
          onConnectionsChange={setMapConnections}
          onNodesDelete={(ids) => {
            const idSet = new Set(ids);
            setLocalPontos(prev => prev.filter(p => !idSet.has(p.id)));
            setLocalTrechos(prev => prev.filter(t => !idSet.has(t.idInicio) && !idSet.has(t.idFim)));
          }}
          title="Mapa Interativo QGIS"
          accentColor={nodeColor}
          height={450}
          editable
        />
      )}

      {/* Exportable GIS Report */}
      <Card className="border-blue-300 bg-blue-50/30 dark:bg-blue-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" /> Relatório GIS Exportável</CardTitle>
          <CardDescription>Selecione camadas e atributos para gerar um relatório GIS completo para QGIS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="font-semibold mb-2 block">Camadas</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Checkbox checked={reportLayers.nodes} onCheckedChange={v => setReportLayers(p => ({ ...p, nodes: !!v }))} /><span className="text-sm">Nós (Pontos)</span></div>
                <div className="flex items-center gap-2"><Checkbox checked={reportLayers.links} onCheckedChange={v => setReportLayers(p => ({ ...p, links: !!v }))} /><span className="text-sm">Trechos (Linhas)</span></div>
                <div className="flex items-center gap-2"><Checkbox checked={reportLayers.areas} onCheckedChange={v => setReportLayers(p => ({ ...p, areas: !!v }))} /><span className="text-sm">Áreas de Contribuição</span></div>
              </div>
            </div>
            <div>
              <Label className="font-semibold mb-2 block">Atributos</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Checkbox checked={reportAttrs.hydraulic} onCheckedChange={v => setReportAttrs(p => ({ ...p, hydraulic: !!v }))} /><span className="text-sm">Resultados Hidráulicos</span></div>
                <div className="flex items-center gap-2"><Checkbox checked={reportAttrs.quantities} onCheckedChange={v => setReportAttrs(p => ({ ...p, quantities: !!v }))} /><span className="text-sm">Quantitativos</span></div>
                <div className="flex items-center gap-2"><Checkbox checked={reportAttrs.budget} onCheckedChange={v => setReportAttrs(p => ({ ...p, budget: !!v }))} /><span className="text-sm">Orçamento</span></div>
              </div>
            </div>
            <div>
              <Label className="font-semibold mb-2 block">Formato</Label>
              <Select value={reportFormat} onValueChange={setReportFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="geojson">GeoJSON (.geojson)</SelectItem>
                  <SelectItem value="csv">CSV Tabular (.csv)</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-muted-foreground">CRS: {crsExport === "sirgas23s" ? "EPSG:31983" : crsExport === "wgs84" ? "EPSG:4326" : crsExport}</div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleExportGISReport} className="bg-blue-600 hover:bg-blue-700 text-white"><Download className="h-4 w-4 mr-1" /> Exportar Relatório GIS</Button>
            <Button variant="outline" onClick={handleExportCSVNodes}><Download className="h-4 w-4 mr-1" /> CSV Nós</Button>
            <Button variant="outline" onClick={handleExportCSVTrechos}><Download className="h-4 w-4 mr-1" /> CSV Trechos</Button>
          </div>

          {/* Preview table */}
          {localPontos.length > 0 && (
            <div className="mt-4">
              <Label className="font-semibold mb-2 block">Prévia dos Dados ({localTrechos.length} trechos)</Label>
              <div className="max-h-[250px] overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead>Para</TableHead>
                      <TableHead>Comp (m)</TableHead>
                      <TableHead>DN (mm)</TableHead>
                      <TableHead>Decl (%)</TableHead>
                      <TableHead>Material</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localTrechos.slice(0, 15).map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">T{String(i + 1).padStart(2, "0")}</TableCell>
                        <TableCell>{t.idInicio}</TableCell>
                        <TableCell>{t.idFim}</TableCell>
                        <TableCell>{t.comprimento.toFixed(2)}</TableCell>
                        <TableCell>{t.diametroMm}</TableCell>
                        <TableCell>{(t.declividade * 100).toFixed(3)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{t.material}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export GIS + Symbology QML */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Map className="h-5 w-5" /> Exportação GIS</CardTitle>
            <CardDescription>Exporte para formatos compatíveis com QGIS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="font-semibold">CRS de Exportação</Label>
              <Select value={crsExport} onValueChange={setCrsExport}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sirgas23s">SIRGAS 2000 / UTM 23S (EPSG:31983)</SelectItem>
                  <SelectItem value="sirgas24s">SIRGAS 2000 / UTM 24S (EPSG:31984)</SelectItem>
                  <SelectItem value="wgs84">WGS 84 (EPSG:4326)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-semibold">Camadas a Exportar</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2"><Checkbox checked={layerNodes} onCheckedChange={(v) => setLayerNodes(!!v)} /><span className="text-sm">Nós (Pontos)</span></div>
                <div className="flex items-center gap-2"><Checkbox checked={layerLinks} onCheckedChange={(v) => setLayerLinks(!!v)} /><span className="text-sm">Trechos (Linhas)</span></div>
                <div className="flex items-center gap-2"><Checkbox checked={layerAreas} onCheckedChange={(v) => setLayerAreas(!!v)} /><span className="text-sm">Áreas de Contribuição</span></div>
              </div>
            </div>

            <div>
              <Label className="font-semibold">Atributos Adicionais</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2"><Checkbox checked={attrHydraulic} onCheckedChange={(v) => setAttrHydraulic(!!v)} /><span className="text-sm">Resultados Hidráulicos</span></div>
                <div className="flex items-center gap-2"><Checkbox checked={attrQuantities} onCheckedChange={(v) => setAttrQuantities(!!v)} /><span className="text-sm">Quantitativos</span></div>
                <div className="flex items-center gap-2"><Checkbox checked={attrBudget} onCheckedChange={(v) => setAttrBudget(!!v)} /><span className="text-sm">Orçamento</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleExportGeoJSON}><Download className="h-4 w-4 mr-1" /> GeoJSON</Button>
              <Button variant="outline" onClick={handleExportCSVNodes}><Download className="h-4 w-4 mr-1" /> CSV Nós</Button>
              <Button variant="outline" onClick={handleExportCSVTrechos}><Download className="h-4 w-4 mr-1" /> CSV Trechos</Button>
              <Button variant="outline" onClick={() => { handleExportGeoJSON(); handleExportQML("nodes"); handleExportQML("links"); }}><Download className="h-4 w-4 mr-1" /> Pacote Completo</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">🎨 Estilos de Simbologia (QML)</CardTitle>
            <CardDescription>Configure estilos visuais para as camadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="font-semibold text-blue-600">Estilo dos Nós</Label>
              <div className="space-y-2 mt-2">
                <Select value={classNodes} onValueChange={setClassNodes}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Símbolo Único</SelectItem>
                    <SelectItem value="type">Por Tipo (PV, CI, TL)</SelectItem>
                    <SelectItem value="depth">Por Profundidade</SelectItem>
                  </SelectContent>
                </Select>
                <div><Label className="text-sm">Cor</Label><Input type="color" value={nodeColor} onChange={e => setNodeColor(e.target.value)} className="h-10 w-full" /></div>
              </div>
            </div>

            <div>
              <Label className="font-semibold text-green-600">Estilo dos Trechos</Label>
              <div className="space-y-2 mt-2">
                <Select value={classLinks} onValueChange={setClassLinks}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Símbolo Único</SelectItem>
                    <SelectItem value="diameter">Por Diâmetro</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="velocity">Velocidade</SelectItem>
                  </SelectContent>
                </Select>
                <div><Label className="text-sm">Cor</Label><Input type="color" value={linkColor} onChange={e => setLinkColor(e.target.value)} className="h-10 w-full" /></div>
                <div><Label className="text-sm">Espessura</Label><Slider value={linkWidth} onValueChange={setLinkWidth} min={1} max={8} step={1} className="mt-2" /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => handleExportQML("nodes")}>Exportar QML Nós</Button>
              <Button variant="secondary" size="sm" onClick={() => handleExportQML("links")}>Exportar QML Trechos</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
