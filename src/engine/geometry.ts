/**
 * Geometric calculations for sanitation network engineering.
 * Ported from Python engine_rede/geometry.py
 */

// Engineering constants
export const DECLIVIDADE_MIN = 0.005; // Minimum slope (0.5%) for gravity flow

// Network type
export type TipoRede = "Esgoto por Gravidade" | "Elevatória / Booster";

export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= 0) {
    throw new Error(
      `Distance between points (${x1}, ${y1}) and (${x2}, ${y2}) must be greater than zero.`
    );
  }

  return distance;
}

export function calculateSlope(cotaInicio: number, cotaFim: number, distance: number): number {
  if (distance <= 0) {
    throw new Error(`Distance must be positive for slope calculation. Got: ${distance}`);
  }
  return (cotaInicio - cotaFim) / distance;
}

export function classifyNetworkType(slope: number): TipoRede {
  if (slope >= DECLIVIDADE_MIN) {
    return "Esgoto por Gravidade";
  }
  return "Elevatória / Booster";
}

export function validateCoordinates(x: number, y: number, cota: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(cota)) {
    throw new Error(`All coordinates must be finite numbers. Got: x=${x}, y=${y}, cota=${cota}`);
  }
}
