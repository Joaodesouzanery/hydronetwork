/**
 * Zod validation schemas for HydroNetwork data types.
 *
 * Provides runtime validation for network parameters, nodes,
 * alert configurations, and project delay data.
 */

import { z } from "zod";

// ══════════════════════════════════════
// Sewer Parameters
// ══════════════════════════════════════

export const sewerParamsSchema = z.object({
  manning: z.number().min(0.001, "Manning deve ser > 0").max(0.1, "Manning muito alto"),
  laminaMax: z.number().min(0.1, "y/D min 0.1").max(1.0, "y/D max 1.0"),
  velMin: z.number().min(0, "Velocidade min >= 0"),
  velMax: z.number().min(0.1, "Velocidade max > 0"),
  tensaoMin: z.number().min(0, "Tensão min >= 0"),
  diamMinMm: z.number().int().min(50, "Diâmetro min 50mm").max(3000, "Diâmetro max 3000mm"),
}).refine(d => d.velMin < d.velMax, {
  message: "Velocidade mínima deve ser menor que a máxima",
  path: ["velMin"],
});

// ══════════════════════════════════════
// Water Parameters
// ══════════════════════════════════════

export const waterParamsSchema = z.object({
  formula: z.enum(["hazen-williams", "colebrook"]),
  coefHW: z.number().min(50, "C min 50").max(200, "C max 200"),
  velMin: z.number().min(0, "Velocidade min >= 0"),
  velMax: z.number().min(0.1, "Velocidade max > 0"),
  pressaoMin: z.number().min(0, "Pressão min >= 0"),
  pressaoMax: z.number().min(1, "Pressão max > 0"),
  diamMinMm: z.number().int().min(20, "Diâmetro min 20mm").max(2000, "Diâmetro max 2000mm"),
}).refine(d => d.velMin < d.velMax, {
  message: "Velocidade mínima deve ser menor que a máxima",
  path: ["velMin"],
}).refine(d => d.pressaoMin < d.pressaoMax, {
  message: "Pressão mínima deve ser menor que a máxima",
  path: ["pressaoMin"],
});

// ══════════════════════════════════════
// Network Nodes
// ══════════════════════════════════════

export const sewerNodeSchema = z.object({
  id: z.string().min(1, "ID obrigatório"),
  x: z.number(),
  y: z.number(),
  cotaTerreno: z.number(),
  cotaFundo: z.number(),
  populacao: z.number().int().min(0, "População >= 0"),
}).refine(d => d.cotaFundo <= d.cotaTerreno, {
  message: "Cota do fundo deve ser <= cota do terreno",
  path: ["cotaFundo"],
});

export const waterNodeSchema = z.object({
  id: z.string().min(1, "ID obrigatório"),
  x: z.number(),
  y: z.number(),
  cota: z.number(),
  demanda: z.number().min(0, "Demanda >= 0"),
});

// ══════════════════════════════════════
// Alert Configuration
// ══════════════════════════════════════

export const emailSchema = z.string().email("E-mail inválido");

export const alertConfigSchema = z.object({
  tipo_alerta: z.enum(["producao_baixa", "funcionarios_ausentes", "clima_adverso", "atraso_cronograma"], {
    required_error: "Selecione o tipo de alerta",
  }),
  obra_id: z.string().nullable(),
  destinatarios: z.array(emailSchema).min(1, "Pelo menos um destinatário é necessário"),
  ativo: z.boolean(),
});

// ══════════════════════════════════════
// Project Delay
// ══════════════════════════════════════

export const projectDelaySchema = z.object({
  totalDays: z.number().positive(),
  elapsedDays: z.number().min(0),
  expectedProgress: z.number().min(0).max(100),
  actualProgress: z.number().min(0).max(100),
  delayPercent: z.number().min(0),
  delayDays: z.number().min(0),
  status: z.enum(["on_track", "warning", "critical", "overdue"]),
});

// ══════════════════════════════════════
// Utility: safe parse with toast
// ══════════════════════════════════════

export function validateWithToast<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.errors[0];
    const { toast } = require("sonner");
    toast.error(firstError.message);
    return null;
  }
  return result.data;
}
