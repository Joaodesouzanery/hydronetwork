/**
 * UnifiedImportPanel - Painel unico de importacao multi-arquivo
 * Suporta: DXF, SHP, INP (EPANET/SWMM), CSV, TXT, XLSX, GeoJSON, IFC
 * Fila de processamento, selecao por camada, confirmar → pontos + trechos reais
 *
 * LEITURA INTEGRAL: parse completo com TODOS os atributos de cada formato.
 * CAMPOS DO ARQUIVO: visualizacao de todos os campos detectados.
 * TRECHOS: identificacao correta de polilinhas individuais.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PontoTopografico } from '@/engine/reader';
import { Trecho, createTrechoFromPoints, DEFAULT_DIAMETRO_MM, DEFAULT_MATERIAL } from '@/engine/domain';
import { parseINPToInternal, parseSWMMToInternal } from '@/engine/importEngine';
import { Upload, Trash2, Check, X, FileText, Loader2, ChevronDown, ChevronRight, ChevronLeft, Globe, AlertTriangle, History, Save, FolderOpen, Undo2 } from 'lucide-react';
import { CRSSelector } from '@/components/hydronetwork/CRSSelector';
import { ImportCRSConfig, validateUTMRange } from '@/engine/coordinateTransform';
import {
  type ParsedPoint, type ParsedEdge, type ParseResult,
  calculateEdgeLength, getDxfColor,
} from '@/engine/importParsers';
import type { WorkerResponse } from '@/engine/importWorker';

interface FileQueueItem {
  id: string;
  file: File;
  format: string;
  status: 'aguardando' | 'lendo' | 'ok' | 'erro';
  progress: number;
  result: ParseResult | null;
  error?: string;
}

interface ImportHistoryEntry {
  fileName: string;
  format: string;
  pointCount: number;
  edgeCount: number;
  timestamp: string;
}

interface ValidationIssueItem {
  type: 'warning' | 'error' | 'info';
  category: string;
  message: string;
  count: number;
  details?: string[];
}

interface ImportTemplate {
  id: string;
  name: string;
  selectedLayers: string[];
  crsConfig: ImportCRSConfig | null;
  filterLayer: string;
  filterType: string;
  createdAt: string;
}

interface UnifiedImportPanelProps {
  onImport: (pontos: PontoTopografico[], trechos: Trecho[]) => void;
  diametroMm?: number;
  material?: string;
  onBeforeImport?: () => { pontos: PontoTopografico[]; trechos: Trecho[] } | null;
  onUndo?: (snapshot: { pontos: PontoTopografico[]; trechos: Trecho[] }) => void;
}

// ── Parsers kept on main thread (complex external dependencies) ──
//
// NOTE: DXF, CSV, GeoJSON, XLSX, IFC parsers were moved to
// src/engine/importParsers.ts and run via Web Worker (importWorker.ts)
// for non-blocking parsing of large files.

// Worker-compatible formats
const WORKER_FORMATS = new Set(['DXF', 'CSV', 'TXT', 'GeoJSON', 'XLSX', 'IFC']);

function parseINPContent(content: string, fileName: string): ParseResult {
  const parsed = parseINPToInternal(content);
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const layersSet = new Set<string>();
  const fieldsSet = new Set<string>(['elevation', 'type', 'diameter', 'roughness', 'length']);

  for (const n of parsed.nodes) {
    const layer = n.tipo === 'reservoir' ? 'Reservatórios' : 'Junções';
    layersSet.add(layer);
    points.push({
      id: n.id, x: n.x, y: n.y, z: n.z,
      layer, sourceFile: fileName,
      properties: { ...n.properties, nodeType: n.tipo, elevation: n.z },
    });
  }
  for (const e of parsed.edges) {
    const layer = e.properties?._type === 'pump' ? 'Bombas' : e.properties?._type === 'valve' ? 'Válvulas' : 'Tubulações';
    layersSet.add(layer);
    // Build coordinates from start/end nodes + vertices
    const startNode = parsed.nodes.find(n => n.id === e.startNodeId);
    const endNode = parsed.nodes.find(n => n.id === e.endNodeId);
    const coords: number[][] = [];
    if (startNode) coords.push([startNode.x, startNode.y, startNode.z]);
    if (e.vertices) e.vertices.forEach(v => coords.push([v[0], v[1], v[2]]));
    if (endNode) coords.push([endNode.x, endNode.y, endNode.z]);
    if (coords.length < 2 && startNode && endNode) {
      // fallback if coords are still empty
      coords.push([startNode.x, startNode.y, startNode.z], [endNode.x, endNode.y, endNode.z]);
    }
    edges.push({
      id: e.id, type: e.properties?._type === 'pump' ? 'PUMP' : e.properties?._type === 'valve' ? 'VALVE' : 'PIPE',
      coordinates: coords, isClosed: false, layer, sourceFile: fileName,
      properties: { ...e.properties, from: e.startNodeId, to: e.endNodeId, diameter: e.dn, material: e.material },
    });
  }
  const result: ParseResult = {
    points, edges, layers: Array.from(layersSet), fields: Array.from(fieldsSet),
    patternsCount: parsed.patterns?.length,
    curvesCount: parsed.curves?.length,
    verticesCount: parsed.edges.reduce((sum, e) => sum + (e.vertices?.length || 0), 0),
  };
  return result;
}

function parseSWMMContent(content: string, fileName: string): ParseResult {
  const parsed = parseSWMMToInternal(content);
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const layersSet = new Set<string>();
  const fieldsSet = new Set<string>(['elevation', 'type']);

  for (const n of parsed.nodes) {
    const layer = n.tipo === 'outfall' ? 'Exutórios' : 'Poços de Visita';
    layersSet.add(layer);
    points.push({
      id: n.id, x: n.x, y: n.y, z: n.z,
      layer, sourceFile: fileName,
      properties: { ...n.properties, nodeType: n.tipo, elevation: n.z },
    });
  }
  for (const e of parsed.edges) {
    layersSet.add('Condutos');
    const startNode = parsed.nodes.find(n => n.id === e.startNodeId);
    const endNode = parsed.nodes.find(n => n.id === e.endNodeId);
    const coords: number[][] = [];
    if (startNode) coords.push([startNode.x, startNode.y, startNode.z]);
    if (e.vertices) e.vertices.forEach(v => coords.push([v[0], v[1], v[2]]));
    if (endNode) coords.push([endNode.x, endNode.y, endNode.z]);
    edges.push({
      id: e.id, type: 'CONDUIT', coordinates: coords, isClosed: false,
      layer: 'Condutos', sourceFile: fileName,
      properties: { ...e.properties, from: e.startNodeId, to: e.endNodeId, diameter: e.dn, material: e.material },
    });
  }
  return { points, edges, layers: Array.from(layersSet), fields: Array.from(fieldsSet) };
}

async function parseSHPContentAsync(buffer: ArrayBuffer, fileName: string): Promise<ParseResult> {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const fieldsSet = new Set<string>();
  const layersSet = new Set<string>();

  try {
    // Use shpjs library for full SHP+DBF parsing (supports .shp and .zip)
    const { parseSHPBuffer } = await import('@/engine/shpReader');
    const shpResult = await parseSHPBuffer(buffer);

    for (const feature of shpResult.features) {
      if (!feature.geometry) continue;
      const props = feature.properties || {};
      Object.keys(props).forEach(k => fieldsSet.add(k));
      const layer = props.layer || props.LAYER || 'SHP';
      layersSet.add(layer);

      switch (feature.geometry.type) {
        case 'Point': {
          const [x, y, z] = feature.geometry.coordinates;
          points.push({
            id: props.id || props.ID || `SHP_P${points.length}`,
            x, y, z: z || props.cota || props.COTA || props.Z || props.ELEVACAO || 0,
            layer, sourceFile: fileName,
            properties: { ...props, geometryType: 'Point' },
          });
          break;
        }
        case 'MultiPoint': {
          for (const coord of feature.geometry.coordinates) {
            const [x, y, z] = coord;
            points.push({
              id: `SHP_P${points.length}`, x, y, z: z || 0,
              layer, sourceFile: fileName,
              properties: { ...props, geometryType: 'MultiPoint' },
            });
          }
          break;
        }
        case 'LineString': {
          const coords = feature.geometry.coordinates;
          if (coords.length >= 2) {
            edges.push({
              id: props.id || `SHP_E${edges.length}`,
              type: 'PolyLine', coordinates: coords.map((c: number[]) => [c[0], c[1], c[2] || 0]),
              isClosed: false, layer, sourceFile: fileName,
              properties: { ...props, geometryType: 'LineString', length: calculateEdgeLength(coords) },
            });
          }
          break;
        }
        case 'MultiLineString': {
          for (const line of feature.geometry.coordinates) {
            if (line.length >= 2) {
              edges.push({
                id: `SHP_E${edges.length}`,
                type: 'PolyLine', coordinates: line.map((c: number[]) => [c[0], c[1], c[2] || 0]),
                isClosed: false, layer, sourceFile: fileName,
                properties: { ...props, geometryType: 'MultiLineString', length: calculateEdgeLength(line) },
              });
            }
          }
          break;
        }
        case 'Polygon': {
          // Polygons are area features (parcels, zones), NOT network segments.
          // Import centroid as a point for reference only.
          if (feature.geometry.coordinates?.[0]?.length >= 2) {
            const ring = feature.geometry.coordinates[0];
            let cx = 0, cy = 0;
            for (const c of ring) { cx += c[0]; cy += c[1]; }
            cx /= ring.length; cy /= ring.length;
            points.push({
              id: `SHP_P${points.length}`, x: cx, y: cy, z: props.cota || props.COTA || props.Z || 0,
              layer, sourceFile: fileName,
              properties: { ...props, geometryType: 'Polygon' },
            });
          }
          break;
        }
        case 'MultiPolygon': {
          // MultiPolygons are area features, NOT network segments.
          for (const poly of feature.geometry.coordinates) {
            if (poly[0]?.length >= 2) {
              const ring = poly[0];
              let cx = 0, cy = 0;
              for (const c of ring) { cx += c[0]; cy += c[1]; }
              cx /= ring.length; cy /= ring.length;
              points.push({
                id: `SHP_P${points.length}`, x: cx, y: cy, z: props.cota || props.COTA || props.Z || 0,
                layer, sourceFile: fileName,
                properties: { ...props, geometryType: 'MultiPolygon' },
              });
            }
          }
          break;
        }
      }
    }
  } catch (shpErr) {
    // Fallback: try raw binary SHP parsing (without DBF attributes)
    return parseSHPContentFallback(buffer, fileName);
  }

  return {
    points, edges,
    layers: Array.from(layersSet).length > 0 ? Array.from(layersSet) : ['SHP'],
    fields: Array.from(fieldsSet),
  };
}

// Fallback binary SHP parser (used when shpjs fails, e.g., raw .shp without .dbf)
function parseSHPContentFallback(buffer: ArrayBuffer, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const view = new DataView(buffer);
  const magic = view.getInt32(0, false);
  if (magic !== 9994) return { points, edges, layers: ['SHP'], fields: [] };

  let offset = 100;
  let recIdx = 0;
  while (offset + 12 < buffer.byteLength) {
    try {
      const contentLength = view.getInt32(offset + 4, false) * 2;
      const recStart = offset + 8;
      if (recStart + 4 > buffer.byteLength) break;
      const recShapeType = view.getInt32(recStart, true);

      if (recShapeType === 1 || recShapeType === 11 || recShapeType === 21) {
        const x = view.getFloat64(recStart + 4, true);
        const y = view.getFloat64(recStart + 12, true);
        const z = recShapeType === 11 && recStart + 28 <= buffer.byteLength ? view.getFloat64(recStart + 20, true) : 0;
        points.push({ id: `SHP_P${recIdx}`, x, y, z, layer: 'SHP', sourceFile: fileName, properties: {} });
      } else if (recShapeType === 3 || recShapeType === 13 || recShapeType === 5 || recShapeType === 15) {
        const numParts = view.getInt32(recStart + 36, true);
        const numPoints = view.getInt32(recStart + 40, true);
        const partsOff = recStart + 44;
        const ptsOff = partsOff + numParts * 4;
        const parts: number[] = [];
        for (let p = 0; p < numParts; p++) parts.push(view.getInt32(partsOff + p * 4, true));
        for (let p = 0; p < numParts; p++) {
          const start = parts[p], end = p + 1 < numParts ? parts[p + 1] : numPoints;
          const coords: number[][] = [];
          for (let pt = start; pt < end; pt++) {
            const ptOff = ptsOff + pt * 16;
            if (ptOff + 16 > buffer.byteLength) break;
            coords.push([view.getFloat64(ptOff, true), view.getFloat64(ptOff + 8, true), 0]);
          }
          if (coords.length >= 2) {
            edges.push({
              id: `SHP_E${recIdx}_${p}`, type: recShapeType >= 5 ? 'Polygon' : 'PolyLine',
              coordinates: coords, isClosed: recShapeType >= 5, layer: 'SHP', sourceFile: fileName,
              properties: { length: calculateEdgeLength(coords) },
            });
          }
        }
      }
      offset += 8 + contentLength;
      recIdx++;
    } catch { break; }
  }
  return { points, edges, layers: ['SHP'], fields: [] };
}

// TIF/GeoTIFF parser for elevation raster data
async function parseTIFContentAsync(buffer: ArrayBuffer, fileName: string): Promise<ParseResult> {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const fieldsSet = new Set<string>(['cota', 'resolution']);

  try {
    const { parseGeoTIFF } = await import('@/engine/tifReader');
    const { setRasterGrid } = await import('@/engine/rasterStore');
    const tifResult = await parseGeoTIFF(buffer, 15000, -9999, true);

    // Store raw grid for contour extraction and elevation sampling
    if (tifResult.grid) {
      setRasterGrid(tifResult.grid, {
        width: tifResult.width, height: tifResult.height,
        noDataValue: tifResult.noDataValue,
      });
      // Add raster metadata to fields for display
      fieldsSet.add(`${tifResult.width}×${tifResult.height} px`);
      if (tifResult.grid.pixelSize) {
        const res = Math.abs(tifResult.grid.pixelSize[0]);
        fieldsSet.add(`${res.toFixed(2)} m/px`);
      }
    }

    for (const pt of tifResult.points) {
      points.push({
        id: pt.id, x: pt.x, y: pt.y, z: pt.cota,
        layer: 'GeoTIFF', sourceFile: fileName,
        properties: { cota: pt.cota, _source: 'GeoTIFF' },
      });
    }

    if (tifResult.crs?.epsg) fieldsSet.add(`EPSG:${tifResult.crs.epsg}`);
  } catch (err: any) {
    throw new Error(`Erro ao ler GeoTIFF: ${err.message}`);
  }

  return {
    points, edges,
    layers: points.length > 0 ? ['GeoTIFF'] : [],
    fields: Array.from(fieldsSet),
  };
}

// ── Validation ──

function runPostParseValidation(points: ParsedPoint[], edges: ParsedEdge[]): ValidationIssueItem[] {
  const issues: ValidationIssueItem[] = [];

  // 1. Duplicate points (same x,y within 0.001 tolerance)
  const coordMap = new Map<string, string[]>();
  for (const p of points) {
    const key = `${p.x.toFixed(3)}_${p.y.toFixed(3)}`;
    if (!coordMap.has(key)) coordMap.set(key, []);
    coordMap.get(key)!.push(p.id);
  }
  const duplicates = Array.from(coordMap.entries()).filter(([, ids]) => ids.length > 1);
  if (duplicates.length > 0) {
    issues.push({
      type: 'warning', category: 'Pontos Duplicados',
      message: `${duplicates.length} posicao(oes) com pontos sobrepostos`,
      count: duplicates.length,
      details: duplicates.slice(0, 5).map(([coord, ids]) => `Posicao ${coord.replace('_', ', ')}: ${ids.join(', ')}`),
    });
  }

  // 2. Zero-length edges
  const zeroEdges = edges.filter(e => {
    const len = calculateEdgeLength(e.coordinates);
    return len < 0.001;
  });
  if (zeroEdges.length > 0) {
    issues.push({
      type: 'warning', category: 'Trechos Comprimento Zero',
      message: `${zeroEdges.length} trecho(s) com comprimento zero ou quase zero`,
      count: zeroEdges.length,
      details: zeroEdges.slice(0, 5).map(e => `${e.id} (${e.layer})`),
    });
  }

  // 3. Out-of-range coordinates
  const outOfRange = points.filter(p => {
    const absX = Math.abs(p.x);
    const absY = Math.abs(p.y);
    // Check if likely UTM but with invalid ranges
    if (absX > 100000 && absX < 1000000) {
      // Likely UTM X - check Y range
      return absY < 100000 || absY > 10000100;
    }
    // Check if coordinates are negative (could be an issue for UTM)
    if (p.x < 0 && absX > 1000) return true;
    return false;
  });
  if (outOfRange.length > 0) {
    issues.push({
      type: 'warning', category: 'Coordenadas Fora da Faixa',
      message: `${outOfRange.length} ponto(s) com coordenadas possivelmente invalidas`,
      count: outOfRange.length,
      details: outOfRange.slice(0, 5).map(p => `${p.id}: X=${p.x.toFixed(2)}, Y=${p.y.toFixed(2)}`),
    });
  }

  // 4. Network gaps - isolated points not connected to any edge
  if (edges.length > 0 && points.length > 0) {
    const edgePointKeys = new Set<string>();
    for (const e of edges) {
      for (const c of e.coordinates) {
        edgePointKeys.add(`${c[0].toFixed(3)}_${c[1].toFixed(3)}`);
      }
    }
    const isolatedPoints = points.filter(p => !edgePointKeys.has(`${p.x.toFixed(3)}_${p.y.toFixed(3)}`));
    if (isolatedPoints.length > 0) {
      issues.push({
        type: 'info', category: 'Pontos Isolados (Gaps)',
        message: `${isolatedPoints.length} ponto(s) nao conectados a nenhum trecho`,
        count: isolatedPoints.length,
        details: isolatedPoints.slice(0, 5).map(p => `${p.id} (${p.layer})`),
      });
    }
  }

  // 5. Points with Z=0 (potential missing elevation)
  const zeroZ = points.filter(p => p.z === 0);
  if (zeroZ.length > 0 && zeroZ.length < points.length) {
    issues.push({
      type: 'info', category: 'Elevacao Zero',
      message: `${zeroZ.length} de ${points.length} pontos com elevacao Z=0`,
      count: zeroZ.length,
    });
  }

  return issues;
}

// ── Persistence ──

function saveImportHistory(entries: ImportHistoryEntry[]) {
  try {
    const existing: ImportHistoryEntry[] = JSON.parse(localStorage.getItem('hydroImportHistory') || '[]');
    const merged = [...entries, ...existing].slice(0, 20);
    localStorage.setItem('hydroImportHistory', JSON.stringify(merged));
  } catch { /* ignore */ }
}

function loadImportHistory(): ImportHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem('hydroImportHistory') || '[]');
  } catch { return []; }
}

function saveImportTemplate(template: ImportTemplate) {
  try {
    const existing: ImportTemplate[] = JSON.parse(localStorage.getItem('hydroImportTemplates') || '[]');
    const updated = [template, ...existing.filter(t => t.id !== template.id)].slice(0, 10);
    localStorage.setItem('hydroImportTemplates', JSON.stringify(updated));
  } catch { /* ignore */ }
}

function loadImportTemplates(): ImportTemplate[] {
  try {
    return JSON.parse(localStorage.getItem('hydroImportTemplates') || '[]');
  } catch { return []; }
}

function deleteImportTemplate(id: string) {
  try {
    const existing: ImportTemplate[] = JSON.parse(localStorage.getItem('hydroImportTemplates') || '[]');
    localStorage.setItem('hydroImportTemplates', JSON.stringify(existing.filter(t => t.id !== id)));
  } catch { /* ignore */ }
}

function saveImportSnapshot(pontos: PontoTopografico[], trechos: Trecho[]) {
  try {
    localStorage.setItem('hydroImportSnapshot', JSON.stringify({ pontos, trechos, timestamp: new Date().toISOString() }));
  } catch { /* ignore */ }
}

function loadImportSnapshot(): { pontos: PontoTopografico[]; trechos: Trecho[]; timestamp: string } | null {
  try {
    const raw = localStorage.getItem('hydroImportSnapshot');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Component ──

export const UnifiedImportPanel: React.FC<UnifiedImportPanelProps> = ({ onImport, diametroMm = DEFAULT_DIAMETRO_MM, material = DEFAULT_MATERIAL, onBeforeImport, onUndo }) => {
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [filterLayer, setFilterLayer] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 50;
  const [showFields, setShowFields] = useState(false);
  const [importCRS, setImportCRS] = useState<ImportCRSConfig | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssueItem[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [importHistory] = useState<ImportHistoryEntry[]>(() => loadImportHistory());
  const [templates, setTemplates] = useState<ImportTemplate[]>(() => loadImportTemplates());
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [hasSnapshot, setHasSnapshot] = useState(() => !!loadImportSnapshot());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  // ── Web Worker for heavy parsing (DXF, CSV, XLSX, GeoJSON, IFC) ──
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('@/engine/importWorker.ts', import.meta.url),
        { type: 'module' },
      );
    } catch {
      // Worker creation may fail in some environments; parsing falls back to main thread
      workerRef.current = null;
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Merged data from all files (memoized to avoid recalculation on each render)
  const allPoints = useMemo(
    () => fileQueue.filter(f => f.status === 'ok').flatMap(f => f.result?.points ?? []),
    [fileQueue],
  );
  const allEdges = useMemo(
    () => fileQueue.filter(f => f.status === 'ok').flatMap(f => f.result?.edges ?? []),
    [fileQueue],
  );
  const allLayers = useMemo(
    () => [...new Set([...allPoints.map(p => p.layer), ...allEdges.map(e => e.layer)])],
    [allPoints, allEdges],
  );
  const allTypes = useMemo(
    () => [...new Set(allEdges.map(e => e.type))],
    [allEdges],
  );
  const allFields = useMemo(
    () => [...new Set(fileQueue.filter(f => f.status === 'ok').flatMap(f => f.result?.fields ?? []))],
    [fileQueue],
  );
  const totalEntities = allPoints.length + allEdges.length;

  // Field info with samples and types for "Campos do Arquivo"
  const allFieldInfo = useMemo(() => {
    const fieldMap = new Map<string, { samples: Set<string>; count: number; numeric: boolean }>();

    const processProps = (props: Record<string, any>) => {
      for (const [key, val] of Object.entries(props)) {
        if (val === undefined || val === null || val === '') continue;
        if (!fieldMap.has(key)) {
          fieldMap.set(key, { samples: new Set(), count: 0, numeric: true });
        }
        const f = fieldMap.get(key)!;
        f.count++;
        if (typeof val !== 'number') f.numeric = false;
        if (f.samples.size < 3) f.samples.add(String(val).substring(0, 40));
      }
    };

    allPoints.forEach(p => processProps(p.properties));
    allEdges.forEach(e => processProps(e.properties));

    return Array.from(fieldMap.entries()).map(([name, info]) => ({
      name,
      type: info.numeric ? 'number' : 'text',
      samples: Array.from(info.samples),
      count: info.count,
    })).sort((a, b) => b.count - a.count);
  }, [allPoints, allEdges]);

  // Filtered (memoized)
  const filteredPoints = useMemo(
    () => allPoints.filter(p => (filterLayer === 'all' || p.layer === filterLayer)),
    [allPoints, filterLayer],
  );
  const filteredEdges = useMemo(
    () => allEdges.filter(e => (filterLayer === 'all' || e.layer === filterLayer) && (filterType === 'all' || e.type === filterType)),
    [allEdges, filterLayer, filterType],
  );

  // Pagination
  const allFilteredEntities = [
    ...filteredPoints.map(p => ({ type: 'point' as const, data: p })),
    ...filteredEdges.map(e => ({ type: 'edge' as const, data: e })),
  ];
  const filteredTotal = allFilteredEntities.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const paginatedEntities = allFilteredEntities.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // File detection
  const detectFormat = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      dxf: 'DXF', csv: 'CSV', txt: 'TXT', xlsx: 'XLSX', xls: 'XLSX',
      geojson: 'GeoJSON', json: 'GeoJSON', ifc: 'IFC',
      inp: 'INP', shp: 'SHP', tif: 'TIF', tiff: 'TIF',
      zip: 'SHP', // ZIP files typically contain Shapefiles
    };
    return map[ext] || 'Desconhecido';
  };

  // ── Parse via Web Worker (non-blocking) ──
  const parseInWorker = useCallback((item: FileQueueItem, content: string | ArrayBuffer): Promise<FileQueueItem> => {
    const worker = workerRef.current;
    if (!worker) {
      // Fallback: import and run on main thread if Worker unavailable
      return (async () => {
        const { parseDXFComplete, parseCSVContent, parseGeoJSONContent, parseXLSXContent, parseIFCContent } = await import('@/engine/importParsers');
        let result: ParseResult;
        switch (item.format) {
          case 'DXF': result = parseDXFComplete(content as string, item.file.name); break;
          case 'CSV': case 'TXT': result = parseCSVContent(content as string, item.file.name); break;
          case 'GeoJSON': result = parseGeoJSONContent(content as string, item.file.name); break;
          case 'XLSX': result = parseXLSXContent(content as ArrayBuffer, item.file.name); break;
          case 'IFC': result = parseIFCContent(content as string, item.file.name); break;
          default: throw new Error(`Formato nao suportado: ${item.format}`);
        }
        if (result.points.length === 0 && result.edges.length === 0) {
          return { ...item, status: 'erro' as const, error: 'Nenhuma entidade encontrada' };
        }
        return { ...item, status: 'ok' as const, progress: 100, result };
      })();
    }

    return new Promise<FileQueueItem>((resolve) => {
      const msgId = item.id;

      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.id !== msgId) return;

        if (e.data.type === 'progress') {
          // Update progress in real-time while worker parses
          setFileQueue(prev =>
            prev.map(f => f.id === msgId ? { ...f, progress: e.data.progress ?? f.progress } : f),
          );
          return;
        }

        // Result or error — remove listener
        worker.removeEventListener('message', handler);

        if (e.data.type === 'error') {
          resolve({ ...item, status: 'erro', error: e.data.error || 'Erro ao processar' });
          return;
        }

        const result = e.data.result!;
        if (result.points.length === 0 && result.edges.length === 0) {
          resolve({ ...item, status: 'erro', error: 'Nenhuma entidade encontrada' });
          return;
        }
        resolve({ ...item, status: 'ok', progress: 100, result });
      };

      worker.addEventListener('message', handler);

      // Send to worker — transfer ArrayBuffer for zero-copy performance
      if (content instanceof ArrayBuffer) {
        worker.postMessage(
          { id: msgId, format: item.format, buffer: content, fileName: item.file.name },
          [content],
        );
      } else {
        worker.postMessage(
          { id: msgId, format: item.format, content, fileName: item.file.name },
        );
      }
    });
  }, []);

  // Process a single file
  const processFile = useCallback(async (item: FileQueueItem): Promise<FileQueueItem> => {
    try {
      const format = item.format;

      // ── Formats handled by Web Worker (non-blocking) ──
      if (WORKER_FORMATS.has(format)) {
        const content = format === 'XLSX'
          ? await item.file.arrayBuffer()
          : await item.file.text();
        return await parseInWorker(item, content);
      }

      // ── Formats kept on main thread (external dependencies) ──
      let result: ParseResult;

      if (format === 'INP') {
        const text = await item.file.text();
        const isSWMM = /\[SUBCATCHMENTS\]|\[CONDUITS\]|\[OUTFALLS\]/i.test(text);
        result = isSWMM ? parseSWMMContent(text, item.file.name) : parseINPContent(text, item.file.name);
      } else if (format === 'SHP') {
        const buffer = await item.file.arrayBuffer();
        result = await parseSHPContentAsync(buffer, item.file.name);
      } else if (format === 'TIF') {
        toast.info(`Processando DEM: ${item.file.name} (${(item.file.size / 1024 / 1024).toFixed(1)} MB)...`);
        const buffer = await item.file.arrayBuffer();
        result = await parseTIFContentAsync(buffer, item.file.name);
        const rasterInfo = result.fields.filter(f => f.startsWith('EPSG:')).join(', ');
        toast.success(`DEM carregado: ${result.points.length} pontos amostrados${rasterInfo ? ` | ${rasterInfo}` : ''}`);
      } else {
        return { ...item, status: 'erro', error: `Formato nao suportado: ${format}` };
      }

      if (result.points.length === 0 && result.edges.length === 0) {
        return { ...item, status: 'erro', error: 'Nenhuma entidade encontrada' };
      }

      return { ...item, status: 'ok', progress: 100, result };
    } catch (err: any) {
      return { ...item, status: 'erro', error: err.message || 'Erro ao processar' };
    }
  }, [parseInWorker]);

  // Process queue
  useEffect(() => {
    if (processingRef.current) return;
    const pending = fileQueue.find(f => f.status === 'aguardando');
    if (!pending) return;

    processingRef.current = true;
    setFileQueue(prev => prev.map(f => f.id === pending.id ? { ...f, status: 'lendo', progress: 5 } : f));

    processFile(pending).then(processed => {
      setFileQueue(prev => prev.map(f => f.id === pending.id ? processed : f));
      // Auto-select new entities
      if (processed.result) {
        const newIds = [
          ...processed.result.points.map(p => p.id),
          ...processed.result.edges.map(e => e.id),
        ];
        setSelectedEntities(prev => new Set([...prev, ...newIds]));
      }
      processingRef.current = false;
    });
  }, [fileQueue, processFile]);

  // Auto-run validation when data changes
  useEffect(() => {
    if (allPoints.length > 0 || allEdges.length > 0) {
      const issues = runPostParseValidation(allPoints, allEdges);
      setValidationIssues(issues);
    } else {
      setValidationIssues([]);
    }
  }, [allPoints.length, allEdges.length]);

  // Handle file selection
  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const supported = arr.filter(f => {
      const fmt = detectFormat(f.name);
      return fmt !== 'Desconhecido';
    });
    if (supported.length === 0) return;

    const newItems: FileQueueItem[] = supported.map((f, idx) => ({
      id: `${Date.now()}_${idx}_${f.name}`,
      file: f,
      format: detectFormat(f.name),
      status: 'aguardando' as const,
      progress: 0,
      result: null,
    }));
    setFileQueue(prev => [...prev, ...newItems]);
  }, []);

  const removeFile = (id: string) => {
    const item = fileQueue.find(f => f.id === id);
    if (item?.result) {
      const idsToRemove = new Set([
        ...item.result.points.map(p => p.id),
        ...item.result.edges.map(e => e.id),
      ]);
      setSelectedEntities(prev => { const n = new Set(prev); idsToRemove.forEach(x => n.delete(x)); return n; });
    }
    setFileQueue(prev => prev.filter(f => f.id !== id));
  };

  const clearQueue = () => { setFileQueue([]); setSelectedEntities(new Set()); setExpandedEntities(new Set()); setImportCRS(null); };

  const selectAll = () => {
    const ids = [...filteredPoints.map(p => p.id), ...filteredEdges.map(e => e.id)];
    setSelectedEntities(prev => new Set([...prev, ...ids]));
  };

  const selectNone = () => {
    if (filterLayer === 'all' && filterType === 'all') {
      setSelectedEntities(new Set());
    } else {
      const toRemove = new Set([...filteredPoints.map(p => p.id), ...filteredEdges.map(e => e.id)]);
      setSelectedEntities(prev => { const n = new Set(prev); toRemove.forEach(x => n.delete(x)); return n; });
    }
  };

  const toggleEntity = (id: string) => {
    setSelectedEntities(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleExpand = (key: string) => {
    setExpandedEntities(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  // Confirm import — creates real Trechos from edges preserving connectivity
  const handleConfirm = () => {
    const pontosTopo: PontoTopografico[] = [];
    const trechosResult: Trecho[] = [];
    const seen = new Set<string>();
    let vertexCounter = 0;

    // Helper: get or create a PontoTopografico for a coordinate, deduplicating by position
    const getOrCreatePonto = (x: number, y: number, z: number, baseId: string): PontoTopografico => {
      const key = `${x.toFixed(4)}_${y.toFixed(4)}`;
      const existing = pontosTopo.find(p => `${p.x.toFixed(4)}_${p.y.toFixed(4)}` === key);
      if (existing) return existing;
      const ponto: PontoTopografico = { id: baseId, x, y, cota: z || 0 };
      seen.add(key);
      pontosTopo.push(ponto);
      return ponto;
    };

    // 1. Selected points → PontoTopografico
    allPoints.filter(p => selectedEntities.has(p.id)).forEach(p => {
      getOrCreatePonto(p.x, p.y, p.z, p.id);
    });

    // 2. Selected edges → extract vertices AND create real Trechos
    allEdges.filter(e => selectedEntities.has(e.id)).forEach(e => {
      const edgeCoords = e.isClosed
        ? e.coordinates.slice(0, e.coordinates.length - 1)  // skip duplicate closing vertex
        : e.coordinates;

      // Create PontoTopografico for each vertex of this edge
      const edgePontos: PontoTopografico[] = edgeCoords.map((coord, ci) => {
        vertexCounter++;
        return getOrCreatePonto(coord[0], coord[1], coord[2] || 0, `${e.id}_v${ci}`);
      });

      // Create a Trecho for each consecutive pair of vertices in this edge
      for (let j = 0; j < edgePontos.length - 1; j++) {
        const pStart = edgePontos[j];
        const pEnd = edgePontos[j + 1];
        // Skip zero-length segments
        const dx = pEnd.x - pStart.x;
        const dy = pEnd.y - pStart.y;
        if (Math.sqrt(dx * dx + dy * dy) < 0.001) continue;
        try {
          trechosResult.push(createTrechoFromPoints(pStart, pEnd, diametroMm, material));
        } catch {
          // skip invalid segments (e.g. zero distance)
        }
      }

      // For closed edges, also connect last vertex back to first
      if (e.isClosed && edgePontos.length >= 2) {
        const pLast = edgePontos[edgePontos.length - 1];
        const pFirst = edgePontos[0];
        const dx = pFirst.x - pLast.x;
        const dy = pFirst.y - pLast.y;
        if (Math.sqrt(dx * dx + dy * dy) >= 0.001) {
          try {
            trechosResult.push(createTrechoFromPoints(pLast, pFirst, diametroMm, material));
          } catch { /* skip */ }
        }
      }
    });

    // If we have points but no edges, create sequential trechos as fallback
    if (trechosResult.length === 0 && pontosTopo.length >= 2) {
      for (let j = 0; j < pontosTopo.length - 1; j++) {
        try {
          trechosResult.push(createTrechoFromPoints(pontosTopo[j], pontosTopo[j + 1], diametroMm, material));
        } catch { /* skip */ }
      }
    }

    if (pontosTopo.length < 2 && trechosResult.length === 0) return;

    // Save snapshot for undo (before applying new import)
    if (onBeforeImport) {
      const currentData = onBeforeImport();
      if (currentData && (currentData.pontos.length > 0 || currentData.trechos.length > 0)) {
        saveImportSnapshot(currentData.pontos, currentData.trechos);
        setHasSnapshot(true);
      }
    }

    // Save history
    const historyEntries: ImportHistoryEntry[] = fileQueue.filter(f => f.status === 'ok').map(f => ({
      fileName: f.file.name, format: f.format,
      pointCount: f.result?.points.length || 0, edgeCount: f.result?.edges.length || 0,
      timestamp: new Date().toISOString(),
    }));
    saveImportHistory(historyEntries);

    onImport(pontosTopo, trechosResult);
    clearQueue();
  };

  const isProcessing = fileQueue.some(f => f.status === 'aguardando' || f.status === 'lendo');
  const hasResults = totalEntities > 0;

  return (
    <div className="space-y-3">
      {/* Enhanced Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 cursor-pointer relative overflow-hidden
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 scale-[1.02] shadow-lg shadow-blue-500/20'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }`}
        onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none" />
        )}
        <div className={`transition-transform duration-200 ${isDragging ? 'scale-110' : ''}`}>
          <Upload className={`h-10 w-10 mx-auto mb-2 transition-colors duration-200 ${isDragging ? 'text-blue-500' : 'text-muted-foreground'}`} />
        </div>
        <p className={`text-sm font-medium transition-colors duration-200 ${isDragging ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
          {isDragging ? 'Solte os arquivos aqui!' : 'Arraste ou clique para selecionar arquivos'}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 mt-2">
          {['DXF', 'SHP', 'INP', 'CSV', 'XLSX', 'GeoJSON', 'IFC'].map(fmt => (
            <span key={fmt} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{fmt}</span>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".dxf,.csv,.txt,.xlsx,.xls,.geojson,.json,.ifc,.inp,.shp,.tif,.tiff,.zip"
          className="hidden"
          onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* Undo Last Import + History */}
      <div className="flex items-center gap-2 flex-wrap">
        {hasSnapshot && onUndo && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
            const snapshot = loadImportSnapshot();
            if (snapshot) { onUndo({ pontos: snapshot.pontos, trechos: snapshot.trechos }); setHasSnapshot(false); localStorage.removeItem('hydroImportSnapshot'); }
          }}>
            <Undo2 className="h-3 w-3 mr-1" />Desfazer Ultima Importacao
          </Button>
        )}
        {importHistory.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowHistory(!showHistory)}>
            <History className="h-3 w-3 mr-1" />Historico ({importHistory.length})
          </Button>
        )}
      </div>

      {/* Import History */}
      {showHistory && importHistory.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 text-xs font-medium">Historico de Importacoes</div>
          <div className="max-h-[120px] overflow-auto divide-y divide-border">
            {importHistory.slice(0, 10).map((h, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{h.fileName}</span>
                <Badge variant="outline" className="text-[10px]">{h.format}</Badge>
                <span className="text-muted-foreground">{h.pointCount}pts {h.edgeCount}tr</span>
                <span className="text-muted-foreground text-[10px]">{new Date(h.timestamp).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Queue */}
      {fileQueue.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
            <span className="text-xs font-medium">Fila de Arquivos ({fileQueue.length})</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearQueue}><Trash2 className="h-3 w-3 mr-1" />Limpar</Button>
          </div>
          <div className="divide-y divide-border max-h-[140px] overflow-auto">
            {fileQueue.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1 font-medium">{item.file.name}</span>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">{item.format}</Badge>
                {item.status === 'aguardando' && <Badge variant="secondary" className="text-[10px]">Aguardando</Badge>}
                {item.status === 'lendo' && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                    {item.progress > 0 && item.progress < 100 && (
                      <span className="text-[10px] text-blue-500 font-mono">{item.progress}%</span>
                    )}
                  </span>
                )}
                {item.status === 'ok' && (
                  <Badge className="bg-green-600 text-[10px]">
                    {(item.result?.points.length || 0) + (item.result?.edges.length || 0)} entidades
                  </Badge>
                )}
                {item.status === 'erro' && (
                  <Badge variant="destructive" className="text-[10px]" title={item.error}> Erro</Badge>
                )}
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={ev => { ev.stopPropagation(); removeFile(item.id); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats + Entity Selection */}
      {hasResults && !isProcessing && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Nos/Pontos', value: allPoints.length, color: 'text-green-600' },
              { label: 'Trechos/Linhas', value: allEdges.length, color: 'text-amber-600' },
              { label: 'Layers', value: allLayers.length, color: 'text-purple-600' },
              { label: 'Selecionados', value: selectedEntities.size, color: 'text-blue-600' },
            ].map(s => (
              <div key={s.label} className="bg-muted/50 rounded-lg p-2 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          {/* Extra INP/SWMM counts */}
          {(() => {
            const extras = fileQueue.filter(f => f.status === 'ok' && f.result).map(f => f.result!);
            const totalPatterns = extras.reduce((s, r) => s + (r.patternsCount || 0), 0);
            const totalCurves = extras.reduce((s, r) => s + (r.curvesCount || 0), 0);
            const totalVerts = extras.reduce((s, r) => s + (r.verticesCount || 0), 0);
            if (totalPatterns === 0 && totalCurves === 0 && totalVerts === 0) return null;
            return (
              <div className="flex gap-2 flex-wrap">
                {totalVerts > 0 && <Badge variant="secondary" className="text-[10px]">{totalVerts} vertices</Badge>}
                {totalPatterns > 0 && <Badge variant="secondary" className="text-[10px]">{totalPatterns} padroes</Badge>}
                {totalCurves > 0 && <Badge variant="secondary" className="text-[10px]">{totalCurves} curvas</Badge>}
              </div>
            );
          })()}

          {/* Campos do Arquivo */}
          {allFieldInfo.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                className="flex items-center justify-between w-full px-3 py-2 bg-muted/50 text-xs font-medium hover:bg-muted/70 transition-colors"
                onClick={() => setShowFields(!showFields)}
              >
                <span>Campos do Arquivo ({allFieldInfo.length} campos detectados)</span>
                {showFields ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {showFields && (
                <div className="max-h-[200px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Campo</th>
                        <th className="px-2 py-1 text-left">Tipo</th>
                        <th className="px-2 py-1 text-center">Ocorrencias</th>
                        <th className="px-2 py-1 text-left">Amostras</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {allFieldInfo.map(f => (
                        <tr key={f.name} className="hover:bg-muted/20">
                          <td className="px-2 py-1 font-mono font-medium">{f.name}</td>
                          <td className="px-2 py-1"><Badge variant="outline" className="text-[10px]">{f.type}</Badge></td>
                          <td className="px-2 py-1 text-center">{f.count}</td>
                          <td className="px-2 py-1 text-muted-foreground truncate max-w-[200px]">{f.samples.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterLayer} onChange={e => { setFilterLayer(e.target.value); setCurrentPage(0); }}
              className="text-xs border border-border rounded px-2 py-1 bg-background">
              <option value="all">Todos Layers ({allLayers.length})</option>
              {allLayers.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {allTypes.length > 0 && (
              <select value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(0); }}
                className="text-xs border border-border rounded px-2 py-1 bg-background">
                <option value="all">Todos Tipos</option>
                {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={selectAll}>Selecionar Todos</Button>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={selectNone}>Limpar Selecao</Button>
          </div>

          {/* Entity Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-[250px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 w-8 text-center">
                      <input type="checkbox"
                        checked={filteredPoints.length + filteredEdges.length > 0 && [...filteredPoints.map(p => p.id), ...filteredEdges.map(e => e.id)].every(id => selectedEntities.has(id))}
                        onChange={e => e.target.checked ? selectAll() : selectNone()} />
                    </th>
                    <th className="px-2 py-1.5 text-left">ID</th>
                    <th className="px-2 py-1.5 text-left">Tipo</th>
                    <th className="px-2 py-1.5 text-center">Info</th>
                    <th className="px-2 py-1.5 text-center">Comp.</th>
                    <th className="px-2 py-1.5 text-left">Layer</th>
                    <th className="px-2 py-1.5 text-left">Arquivo</th>
                    <th className="px-2 py-1.5 w-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedEntities.map(entity => {
                    if (entity.type === 'point') {
                      const p = entity.data as ParsedPoint;
                      const rowKey = `p_${p.id}_${p.sourceFile}`;
                      const isExpanded = expandedEntities.has(rowKey);
                      return (
                        <React.Fragment key={rowKey}>
                          <tr className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleEntity(p.id)}>
                            <td className="px-2 py-1 text-center"><input type="checkbox" checked={selectedEntities.has(p.id)} readOnly /></td>
                            <td className="px-2 py-1 font-mono">{p.id}</td>
                            <td className="px-2 py-1">
                              {p.properties.color !== undefined && <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: getDxfColor(p.properties.color) }} />}
                              <Badge variant="outline" className="text-[10px]">{p.properties.entityType || 'POINT'}</Badge>
                            </td>
                            <td className="px-2 py-1 text-center font-mono">{p.x.toFixed(1)}, {p.y.toFixed(1)}</td>
                            <td className="px-2 py-1 text-center text-muted-foreground">—</td>
                            <td className="px-2 py-1">{p.layer}</td>
                            <td className="px-2 py-1 text-muted-foreground truncate max-w-[80px]">{p.sourceFile}</td>
                            <td className="px-2 py-1 text-center">
                              {Object.keys(p.properties).length > 0 && (
                                <button onClick={ev => { ev.stopPropagation(); toggleExpand(rowKey); }} className="text-muted-foreground hover:text-foreground">
                                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="px-4 py-2 bg-muted/20">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                                  {Object.entries(p.properties).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => (
                                    <span key={k}><span className="font-medium text-muted-foreground">{k}:</span> <span className="font-mono">{String(v)}</span></span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    } else {
                      const e = entity.data as ParsedEdge;
                      const rowKey = `e_${e.id}_${e.sourceFile}`;
                      const isExpanded = expandedEntities.has(rowKey);
                      const edgeLen = e.properties.length ?? calculateEdgeLength(e.coordinates);
                      return (
                        <React.Fragment key={rowKey}>
                          <tr className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleEntity(e.id)}>
                            <td className="px-2 py-1 text-center"><input type="checkbox" checked={selectedEntities.has(e.id)} readOnly /></td>
                            <td className="px-2 py-1 font-mono">{e.id}</td>
                            <td className="px-2 py-1">
                              {e.properties.color !== undefined && <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: getDxfColor(e.properties.color) }} />}
                              <Badge variant="outline" className="text-[10px]">{e.type}</Badge>
                            </td>
                            <td className="px-2 py-1 text-center">{e.coordinates.length} vertices</td>
                            <td className="px-2 py-1 text-center font-mono">{edgeLen > 0 ? edgeLen.toFixed(1) : '—'}</td>
                            <td className="px-2 py-1">{e.layer}</td>
                            <td className="px-2 py-1 text-muted-foreground truncate max-w-[80px]">{e.sourceFile}</td>
                            <td className="px-2 py-1 text-center">
                              {Object.keys(e.properties).length > 0 && (
                                <button onClick={ev => { ev.stopPropagation(); toggleExpand(rowKey); }} className="text-muted-foreground hover:text-foreground">
                                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="px-4 py-2 bg-muted/20">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                                  {Object.entries(e.properties).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => (
                                    <span key={k}><span className="font-medium text-muted-foreground">{k}:</span> <span className="font-mono">{String(v)}</span></span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    }
                  })}
                  {filteredTotal === 0 && (
                    <tr><td colSpan={8} className="px-2 py-4 text-center text-muted-foreground">
                      Nenhuma entidade encontrada
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border text-xs">
                <span className="text-muted-foreground">
                  {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredTotal)} de {filteredTotal}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                    disabled={safePage === 0}
                    onClick={() => setCurrentPage(0)}>
                    Inicio
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                    disabled={safePage === 0}
                    onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="px-2 font-medium">{safePage + 1} / {totalPages}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setCurrentPage(totalPages - 1)}>
                    Fim
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Trecho preview count */}
          {allEdges.filter(e => selectedEntities.has(e.id)).length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2 text-xs text-blue-700 dark:text-blue-300">
              {(() => {
                const selEdges = allEdges.filter(e => selectedEntities.has(e.id));
                const trechoCount = selEdges.reduce((acc, e) => {
                  const n = e.isClosed ? e.coordinates.length : Math.max(0, e.coordinates.length - 1);
                  return acc + n;
                }, 0);
                const vertexCount = selEdges.reduce((acc, e) => acc + e.coordinates.length, 0);
                const totalLen = selEdges.reduce((acc, e) => acc + (e.properties.length ?? calculateEdgeLength(e.coordinates)), 0);
                return `${selEdges.length} entidades selecionadas → ${vertexCount} vertices, ~${trechoCount} trechos reais${totalLen > 0 ? `, ${totalLen.toFixed(1)} comprimento total` : ''}`;
              })()}
            </div>
          )}

          {/* CRS Selection — MANDATORY before import */}
          <CRSSelector
            onCRSSelected={setImportCRS}
            sampleCoordinates={allPoints.slice(0, 20).map(p => ({ x: p.x, y: p.y }))}
            initialConfig={importCRS || undefined}
          />

          {/* Import Templates */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              className="flex items-center justify-between w-full px-3 py-2 bg-muted/50 text-xs font-medium hover:bg-muted/70 transition-colors"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              <span className="flex items-center gap-1"><FolderOpen className="h-3.5 w-3.5" /> Templates de Importacao ({templates.length})</span>
              {showTemplates ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {showTemplates && (
              <div className="p-3 space-y-2">
                {templates.length > 0 && (
                  <div className="space-y-1">
                    {templates.map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <Button variant="outline" size="sm" className="h-6 text-xs flex-1 justify-start" onClick={() => {
                          if (t.crsConfig) setImportCRS(t.crsConfig);
                          setFilterLayer(t.filterLayer);
                          setFilterType(t.filterType);
                          // Reselect entities based on saved layers
                          if (t.selectedLayers.length > 0) {
                            const idsToSelect = [
                              ...allPoints.filter(p => t.selectedLayers.includes(p.layer)).map(p => p.id),
                              ...allEdges.filter(e => t.selectedLayers.includes(e.layer)).map(e => e.id),
                            ];
                            setSelectedEntities(new Set(idsToSelect));
                          }
                        }}>
                          <FolderOpen className="h-3 w-3 mr-1" />{t.name}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                          deleteImportTemplate(t.id);
                          setTemplates(loadImportTemplates());
                        }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text" placeholder="Nome do template..."
                    value={templateName} onChange={e => setTemplateName(e.target.value)}
                    className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background"
                  />
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!templateName.trim()}
                    onClick={() => {
                      const selectedLayerNames = [...new Set([
                        ...allPoints.filter(p => selectedEntities.has(p.id)).map(p => p.layer),
                        ...allEdges.filter(e => selectedEntities.has(e.id)).map(e => e.layer),
                      ])];
                      const template: ImportTemplate = {
                        id: Date.now().toString(),
                        name: templateName.trim(),
                        selectedLayers: selectedLayerNames,
                        crsConfig: importCRS,
                        filterLayer, filterType,
                        createdAt: new Date().toISOString(),
                      };
                      saveImportTemplate(template);
                      setTemplates(loadImportTemplates());
                      setTemplateName('');
                    }}>
                    <Save className="h-3 w-3 mr-1" />Salvar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Validation Report */}
          {validationIssues.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                className="flex items-center justify-between w-full px-3 py-2 bg-muted/50 text-xs font-medium hover:bg-muted/70 transition-colors"
                onClick={() => setShowValidation(!showValidation)}
              >
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Validacao ({validationIssues.filter(i => i.type === 'warning').length} avisos, {validationIssues.filter(i => i.type === 'error').length} erros, {validationIssues.filter(i => i.type === 'info').length} info)
                </span>
                {showValidation ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {showValidation && (
                <div className="divide-y divide-border">
                  {validationIssues.map((issue, idx) => (
                    <div key={idx} className={`px-3 py-2 text-xs ${
                      issue.type === 'error' ? 'bg-red-50 dark:bg-red-950/20' :
                      issue.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20' :
                      'bg-blue-50 dark:bg-blue-950/20'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Badge variant={issue.type === 'error' ? 'destructive' : issue.type === 'warning' ? 'secondary' : 'outline'} className="text-[10px]">
                          {issue.type === 'error' ? 'ERRO' : issue.type === 'warning' ? 'AVISO' : 'INFO'}
                        </Badge>
                        <span className="font-medium">{issue.category}</span>
                        <span className="text-muted-foreground">— {issue.message}</span>
                      </div>
                      {issue.details && issue.details.length > 0 && (
                        <div className="mt-1 ml-6 text-[10px] text-muted-foreground space-y-0.5">
                          {issue.details.map((d, di) => <div key={di}>• {d}</div>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* UTM Validation Warning */}
          {importCRS?.type === 'utm' && allPoints.length > 0 && (() => {
            const invalidPts = allPoints.slice(0, 50).filter(p => !validateUTMRange(p.x, p.y).valid);
            if (invalidPts.length === 0) return null;
            return (
              <div className="flex items-start gap-2 border border-amber-500 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {invalidPts.length} ponto(s) fora da faixa UTM esperada (X: 100.000-900.000, Y: 1.000.000-10.000.000).
                  Verifique se o CRS está correto ou use "Transformar Coordenadas" após importar.
                </span>
              </div>
            );
          })()}

          {/* Confirm */}
          <Button
            className="w-full"
            disabled={selectedEntities.size === 0 || !importCRS}
            onClick={handleConfirm}
          >
            <Check className="h-4 w-4 mr-2" />
            {!importCRS
              ? 'Defina o CRS antes de importar'
              : `Confirmar Importacao (${selectedEntities.size} entidades selecionadas)`
            }
          </Button>
        </>
      )}

      {/* Processing indicator */}
      {isProcessing && !hasResults && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processando arquivos...
        </div>
      )}
    </div>
  );
};

export default UnifiedImportPanel;
