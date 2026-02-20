/**
 * 🆕 NOVO - Importação com Parser DXF Completo
 * Extração real de LWPOLYLINE, LINE, POINT
 * Suporte a arquivos grandes (6MB+)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

interface ImportWizardProps {
  onComplete: (result: ImportResult) => void;
  onCancel: () => void;
  initialFile?: File;
}

interface ImportResult {
  success: boolean;
  fileName: string;
  points: ParsedPoint[];
  edges: ParsedEdge[];
  allFields: string[];
  rawEntities: any[];
}

interface ParsedPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  layer: string;
  handle: string;
  attributes: Record<string, any>;
}

interface ParsedEdge {
  id: string;
  type: string;
  coordinates: number[][];
  isClosed: boolean;
  layer: string;
  handle: string;
  color: number;
  attributes: Record<string, any>;
}

// ============================================================================
// PARSER DXF COMPLETO - Extrai TODAS as geometrias
// ============================================================================

const parseDXFComplete = (content: string): {
  entities: any[];
  points: ParsedPoint[];
  edges: ParsedEdge[];
  allFields: string[];
  layers: string[];
} => {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const entities: any[] = [];
  const allFieldsSet = new Set<string>(['layer', 'handle', 'type', 'color', 'lineType']);
  const layersSet = new Set<string>();

  // Normalizar quebras de linha
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Dividir em linhas
  const lines = normalizedContent.split('\n');
  
  // Encontrar a seção ENTITIES
  let inEntities = false;
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i]?.trim();
    
    // Detectar início da seção ENTITIES
    if (line === 'ENTITIES') {
      inEntities = true;
      i++;
      continue;
    }
    
    // Detectar fim da seção ENTITIES
    if (inEntities && line === 'ENDSEC') {
      break;
    }
    
    if (!inEntities) {
      i++;
      continue;
    }
    
    // Detectar início de entidade (código 0)
    if (line === '0') {
      i++;
      const entityType = lines[i]?.trim().toUpperCase();
      
      if (entityType === 'LWPOLYLINE') {
        const result = parseLWPolyline(lines, i + 1);
        if (result.entity && result.coordinates.length >= 2) {
          const edge: ParsedEdge = {
            id: result.entity.handle || `lwpoly_${edges.length}`,
            type: 'LWPOLYLINE',
            coordinates: result.coordinates,
            isClosed: result.entity.closed || false,
            layer: result.entity.layer || '0',
            handle: result.entity.handle || '',
            color: result.entity.color || 256,
            attributes: result.entity
          };
          edges.push(edge);
          entities.push({ ...result.entity, type: 'LWPOLYLINE', geometry: result.coordinates });
          layersSet.add(edge.layer);
        }
        i = result.nextIndex;
        continue;
      }
      
      if (entityType === 'LINE') {
        const result = parseLine(lines, i + 1);
        if (result.entity && result.coordinates.length === 2) {
          const edge: ParsedEdge = {
            id: result.entity.handle || `line_${edges.length}`,
            type: 'LINE',
            coordinates: result.coordinates,
            isClosed: false,
            layer: result.entity.layer || '0',
            handle: result.entity.handle || '',
            color: result.entity.color || 256,
            attributes: result.entity
          };
          edges.push(edge);
          entities.push({ ...result.entity, type: 'LINE', geometry: result.coordinates });
          layersSet.add(edge.layer);
        }
        i = result.nextIndex;
        continue;
      }
      
      if (entityType === 'POLYLINE') {
        const result = parsePolyline(lines, i + 1);
        if (result.entity && result.coordinates.length >= 2) {
          const edge: ParsedEdge = {
            id: result.entity.handle || `poly_${edges.length}`,
            type: 'POLYLINE',
            coordinates: result.coordinates,
            isClosed: result.entity.closed || false,
            layer: result.entity.layer || '0',
            handle: result.entity.handle || '',
            color: result.entity.color || 256,
            attributes: result.entity
          };
          edges.push(edge);
          entities.push({ ...result.entity, type: 'POLYLINE', geometry: result.coordinates });
          layersSet.add(edge.layer);
        }
        i = result.nextIndex;
        continue;
      }
      
      if (entityType === 'POINT') {
        const result = parsePoint(lines, i + 1);
        if (result.entity && result.x !== undefined && result.y !== undefined) {
          const point: ParsedPoint = {
            id: result.entity.handle || `point_${points.length}`,
            x: result.x,
            y: result.y,
            z: result.z || 0,
            layer: result.entity.layer || '0',
            handle: result.entity.handle || '',
            attributes: result.entity
          };
          points.push(point);
          entities.push({ ...result.entity, type: 'POINT', x: result.x, y: result.y, z: result.z });
          layersSet.add(point.layer);
        }
        i = result.nextIndex;
        continue;
      }
      
      if (entityType === 'CIRCLE' || entityType === 'ARC') {
        const result = parseCircleArc(lines, i + 1, entityType);
        if (result.entity && result.coordinates.length > 0) {
          const edge: ParsedEdge = {
            id: result.entity.handle || `${entityType.toLowerCase()}_${edges.length}`,
            type: entityType,
            coordinates: result.coordinates,
            isClosed: entityType === 'CIRCLE',
            layer: result.entity.layer || '0',
            handle: result.entity.handle || '',
            color: result.entity.color || 256,
            attributes: result.entity
          };
          edges.push(edge);
          entities.push({ ...result.entity, type: entityType, geometry: result.coordinates });
          layersSet.add(edge.layer);
        }
        i = result.nextIndex;
        continue;
      }
      
      if (entityType === 'SPLINE') {
        const result = parseSpline(lines, i + 1);
        if (result.entity && result.coordinates.length >= 2) {
          const edge: ParsedEdge = {
            id: result.entity.handle || `spline_${edges.length}`,
            type: 'SPLINE',
            coordinates: result.coordinates,
            isClosed: result.entity.closed || false,
            layer: result.entity.layer || '0',
            handle: result.entity.handle || '',
            color: result.entity.color || 256,
            attributes: result.entity
          };
          edges.push(edge);
          entities.push({ ...result.entity, type: 'SPLINE', geometry: result.coordinates });
          layersSet.add(edge.layer);
        }
        i = result.nextIndex;
        continue;
      }
    }
    
    i++;
  }

  return {
    entities,
    points,
    edges,
    allFields: Array.from(allFieldsSet),
    layers: Array.from(layersSet)
  };
};

// Parser para LWPOLYLINE
const parseLWPolyline = (lines: string[], startIndex: number) => {
  const entity: Record<string, any> = {};
  const coordinates: number[][] = [];
  let i = startIndex;
  let currentX: number | null = null;
  let currentY: number | null = null;
  let currentZ: number = 0;
  let vertexCount = 0;
  let elevation = 0;

  while (i < lines.length - 1) {
    const code = parseInt(lines[i]?.trim() || '');
    const value = lines[i + 1]?.trim() || '';

    if (code === 0) break; // Próxima entidade

    switch (code) {
      case 5: entity.handle = value; break;
      case 8: entity.layer = value; break;
      case 62: entity.color = parseInt(value); break;
      case 6: entity.lineType = value; break;
      case 38: elevation = parseFloat(value); break;
      case 39: entity.thickness = parseFloat(value); break;
      case 43: entity.constantWidth = parseFloat(value); break;
      case 70: entity.closed = (parseInt(value) & 1) === 1; break;
      case 90: vertexCount = parseInt(value); break;
      case 10:
        // Salvar vértice anterior se existir
        if (currentX !== null && currentY !== null) {
          coordinates.push([currentX, currentY, currentZ || elevation]);
        }
        currentX = parseFloat(value);
        currentY = null;
        currentZ = elevation;
        break;
      case 20:
        currentY = parseFloat(value);
        break;
      case 30:
        currentZ = parseFloat(value);
        break;
    }
    i += 2;
  }

  // Adicionar último vértice
  if (currentX !== null && currentY !== null) {
    coordinates.push([currentX, currentY, currentZ || elevation]);
  }

  // Se fechado, adicionar primeiro ponto no final
  if (entity.closed && coordinates.length > 0) {
    coordinates.push([...coordinates[0]]);
  }

  return { entity, coordinates, nextIndex: i };
};

// Parser para LINE
const parseLine = (lines: string[], startIndex: number) => {
  const entity: Record<string, any> = {};
  const coordinates: number[][] = [];
  let i = startIndex;
  let x1: number | null = null, y1: number | null = null, z1: number = 0;
  let x2: number | null = null, y2: number | null = null, z2: number = 0;

  while (i < lines.length - 1) {
    const code = parseInt(lines[i]?.trim() || '');
    const value = lines[i + 1]?.trim() || '';

    if (code === 0) break;

    switch (code) {
      case 5: entity.handle = value; break;
      case 8: entity.layer = value; break;
      case 62: entity.color = parseInt(value); break;
      case 6: entity.lineType = value; break;
      case 10: x1 = parseFloat(value); break;
      case 20: y1 = parseFloat(value); break;
      case 30: z1 = parseFloat(value); break;
      case 11: x2 = parseFloat(value); break;
      case 21: y2 = parseFloat(value); break;
      case 31: z2 = parseFloat(value); break;
    }
    i += 2;
  }

  if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
    coordinates.push([x1, y1, z1]);
    coordinates.push([x2, y2, z2]);
  }

  return { entity, coordinates, nextIndex: i };
};

// Parser para POLYLINE (antiga, com VERTEX)
const parsePolyline = (lines: string[], startIndex: number) => {
  const entity: Record<string, any> = {};
  const coordinates: number[][] = [];
  let i = startIndex;

  // Ler atributos da POLYLINE
  while (i < lines.length - 1) {
    const code = parseInt(lines[i]?.trim() || '');
    const value = lines[i + 1]?.trim() || '';

    if (code === 0) break;

    switch (code) {
      case 5: entity.handle = value; break;
      case 8: entity.layer = value; break;
      case 62: entity.color = parseInt(value); break;
      case 70: entity.closed = (parseInt(value) & 1) === 1; break;
    }
    i += 2;
  }

  // Ler VERTEX
  while (i < lines.length - 1) {
    const code = parseInt(lines[i]?.trim() || '');
    const value = lines[i + 1]?.trim() || '';

    if (code === 0 && value === 'SEQEND') {
      i += 2;
      break;
    }

    if (code === 0 && value === 'VERTEX') {
      i += 2;
      let vx: number | null = null, vy: number | null = null, vz: number = 0;
      
      while (i < lines.length - 1) {
        const vCode = parseInt(lines[i]?.trim() || '');
        const vValue = lines[i + 1]?.trim() || '';

        if (vCode === 0) break;

        switch (vCode) {
          case 10: vx = parseFloat(vValue); break;
          case 20: vy = parseFloat(vValue); break;
          case 30: vz = parseFloat(vValue); break;
        }
        i += 2;
      }

      if (vx !== null && vy !== null) {
        coordinates.push([vx, vy, vz]);
      }
      continue;
    }

    i += 2;
  }

  if (entity.closed && coordinates.length > 0) {
    coordinates.push([...coordinates[0]]);
  }

  return { entity, coordinates, nextIndex: i };
};

// Parser para POINT
const parsePoint = (lines: string[], startIndex: number) => {
  const entity: Record<string, any> = {};
  let i = startIndex;
  let x: number | undefined, y: number | undefined, z: number = 0;

  while (i < lines.length - 1) {
    const code = parseInt(lines[i]?.trim() || '');
    const value = lines[i + 1]?.trim() || '';

    if (code === 0) break;

    switch (code) {
      case 5: entity.handle = value; break;
      case 8: entity.layer = value; break;
      case 62: entity.color = parseInt(value); break;
      case 10: x = parseFloat(value); break;
      case 20: y = parseFloat(value); break;
      case 30: z = parseFloat(value); break;
    }
    i += 2;
  }

  return { entity, x, y, z, nextIndex: i };
};

// Parser para CIRCLE e ARC
const parseCircleArc = (lines: string[], startIndex: number, type: string) => {
  const entity: Record<string, any> = {};
  let i = startIndex;
  let cx: number = 0, cy: number = 0, cz: number = 0;
  let radius: number = 0;
  let startAngle: number = 0, endAngle: number = 360;

  while (i < lines.length - 1) {
    const code = parseInt(lines[i]?.trim() || '');
    const value = lines[i + 1]?.trim() || '';

    if (code === 0) break;

    switch (code) {
      case 5: entity.handle = value; break;
      case 8: entity.layer = value; break;
      case 62: entity.color = parseInt(value); break;
      case 10: cx = parseFloat(value); break;
      case 20: cy = parseFloat(value); break;
      case 30: cz = parseFloat(value); break;
      case 40: radius = parseFloat(value); break;
      case 50: startAngle = parseFloat(value); break;
      case 51: endAngle = parseFloat(value); break;
    }
    i += 2;
  }

  // Gerar pontos do arco/círculo
  const coordinates: number[][] = [];
  const segments = type === 'CIRCLE' ? 36 : Math.max(8, Math.ceil(Math.abs(endAngle - startAngle) / 10));
  const start = (startAngle * Math.PI) / 180;
  const end = type === 'CIRCLE' ? start + 2 * Math.PI : (endAngle * Math.PI) / 180;

  for (let j = 0; j <= segments; j++) {
    const angle = start + (end - start) * (j / segments);
    coordinates.push([
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
      cz
    ]);
  }

  return { entity, coordinates, nextIndex: i };
};

// Parser para SPLINE
const parseSpline = (lines: string[], startIndex: number) => {
  const entity: Record<string, any> = {};
  const controlPoints: number[][] = [];
  const fitPoints: number[][] = [];
  let i = startIndex;
  let currentX: number | null = null;
  let currentY: number | null = null;
  let currentZ: number = 0;
  let readingFitPoints = false;

  while (i < lines.length - 1) {
    const code = parseInt(lines[i]?.trim() || '');
    const value = lines[i + 1]?.trim() || '';

    if (code === 0) break;

    switch (code) {
      case 5: entity.handle = value; break;
      case 8: entity.layer = value; break;
      case 62: entity.color = parseInt(value); break;
      case 70: entity.closed = (parseInt(value) & 1) === 1; break;
      case 10:
        if (currentX !== null && currentY !== null) {
          controlPoints.push([currentX, currentY, currentZ]);
        }
        currentX = parseFloat(value);
        currentY = null;
        currentZ = 0;
        break;
      case 20: currentY = parseFloat(value); break;
      case 30: currentZ = parseFloat(value); break;
      case 11:
        readingFitPoints = true;
        fitPoints.push([parseFloat(value), 0, 0]);
        break;
      case 21:
        if (fitPoints.length > 0) fitPoints[fitPoints.length - 1][1] = parseFloat(value);
        break;
      case 31:
        if (fitPoints.length > 0) fitPoints[fitPoints.length - 1][2] = parseFloat(value);
        break;
    }
    i += 2;
  }

  if (currentX !== null && currentY !== null) {
    controlPoints.push([currentX, currentY, currentZ]);
  }

  const coordinates = fitPoints.length > 0 ? fitPoints : controlPoints;

  if (entity.closed && coordinates.length > 0) {
    coordinates.push([...coordinates[0]]);
  }

  return { entity, coordinates, nextIndex: i };
};

// ============================================================================
// PARSER PARA OUTROS FORMATOS
// ============================================================================

const parseCSV = (content: string, fileName: string) => {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const entities: any[] = [];
  const allFieldsSet = new Set<string>();

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { entities, points, edges, allFields: [], layers: [] };

  const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
  headers.forEach(h => allFieldsSet.add(h));

  // Detectar campos de coordenadas
  const xField = headers.find(h => /^(x|coord_?x|longitude|lon|este|easting|e)$/i.test(h));
  const yField = headers.find(h => /^(y|coord_?y|latitude|lat|norte|northing|n)$/i.test(h));
  const zField = headers.find(h => /^(z|coord_?z|cota|elevation|elev|altitude|alt|h)$/i.test(h));
  const xIniField = headers.find(h => /^(x_?ini|x_?inicio|x_?start|x1|x_?mont)$/i.test(h));
  const yIniField = headers.find(h => /^(y_?ini|y_?inicio|y_?start|y1|y_?mont)$/i.test(h));
  const xFimField = headers.find(h => /^(x_?fim|x_?end|x2|x_?jus)$/i.test(h));
  const yFimField = headers.find(h => /^(y_?fim|y_?end|y2|y_?jus)$/i.test(h));

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
    const attrs: Record<string, any> = {};
    headers.forEach((h, j) => { attrs[h] = values[j] || ''; });

    const id = attrs['id'] || attrs['ID'] || attrs['codigo'] || `row_${i}`;
    entities.push({ id, type: 'CSV_ROW', attributes: attrs });

    // Ponto
    if (xField && yField) {
      const x = parseFloat(String(attrs[xField]).replace(',', '.'));
      const y = parseFloat(String(attrs[yField]).replace(',', '.'));
      const z = zField ? parseFloat(String(attrs[zField]).replace(',', '.')) || 0 : 0;
      if (!isNaN(x) && !isNaN(y)) {
        points.push({ id, x, y, z, layer: 'CSV', handle: id, attributes: attrs });
      }
    }

    // Trecho
    if (xIniField && yIniField && xFimField && yFimField) {
      const x1 = parseFloat(String(attrs[xIniField]).replace(',', '.'));
      const y1 = parseFloat(String(attrs[yIniField]).replace(',', '.'));
      const x2 = parseFloat(String(attrs[xFimField]).replace(',', '.'));
      const y2 = parseFloat(String(attrs[yFimField]).replace(',', '.'));
      if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
        edges.push({
          id, type: 'LINE', coordinates: [[x1, y1, 0], [x2, y2, 0]],
          isClosed: false, layer: 'CSV', handle: id, color: 256, attributes: attrs
        });
      }
    }
  }

  return { entities, points, edges, allFields: Array.from(allFieldsSet), layers: ['CSV'] };
};

const parseGeoJSON = (content: string) => {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const entities: any[] = [];
  const allFieldsSet = new Set<string>();
  const layersSet = new Set<string>();

  try {
    const json = JSON.parse(content);
    const features = json.features || (json.type === 'Feature' ? [json] : []);

    features.forEach((f: any, i: number) => {
      const attrs = f.properties || {};
      Object.keys(attrs).forEach(k => allFieldsSet.add(k));
      const layer = attrs.layer || 'GeoJSON';
      layersSet.add(layer);
      const id = f.id || attrs.id || `feature_${i}`;

      entities.push({ id, type: f.geometry?.type, attributes: attrs, geometry: f.geometry });

      if (f.geometry?.type === 'Point') {
        const [x, y, z = 0] = f.geometry.coordinates;
        points.push({ id, x, y, z, layer, handle: id, attributes: attrs });
      }

      if (f.geometry?.type === 'LineString') {
        edges.push({
          id, type: 'LineString',
          coordinates: f.geometry.coordinates.map((c: number[]) => [c[0], c[1], c[2] || 0]),
          isClosed: false, layer, handle: id, color: 256, attributes: attrs
        });
      }

      if (f.geometry?.type === 'Polygon') {
        f.geometry.coordinates.forEach((ring: number[][], ri: number) => {
          edges.push({
            id: `${id}_ring_${ri}`, type: 'Polygon',
            coordinates: ring.map((c: number[]) => [c[0], c[1], c[2] || 0]),
            isClosed: true, layer, handle: id, color: 256, attributes: attrs
          });
        });
      }

      if (f.geometry?.type === 'MultiLineString') {
        f.geometry.coordinates.forEach((line: number[][], li: number) => {
          edges.push({
            id: `${id}_line_${li}`, type: 'MultiLineString',
            coordinates: line.map((c: number[]) => [c[0], c[1], c[2] || 0]),
            isClosed: false, layer, handle: id, color: 256, attributes: attrs
          });
        });
      }
    });
  } catch (e) {
    console.error('Erro ao parsear GeoJSON:', e);
  }

  return { entities, points, edges, allFields: Array.from(allFieldsSet), layers: Array.from(layersSet) };
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const ImportWizard: React.FC<ImportWizardProps> = ({ onComplete, onCancel, initialFile }) => {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<{
    entities: any[];
    points: ParsedPoint[];
    edges: ParsedEdge[];
    allFields: string[];
    layers: string[];
    fileType: string;
  } | null>(null);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [filterLayer, setFilterLayer] = useState<string>('all');

  const handleParse = useCallback(async (f: File) => {
    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      setProgress(10);

      // Ler arquivo
      const content = await f.text();
      setProgress(30);

      let result: any;

      if (ext === 'dxf') {
        // Para arquivos grandes, processar em chunks
        setProgress(50);
        result = parseDXFComplete(content);
        result.fileType = 'DXF';
      } else if (ext === 'csv' || ext === 'txt') {
        result = parseCSV(content, f.name);
        result.fileType = ext.toUpperCase();
      } else if (ext === 'geojson' || ext === 'json') {
        result = parseGeoJSON(content);
        result.fileType = 'GeoJSON';
      } else {
        throw new Error(`Formato não suportado: ${ext}`);
      }

      setProgress(90);

      // Selecionar todas as entidades por padrão
      const allIds = new Set([
        ...result.points.map((p: ParsedPoint) => p.id),
        ...result.edges.map((e: ParsedEdge) => e.id)
      ]);
      setSelectedEntities(allIds);

      setParseResult(result);
      setProgress(100);
    } catch (err: any) {
      setError(`Erro ao processar arquivo: ${err.message}`);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (file) handleParse(file);
  }, [file, handleParse]);

  const handleFileSelect = (files: FileList | File[]) => {
    const f = Array.from(files)[0];
    if (f) setFile(f);
  };

  const handleImport = () => {
    if (!parseResult || !file) return;

    const selectedPoints = parseResult.points.filter(p => selectedEntities.has(p.id));
    const selectedEdges = parseResult.edges.filter(e => selectedEntities.has(e.id));

    onComplete({
      success: true,
      fileName: file.name,
      points: selectedPoints,
      edges: selectedEdges,
      allFields: parseResult.allFields,
      rawEntities: parseResult.entities
    });
  };

  const toggleEntity = (id: string) => {
    setSelectedEntities(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!parseResult) return;
    const filtered = filterLayer === 'all' 
      ? [...parseResult.points, ...parseResult.edges]
      : [...parseResult.points.filter(p => p.layer === filterLayer), ...parseResult.edges.filter(e => e.layer === filterLayer)];
    const ids = new Set(filtered.map(e => e.id));
    setSelectedEntities(prev => new Set([...prev, ...ids]));
  };

  const selectNone = () => {
    if (!parseResult) return;
    if (filterLayer === 'all') {
      setSelectedEntities(new Set());
    } else {
      const toRemove = [
        ...parseResult.points.filter(p => p.layer === filterLayer).map(p => p.id),
        ...parseResult.edges.filter(e => e.layer === filterLayer).map(e => e.id)
      ];
      setSelectedEntities(prev => {
        const next = new Set(prev);
        toRemove.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const filteredEdges = parseResult?.edges.filter(e => filterLayer === 'all' || e.layer === filterLayer) || [];
  const filteredPoints = parseResult?.points.filter(p => filterLayer === 'all' || p.layer === filterLayer) || [];

  return (
    <div style={{ 
      padding: 24, 
      backgroundColor: '#0f172a', 
      borderRadius: 12, 
      color: '#e2e8f0', 
      minWidth: 900,
      maxWidth: 1200,
      maxHeight: '90vh',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>📁 Importação - Topografia</h2>
          <span style={{ 
            backgroundColor: '#10b981', 
            color: '#fff', 
            padding: '4px 12px', 
            borderRadius: 20, 
            fontSize: 12, 
            fontWeight: 'bold'
          }}>
            🆕 NOVO v2
          </span>
        </div>
        {file && (
          <span style={{ color: '#94a3b8' }}>
            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </span>
        )}
      </div>

      {/* Upload */}
      {!parseResult && !loading && (
        <div
          style={{
            border: '2px dashed #3b82f6',
            borderRadius: 12,
            padding: 60,
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: '#1e293b'
          }}
          onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); }}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('import-file-input')?.click()}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
          <p style={{ fontSize: 18, marginBottom: 8 }}>Arraste ou clique para selecionar</p>
          <p style={{ color: '#94a3b8' }}>DXF (QGIS), GeoJSON, CSV, TXT</p>
          <input
            id="import-file-input"
            type="file"
            style={{ display: 'none' }}
            accept=".dxf,.geojson,.json,.csv,.txt"
            onChange={e => e.target.files && handleFileSelect(e.target.files)}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <p style={{ fontSize: 18, marginBottom: 16 }}>Processando arquivo...</p>
          <div style={{ 
            width: '100%', 
            height: 8, 
            backgroundColor: '#334155', 
            borderRadius: 4, 
            overflow: 'hidden' 
          }}>
            <div style={{ 
              width: `${progress}%`, 
              height: '100%', 
              backgroundColor: '#3b82f6',
              transition: 'width 0.3s'
            }} />
          </div>
          <p style={{ color: '#94a3b8', marginTop: 8 }}>{progress}%</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ 
          padding: 16, 
          backgroundColor: '#dc262622', 
          border: '1px solid #dc2626', 
          borderRadius: 8, 
          marginBottom: 20 
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {parseResult && (
        <div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, color: '#3b82f6', fontWeight: 'bold' }}>{parseResult.entities.length}</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Entidades Total</div>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, color: '#10b981', fontWeight: 'bold' }}>{parseResult.points.length}</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Pontos/Nós</div>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, color: '#f59e0b', fontWeight: 'bold' }}>{parseResult.edges.length}</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Trechos/Linhas</div>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, color: '#8b5cf6', fontWeight: 'bold' }}>{parseResult.layers.length}</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Layers</div>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, color: '#06b6d4', fontWeight: 'bold' }}>{selectedEntities.size}</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Selecionados</div>
            </div>
          </div>

          {/* Layers Filter */}
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ color: '#94a3b8' }}>Filtrar por Layer:</label>
            <select 
              value={filterLayer} 
              onChange={e => setFilterLayer(e.target.value)}
              style={{ 
                padding: '8px 12px', 
                borderRadius: 6, 
                backgroundColor: '#1e293b', 
                color: '#e2e8f0', 
                border: '1px solid #334155' 
              }}
            >
              <option value="all">Todos ({parseResult.layers.length} layers)</option>
              {parseResult.layers.map(layer => (
                <option key={layer} value={layer}>{layer}</option>
              ))}
            </select>
            <button onClick={selectAll} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
              ✓ Selecionar Todos
            </button>
            <button onClick={selectNone} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #64748b', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
              ✗ Limpar Seleção
            </button>
          </div>

          {/* Edges Table */}
          {filteredEdges.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 12 }}>📐 Trechos/Polilinhas ({filteredEdges.length})</h3>
              <div style={{ maxHeight: 250, overflow: 'auto', backgroundColor: '#1e293b', borderRadius: 8, border: '1px solid #334155' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#334155' }}>
                    <tr>
                      <th style={{ padding: 10, width: 40 }}>✓</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Handle</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Tipo</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>Vértices</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Layer</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>Fechado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEdges.slice(0, 200).map(edge => (
                      <tr key={edge.id} style={{ borderBottom: '1px solid #334155', cursor: 'pointer' }} onClick={() => toggleEntity(edge.id)}>
                        <td style={{ padding: 10, textAlign: 'center' }}>
                          <input type="checkbox" checked={selectedEntities.has(edge.id)} readOnly />
                        </td>
                        <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 12 }}>{edge.handle || edge.id}</td>
                        <td style={{ padding: 10 }}>{edge.type}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{edge.coordinates.length}</td>
                        <td style={{ padding: 10 }}>{edge.layer}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{edge.isClosed ? '✓' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredEdges.length > 200 && (
                  <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>
                    ... e mais {filteredEdges.length - 200} trechos
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Points Table */}
          {filteredPoints.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 12 }}>📍 Pontos ({filteredPoints.length})</h3>
              <div style={{ maxHeight: 200, overflow: 'auto', backgroundColor: '#1e293b', borderRadius: 8, border: '1px solid #334155' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#334155' }}>
                    <tr>
                      <th style={{ padding: 10, width: 40 }}>✓</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Handle</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>X</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>Y</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>Z</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Layer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPoints.slice(0, 100).map(point => (
                      <tr key={point.id} style={{ borderBottom: '1px solid #334155', cursor: 'pointer' }} onClick={() => toggleEntity(point.id)}>
                        <td style={{ padding: 10, textAlign: 'center' }}>
                          <input type="checkbox" checked={selectedEntities.has(point.id)} readOnly />
                        </td>
                        <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 12 }}>{point.handle || point.id}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontFamily: 'monospace' }}>{point.x.toFixed(3)}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontFamily: 'monospace' }}>{point.y.toFixed(3)}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontFamily: 'monospace' }}>{point.z.toFixed(3)}</td>
                        <td style={{ padding: 10 }}>{point.layer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPoints.length > 100 && (
                  <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>
                    ... e mais {filteredPoints.length - 100} pontos
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          <div style={{ 
            padding: 16, 
            backgroundColor: selectedEntities.size > 0 ? '#10b98122' : '#f5940b22', 
            border: `1px solid ${selectedEntities.size > 0 ? '#10b981' : '#f59e0b'}`, 
            borderRadius: 8,
            marginBottom: 20
          }}>
            <h4 style={{ margin: '0 0 8px', color: selectedEntities.size > 0 ? '#10b981' : '#f59e0b' }}>
              {selectedEntities.size > 0 ? '✅ Pronto para Importar' : '⚠️ Selecione entidades para importar'}
            </h4>
            <p style={{ margin: 0, color: '#94a3b8' }}>
              {selectedEntities.size} entidades selecionadas
            </p>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button onClick={onCancel} style={{ 
          padding: '12px 24px', 
          borderRadius: 8, 
          border: '1px solid #ef4444', 
          backgroundColor: 'transparent', 
          color: '#ef4444', 
          cursor: 'pointer'
        }}>
          Cancelar
        </button>
        
        <div style={{ display: 'flex', gap: 12 }}>
          {parseResult && (
            <button onClick={() => { setParseResult(null); setFile(null); }} style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: '1px solid #64748b',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer'
            }}>
              ← Novo Arquivo
            </button>
          )}
          
          <button 
            onClick={handleImport} 
            disabled={!parseResult || selectedEntities.size === 0}
            style={{
              padding: '12px 32px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: parseResult && selectedEntities.size > 0 ? '#10b981' : '#334155',
              color: '#fff',
              cursor: parseResult && selectedEntities.size > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            ✅ Confirmar Importação ({selectedEntities.size})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportWizard;

