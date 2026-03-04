/**
 * TrechoMeasurement Engine — Manages measurement (medição) per trecho.
 * Supports partial and total measurement, physical progress tracking,
 * and automatic cost/schedule updates.
 */

// ── Types ──

export interface TrechoMeasurement {
  trechoKey: string;
  nomeTrecho: string;
  comprimentoTotal: number;
  comprimentoExecutado: number;
  progressoPct: number;        // (executado / total) * 100
  custoOrcado: number;         // from cost allocation
  custoExecutado: number;      // proportional to progress
  status: "nao_iniciado" | "em_andamento" | "concluido";
  dataInicio: string;
  dataUltimaAtualizacao: string;
  observacoes: string;
  medicoes: MeasurementEntry[];
}

export interface MeasurementEntry {
  id: string;
  data: string;               // YYYY-MM-DD
  comprimentoMedido: number;  // meters measured in this entry
  observacao: string;
  responsavel: string;
}

// ── Storage ──

const STORAGE_KEY = "hydronetwork_trecho_measurements";

export function loadMeasurements(): TrechoMeasurement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMeasurements(measurements: TrechoMeasurement[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(measurements));
}

// ── CRUD ──

export function getMeasurement(trechoKey: string): TrechoMeasurement | undefined {
  return loadMeasurements().find(m => m.trechoKey === trechoKey);
}

export function createOrUpdateMeasurement(measurement: TrechoMeasurement): void {
  const all = loadMeasurements();
  const idx = all.findIndex(m => m.trechoKey === measurement.trechoKey);
  if (idx >= 0) {
    all[idx] = measurement;
  } else {
    all.push(measurement);
  }
  saveMeasurements(all);
}

export function initializeMeasurement(
  trechoKey: string,
  nomeTrecho: string,
  comprimentoTotal: number,
  custoOrcado: number
): TrechoMeasurement {
  const existing = getMeasurement(trechoKey);
  if (existing) return existing;

  const measurement: TrechoMeasurement = {
    trechoKey,
    nomeTrecho,
    comprimentoTotal,
    comprimentoExecutado: 0,
    progressoPct: 0,
    custoOrcado,
    custoExecutado: 0,
    status: "nao_iniciado",
    dataInicio: "",
    dataUltimaAtualizacao: "",
    observacoes: "",
    medicoes: [],
  };
  createOrUpdateMeasurement(measurement);
  return measurement;
}

// ── Add measurement entry ──

export function addMeasurementEntry(
  trechoKey: string,
  entry: Omit<MeasurementEntry, "id">
): TrechoMeasurement | null {
  const measurement = getMeasurement(trechoKey);
  if (!measurement) return null;

  const newEntry: MeasurementEntry = {
    ...entry,
    id: crypto.randomUUID(),
  };

  measurement.medicoes.push(newEntry);
  return recalculateMeasurement(measurement);
}

export function removeMeasurementEntry(trechoKey: string, entryId: string): TrechoMeasurement | null {
  const measurement = getMeasurement(trechoKey);
  if (!measurement) return null;

  measurement.medicoes = measurement.medicoes.filter(e => e.id !== entryId);
  return recalculateMeasurement(measurement);
}

// ── Recalculate from entries ──

export function recalculateMeasurement(measurement: TrechoMeasurement): TrechoMeasurement {
  const totalExecutado = measurement.medicoes.reduce((sum, e) => sum + e.comprimentoMedido, 0);
  const capped = Math.min(totalExecutado, measurement.comprimentoTotal);
  const progressoPct = measurement.comprimentoTotal > 0
    ? Math.round((capped / measurement.comprimentoTotal) * 10000) / 100
    : 0;

  const custoExecutado = measurement.custoOrcado > 0
    ? Math.round(measurement.custoOrcado * (progressoPct / 100) * 100) / 100
    : 0;

  let status: TrechoMeasurement["status"] = "nao_iniciado";
  if (progressoPct >= 100) status = "concluido";
  else if (progressoPct > 0) status = "em_andamento";

  const dataInicio = measurement.medicoes.length > 0
    ? measurement.medicoes.reduce((min, e) => e.data < min ? e.data : min, measurement.medicoes[0].data)
    : "";
  const dataUltimaAtualizacao = measurement.medicoes.length > 0
    ? measurement.medicoes.reduce((max, e) => e.data > max ? e.data : max, measurement.medicoes[0].data)
    : "";

  const updated: TrechoMeasurement = {
    ...measurement,
    comprimentoExecutado: capped,
    progressoPct,
    custoExecutado,
    status,
    dataInicio,
    dataUltimaAtualizacao,
  };

  createOrUpdateMeasurement(updated);
  return updated;
}

// ── Set measurement directly (for quick partial/total) ──

export function setMeasurementDirect(
  trechoKey: string,
  comprimentoExecutado: number,
  observacao?: string
): TrechoMeasurement | null {
  const measurement = getMeasurement(trechoKey);
  if (!measurement) return null;

  // Create an entry for the difference
  const currentExecutado = measurement.comprimentoExecutado;
  const diff = comprimentoExecutado - currentExecutado;
  if (Math.abs(diff) < 0.01) return measurement;

  const entry: Omit<MeasurementEntry, "id"> = {
    data: new Date().toISOString().slice(0, 10),
    comprimentoMedido: diff,
    observacao: observacao || (diff > 0 ? "Avanço de medição" : "Ajuste de medição"),
    responsavel: "",
  };

  return addMeasurementEntry(trechoKey, entry);
}

// ── Summary ──

export interface MeasurementSummary {
  totalTrechos: number;
  trechosIniciados: number;
  trechosConcluidos: number;
  extensaoTotal: number;
  extensaoExecutada: number;
  progressoGeral: number;
  custoOrcadoTotal: number;
  custoExecutadoTotal: number;
}

export function getMeasurementSummary(): MeasurementSummary {
  const all = loadMeasurements();
  const extensaoTotal = all.reduce((s, m) => s + m.comprimentoTotal, 0);
  const extensaoExecutada = all.reduce((s, m) => s + m.comprimentoExecutado, 0);
  const custoOrcadoTotal = all.reduce((s, m) => s + m.custoOrcado, 0);
  const custoExecutadoTotal = all.reduce((s, m) => s + m.custoExecutado, 0);

  return {
    totalTrechos: all.length,
    trechosIniciados: all.filter(m => m.status === "em_andamento").length,
    trechosConcluidos: all.filter(m => m.status === "concluido").length,
    extensaoTotal: Math.round(extensaoTotal * 100) / 100,
    extensaoExecutada: Math.round(extensaoExecutada * 100) / 100,
    progressoGeral: extensaoTotal > 0 ? Math.round((extensaoExecutada / extensaoTotal) * 10000) / 100 : 0,
    custoOrcadoTotal: Math.round(custoOrcadoTotal * 100) / 100,
    custoExecutadoTotal: Math.round(custoExecutadoTotal * 100) / 100,
  };
}
