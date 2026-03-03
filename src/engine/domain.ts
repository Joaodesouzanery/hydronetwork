/**
 * Domain models for sanitation network engineering.
 * Ported from Python engine_rede/domain.py
 */

import {
  TipoRede,
  calculateDistance,
  calculateSlope,
  classifyNetworkType,
  validateCoordinates,
} from "./geometry";
import { PontoTopografico } from "./reader";

// Default engineering parameters
export const DEFAULT_DIAMETRO_MM = 200;
export const DEFAULT_MATERIAL = "PVC";

export type TipoRedeManual = "agua" | "esgoto" | "drenagem" | "recalque" | "outro";

export interface Trecho {
  idInicio: string;
  idFim: string;
  nome?: string;
  comprimento: number;
  declividade: number;
  tipoRede: TipoRede;
  diametroMm: number;
  material: string;
  xInicio: number;
  yInicio: number;
  cotaInicio: number;
  xFim: number;
  yFim: number;
  cotaFim: number;
  // Editable identity fields
  nomeTrecho?: string;
  codigoTrecho?: string;
  tipoRedeManual?: TipoRedeManual;
  frenteServico?: string;
  lote?: string;
  grupo?: string;
}

export function trechoToRecord(t: Trecho, includeCoordinates = false) {
  const base: Record<string, unknown> = {
    id_inicio: t.idInicio,
    id_fim: t.idFim,
    comprimento: Math.round(t.comprimento * 1000) / 1000,
    declividade: Math.round(t.declividade * 1000000) / 1000000,
    tipo_rede: t.tipoRede,
    diametro_mm: t.diametroMm,
    material: t.material,
  };

  if (includeCoordinates) {
    base.x_inicio = Math.round(t.xInicio * 1000) / 1000;
    base.y_inicio = Math.round(t.yInicio * 1000) / 1000;
    base.cota_inicio = Math.round(t.cotaInicio * 1000) / 1000;
    base.x_fim = Math.round(t.xFim * 1000) / 1000;
    base.y_fim = Math.round(t.yFim * 1000) / 1000;
    base.cota_fim = Math.round(t.cotaFim * 1000) / 1000;
  }

  return base;
}

export function getDesnivel(t: Trecho): number {
  return t.cotaInicio - t.cotaFim;
}

export function isGravityFlow(t: Trecho): boolean {
  return t.tipoRede === "Esgoto por Gravidade";
}

export function createTrechoFromPoints(
  pontoInicio: PontoTopografico,
  pontoFim: PontoTopografico,
  diametroMm = DEFAULT_DIAMETRO_MM,
  material = DEFAULT_MATERIAL
): Trecho {
  validateCoordinates(pontoInicio.x, pontoInicio.y, pontoInicio.cota);
  validateCoordinates(pontoFim.x, pontoFim.y, pontoFim.cota);

  const comprimento = calculateDistance(pontoInicio.x, pontoInicio.y, pontoFim.x, pontoFim.y);
  const declividade = calculateSlope(pontoInicio.cota, pontoFim.cota, comprimento);
  const tipoRede = classifyNetworkType(declividade);

  return {
    idInicio: pontoInicio.id,
    idFim: pontoFim.id,
    comprimento,
    declividade,
    tipoRede,
    diametroMm,
    material,
    xInicio: pontoInicio.x,
    yInicio: pontoInicio.y,
    cotaInicio: pontoInicio.cota,
    xFim: pontoFim.x,
    yFim: pontoFim.y,
    cotaFim: pontoFim.cota,
    tipoRedeManual: "esgoto",
  };
}

export function createTrechosFromTopography(
  pontos: PontoTopografico[],
  diametroMm = DEFAULT_DIAMETRO_MM,
  material = DEFAULT_MATERIAL
): Trecho[] {
  if (pontos.length < 2) {
    throw new Error(`At least 2 points are required. Got: ${pontos.length}`);
  }

  const trechos: Trecho[] = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    trechos.push(createTrechoFromPoints(pontos[i], pontos[i + 1], diametroMm, material));
  }
  return trechos;
}

export interface NetworkSummary {
  totalTrechos: number;
  comprimentoTotal: number;
  trechosGravidade: number;
  trechosElevatoria: number;
  declividadeMedia: number;
  declividadeMin: number;
  declividadeMax: number;
}

export function summarizeNetwork(trechos: Trecho[]): NetworkSummary {
  if (trechos.length === 0) {
    return {
      totalTrechos: 0,
      comprimentoTotal: 0,
      trechosGravidade: 0,
      trechosElevatoria: 0,
      declividadeMedia: 0,
      declividadeMin: 0,
      declividadeMax: 0,
    };
  }

  const comprimentos = trechos.map((t) => t.comprimento);
  const declividades = trechos.map((t) => t.declividade);
  const gravidade = trechos.filter((t) => isGravityFlow(t)).length;

  return {
    totalTrechos: trechos.length,
    comprimentoTotal: Math.round(comprimentos.reduce((a, b) => a + b, 0) * 1000) / 1000,
    trechosGravidade: gravidade,
    trechosElevatoria: trechos.length - gravidade,
    declividadeMedia:
      Math.round((declividades.reduce((a, b) => a + b, 0) / declividades.length) * 1000000) / 1000000,
    declividadeMin: Math.round(Math.min(...declividades) * 1000000) / 1000000,
    declividadeMax: Math.round(Math.max(...declividades) * 1000000) / 1000000,
  };
}
