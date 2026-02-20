/**
 * NumericParser — Locale-aware number parsing and UTM coordinate validation.
 *
 * Detects:
 * - Brazilian format: 1.234.567,89 (dot = thousands, comma = decimal)
 * - American format: 1,234,567.89 (comma = thousands, dot = decimal)
 *
 * Internally always uses decimal "." with no thousands separator.
 */

export type NumericFormat = "auto" | "br" | "us";

/**
 * Parse a localized number string to a standard float.
 */
export function parseLocalizedNumber(
  value: string | number | null | undefined,
  format: NumericFormat = "auto"
): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : value;

  let str = String(value).trim();
  str = str.replace(/[¤$\u20AC£¥\s\u00A0]/g, "");
  if (str === "" || str === "-") return null;

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  let isCommaDecimal: boolean;

  if (format === "br") {
    isCommaDecimal = true;
  } else if (format === "us") {
    isCommaDecimal = false;
  } else {
    if (lastComma > lastDot) {
      isCommaDecimal = true;
    } else if (lastDot > lastComma) {
      isCommaDecimal = false;
    } else if (lastComma >= 0 && lastDot < 0) {
      const afterComma = str.substring(lastComma + 1);
      isCommaDecimal = afterComma.length !== 3 || str.indexOf(",") === lastComma;
    } else if (lastDot >= 0 && lastComma < 0) {
      const dotCount = (str.match(/\./g) || []).length;
      isCommaDecimal = dotCount > 1;
    } else {
      isCommaDecimal = false;
    }
  }

  if (isCommaDecimal) {
    str = str.replace(/\./g, "");
    str = str.replace(",", ".");
  } else {
    str = str.replace(/,/g, "");
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Detect the numeric format from sample values.
 */
export function detectNumericFormat(samples: string[]): NumericFormat {
  const brPattern = /^\d{1,3}(\.\d{3})*,\d+$/;
  const usPattern = /^\d{1,3}(,\d{3})*\.\d+$/;

  let brCount = 0;
  let usCount = 0;

  for (const s of samples) {
    const trimmed = s.trim();
    if (brPattern.test(trimmed)) brCount++;
    if (usPattern.test(trimmed)) usCount++;
  }

  if (brCount > usCount) return "br";
  if (usCount > brCount) return "us";
  return "auto";
}

/**
 * Validate UTM coordinates and warn about possible numeric format issues.
 */
export function validateUTMCoordinates(x: number, y: number): { valid: boolean; warning?: string } {
  const validX = x >= 100000 && x <= 900000;
  const validY = y >= 1000000 && y <= 10000000;
  if (validX && validY) return { valid: true };
  return {
    valid: false,
    warning: `Coordenadas fora da faixa UTM esperada (X: 100000-900000, Y: 1000000-10000000). X=${x.toFixed(3)}, Y=${y.toFixed(3)}. Possível erro de interpretação de separador decimal.`,
  };
}
