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
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PontoTopografico, parseTopographyCSV } from '@/engine/reader';
import { Trecho, createTrechoFromPoints, DEFAULT_DIAMETRO_MM, DEFAULT_MATERIAL } from '@/engine/domain';
import { parseINPToInternal, parseSWMMToInternal } from '@/engine/importEngine';
import { Upload, Trash2, Check, X, FileText, Loader2, ChevronDown, ChevronRight, ChevronLeft, Globe, AlertTriangle, History, Save, FolderOpen, Undo2 } from 'lucide-react';
import { CRSSelector } from '@/components/hydronetwork/CRSSelector';
import { ImportCRSConfig, validateUTMRange } from '@/engine/coordinateTransform';

// ── Types ──

interface ParsedPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  layer: string;
  sourceFile: string;
  properties: Record<string, any>;
}

interface ParsedEdge {
  id: string;
  type: string;
  coordinates: number[][];
  isClosed: boolean;
  layer: string;
  sourceFile: string;
  properties: Record<string, any>;
}

interface ParseResult {
  points: ParsedPoint[];
  edges: ParsedEdge[];
  layers: string[];
  fields: string[];
  patternsCount?: number;
  curvesCount?: number;
  verticesCount?: number;
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

// ── Helpers ──

function calculateEdgeLength(coords: number[][]): number {
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
function getDxfColor(colorIndex: number): string {
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

// ── Parsers ──

function parseDXFComplete(content: string, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const layersSet = new Set<string>();
  const fieldsSet = new Set<string>();
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let inEntities = false;
  let i = 0;

  // Standard fields always tracked
  fieldsSet.add('handle'); fieldsSet.add('layer'); fieldsSet.add('entityType');

  while (i < lines.length) {
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
        while (i < lines.length - 1) {
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
        while (i < lines.length - 1) {
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
        while (i < lines.length - 1) {
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
        while (i < lines.length - 1) {
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
        while (i < lines.length - 1) {
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
        while (i < lines.length - 1) {
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
        while (i < lines.length - 1) {
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
        while (i < lines.length - 1) {
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
        while (i < lines.length - 1) {
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
        while (i < lines.length - 1) {
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
  return { points, edges, layers: Array.from(layersSet), fields: Array.from(fieldsSet) };
}

function parseCSVContent(content: string, fileName: string): ParseResult {
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

function parseGeoJSONContent(content: string, fileName: string): ParseResult {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const layersSet = new Set<string>();
  const fieldsSet = new Set<string>();
  try {
    const json = JSON.parse(content);
    const features = json.features || (json.type === 'Feature' ? [json] : []);
    features.forEach((f: any, idx: number) => {
      const props = f.properties || {};
      // Collect ALL property keys
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

function parseXLSXContent(buffer: ArrayBuffer, fileName: string): ParseResult {
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
      // Store ALL columns in properties
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

function parseIFCContent(content: string, fileName: string): ParseResult {
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
    // Match entity definition lines: #ID = IFCTYPE(...)
    const entityMatch = line.match(/^(#\d+)\s*=\s*(IFC\w+)\s*\(/i);
    if (!entityMatch) continue;
    const entId = entityMatch[1];
    const type = entityMatch[2].toUpperCase();

    // IFCCARTESIANPOINT
    if (type === 'IFCCARTESIANPOINT') {
      const m = line.match(/\(\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*(?:,\s*([-\d.eE+]+))?\s*\)/);
      if (m) cartesianPoints.set(entId, [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3] || '0')]);
      continue;
    }

    // IFCAXIS2PLACEMENT3D
    if (type === 'IFCAXIS2PLACEMENT3D') {
      const m = line.match(/\(\s*(#\d+)/);
      if (m) placementToPoint.set(entId, m[1]);
      continue;
    }

    // IFCLOCALPLACEMENT
    if (type === 'IFCLOCALPLACEMENT') {
      const m = line.match(/\([^,]*,\s*(#\d+)/);
      if (m) localPlacementMap.set(entId, m[1]);
      continue;
    }

    // IFCPOLYLINE
    if (type === 'IFCPOLYLINE') {
      const m = line.match(/\(\s*\(([^)]+)\)/);
      if (m) {
        polylines.push({ id: entId, refs: m[1].split(',').map(r => r.trim()) });
      }
      continue;
    }

    // MEP-related entities: count and extract
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

  // Resolve placement → coordinates
  const getPlacementCoords = (placementRef: string): [number, number, number] | null => {
    const axisRef = localPlacementMap.get(placementRef);
    if (!axisRef) return null;
    const ptRef = placementToPoint.get(axisRef);
    if (!ptRef) return null;
    return cartesianPoints.get(ptRef) || null;
  };

  const ifcEntitySummary = Object.fromEntries(entityCounts);
  if (entityCounts.size > 0) fieldsSet.add('ifcEntityTypes');

  // Extract MEP entities as points with their placement coordinates
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

  // Fallback: if no MEP entities found with placement, extract cartesian points (up to 50k)
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

  // Extract IFCPOLYLINE as edges (already collected in single pass)
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
          if (feature.geometry.coordinates?.[0]?.length >= 2) {
            const ring = feature.geometry.coordinates[0];
            edges.push({
              id: `SHP_E${edges.length}`,
              type: 'Polygon', coordinates: ring.map((c: number[]) => [c[0], c[1], c[2] || 0]),
              isClosed: true, layer, sourceFile: fileName,
              properties: { ...props, geometryType: 'Polygon', length: calculateEdgeLength(ring) },
            });
          }
          break;
        }
        case 'MultiPolygon': {
          for (const poly of feature.geometry.coordinates) {
            if (poly[0]?.length >= 2) {
              edges.push({
                id: `SHP_E${edges.length}`,
                type: 'Polygon', coordinates: poly[0].map((c: number[]) => [c[0], c[1], c[2] || 0]),
                isClosed: true, layer, sourceFile: fileName,
                properties: { ...props, geometryType: 'MultiPolygon', length: calculateEdgeLength(poly[0]) },
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
    const tifResult = await parseGeoTIFF(buffer, 15000);

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

  // Merged data from all files
  const allPoints = fileQueue.filter(f => f.status === 'ok').flatMap(f => f.result?.points ?? []);
  const allEdges = fileQueue.filter(f => f.status === 'ok').flatMap(f => f.result?.edges ?? []);
  const allLayers = [...new Set([...allPoints.map(p => p.layer), ...allEdges.map(e => e.layer)])];
  const allTypes = [...new Set(allEdges.map(e => e.type))];
  const allFields = [...new Set(fileQueue.filter(f => f.status === 'ok').flatMap(f => f.result?.fields ?? []))];
  const totalEntities = allPoints.length + allEdges.length;

  // Field info with samples and types for "Campos do Arquivo"
  const allFieldInfo = useMemo(() => {
    const pts = fileQueue.filter(f => f.status === 'ok').flatMap(f => f.result?.points ?? []);
    const edg = fileQueue.filter(f => f.status === 'ok').flatMap(f => f.result?.edges ?? []);
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

    pts.forEach(p => processProps(p.properties));
    edg.forEach(e => processProps(e.properties));

    return Array.from(fieldMap.entries()).map(([name, info]) => ({
      name,
      type: info.numeric ? 'number' : 'text',
      samples: Array.from(info.samples),
      count: info.count,
    })).sort((a, b) => b.count - a.count);
  }, [fileQueue]);

  // Filtered
  const filteredPoints = allPoints.filter(p => (filterLayer === 'all' || p.layer === filterLayer));
  const filteredEdges = allEdges.filter(e => (filterLayer === 'all' || e.layer === filterLayer) && (filterType === 'all' || e.type === filterType));

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
      } else if (format === 'INP') {
        const text = await item.file.text();
        // Detect SWMM vs EPANET by checking for SWMM-specific sections
        const isSWMM = /\[SUBCATCHMENTS\]|\[CONDUITS\]|\[OUTFALLS\]/i.test(text);
        result = isSWMM ? parseSWMMContent(text, item.file.name) : parseINPContent(text, item.file.name);
      } else if (format === 'SHP') {
        const buffer = await item.file.arrayBuffer();
        result = await parseSHPContentAsync(buffer, item.file.name);
      } else if (format === 'TIF') {
        const buffer = await item.file.arrayBuffer();
        result = await parseTIFContentAsync(buffer, item.file.name);
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
                {item.status === 'lendo' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
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
