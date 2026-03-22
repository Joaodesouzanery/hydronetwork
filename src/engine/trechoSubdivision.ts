/**
 * Trecho Subdivision engine — splits a network segment into smaller sub-segments
 * by a specified length, interpolating coordinates linearly along the segment.
 */

import { Trecho } from "./domain";

export interface SubTrecho extends Trecho {
  parentId: string;       // "idInicio-idFim" of the original trecho
  subIndex: number;       // 0-based index within the parent
  subCount: number;       // total number of sub-trechos
  isSubdivided: boolean;  // always true for sub-trechos
}

/**
 * Subdivide a trecho into N sub-segments of approximately `segmentLength` meters.
 * The last segment absorbs any remainder.
 */
export function subdivideTrecho(
  trecho: Trecho,
  segmentLength: number
): SubTrecho[] {
  if (segmentLength <= 0 || segmentLength >= trecho.comprimento) {
    // No subdivision needed — return single sub-trecho wrapping the original
    return [wrapAsSubTrecho(trecho, 0, 1)];
  }

  const n = Math.ceil(trecho.comprimento / segmentLength);
  const parentId = `${trecho.idInicio}-${trecho.idFim}`;
  const baseName = trecho.nomeTrecho || `${trecho.idInicio}→${trecho.idFim}`;
  const result: SubTrecho[] = [];

  let accumulated = 0;

  for (let i = 0; i < n; i++) {
    const isFirst = i === 0;
    const isLast = i === n - 1;

    // Length: equal splits, last one absorbs remainder
    const comp = isLast
      ? trecho.comprimento - accumulated
      : segmentLength;

    // Interpolation fractions along the segment
    const tStart = accumulated / trecho.comprimento;
    const tEnd = (accumulated + comp) / trecho.comprimento;

    // Interpolate coordinates linearly
    const xStart = lerp(trecho.xInicio, trecho.xFim, tStart);
    const yStart = lerp(trecho.yInicio, trecho.yFim, tStart);
    const cotaStart = lerp(trecho.cotaInicio, trecho.cotaFim, tStart);
    const xEnd = lerp(trecho.xInicio, trecho.xFim, tEnd);
    const yEnd = lerp(trecho.yInicio, trecho.yFim, tEnd);
    const cotaEnd = lerp(trecho.cotaInicio, trecho.cotaFim, tEnd);

    // Node IDs for sub-trechos
    const subIdInicio = isFirst ? trecho.idInicio : `${parentId}_S${i}`;
    const subIdFim = isLast ? trecho.idFim : `${parentId}_S${i + 1}`;

    result.push({
      idInicio: subIdInicio,
      idFim: subIdFim,
      nome: trecho.nome,
      comprimento: round3(comp),
      declividade: trecho.declividade,
      tipoRede: trecho.tipoRede,
      diametroMm: trecho.diametroMm,
      material: trecho.material,
      xInicio: round3(xStart),
      yInicio: round3(yStart),
      cotaInicio: round3(cotaStart),
      xFim: round3(xEnd),
      yFim: round3(yEnd),
      cotaFim: round3(cotaEnd),
      nomeTrecho: `${baseName} (${i + 1}/${n})`,
      codigoTrecho: trecho.codigoTrecho
        ? `${trecho.codigoTrecho}.${i + 1}`
        : undefined,
      tipoRedeManual: trecho.tipoRedeManual,
      frenteServico: trecho.frenteServico,
      lote: trecho.lote,
      grupo: trecho.grupo,
      parentId,
      subIndex: i,
      subCount: n,
      isSubdivided: true,
    });

    accumulated += comp;
  }

  return result;
}

/**
 * Reunify sub-trechos back into the original trecho.
 * Takes all sub-trechos sharing the same parentId and reconstructs the original.
 */
export function reunifySubTrechos(subTrechos: SubTrecho[]): Trecho {
  if (subTrechos.length === 0) {
    throw new Error("Cannot reunify empty sub-trecho list");
  }

  const sorted = [...subTrechos].sort((a, b) => a.subIndex - b.subIndex);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return {
    idInicio: first.idInicio,
    idFim: last.idFim,
    nome: first.nome,
    comprimento: round3(sorted.reduce((sum, s) => sum + s.comprimento, 0)),
    declividade: first.declividade,
    tipoRede: first.tipoRede,
    diametroMm: first.diametroMm,
    material: first.material,
    xInicio: first.xInicio,
    yInicio: first.yInicio,
    cotaInicio: first.cotaInicio,
    xFim: last.xFim,
    yFim: last.yFim,
    cotaFim: last.cotaFim,
    nomeTrecho: stripSubdivisionSuffix(first.nomeTrecho),
    codigoTrecho: stripCodeSuffix(first.codigoTrecho),
    tipoRedeManual: first.tipoRedeManual,
    frenteServico: first.frenteServico,
    lote: first.lote,
    grupo: first.grupo,
  };
}

/**
 * Check if a trecho-like object is a SubTrecho.
 */
export function isSubTrecho(t: Trecho): t is SubTrecho {
  return "isSubdivided" in t && (t as SubTrecho).isSubdivided === true;
}

// ── Helpers ──

function wrapAsSubTrecho(t: Trecho, index: number, count: number): SubTrecho {
  return {
    ...t,
    parentId: `${t.idInicio}-${t.idFim}`,
    subIndex: index,
    subCount: count,
    isSubdivided: true,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function stripSubdivisionSuffix(name?: string): string | undefined {
  if (!name) return undefined;
  return name.replace(/\s*\(\d+\/\d+\)$/, "");
}

function stripCodeSuffix(code?: string): string | undefined {
  if (!code) return undefined;
  return code.replace(/\.\d+$/, "");
}
