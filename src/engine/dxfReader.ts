/**
 * DXF file parser for topography data.
 * Extracts POINT, LINE and POLYLINE entities from DXF files.
 */

import { PontoTopografico } from "./reader";

export class DxfReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DxfReaderError";
  }
}

interface DxfEntity {
  type: string;
  x?: number;
  y?: number;
  z?: number;
  x2?: number;
  y2?: number;
  z2?: number;
  layer?: string;
  vertices?: { x: number; y: number; z: number }[];
}

/**
 * Parse DXF text content and extract entities.
 */
function parseDxfEntities(text: string): DxfEntity[] {
  const lines = text.split(/\r?\n/);
  const entities: DxfEntity[] = [];

  // Find ENTITIES section
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "ENTITIES") break;
    i++;
  }
  if (i >= lines.length) {
    throw new DxfReaderError("Seção ENTITIES não encontrada no arquivo DXF.");
  }
  i++;

  let current: DxfEntity | null = null;
  let inVertex = false;
  let currentVertex: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  while (i < lines.length - 1) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1]?.trim() ?? "";
    i += 2;

    if (code === 0) {
      // Save previous entity
      if (current) {
        if (inVertex && current.vertices) {
          current.vertices.push({ ...currentVertex });
          inVertex = false;
        }
        entities.push(current);
      }

      if (value === "ENDSEC" || value === "EOF") break;

      if (value === "POINT" || value === "LINE" || value === "LWPOLYLINE" || value === "POLYLINE" || value === "INSERT" || value === "CIRCLE") {
        current = { type: value, vertices: [] };
        inVertex = false;
      } else if (value === "VERTEX") {
        inVertex = true;
        currentVertex = { x: 0, y: 0, z: 0 };
      } else if (value === "SEQEND") {
        inVertex = false;
        current = null;
      } else {
        current = null;
      }
      continue;
    }

    if (!current && !inVertex) continue;

    if (inVertex) {
      if (code === 10) currentVertex.x = parseFloat(value);
      else if (code === 20) currentVertex.y = parseFloat(value);
      else if (code === 30) currentVertex.z = parseFloat(value);
      if (code === 0 && current?.vertices) {
        current.vertices.push({ ...currentVertex });
        inVertex = false;
      }
    } else if (current) {
      switch (code) {
        case 8: current.layer = value; break;
        case 10: current.x = parseFloat(value); break;
        case 20: current.y = parseFloat(value); break;
        case 30: current.z = parseFloat(value); break;
        case 11: current.x2 = parseFloat(value); break;
        case 21: current.y2 = parseFloat(value); break;
        case 31: current.z2 = parseFloat(value); break;
      }
    }
  }

  // Save last entity
  if (current) entities.push(current);

  return entities;
}

/**
 * Extract topographic points from DXF entities.
 * POINTs become individual points.
 * LWPOLYLINE vertices also become points.
 * LINE endpoints become points (deduplicated).
 */
export function parseDxfToPoints(text: string): PontoTopografico[] {
  const entities = parseDxfEntities(text);
  const pointsMap = new Map<string, PontoTopografico>();
  let autoId = 1;

  const addPoint = (x: number, y: number, z: number, layer?: string) => {
    if (isNaN(x) || isNaN(y)) return;
    const key = `${x.toFixed(4)}_${y.toFixed(4)}`;
    if (!pointsMap.has(key)) {
      const id = layer ? `${layer}_${autoId}` : `P${String(autoId).padStart(3, "0")}`;
      autoId++;
      pointsMap.set(key, { id, x, y, cota: isNaN(z) ? 0 : z });
    }
  };

  for (const e of entities) {
    switch (e.type) {
      case "POINT":
        if (e.x !== undefined && e.y !== undefined) {
          addPoint(e.x, e.y, e.z ?? 0, e.layer);
        }
        break;

      case "LINE":
        if (e.x !== undefined && e.y !== undefined) addPoint(e.x, e.y, e.z ?? 0, e.layer);
        if (e.x2 !== undefined && e.y2 !== undefined) addPoint(e.x2, e.y2, e.z2 ?? 0, e.layer);
        break;

      case "LWPOLYLINE":
      case "POLYLINE":
        if (e.vertices) {
          for (const v of e.vertices) {
            addPoint(v.x, v.y, v.z ?? 0, e.layer);
          }
        }
        // Also check if x/y are set (LWPOLYLINE stores vertices differently in some files)
        if (e.x !== undefined && e.y !== undefined) {
          addPoint(e.x, e.y, e.z ?? 0, e.layer);
        }
        break;

      case "INSERT":
      case "CIRCLE":
        if (e.x !== undefined && e.y !== undefined) {
          addPoint(e.x, e.y, e.z ?? 0, e.layer);
        }
        break;
    }
  }

  const points = Array.from(pointsMap.values());
  if (points.length === 0) {
    throw new DxfReaderError("Nenhum ponto encontrado no arquivo DXF. Verifique se o arquivo contém entidades POINT, LINE ou POLYLINE.");
  }

  return points;
}

/**
 * Parse a DXF file into topographic points.
 */
export function parseDxfFile(file: File): Promise<PontoTopografico[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        resolve(parseDxfToPoints(text));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new DxfReaderError("Erro ao ler arquivo DXF."));
    reader.readAsText(file);
  });
}
