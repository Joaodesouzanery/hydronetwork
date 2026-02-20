/**
 * UnifiedImportPanel - Painel unico de importacao multi-arquivo
 * Suporta: DXF, CSV, TXT, XLSX, GeoJSON, IFC
 * Fila de processamento, selecao por camada, confirmar → processPoints()
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PontoTopografico, parseTopographyCSV } from '@/engine/reader';
import { Upload, Trash2, Check, X, FileText, Loader2 } from 'lucide-react';

// ── Types ──

interface ParsedPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  layer: string;
  sourceFile: string;
}

interface ParsedEdge {
  id: string;
  type: string;
  coordinates: number[][];
  isClosed: boolean;
  layer: string;
  sourceFile: string;
}

interface ParseResult {
  points: ParsedPoint[];
  edges: ParsedEdge[];
  layers: string[];
}

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

interface UnifiedImportPanelProps {
  onImport: (pontos: PontoTopografico[]) => void;
}

// ── Parsers ──

function parseDXFComplete(content: string, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const layersSet = new Set<string>();
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let inEntities = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]?.trim();
    if (line === 'ENTITIES') { inEntities = true; i++; continue; }
    if (inEntities && line === 'ENDSEC') break;
    if (!inEntities) { i++; continue; }

    if (line === '0') {
      i++;
      const entityType = lines[i]?.trim().toUpperCase();

      if (entityType === 'LWPOLYLINE') {
        const coords: number[][] = [];
        let handle = '', layer = '0', closed = false, cx: number | null = null, cy: number | null = null, cz = 0, elev = 0;
        i++;
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) handle = val;
          if (code === 8) { layer = val; layersSet.add(val); }
          if (code === 38) elev = parseFloat(val);
          if (code === 70) closed = (parseInt(val) & 1) === 1;
          if (code === 10) { if (cx !== null && cy !== null) coords.push([cx, cy, cz || elev]); cx = parseFloat(val); cy = null; cz = elev; }
          if (code === 20) cy = parseFloat(val);
          if (code === 30) cz = parseFloat(val);
          i += 2;
        }
        if (cx !== null && cy !== null) coords.push([cx, cy, cz || elev]);
        if (closed && coords.length > 0) coords.push([...coords[0]]);
        if (coords.length >= 2) edges.push({ id: handle || `lw_${edges.length}`, type: 'LWPOLYLINE', coordinates: coords, isClosed: closed, layer, sourceFile: fileName });
        continue;
      }

      if (entityType === 'LINE') {
        let handle = '', layer = '0';
        let x1: number | null = null, y1: number | null = null, z1 = 0, x2: number | null = null, y2: number | null = null, z2 = 0;
        i++;
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) handle = val;
          if (code === 8) { layer = val; layersSet.add(val); }
          if (code === 10) x1 = parseFloat(val);
          if (code === 20) y1 = parseFloat(val);
          if (code === 30) z1 = parseFloat(val);
          if (code === 11) x2 = parseFloat(val);
          if (code === 21) y2 = parseFloat(val);
          if (code === 31) z2 = parseFloat(val);
          i += 2;
        }
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
          edges.push({ id: handle || `ln_${edges.length}`, type: 'LINE', coordinates: [[x1, y1, z1], [x2, y2, z2]], isClosed: false, layer, sourceFile: fileName });
          layersSet.add(layer);
        }
        continue;
      }

      if (entityType === 'POLYLINE') {
        let handle = '', layer = '0', closed = false;
        const coords: number[][] = [];
        i++;
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0 && val === 'SEQEND') { i += 2; break; }
          if (code === 5) handle = val;
          if (code === 8) { layer = val; layersSet.add(val); }
          if (code === 70) closed = (parseInt(val) & 1) === 1;
          if (code === 0 && val === 'VERTEX') {
            i += 2;
            let vx: number | null = null, vy: number | null = null, vz = 0;
            while (i < lines.length - 1) {
              const vc = parseInt(lines[i]?.trim() || '');
              const vv = lines[i + 1]?.trim() || '';
              if (vc === 0) break;
              if (vc === 10) vx = parseFloat(vv);
              if (vc === 20) vy = parseFloat(vv);
              if (vc === 30) vz = parseFloat(vv);
              i += 2;
            }
            if (vx !== null && vy !== null) coords.push([vx, vy, vz]);
            continue;
          }
          i += 2;
        }
        if (closed && coords.length > 0) coords.push([...coords[0]]);
        if (coords.length >= 2) edges.push({ id: handle || `pl_${edges.length}`, type: 'POLYLINE', coordinates: coords, isClosed: closed, layer, sourceFile: fileName });
        continue;
      }

      if (entityType === 'POINT') {
        let handle = '', layer = '0', x: number | null = null, y: number | null = null, z = 0;
        i++;
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) handle = val;
          if (code === 8) { layer = val; layersSet.add(val); }
          if (code === 10) x = parseFloat(val);
          if (code === 20) y = parseFloat(val);
          if (code === 30) z = parseFloat(val);
          i += 2;
        }
        if (x !== null && y !== null) {
          points.push({ id: handle || `pt_${points.length}`, x, y, z, layer, sourceFile: fileName });
          layersSet.add(layer);
        }
        continue;
      }

      if (entityType === 'CIRCLE' || entityType === 'ARC') {
        let handle = '', layer = '0', cx2 = 0, cy2 = 0, cz2 = 0, radius = 0, startAngle = 0, endAngle = 360;
        i++;
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) handle = val;
          if (code === 8) { layer = val; layersSet.add(val); }
          if (code === 10) cx2 = parseFloat(val);
          if (code === 20) cy2 = parseFloat(val);
          if (code === 30) cz2 = parseFloat(val);
          if (code === 40) radius = parseFloat(val);
          if (code === 50) startAngle = parseFloat(val);
          if (code === 51) endAngle = parseFloat(val);
          i += 2;
        }
        const coords: number[][] = [];
        const segs = entityType === 'CIRCLE' ? 36 : Math.max(8, Math.ceil(Math.abs(endAngle - startAngle) / 10));
        const sA = (startAngle * Math.PI) / 180;
        const eA = entityType === 'CIRCLE' ? sA + 2 * Math.PI : (endAngle * Math.PI) / 180;
        for (let j = 0; j <= segs; j++) {
          const angle = sA + (eA - sA) * (j / segs);
          coords.push([cx2 + radius * Math.cos(angle), cy2 + radius * Math.sin(angle), cz2]);
        }
        if (coords.length > 0) edges.push({ id: handle || `${entityType.toLowerCase()}_${edges.length}`, type: entityType, coordinates: coords, isClosed: entityType === 'CIRCLE', layer, sourceFile: fileName });
        continue;
      }

      if (entityType === 'SPLINE') {
        let handle = '', layer = '0', closed = false;
        const controlPts: number[][] = [];
        const fitPts: number[][] = [];
        let sx: number | null = null, sy: number | null = null, sz = 0;
        i++;
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) handle = val;
          if (code === 8) { layer = val; layersSet.add(val); }
          if (code === 70) closed = (parseInt(val) & 1) === 1;
          if (code === 10) { if (sx !== null && sy !== null) controlPts.push([sx, sy, sz]); sx = parseFloat(val); sy = null; sz = 0; }
          if (code === 20) sy = parseFloat(val);
          if (code === 30) sz = parseFloat(val);
          if (code === 11) fitPts.push([parseFloat(val), 0, 0]);
          if (code === 21 && fitPts.length > 0) fitPts[fitPts.length - 1][1] = parseFloat(val);
          if (code === 31 && fitPts.length > 0) fitPts[fitPts.length - 1][2] = parseFloat(val);
          i += 2;
        }
        if (sx !== null && sy !== null) controlPts.push([sx, sy, sz]);
        const coords = fitPts.length > 0 ? fitPts : controlPts;
        if (closed && coords.length > 0) coords.push([...coords[0]]);
        if (coords.length >= 2) edges.push({ id: handle || `spl_${edges.length}`, type: 'SPLINE', coordinates: coords, isClosed: closed, layer, sourceFile: fileName });
        continue;
      }
    }
    i++;
  }
  return { points, edges, layers: Array.from(layersSet) };
}

function parseCSVContent(content: string, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const csvLines = content.split('\n').filter(l => l.trim());
  if (csvLines.length < 2) return { points, edges, layers: [] };

  const delim = csvLines[0].includes(';') ? ';' : csvLines[0].includes('\t') ? '\t' : ',';
  const headers = csvLines[0].split(delim).map(h => h.trim().replace(/"/g, ''));
  const isHeader = headers.some(h => isNaN(Number(h)) && h.length > 0);

  if (!isHeader) {
    // Headerless CSV: try parseTopographyCSV format (id,x,y,cota or x,y,cota)
    try {
      const pts = parseTopographyCSV(content);
      return {
        points: pts.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.cota, layer: 'CSV', sourceFile: fileName })),
        edges: [],
        layers: ['CSV'],
      };
    } catch { return { points, edges, layers: [] }; }
  }

  const xField = headers.find(h => /^(x|coord_?x|longitude|lon|este|easting|e)$/i.test(h));
  const yField = headers.find(h => /^(y|coord_?y|latitude|lat|norte|northing|n)$/i.test(h));
  const zField = headers.find(h => /^(z|coord_?z|cota|elevation|elev|altitude|alt|h)$/i.test(h));
  const idField = headers.find(h => /^(id|codigo|nome|name)$/i.test(h));
  const xIniField = headers.find(h => /^(x_?ini|x_?inicio|x_?start|x1|x_?mont)$/i.test(h));
  const yIniField = headers.find(h => /^(y_?ini|y_?inicio|y_?start|y1|y_?mont)$/i.test(h));
  const xFimField = headers.find(h => /^(x_?fim|x_?end|x2|x_?jus)$/i.test(h));
  const yFimField = headers.find(h => /^(y_?fim|y_?end|y2|y_?jus)$/i.test(h));

  for (let r = 1; r < csvLines.length; r++) {
    const vals = csvLines[r].split(delim).map(v => v.trim().replace(/"/g, ''));
    const attrs: Record<string, string> = {};
    headers.forEach((h, j) => { attrs[h] = vals[j] || ''; });
    const id = (idField ? attrs[idField] : '') || `row_${r}`;

    if (xField && yField) {
      const x = parseFloat(attrs[xField].replace(',', '.'));
      const y = parseFloat(attrs[yField].replace(',', '.'));
      const z = zField ? parseFloat(attrs[zField].replace(',', '.')) || 0 : 0;
      if (!isNaN(x) && !isNaN(y)) points.push({ id, x, y, z, layer: 'CSV', sourceFile: fileName });
    }

    if (xIniField && yIniField && xFimField && yFimField) {
      const x1 = parseFloat(attrs[xIniField].replace(',', '.'));
      const y1 = parseFloat(attrs[yIniField].replace(',', '.'));
      const x2 = parseFloat(attrs[xFimField].replace(',', '.'));
      const y2 = parseFloat(attrs[yFimField].replace(',', '.'));
      if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2))
        edges.push({ id, type: 'LINE', coordinates: [[x1, y1, 0], [x2, y2, 0]], isClosed: false, layer: 'CSV', sourceFile: fileName });
    }
  }
  return { points, edges, layers: points.length > 0 || edges.length > 0 ? ['CSV'] : [] };
}

function parseGeoJSONContent(content: string, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const layersSet = new Set<string>();
  try {
    const json = JSON.parse(content);
    const features = json.features || (json.type === 'Feature' ? [json] : []);
    features.forEach((f: any, idx: number) => {
      const props = f.properties || {};
      const layer = props.layer || 'GeoJSON';
      layersSet.add(layer);
      const id = f.id || props.id || `feat_${idx}`;
      const geom = f.geometry;
      if (!geom) return;
      if (geom.type === 'Point') {
        const [x, y, z = 0] = geom.coordinates;
        points.push({ id, x, y, z, layer, sourceFile: fileName });
      }
      if (geom.type === 'LineString') {
        edges.push({ id, type: 'LineString', coordinates: geom.coordinates.map((c: number[]) => [c[0], c[1], c[2] || 0]), isClosed: false, layer, sourceFile: fileName });
      }
      if (geom.type === 'Polygon') {
        geom.coordinates.forEach((ring: number[][], ri: number) => {
          edges.push({ id: `${id}_ring${ri}`, type: 'Polygon', coordinates: ring.map((c: number[]) => [c[0], c[1], c[2] || 0]), isClosed: true, layer, sourceFile: fileName });
        });
      }
      if (geom.type === 'MultiLineString') {
        geom.coordinates.forEach((line: number[][], li: number) => {
          edges.push({ id: `${id}_line${li}`, type: 'MultiLineString', coordinates: line.map((c: number[]) => [c[0], c[1], c[2] || 0]), isClosed: false, layer, sourceFile: fileName });
        });
      }
    });
  } catch { /* invalid JSON */ }
  return { points, edges, layers: Array.from(layersSet) };
}

function parseXLSXContent(buffer: ArrayBuffer, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
  if (data.length === 0) return { points, edges: [], layers: [] };

  const headers = Object.keys(data[0]);
  const xField = headers.find(h => /^(x|coord_?x|longitude|lon|este|easting)$/i.test(h));
  const yField = headers.find(h => /^(y|coord_?y|latitude|lat|norte|northing)$/i.test(h));
  const zField = headers.find(h => /^(z|cota|elevation|elev|altitude)$/i.test(h));
  const idField = headers.find(h => /^(id|codigo|nome|name)$/i.test(h));

  if (!xField || !yField) return { points, edges: [], layers: [] };

  data.forEach((row, i) => {
    const x = parseFloat(String(row[xField]));
    const y = parseFloat(String(row[yField]));
    const z = zField ? parseFloat(String(row[zField])) : 0;
    if (isNaN(x) || isNaN(y)) return;
    const id = idField ? String(row[idField] || `P${String(i + 1).padStart(3, '0')}`) : `P${String(i + 1).padStart(3, '0')}`;
    points.push({ id, x, y, z: isNaN(z) ? 0 : z, layer: 'XLSX', sourceFile: fileName });
  });
  return { points, edges: [], layers: points.length > 0 ? ['XLSX'] : [] };
}

function parseIFCContent(content: string, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const ifcLines = content.split(/\r?\n/);
  let autoId = 1;
  for (const line of ifcLines) {
    const m = line.match(/IFCCARTESIANPOINT\s*\(\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*(?:,\s*([-\d.eE+]+))?\s*\)/i);
    if (m) {
      points.push({ id: `IFC_${autoId++}`, x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3] || '0'), layer: 'IFC', sourceFile: fileName });
      if (autoId > 5000) break;
    }
  }
  return { points, edges: [], layers: points.length > 0 ? ['IFC'] : [] };
}

// ── Persistence ──

function saveImportHistory(entries: ImportHistoryEntry[]) {
  try {
    const existing: ImportHistoryEntry[] = JSON.parse(localStorage.getItem('hydroImportHistory') || '[]');
    const merged = [...entries, ...existing].slice(0, 20);
    localStorage.setItem('hydroImportHistory', JSON.stringify(merged));
  } catch { /* ignore */ }
}

// ── Component ──

export const UnifiedImportPanel: React.FC<UnifiedImportPanelProps> = ({ onImport }) => {
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [filterLayer, setFilterLayer] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  // Merged data from all files
  const allPoints = fileQueue.filter(f => f.status === 'ok').flatMap(f => f.result?.points ?? []);
  const allEdges = fileQueue.filter(f => f.status === 'ok').flatMap(f => f.result?.edges ?? []);
  const allLayers = [...new Set([...allPoints.map(p => p.layer), ...allEdges.map(e => e.layer)])];
  const allTypes = [...new Set(allEdges.map(e => e.type))];
  const totalEntities = allPoints.length + allEdges.length;

  // Filtered
  const filteredPoints = allPoints.filter(p => (filterLayer === 'all' || p.layer === filterLayer));
  const filteredEdges = allEdges.filter(e => (filterLayer === 'all' || e.layer === filterLayer) && (filterType === 'all' || e.type === filterType));

  // File detection
  const detectFormat = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = { dxf: 'DXF', csv: 'CSV', txt: 'TXT', xlsx: 'XLSX', xls: 'XLSX', geojson: 'GeoJSON', json: 'GeoJSON', ifc: 'IFC' };
    return map[ext] || 'Desconhecido';
  };

  // Process a single file
  const processFile = useCallback(async (item: FileQueueItem): Promise<FileQueueItem> => {
    try {
      const format = item.format;
      let result: ParseResult;

      if (format === 'DXF') {
        const text = await item.file.text();
        result = parseDXFComplete(text, item.file.name);
      } else if (format === 'CSV' || format === 'TXT') {
        const text = await item.file.text();
        result = parseCSVContent(text, item.file.name);
      } else if (format === 'GeoJSON') {
        const text = await item.file.text();
        result = parseGeoJSONContent(text, item.file.name);
      } else if (format === 'XLSX') {
        const buffer = await item.file.arrayBuffer();
        result = parseXLSXContent(buffer, item.file.name);
      } else if (format === 'IFC') {
        const text = await item.file.text();
        result = parseIFCContent(text, item.file.name);
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
  }, []);

  // Process queue
  useEffect(() => {
    if (processingRef.current) return;
    const pending = fileQueue.find(f => f.status === 'aguardando');
    if (!pending) return;

    processingRef.current = true;
    setFileQueue(prev => prev.map(f => f.id === pending.id ? { ...f, status: 'lendo', progress: 30 } : f));

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

  const clearQueue = () => { setFileQueue([]); setSelectedEntities(new Set()); };

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

  // Confirm import
  const handleConfirm = () => {
    const pontosTopo: PontoTopografico[] = [];
    const seen = new Set<string>();

    // Selected points → PontoTopografico
    allPoints.filter(p => selectedEntities.has(p.id)).forEach(p => {
      const key = `${p.x.toFixed(4)}_${p.y.toFixed(4)}`;
      if (!seen.has(key)) { seen.add(key); pontosTopo.push({ id: p.id, x: p.x, y: p.y, cota: p.z || 0 }); }
    });

    // Selected edges → extract unique vertices as PontoTopografico
    allEdges.filter(e => selectedEntities.has(e.id)).forEach(e => {
      e.coordinates.forEach((coord, ci) => {
        const key = `${coord[0].toFixed(4)}_${coord[1].toFixed(4)}`;
        if (!seen.has(key)) { seen.add(key); pontosTopo.push({ id: `${e.id}_v${ci}`, x: coord[0], y: coord[1], cota: coord[2] || 0 }); }
      });
    });

    if (pontosTopo.length < 2) return;

    // Save history
    const historyEntries: ImportHistoryEntry[] = fileQueue.filter(f => f.status === 'ok').map(f => ({
      fileName: f.file.name, format: f.format,
      pointCount: f.result?.points.length || 0, edgeCount: f.result?.edges.length || 0,
      timestamp: new Date().toISOString(),
    }));
    saveImportHistory(historyEntries);

    onImport(pontosTopo);
    clearQueue();
  };

  const isProcessing = fileQueue.some(f => f.status === 'aguardando' || f.status === 'lendo');
  const hasResults = totalEntities > 0;

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-border hover:border-primary/50'}`}
        onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-1 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Arraste ou clique para selecionar arquivos</p>
        <p className="text-xs text-muted-foreground mt-1">
          <strong>DXF</strong>, CSV, TXT, <strong>XLSX</strong>, GeoJSON, <strong>IFC</strong> — selecao multipla
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".dxf,.csv,.txt,.xlsx,.xls,.geojson,.json,.ifc"
          className="hidden"
          onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

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
                {item.status === 'lendo' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
                {item.status === 'ok' && (
                  <Badge className="bg-green-600 text-[10px]">
                    {(item.result?.points.length || 0) + (item.result?.edges.length || 0)} entidades
                  </Badge>
                )}
                {item.status === 'erro' && (
                  <Badge variant="destructive" className="text-[10px]" title={item.error}> Erro</Badge>
                )}
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={e => { e.stopPropagation(); removeFile(item.id); }}>
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
              { label: 'Pontos', value: allPoints.length, color: 'text-green-600' },
              { label: 'Trechos', value: allEdges.length, color: 'text-amber-600' },
              { label: 'Layers', value: allLayers.length, color: 'text-purple-600' },
              { label: 'Selecionados', value: selectedEntities.size, color: 'text-blue-600' },
            ].map(s => (
              <div key={s.label} className="bg-muted/50 rounded-lg p-2 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterLayer} onChange={e => setFilterLayer(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background">
              <option value="all">Todos Layers ({allLayers.length})</option>
              {allLayers.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {allTypes.length > 0 && (
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
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
            <div className="max-h-[200px] overflow-auto">
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
                    <th className="px-2 py-1.5 text-left">Layer</th>
                    <th className="px-2 py-1.5 text-left">Arquivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPoints.slice(0, 100).map(p => (
                    <tr key={`p_${p.id}_${p.sourceFile}`} className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleEntity(p.id)}>
                      <td className="px-2 py-1 text-center"><input type="checkbox" checked={selectedEntities.has(p.id)} readOnly /></td>
                      <td className="px-2 py-1 font-mono">{p.id}</td>
                      <td className="px-2 py-1"><Badge variant="outline" className="text-[10px]">POINT</Badge></td>
                      <td className="px-2 py-1 text-center font-mono">{p.x.toFixed(1)}, {p.y.toFixed(1)}</td>
                      <td className="px-2 py-1">{p.layer}</td>
                      <td className="px-2 py-1 text-muted-foreground truncate max-w-[80px]">{p.sourceFile}</td>
                    </tr>
                  ))}
                  {filteredEdges.slice(0, 100).map(e => (
                    <tr key={`e_${e.id}_${e.sourceFile}`} className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleEntity(e.id)}>
                      <td className="px-2 py-1 text-center"><input type="checkbox" checked={selectedEntities.has(e.id)} readOnly /></td>
                      <td className="px-2 py-1 font-mono">{e.id}</td>
                      <td className="px-2 py-1"><Badge variant="outline" className="text-[10px]">{e.type}</Badge></td>
                      <td className="px-2 py-1 text-center">{e.coordinates.length} vertices</td>
                      <td className="px-2 py-1">{e.layer}</td>
                      <td className="px-2 py-1 text-muted-foreground truncate max-w-[80px]">{e.sourceFile}</td>
                    </tr>
                  ))}
                  {(filteredPoints.length > 100 || filteredEdges.length > 100) && (
                    <tr><td colSpan={6} className="px-2 py-1.5 text-center text-muted-foreground">
                      ... e mais {Math.max(0, filteredPoints.length - 100) + Math.max(0, filteredEdges.length - 100)} entidades
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirm */}
          <Button
            className="w-full"
            disabled={selectedEntities.size === 0}
            onClick={handleConfirm}
          >
            <Check className="h-4 w-4 mr-2" />
            Confirmar Importacao ({selectedEntities.size} entidades)
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
