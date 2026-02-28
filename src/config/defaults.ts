/**
 * Centralized configuration constants for HydroNetwork.
 *
 * All magic numbers and hardcoded values across the application are
 * consolidated here for easy maintenance and consistency.
 */

// ══════════════════════════════════════
// Sewer (Esgoto) — NBR 9649 / NBR 14486
// ══════════════════════════════════════

export const SEWER_DEFAULTS = {
  manning: { PVC: 0.013, Concreto: 0.015 } as Record<string, number>,
  velMin: 0.6,
  velMax: 5.0,
  laminaMax: 0.75,
  tensaoMin: 1.0,
  diamMinMm: 150,
  defaultMaterial: "PVC",
  defaultVazaoLps: 1.5,
  defaultQpcLitrosDia: 160,
  defaultK1: 1.2,
  defaultK2: 1.5,
  defaultCotaFundoOffset: 1.5,
  defaultPopulacao: 50,
  pvDepthWarning: 4, // meters
  mapAccentColor: "#f59e0b",
  mapOkColor: "#22c55e",
  mapFailColor: "#ef4444",
  markerColor: "#92400e",
  markerFillColor: "#f59e0b",
} as const;

// ══════════════════════════════════════
// Water (Agua) — NBR 12218
// ══════════════════════════════════════

export const WATER_DEFAULTS = {
  formula: "hazen-williams" as const,
  coefHW: 140,
  velMin: 0.6,
  velMax: 3.5,
  pressaoMin: 10.0,
  pressaoMax: 50.0,
  diamMinMm: 50,
  rugosidade: 0.0015,
  defaultMaterial: "PVC",
  defaultVazaoLps: 0.5,
  demandaResidencial: { min: 0.3, max: 0.5 },
  demandaComercial: { min: 0.8, max: 1.5 },
  demandaIndustrial: { min: 2.0, max: 5.0 },
  mapAccentColor: "#3b82f6",
  mapOkColor: "#3b82f6",
  mapFailColor: "#ef4444",
  markerColor: "#1e40af",
  markerFillColor: "#60a5fa",
} as const;

// ══════════════════════════════════════
// Project Delays (Atrasos de Projeto)
// ══════════════════════════════════════

export const DELAY_THRESHOLDS = {
  warningPercent: 10,
  criticalPercent: 20,
  alertThresholdPercent: 10,
} as const;

export const DELAY_STATUS_COLORS = {
  on_track: "#22c55e",
  warning: "#eab308",
  critical: "#ef4444",
  overdue: "#7f1d1d",
  default: "#3b82f6",
} as const;

// ══════════════════════════════════════
// Alerts (Alertas)
// ══════════════════════════════════════

export const ALERT_TYPES = {
  producao_baixa: "Produção Abaixo da Meta",
  funcionarios_ausentes: "Funcionários Ausentes",
  clima_adverso: "Clima Adverso",
  atraso_cronograma: "Atraso no Cronograma",
} as const;

export type AlertType = keyof typeof ALERT_TYPES;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// ══════════════════════════════════════
// Lean / LPS Charts
// ══════════════════════════════════════

export const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
] as const;

export const LPS_DEFAULTS = {
  targetPPC: 80,
} as const;

// ══════════════════════════════════════
// Demo Data Coordinates (UTM Zone 22S)
// ══════════════════════════════════════

export const DEMO_UTM_ORIGIN = {
  x: 350000,
  y: 7400000,
} as const;

// ══════════════════════════════════════
// General UI Defaults
// ══════════════════════════════════════

export const MAP_DEFAULTS = {
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "&copy; OSM",
  fitBoundsPadding: [30, 30] as [number, number],
  segmentWeight: 4,
  segmentOpacity: 0.85,
  markerRadius: 5,
  markerFillOpacity: 0.8,
  defaultHeight: 400,
} as const;
