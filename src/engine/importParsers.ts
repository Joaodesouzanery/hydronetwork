/**
 * importParsers.ts — Pure parsing functions for import file formats.
 *
 * Extracted from UnifiedImportPanel so they can be used both on the
 * main thread (fallback) and inside a Web Worker (preferred).
 *
 * Supported: DXF, CSV/TXT, GeoJSON, XLSX, IFC
 * INP/SWMM/SHP/TIF remain in UnifiedImportPanel (external dependencies).
 */

import * as XLSX from 'xlsx';
import { parseTopographyCSV } from '@/engine/reader';

// ── Shared Types ──

export interface ParsedPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  layer: string;
  sourceFile: string;
  properties: Record<string, any>;
}

export interface ParsedEdge {
  id: string;
  type: string;
  coordinates: number[][];
  isClosed: boolean;
  layer: string;
  sourceFile: string;
  properties: Record<string, any>;
}

export interface ParseResult {
  points: ParsedPoint[];
  edges: ParsedEdge[];
  layers: string[];
  fields: string[];
  patternsCount?: number;
  curvesCount?: number;
  verticesCount?: number;
}

// ── Helpers ──

export function calculateEdgeLength(coords: number[][]): number {
  let len = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = coords[i + 1][0] - coords[i][0];
    const dy = coords[i + 1][1] - coords[i][1];
    const dz = (coords[i + 1][2] || 0) - (coords[i][2] || 0);
    len += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return len;
}

/** Map DXF ACI color index to CSS color */
export function getDxfColor(colorIndex: number): string {
  const colors: Record<number, string> = {
    1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff',
    6: '#ff00ff', 7: '#ffffff', 8: '#808080', 9: '#c0c0c0',
    10: '#ff0000', 30: '#ff7f00', 40: '#ffff00', 50: '#00ff00',
    70: '#00ffff', 90: '#0000ff', 110: '#ff00ff', 130: '#ff7f7f',
    150: '#ffff7f', 170: '#7fff7f', 190: '#7fffff', 210: '#7f7fff',
    230: '#ff7fff', 250: '#7f7f7f',
  };
  return colors[colorIndex] || '#888888';
}

// ── DXF Parser ──

export function parseDXFComplete(
  content: string,
  fileName: string,
  onProgress?: (pct: number) => void,
): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const layersSet = new Set<string>();
  const fieldsSet = new Set<string>();
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let inEntities = false;
  let i = 0;
  const totalLines = lines.length;
  let lastPct = 0;

  // Standard fields always tracked
  fieldsSet.add('handle'); fieldsSet.add('layer'); fieldsSet.add('entityType');

  while (i < totalLines) {
    // Progress reporting every 5%
    if (onProgress) {
      const pct = Math.round((i / totalLines) * 100);
      if (pct >= lastPct + 5) {
        onProgress(pct);
        lastPct = pct;
      }
    }

    const line = lines[i]?.trim();
    if (line === 'ENTITIES') { inEntities = true; i++; continue; }
    if (inEntities && line === 'ENDSEC') break;
    if (!inEntities) { i++; continue; }

    if (line === '0') {
      i++;
      const entityType = lines[i]?.trim().toUpperCase();

      // ── LWPOLYLINE / 3DPOLYLINE ──
      if (entityType === 'LWPOLYLINE' || entityType === '3DPOLYLINE') {
        const coords: number[][] = [];
        let handle = '', layer = '0', closed = false, cx: number | null = null, cy: number | null = null, cz = 0, elev = 0;
        const props: Record<string, any> = { entityType };
        i++;
        while (i < totalLines - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) { handle = val; props.handle = val; }
          if (code === 6) { props.lineType = val; fieldsSet.add('lineType'); }
          if (code === 8) { layer = val; layersSet.add(val); props.layer = val; }
          if (code === 38) { elev = parseFloat(val); props.elevation = elev; fieldsSet.add('elevation'); }
          if (code === 39) { props.thickness = parseFloat(val); fieldsSet.add('thickness'); }
          if (code === 48) { props.lineTypeScale = parseFloat(val); fieldsSet.add('lineTypeScale'); }
          if (code === 62) { props.color = parseInt(val); fieldsSet.add('color'); }
          if (code === 70) { closed = (parseInt(val) & 1) === 1; props.flags = parseInt(val); fieldsSet.add('flags'); }
          if (code === 370) { props.lineweight = parseInt(val); fieldsSet.add('lineweight'); }
          if (code === 210) { props.extrusionX = parseFloat(val); fieldsSet.add('extrusionX'); }
          if (code === 220) { props.extrusionY = parseFloat(val); fieldsSet.add('extrusionY'); }
          if (code === 230) { props.extrusionZ = parseFloat(val); fieldsSet.add('extrusionZ'); }
          if (code === 10) { if (cx !== null && cy !== null) coords.push([cx, cy, cz || elev]); cx = parseFloat(val); cy = null; cz = elev; }
          if (code === 20) cy = parseFloat(val);
          if (code === 30) cz = parseFloat(val);
          i += 2;
        }
        if (cx !== null && cy !== null) coords.push([cx, cy, cz || elev]);
        if (closed && coords.length > 0) coords.push([...coords[0]]);
        if (coords.length >= 2) {
          props.vertexCount = coords.length;
          props.length = calculateEdgeLength(coords);
          fieldsSet.add('vertexCount'); fieldsSet.add('length');
          edges.push({ id: handle || `lw_${edges.length}`, type: entityType, coordinates: coords, isClosed: closed, layer, sourceFile: fileName, properties: props });
        }
        continue;
      }

      // ── LINE ──
      if (entityType === 'LINE') {
        let handle = '', layer = '0';
        let x1: number | null = null, y1: number | null = null, z1 = 0, x2: number | null = null, y2: number | null = null, z2 = 0;
        const props: Record<string, any> = { entityType };
        i++;
        while (i < totalLines - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) { handle = val; props.handle = val; }
          if (code === 6) { props.lineType = val; fieldsSet.add('lineType'); }
          if (code === 8) { layer = val; layersSet.add(val); props.layer = val; }
          if (code === 39) { props.thickness = parseFloat(val); fieldsSet.add('thickness'); }
          if (code === 48) { props.lineTypeScale = parseFloat(val); fieldsSet.add('lineTypeScale'); }
          if (code === 62) { props.color = parseInt(val); fieldsSet.add('color'); }
          if (code === 370) { props.lineweight = parseInt(val); fieldsSet.add('lineweight'); }
          if (code === 210) { props.extrusionX = parseFloat(val); fieldsSet.add('extrusionX'); }
          if (code === 220) { props.extrusionY = parseFloat(val); fieldsSet.add('extrusionY'); }
          if (code === 230) { props.extrusionZ = parseFloat(val); fieldsSet.add('extrusionZ'); }
          if (code === 10) x1 = parseFloat(val);
          if (code === 20) y1 = parseFloat(val);
          if (code === 30) z1 = parseFloat(val);
          if (code === 11) x2 = parseFloat(val);
          if (code === 21) y2 = parseFloat(val);
          if (code === 31) z2 = parseFloat(val);
          i += 2;
        }
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
          const dx = x2 - x1, dy = y2 - y1, dz2 = z2 - z1;
          props.length = Math.sqrt(dx * dx + dy * dy + dz2 * dz2);
          fieldsSet.add('length');
          edges.push({ id: handle || `ln_${edges.length}`, type: 'LINE', coordinates: [[x1, y1, z1], [x2, y2, z2]], isClosed: false, layer, sourceFile: fileName, properties: props });
          layersSet.add(layer);
        }
        continue;
      }

      // ── POLYLINE ──
      if (entityType === 'POLYLINE') {
        let handle = '', layer = '0', closed = false;
        const coords: number[][] = [];
        const props: Record<string, any> = { entityType };
        i++;
        while (i < totalLines - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0 && val === 'SEQEND') { i += 2; break; }
          if (code === 5) { handle = val; props.handle = val; }
          if (code === 6) { props.lineType = val; fieldsSet.add('lineType'); }
          if (code === 8) { layer = val; layersSet.add(val); props.layer = val; }
          if (code === 39) { props.thickness = parseFloat(val); fieldsSet.add('thickness'); }
          if (code === 48) { props.lineTypeScale = parseFloat(val); fieldsSet.add('lineTypeScale'); }
          if (code === 62) { props.color = parseInt(val); fieldsSet.add('color'); }
          if (code === 70) { closed = (parseInt(val) & 1) === 1; props.flags = parseInt(val); fieldsSet.add('flags'); }
          if (code === 370) { props.lineweight = parseInt(val); fieldsSet.add('lineweight'); }
          if (code === 0 && val === 'VERTEX') {
            i += 2;
            let vx: number | null = null, vy: number | null = null, vz = 0;
            while (i < totalLines - 1) {
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
        if (coords.length >= 2) {
          props.vertexCount = coords.length;
          props.length = calculateEdgeLength(coords);
          fieldsSet.add('vertexCount'); fieldsSet.add('length');
          edges.push({ id: handle || `pl_${edges.length}`, type: 'POLYLINE', coordinates: coords, isClosed: closed, layer, sourceFile: fileName, properties: props });
        }
        continue;
      }

      // ── POINT ──
      if (entityType === 'POINT') {
        let handle = '', layer = '0', x: number | null = null, y: number | null = null, z = 0;
        const props: Record<string, any> = { entityType };
        i++;
        while (i < totalLines - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) { handle = val; props.handle = val; }
          if (code === 6) { props.lineType = val; fieldsSet.add('lineType'); }
          if (code === 8) { layer = val; layersSet.add(val); props.layer = val; }
          if (code === 39) { props.thickness = parseFloat(val); fieldsSet.add('thickness'); }
          if (code === 62) { props.color = parseInt(val); fieldsSet.add('color'); }
          if (code === 370) { props.lineweight = parseInt(val); fieldsSet.add('lineweight'); }
          if (code === 10) x = parseFloat(val);
          if (code === 20) y = parseFloat(val);
          if (code === 30) z = parseFloat(val);
          i += 2;
        }
        if (x !== null && y !== null) {
          points.push({ id: handle || `pt_${points.length}`, x, y, z, layer, sourceFile: fileName, properties: props });
          layersSet.add(layer);
        }
        continue;
      }

      // ── INSERT (block reference → point) ──
      if (entityType === 'INSERT') {
        let handle = '', layer = '0', x: number | null = null, y: number | null = null, z = 0;
        const props: Record<string, any> = { entityType };
        i++;
        while (i < totalLines - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 2) { props.blockName = val; fieldsSet.add('blockName'); }
          if (code === 5) { handle = val; props.handle = val; }
          if (code === 6) { props.lineType = val; fieldsSet.add('lineType'); }
          if (code === 8) { layer = val; layersSet.add(val); props.layer = val; }
          if (code === 41) { props.scaleX = parseFloat(val); fieldsSet.add('scaleX'); }
          if (code === 42) { props.scaleY = parseFloat(val); fieldsSet.add('scaleY'); }
          if (code === 43) { props.scaleZ = parseFloat(val); fieldsSet.add('scaleZ'); }
          if (code === 50) { props.rotation = parseFloat(val); fieldsSet.add('rotation'); }
          if (code === 62) { props.color = parseInt(val); fieldsSet.add('color'); }
          if (code === 370) { props.lineweight = parseInt(val); fieldsSet.add('lineweight'); }
          if (code === 10) x = parseFloat(val);
          if (code === 20) y = parseFloat(val);
          if (code === 30) z = parseFloat(val);
          i += 2;
        }
        if (x !== null && y !== null) {
          points.push({ id: handle || `ins_${points.length}`, x, y, z, layer, sourceFile: fileName, properties: props });
          layersSet.add(layer);
        }
        continue;
      }

      // ── CIRCLE / ARC ──
      if (entityType === 'CIRCLE' || entityType === 'ARC') {
        let handle = '', layer = '0', cx2 = 0, cy2 = 0, cz2 = 0, radius = 0, startAngle = 0, endAngle = 360;
        const props: Record<string, any> = { entityType };
        i++;
        while (i < totalLines - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) { handle = val; props.handle = val; }
          if (code === 6) { props.lineType = val; fieldsSet.add('lineType'); }
          if (code === 8) { layer = val; layersSet.add(val); props.layer = val; }
          if (code === 39) { props.thickness = parseFloat(val); fieldsSet.add('thickness'); }
          if (code === 62) { props.color = parseInt(val); fieldsSet.add('color'); }
          if (code === 370) { props.lineweight = parseInt(val); fieldsSet.add('lineweight'); }
          if (code === 10) cx2 = parseFloat(val);
          if (code === 20) cy2 = parseFloat(val);
          if (code === 30) cz2 = parseFloat(val);
          if (code === 40) { radius = parseFloat(val); props.radius = radius; fieldsSet.add('radius'); }
          if (code === 50) { startAngle = parseFloat(val); props.startAngle = startAngle; fieldsSet.add('startAngle'); }
          if (code === 51) { endAngle = parseFloat(val); props.endAngle = endAngle; fieldsSet.add('endAngle'); }
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
        props.length = calculateEdgeLength(coords);
        fieldsSet.add('length');
        if (coords.length > 0) edges.push({ id: handle || `${entityType.toLowerCase()}_${edges.length}`, type: entityType, coordinates: coords, isClosed: entityType === 'CIRCLE', layer, sourceFile: fileName, properties: props });
        continue;
      }

      // ── SPLINE ──
      if (entityType === 'SPLINE') {
        let handle = '', layer = '0', closed = false;
        const controlPts: number[][] = [];
        const fitPts: number[][] = [];
        let sx: number | null = null, sy: number | null = null, sz = 0;
        const props: Record<string, any> = { entityType };
        i++;
        while (i < totalLines - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) { handle = val; props.handle = val; }
          if (code === 6) { props.lineType = val; fieldsSet.add('lineType'); }
          if (code === 8) { layer = val; layersSet.add(val); props.layer = val; }
          if (code === 62) { props.color = parseInt(val); fieldsSet.add('color'); }
          if (code === 70) { closed = (parseInt(val) & 1) === 1; props.flags = parseInt(val); fieldsSet.add('flags'); }
          if (code === 71) { props.degree = parseInt(val); fieldsSet.add('degree'); }
          if (code === 370) { props.lineweight = parseInt(val); fieldsSet.add('lineweight'); }
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
        if (coords.length >= 2) {
          props.vertexCount = coords.length;
          props.length = calculateEdgeLength(coords);
          fieldsSet.add('vertexCount'); fieldsSet.add('length');
          edges.push({ id: handle || `spl_${edges.length}`, type: 'SPLINE', coordinates: coords, isClosed: closed, layer, sourceFile: fileName, properties: props });
        }
        continue;
      }

      // ── ELLIPSE ──
      if (entityType === 'ELLIPSE') {
        let handle = '', layer = '0';
        let ecx = 0, ecy = 0, ecz = 0, majorX = 0, majorY = 0;
        let minorRatio = 1, startParam = 0, endParam = Math.PI * 2;
        const props: Record<string, any> = { entityType };
        i++;
        while (i < totalLines - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) { handle = val; props.handle = val; }
          if (code === 8) { layer = val; layersSet.add(val); props.layer = val; }
          if (code === 62) { props.color = parseInt(val); fieldsSet.add('color'); }
          if (code === 370) { props.lineweight = parseInt(val); fieldsSet.add('lineweight'); }
          if (code === 10) ecx = parseFloat(val);
          if (code === 20) ecy = parseFloat(val);
          if (code === 30) ecz = parseFloat(val);
          if (code === 11) majorX = parseFloat(val);
          if (code === 21) majorY = parseFloat(val);
          if (code === 40) { minorRatio = parseFloat(val); props.minorRatio = minorRatio; fieldsSet.add('minorRatio'); }
          if (code === 41) startParam = parseFloat(val);
          if (code === 42) endParam = parseFloat(val);
          i += 2;
        }
        const majorLen = Math.sqrt(majorX * majorX + majorY * majorY);
        props.majorRadius = majorLen; props.minorRadius = majorLen * minorRatio;
        fieldsSet.add('majorRadius'); fieldsSet.add('minorRadius');
        const segs = 36;
        const coords: number[][] = [];
        const baseAngle = Math.atan2(majorY, majorX);
        for (let j = 0; j <= segs; j++) {
          const t = startParam + (endParam - startParam) * (j / segs);
          const ex = ecx + majorLen * Math.cos(t) * Math.cos(baseAngle) - majorLen * minorRatio * Math.sin(t) * Math.sin(baseAngle);
          const ey = ecy + majorLen * Math.cos(t) * Math.sin(baseAngle) + majorLen * minorRatio * Math.sin(t) * Math.cos(baseAngle);
          coords.push([ex, ey, ecz]);
        }
        props.length = calculateEdgeLength(coords);
        fieldsSet.add('length');
        if (coords.length > 0) edges.push({ id: handle || `ellipse_${edges.length}`, type: 'ELLIPSE', coordinates: coords, isClosed: Math.abs(endParam - startParam - Math.PI * 2) < 0.01, layer, sourceFile: fileName, properties: props });
        continue;
      }

      // ── 3DFACE ──
      if (entityType === '3DFACE') {
        let handle = '', layer = '0';
        const faceCoords: Record<string, number> = {};
        const props: Record<string, any> = { entityType };
        i++;
        while (i < totalLines - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) { handle = val; props.handle = val; }
          if (code === 8) { layer = val; layersSet.add(val); props.layer = val; }
          if (code === 62) { props.color = parseInt(val); fieldsSet.add('color'); }
          if (code === 10) faceCoords.x1 = parseFloat(val);
          if (code === 20) faceCoords.y1 = parseFloat(val);
          if (code === 30) faceCoords.z1 = parseFloat(val);
          if (code === 11) faceCoords.x2 = parseFloat(val);
          if (code === 21) faceCoords.y2 = parseFloat(val);
          if (code === 31) faceCoords.z2 = parseFloat(val);
          if (code === 12) faceCoords.x3 = parseFloat(val);
          if (code === 22) faceCoords.y3 = parseFloat(val);
          if (code === 32) faceCoords.z3 = parseFloat(val);
          if (code === 13) faceCoords.x4 = parseFloat(val);
          if (code === 23) faceCoords.y4 = parseFloat(val);
          if (code === 33) faceCoords.z4 = parseFloat(val);
          i += 2;
        }
        const coords: number[][] = [];
        if (faceCoords.x1 !== undefined) coords.push([faceCoords.x1, faceCoords.y1 || 0, faceCoords.z1 || 0]);
        if (faceCoords.x2 !== undefined) coords.push([faceCoords.x2, faceCoords.y2 || 0, faceCoords.z2 || 0]);
        if (faceCoords.x3 !== undefined) coords.push([faceCoords.x3, faceCoords.y3 || 0, faceCoords.z3 || 0]);
        if (faceCoords.x4 !== undefined) coords.push([faceCoords.x4, faceCoords.y4 || 0, faceCoords.z4 || 0]);
        if (coords.length >= 3) {
          coords.push([...coords[0]]); // close the face
          edges.push({ id: handle || `3df_${edges.length}`, type: '3DFACE', coordinates: coords, isClosed: true, layer, sourceFile: fileName, properties: props });
        }
        continue;
      }

      // ── TEXT / MTEXT → point with text content ──
      if (entityType === 'TEXT' || entityType === 'MTEXT') {
        let handle = '', layer = '0', x: number | null = null, y: number | null = null, z = 0;
        const props: Record<string, any> = { entityType };
        i++;
        while (i < totalLines - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 1) { props.textContent = val; fieldsSet.add('textContent'); }
          if (code === 5) { handle = val; props.handle = val; }
          if (code === 7) { props.textStyle = val; fieldsSet.add('textStyle'); }
          if (code === 8) { layer = val; layersSet.add(val); props.layer = val; }
          if (code === 40) { props.textHeight = parseFloat(val); fieldsSet.add('textHeight'); }
          if (code === 50) { props.rotation = parseFloat(val); fieldsSet.add('rotation'); }
          if (code === 62) { props.color = parseInt(val); fieldsSet.add('color'); }
          if (code === 10) x = parseFloat(val);
          if (code === 20) y = parseFloat(val);
          if (code === 30) z = parseFloat(val);
          i += 2;
        }
        if (x !== null && y !== null) {
          points.push({ id: handle || `txt_${points.length}`, x, y, z, layer, sourceFile: fileName, properties: props });
          layersSet.add(layer);
        }
        continue;
      }
    }
    i++;
  }
  onProgress?.(100);
  return { points, edges, layers: Array.from(layersSet), fields: Array.from(fieldsSet) };
}

// ── CSV Parser ──

export function parseCSVContent(content: string, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const fieldsSet = new Set<string>();
  const csvLines = content.split('\n').filter(l => l.trim());
  if (csvLines.length < 2) return { points, edges, layers: [], fields: [] };

  const delim = csvLines[0].includes(';') ? ';' : csvLines[0].includes('\t') ? '\t' : ',';
  const headers = csvLines[0].split(delim).map(h => h.trim().replace(/"/g, ''));
  const isHeader = headers.some(h => isNaN(Number(h)) && h.length > 0);

  if (!isHeader) {
    try {
      const pts = parseTopographyCSV(content);
      return {
        points: pts.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.cota, layer: 'CSV', sourceFile: fileName, properties: { id: p.id, x: p.x, y: p.y, cota: p.cota } })),
        edges: [],
        layers: ['CSV'],
        fields: ['id', 'x', 'y', 'cota'],
      };
    } catch { return { points, edges, layers: [], fields: [] }; }
  }

  // ALL headers are fields
  headers.forEach(h => fieldsSet.add(h));

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
    const attrs: Record<string, any> = {};
    headers.forEach((h, j) => { attrs[h] = vals[j] || ''; });
    const id = (idField ? attrs[idField] : '') || `row_${r}`;

    if (xField && yField) {
      const x = parseFloat(String(attrs[xField]).replace(',', '.'));
      const y = parseFloat(String(attrs[yField]).replace(',', '.'));
      const z = zField ? parseFloat(String(attrs[zField]).replace(',', '.')) || 0 : 0;
      if (!isNaN(x) && !isNaN(y)) points.push({ id, x, y, z, layer: 'CSV', sourceFile: fileName, properties: { ...attrs } });
    }

    if (xIniField && yIniField && xFimField && yFimField) {
      const x1 = parseFloat(String(attrs[xIniField]).replace(',', '.'));
      const y1 = parseFloat(String(attrs[yIniField]).replace(',', '.'));
      const x2 = parseFloat(String(attrs[xFimField]).replace(',', '.'));
      const y2 = parseFloat(String(attrs[yFimField]).replace(',', '.'));
      if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
        const dx = x2 - x1, dy = y2 - y1;
        edges.push({ id, type: 'LINE', coordinates: [[x1, y1, 0], [x2, y2, 0]], isClosed: false, layer: 'CSV', sourceFile: fileName, properties: { ...attrs, length: Math.sqrt(dx * dx + dy * dy) } });
      }
    }
  }
  return { points, edges, layers: points.length > 0 || edges.length > 0 ? ['CSV'] : [], fields: Array.from(fieldsSet) };
}

// ── GeoJSON Parser ──

export function parseGeoJSONContent(content: string, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const layersSet = new Set<string>();
  const fieldsSet = new Set<string>();
  try {
    const json = JSON.parse(content);
    const features = json.features || (json.type === 'Feature' ? [json] : []);
    features.forEach((f: any, idx: number) => {
      const props = f.properties || {};
      Object.keys(props).forEach(k => fieldsSet.add(k));
      const layer = props.layer || 'GeoJSON';
      layersSet.add(layer);
      const id = f.id || props.id || `feat_${idx}`;
      const geom = f.geometry;
      if (!geom) return;
      if (geom.type === 'Point') {
        const [x, y, z = 0] = geom.coordinates;
        points.push({ id, x, y, z, layer, sourceFile: fileName, properties: { ...props } });
      }
      if (geom.type === 'MultiPoint') {
        (geom.coordinates as number[][]).forEach((c: number[], ci: number) => {
          points.push({ id: `${id}_pt${ci}`, x: c[0], y: c[1], z: c[2] || 0, layer, sourceFile: fileName, properties: { ...props } });
        });
      }
      if (geom.type === 'LineString') {
        const coords = geom.coordinates.map((c: number[]) => [c[0], c[1], c[2] || 0]);
        edges.push({ id, type: 'LineString', coordinates: coords, isClosed: false, layer, sourceFile: fileName, properties: { ...props, vertexCount: coords.length, length: calculateEdgeLength(coords) } });
      }
      if (geom.type === 'Polygon') {
        geom.coordinates.forEach((ring: number[][], ri: number) => {
          const coords = ring.map((c: number[]) => [c[0], c[1], c[2] || 0]);
          edges.push({ id: `${id}_ring${ri}`, type: 'Polygon', coordinates: coords, isClosed: true, layer, sourceFile: fileName, properties: { ...props, vertexCount: coords.length, length: calculateEdgeLength(coords) } });
        });
      }
      if (geom.type === 'MultiLineString') {
        geom.coordinates.forEach((line: number[][], li: number) => {
          const coords = line.map((c: number[]) => [c[0], c[1], c[2] || 0]);
          edges.push({ id: `${id}_line${li}`, type: 'MultiLineString', coordinates: coords, isClosed: false, layer, sourceFile: fileName, properties: { ...props, vertexCount: coords.length, length: calculateEdgeLength(coords) } });
        });
      }
      if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach((poly: number[][][], pi: number) => {
          poly.forEach((ring: number[][], ri: number) => {
            const coords = ring.map((c: number[]) => [c[0], c[1], c[2] || 0]);
            edges.push({ id: `${id}_poly${pi}_ring${ri}`, type: 'MultiPolygon', coordinates: coords, isClosed: true, layer, sourceFile: fileName, properties: { ...props, vertexCount: coords.length, length: calculateEdgeLength(coords) } });
          });
        });
      }
    });
  } catch { /* invalid JSON */ }
  return { points, edges, layers: Array.from(layersSet), fields: Array.from(fieldsSet) };
}

// ── XLSX Parser ──

export function parseXLSXContent(buffer: ArrayBuffer, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
  if (data.length === 0) return { points, edges: [], layers: [], fields: [] };

  const headers = Object.keys(data[0]);
  const xField = headers.find(h => /^(x|coord_?x|longitude|lon|este|easting)$/i.test(h));
  const yField = headers.find(h => /^(y|coord_?y|latitude|lat|norte|northing)$/i.test(h));
  const zField = headers.find(h => /^(z|cota|elevation|elev|altitude)$/i.test(h));
  const idField = headers.find(h => /^(id|codigo|nome|name)$/i.test(h));
  const xIniField = headers.find(h => /^(x_?ini|x_?inicio|x_?start|x1|x_?mont)$/i.test(h));
  const yIniField = headers.find(h => /^(y_?ini|y_?inicio|y_?start|y1|y_?mont)$/i.test(h));
  const xFimField = headers.find(h => /^(x_?fim|x_?end|x2|x_?jus)$/i.test(h));
  const yFimField = headers.find(h => /^(y_?fim|y_?end|y2|y_?jus)$/i.test(h));

  // Points
  if (xField && yField) {
    data.forEach((row, i) => {
      const x = parseFloat(String(row[xField]));
      const y = parseFloat(String(row[yField]));
      const z = zField ? parseFloat(String(row[zField])) : 0;
      if (isNaN(x) || isNaN(y)) return;
      const id = idField ? String(row[idField] || `P${String(i + 1).padStart(3, '0')}`) : `P${String(i + 1).padStart(3, '0')}`;
      const props: Record<string, any> = {};
      headers.forEach(h => { props[h] = row[h]; });
      points.push({ id, x, y, z: isNaN(z) ? 0 : z, layer: 'XLSX', sourceFile: fileName, properties: props });
    });
  }

  // Edges from start/end coordinate pairs
  if (xIniField && yIniField && xFimField && yFimField) {
    data.forEach((row, i) => {
      const x1 = parseFloat(String(row[xIniField]));
      const y1 = parseFloat(String(row[yIniField]));
      const x2 = parseFloat(String(row[xFimField]));
      const y2 = parseFloat(String(row[yFimField]));
      if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;
      const id = idField ? String(row[idField] || `T${String(i + 1).padStart(3, '0')}`) : `T${String(i + 1).padStart(3, '0')}`;
      const props: Record<string, any> = {};
      headers.forEach(h => { props[h] = row[h]; });
      const dx = x2 - x1, dy = y2 - y1;
      props.length = Math.sqrt(dx * dx + dy * dy);
      edges.push({ id, type: 'LINE', coordinates: [[x1, y1, 0], [x2, y2, 0]], isClosed: false, layer: 'XLSX', sourceFile: fileName, properties: props });
    });
  }

  return { points, edges, layers: points.length > 0 || edges.length > 0 ? ['XLSX'] : [], fields: headers };
}

// ── IFC Parser ──

export function parseIFCContent(content: string, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const fieldsSet = new Set<string>(['entityClass', 'ifcId']);
  const layersSet = new Set<string>();
  const ifcLines = content.split(/\r?\n/);

  // ═══ SINGLE-PASS parsing: collect all entity types in one loop ═══
  const cartesianPoints = new Map<string, [number, number, number]>();
  const placementToPoint = new Map<string, string>();
  const localPlacementMap = new Map<string, string>();
  const entityCounts = new Map<string, number>();
  const mepEntities: { id: string; type: string; name: string; placement: string }[] = [];
  const polylines: { id: string; refs: string[] }[] = [];
  const mepTypes = new Set(['IFCPIPESEGMENT', 'IFCPIPEFITTING', 'IFCDUCTSEGMENT', 'IFCDUCTFITTING',
    'IFCFLOWTERMINAL', 'IFCFLOWSEGMENT', 'IFCFLOWFITTING', 'IFCFLOWCONTROLLER',
    'IFCPUMP', 'IFCVALVE', 'IFCFIRESUPPRESSIONTERMINAL', 'IFCSANITARYTERMINAL']);

  for (const line of ifcLines) {
    const entityMatch = line.match(/^(#\d+)\s*=\s*(IFC\w+)\s*\(/i);
    if (!entityMatch) continue;
    const entId = entityMatch[1];
    const type = entityMatch[2].toUpperCase();

    if (type === 'IFCCARTESIANPOINT') {
      const m = line.match(/\(\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*(?:,\s*([-\d.eE+]+))?\s*\)/);
      if (m) cartesianPoints.set(entId, [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3] || '0')]);
      continue;
    }
    if (type === 'IFCAXIS2PLACEMENT3D') {
      const m = line.match(/\(\s*(#\d+)/);
      if (m) placementToPoint.set(entId, m[1]);
      continue;
    }
    if (type === 'IFCLOCALPLACEMENT') {
      const m = line.match(/\([^,]*,\s*(#\d+)/);
      if (m) localPlacementMap.set(entId, m[1]);
      continue;
    }
    if (type === 'IFCPOLYLINE') {
      const m = line.match(/\(\s*\(([^)]+)\)/);
      if (m) polylines.push({ id: entId, refs: m[1].split(',').map(r => r.trim()) });
      continue;
    }
    if (type.includes('PIPE') || type.includes('FLOW') || type.includes('DUCT') ||
      type.includes('FITTING') || type.includes('SEGMENT') || type.includes('TERMINAL') ||
      type.includes('VALVE') || type.includes('PUMP')) {
      entityCounts.set(type, (entityCounts.get(type) || 0) + 1);
    }
    if (mepTypes.has(type)) {
      const nameMatch = line.match(/'([^']+)'/);
      const placementMatch = line.match(/,\s*(#\d+)\s*,/);
      mepEntities.push({
        id: entId, type,
        name: nameMatch ? nameMatch[1] : type,
        placement: placementMatch ? placementMatch[1] : '',
      });
    }
  }

  const getPlacementCoords = (placementRef: string): [number, number, number] | null => {
    const axisRef = localPlacementMap.get(placementRef);
    if (!axisRef) return null;
    const ptRef = placementToPoint.get(axisRef);
    if (!ptRef) return null;
    return cartesianPoints.get(ptRef) || null;
  };

  const ifcEntitySummary = Object.fromEntries(entityCounts);
  if (entityCounts.size > 0) fieldsSet.add('ifcEntityTypes');

  let autoId = 1;
  for (const ent of mepEntities) {
    const coords = getPlacementCoords(ent.placement);
    if (coords) {
      const layer = ent.type.includes('PIPE') ? 'Tubulações IFC'
        : ent.type.includes('DUCT') ? 'Dutos IFC'
        : ent.type.includes('PUMP') ? 'Bombas IFC'
        : ent.type.includes('VALVE') ? 'Válvulas IFC'
        : 'MEP IFC';
      layersSet.add(layer);
      fieldsSet.add('ifcName');
      points.push({
        id: `IFC_${autoId++}`, x: coords[0], y: coords[1], z: coords[2],
        layer, sourceFile: fileName,
        properties: { entityClass: ent.type, ifcId: ent.id, ifcName: ent.name },
      });
    }
  }

  if (points.length === 0) {
    layersSet.add('IFC');
    for (const [ifcId, coords] of cartesianPoints) {
      if (autoId > 50000) break;
      points.push({
        id: `IFC_${autoId++}`, x: coords[0], y: coords[1], z: coords[2],
        layer: 'IFC', sourceFile: fileName,
        properties: { entityClass: 'IFCCARTESIANPOINT', ifcId, ...ifcEntitySummary },
      });
    }
  }

  let edgeId = 1;
  for (const pl of polylines) {
    const coords: number[][] = [];
    for (const ref of pl.refs) {
      const pt = cartesianPoints.get(ref);
      if (pt) coords.push([...pt]);
    }
    if (coords.length >= 2) {
      layersSet.add('IFC Polylines');
      fieldsSet.add('vertexCount'); fieldsSet.add('length');
      edges.push({
        id: `IFC_E${edgeId++}`, type: 'POLYLINE', coordinates: coords, isClosed: false,
        layer: 'IFC Polylines', sourceFile: fileName,
        properties: { entityClass: 'IFCPOLYLINE', ifcId: pl.id, vertexCount: coords.length, length: calculateEdgeLength(coords) },
      });
    }
  }

  const layers = layersSet.size > 0 ? Array.from(layersSet) : (points.length > 0 || edges.length > 0 ? ['IFC'] : []);
  return { points, edges, layers, fields: Array.from(fieldsSet) };
}
