/**
 * File readers for topography and survey data.
 * Ported from Python engine_rede/reader.py
 * 
 * In the browser, files are parsed from CSV text or XLSX via the xlsx library.
 */

import * as XLSX from "xlsx";

export interface PontoTopografico {
  id: string;
  x: number;
  y: number;
  cota: number;
}

export class TopographyReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TopographyReaderError";
  }
}

function normalizeColumnNames(headers: string[]): string[] {
  return headers.map((h) => h.toLowerCase().trim());
}

function validateRequiredColumns(columns: string[], source: string): void {
  const required = ["id", "x", "y", "cota"];
  const missing = required.filter((r) => !columns.includes(r));
  if (missing.length > 0) {
    throw new TopographyReaderError(
      `Missing required columns in ${source}: ${missing.join(", ")}. Found: ${columns.join(", ")}`
    );
  }
}

/**
 * Detect if first line is a header (contains non-numeric text in expected columns).
 */
function isHeaderLine(line: string, delimiter: string): boolean {
  const parts = line.split(delimiter).map(p => p.trim());
  // If any of the first 3-4 parts is clearly non-numeric, it's a header
  const numericParts = parts.filter(p => !isNaN(Number(p)) && p !== "");
  return numericParts.length < Math.min(3, parts.length);
}

/**
 * Parse CSV/TXT text into topographic points.
 * Supports:
 * - With header: id;x;y;cota
 * - Without header (3 cols): x,y,cota (auto-generates IDs)
 * - Without header (4+ cols): id,x,y,cota
 */
export function parseTopographyCSV(csvText: string): PontoTopografico[] {
  const lines = csvText.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) {
    throw new TopographyReaderError("O arquivo deve ter pelo menos 2 linhas de dados.");
  }

  // Detect delimiter
  const firstLine = lines[0];
  let delimiter = ",";
  if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.includes(";")) delimiter = ";";

  const hasHeader = isHeaderLine(firstLine, delimiter);
  let startIdx = 0;

  if (hasHeader) {
    const rawHeaders = firstLine.split(delimiter);
    const headers = normalizeColumnNames(rawHeaders);
    validateRequiredColumns(headers, "CSV");

    const idIdx = headers.indexOf("id");
    const xIdx = headers.indexOf("x");
    const yIdx = headers.indexOf("y");
    const cotaIdx = headers.indexOf("cota");

    startIdx = 1;
    const pontos: PontoTopografico[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(delimiter);
      const id = parts[idIdx]?.trim();
      const x = parseFloat(parts[xIdx]);
      const y = parseFloat(parts[yIdx]);
      const cota = parseFloat(parts[cotaIdx]);
      if (!id) throw new TopographyReaderError(`Linha ${i + 1}: ID vazio.`);
      if (isNaN(x) || isNaN(y) || isNaN(cota)) {
        throw new TopographyReaderError(`Dados numéricos inválidos na linha ${i + 1}.`);
      }
      pontos.push({ id, x, y, cota });
    }
    return pontos;
  }

  // No header - auto-detect column count
  const pontos: PontoTopografico[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(delimiter).map(p => p.trim()).filter(Boolean);

    let id: string, x: number, y: number, cota: number;

    if (parts.length >= 4) {
      // id, x, y, cota
      id = parts[0];
      x = parseFloat(parts[1]);
      y = parseFloat(parts[2]);
      cota = parseFloat(parts[3]);
    } else if (parts.length >= 3) {
      // x, y, cota (auto-generate ID)
      id = `P${String(i + 1).padStart(3, "0")}`;
      x = parseFloat(parts[0]);
      y = parseFloat(parts[1]);
      cota = parseFloat(parts[2]);
    } else {
      throw new TopographyReaderError(`Linha ${i + 1}: mínimo 3 colunas (X, Y, Cota).`);
    }

    if (isNaN(x) || isNaN(y) || isNaN(cota)) {
      throw new TopographyReaderError(`Dados numéricos inválidos na linha ${i + 1}.`);
    }
    pontos.push({ id, x, y, cota });
  }
  return pontos;
}

/**
 * Parse XLSX ArrayBuffer into topographic points.
 */
export function parseTopographyXLSX(buffer: ArrayBuffer): PontoTopografico[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (data.length === 0) {
    throw new TopographyReaderError("Excel file is empty.");
  }

  const rawHeaders = Object.keys(data[0]);
  const headers = normalizeColumnNames(rawHeaders);
  validateRequiredColumns(headers, "Excel");

  // Create column mapping
  const colMap: Record<string, string> = {};
  rawHeaders.forEach((raw, i) => {
    colMap[headers[i]] = raw;
  });

  const pontos: PontoTopografico[] = [];

  data.forEach((row, idx) => {
    const id = String(row[colMap["id"]] ?? "").trim();
    const x = Number(row[colMap["x"]]);
    const y = Number(row[colMap["y"]]);
    const cota = Number(row[colMap["cota"]]);

    if (!id) {
      throw new TopographyReaderError(`Invalid data at row ${idx + 2}: Point ID must be non-empty.`);
    }
    if (isNaN(x) || isNaN(y) || isNaN(cota)) {
      throw new TopographyReaderError(`Invalid numeric data at row ${idx + 2}.`);
    }

    pontos.push({ id, x, y, cota });
  });

  return pontos;
}

/**
 * Parse a file (CSV or XLSX) into topographic points.
 */
export function parseTopographyFile(file: File): Promise<PontoTopografico[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "txt") {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          resolve(parseTopographyCSV(text));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          resolve(parseTopographyXLSX(buffer));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reject(new TopographyReaderError(`Unsupported file format: .${ext}`));
    }
  });
}

export function validateTopographySequence(pontos: PontoTopografico[]): void {
  if (pontos.length < 2) {
    throw new TopographyReaderError(
      `At least 2 points are required to define a network. Got: ${pontos.length}`
    );
  }

  const ids = pontos.map((p) => p.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    throw new TopographyReaderError(`Duplicate point IDs found: ${[...new Set(duplicates)].join(", ")}`);
  }
}
