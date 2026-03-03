/**
 * importWorker.ts — Web Worker for heavy file parsing.
 *
 * Runs DXF, CSV, GeoJSON, XLSX, and IFC parsing off the main thread
 * so the UI stays responsive during large file imports.
 *
 * Usage (from main thread):
 *   const worker = new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' });
 *   worker.postMessage({ id, format, content, fileName });
 *   worker.onmessage = (e) => { ... };
 */

import {
  parseDXFComplete,
  parseCSVContent,
  parseGeoJSONContent,
  parseXLSXContent,
  parseIFCContent,
  type ParseResult,
} from './importParsers';

// ── Message types ──

export interface WorkerRequest {
  id: string;
  format: string;
  content?: string;
  buffer?: ArrayBuffer;
  fileName: string;
}

export interface WorkerResponse {
  id: string;
  type: 'result' | 'error' | 'progress';
  result?: ParseResult;
  error?: string;
  progress?: number;
}

// ── Worker handler ──

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, format, content, buffer, fileName } = e.data;

  const sendProgress = (pct: number) => {
    ctx.postMessage({ id, type: 'progress', progress: pct } satisfies WorkerResponse);
  };

  try {
    let result: ParseResult;

    switch (format) {
      case 'DXF':
        result = parseDXFComplete(content!, fileName, sendProgress);
        break;
      case 'CSV':
      case 'TXT':
        sendProgress(10);
        result = parseCSVContent(content!, fileName);
        break;
      case 'GeoJSON':
        sendProgress(10);
        result = parseGeoJSONContent(content!, fileName);
        break;
      case 'XLSX':
        sendProgress(10);
        result = parseXLSXContent(buffer!, fileName);
        break;
      case 'IFC':
        sendProgress(10);
        result = parseIFCContent(content!, fileName);
        break;
      default:
        throw new Error(`Formato nao suportado no worker: ${format}`);
    }

    ctx.postMessage({ id, type: 'result', result } satisfies WorkerResponse);
  } catch (err: any) {
    ctx.postMessage({
      id,
      type: 'error',
      error: err.message || 'Erro ao processar arquivo',
    } satisfies WorkerResponse);
  }
};
