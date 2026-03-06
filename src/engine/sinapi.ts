/**
 * Shared SINAPI cost engine — Global pricing reference used across all modules.
 * SINAPI 01/2026 - Desonerado - SP (ajustado INCC +8%)
 *
 * Used by: QuantitiesModule, TrechoEditModule, BudgetCostModule, MedicaoEngine, etc.
 */

export interface SinapiItem {
  codigo: string;
  descricao: string;
  unit: string;
  custo: number;
}

export const SINAPI_COSTS = {
  escavacao: {
    "0-1.5": { codigo: "96995", descricao: "Escavação mecanizada 1ª cat. até 1,5m", unit: "m³", custo: 30.78 },
    "1.5-3": { codigo: "96996", descricao: "Escavação mecanizada 1ª cat. 1,5-3m", unit: "m³", custo: 38.02 },
    "3-4.5": { codigo: "96997", descricao: "Escavação mecanizada 1ª cat. 3-4,5m", unit: "m³", custo: 46.22 },
    "rocha": { codigo: "96999", descricao: "Escavação 3ª cat. (rocha)", unit: "m³", custo: 135.54 },
  },
  escoramento: {
    madeira: { codigo: "95241", descricao: "Escoramento contínuo madeira", unit: "m²", custo: 49.46 },
    metalico: { codigo: "95242", descricao: "Escoramento metálico", unit: "m²", custo: 41.58 },
    estaca: { codigo: "95243", descricao: "Estaca-prancha", unit: "m²", custo: 92.02 },
  },
  tubulacao: {
    150: { codigo: "89356", descricao: "Tubo PVC DN150 implantado", unit: "m", custo: 135.54 },
    200: { codigo: "89357", descricao: "Tubo PVC DN200 implantado", unit: "m", custo: 200.12 },
    250: { codigo: "89358", descricao: "Tubo PVC DN250 implantado", unit: "m", custo: 287.06 },
    300: { codigo: "89359", descricao: "Tubo PVC DN300 implantado", unit: "m", custo: 383.62 },
    400: { codigo: "89361", descricao: "Tubo PVC DN400 implantado", unit: "m", custo: 524.45 },
  },
  reaterro: {
    compactado: { codigo: "97914", descricao: "Reaterro compactado", unit: "m³", custo: 19.98 },
    berco: { codigo: "97905", descricao: "Berço de areia", unit: "m³", custo: 102.92 },
    envoltoria: { codigo: "97906", descricao: "Envoltória com areia", unit: "m³", custo: 92.34 },
  },
  pavimentacao: {
    subbase: { codigo: "95995", descricao: "Sub-base BGS", unit: "m³", custo: 135.32 },
    base: { codigo: "95996", descricao: "Base brita graduada", unit: "m³", custo: 157.46 },
    cbuq: { codigo: "95998", descricao: "CBUQ 5cm (asfalto)", unit: "m²", custo: 30.78 },
    concreto: { codigo: "96001", descricao: "Pavimento concreto", unit: "m²", custo: 91.80 },
    bloquete: { codigo: "96003", descricao: "Bloquete intertravado", unit: "m²", custo: 59.40 },
  },
  pv: {
    "0-1.5": { codigo: "89709", descricao: "PV concreto até 1,5m", unit: "un", custo: 3078.00 },
    "1.5-2.5": { codigo: "89710", descricao: "PV concreto 1,5-2,5m", unit: "un", custo: 4590.00 },
    "2.5-4": { codigo: "89711", descricao: "PV concreto 2,5-4,0m", unit: "un", custo: 7398.00 },
  },
  botafora: { codigo: "97918", descricao: "Carga, transporte e descarga - bota-fora", unit: "m³", custo: 13.50 },
  // Assentamento de redes
  assentamento: {
    esgoto: {
      150: { codigo: "89356", descricao: "Assent. mec. rede esg. PVC DN150", unit: "m", custo: 135.54 },
      200: { codigo: "89357", descricao: "Assent. mec. rede esg. PVC DN200", unit: "m", custo: 200.12 },
      250: { codigo: "89358", descricao: "Assent. mec. rede esg. PVC DN250", unit: "m", custo: 287.06 },
      300: { codigo: "89359", descricao: "Assent. mec. rede esg. PVC DN300", unit: "m", custo: 383.62 },
      400: { codigo: "89361", descricao: "Assent. mec. rede esg. PVC DN400", unit: "m", custo: 524.45 },
    },
    agua: {
      50: { codigo: "89341", descricao: "Assent. rede água PVC DN50", unit: "m", custo: 42.30 },
      75: { codigo: "89342", descricao: "Assent. rede água PVC DN75", unit: "m", custo: 56.80 },
      100: { codigo: "89343", descricao: "Assent. rede água PVC DN100", unit: "m", custo: 78.50 },
      150: { codigo: "89344", descricao: "Assent. rede água PVC DN150", unit: "m", custo: 112.40 },
      200: { codigo: "89345", descricao: "Assent. rede água PVC DN200", unit: "m", custo: 165.80 },
    },
  },
  // Rebaixamento de lençol
  rebaixamento: { codigo: "93200", descricao: "Rebaixamento lençol freático", unit: "dia", custo: 800.00 },
  // Ligações prediais
  ligacao: {
    agua: { codigo: "89401", descricao: "Ligação domiciliar de água", unit: "un", custo: 650.00 },
    esgoto: { codigo: "89402", descricao: "Ligação domiciliar de esgoto", unit: "un", custo: 980.00 },
  },
} as const;

// ── Helper functions ──

export function getEscavacaoCusto(prof: number): number {
  if (prof <= 1.5) return SINAPI_COSTS.escavacao["0-1.5"].custo;
  if (prof <= 3.0) return SINAPI_COSTS.escavacao["1.5-3"].custo;
  return SINAPI_COSTS.escavacao["3-4.5"].custo;
}

export function getEscoramentoCusto(tipo: string): number {
  const k = tipo as keyof typeof SINAPI_COSTS.escoramento;
  return SINAPI_COSTS.escoramento[k]?.custo ?? 45.80;
}

export function getTuboCusto(dn: number): number {
  const k = dn as keyof typeof SINAPI_COSTS.tubulacao;
  return SINAPI_COSTS.tubulacao[k]?.custo ?? 185.30;
}

export function getPavimentoCusto(tipo: string): number {
  if (tipo === "asfalto") return SINAPI_COSTS.pavimentacao.cbuq.custo;
  if (tipo === "concreto") return SINAPI_COSTS.pavimentacao.concreto.custo;
  if (tipo === "bloquete") return SINAPI_COSTS.pavimentacao.bloquete.custo;
  return 0;
}

export function getPVCusto(prof: number): number {
  if (prof <= 1.5) return SINAPI_COSTS.pv["0-1.5"].custo;
  if (prof <= 2.5) return SINAPI_COSTS.pv["1.5-2.5"].custo;
  return SINAPI_COSTS.pv["2.5-4"].custo;
}

/** Get all SINAPI items as a flat array. */
export function getAllSinapiItems(): SinapiItem[] {
  const items: SinapiItem[] = [];
  const addGroup = (group: Record<string, SinapiItem>) => {
    Object.values(group).forEach(item => items.push(item));
  };
  addGroup(SINAPI_COSTS.escavacao);
  addGroup(SINAPI_COSTS.escoramento);
  addGroup(SINAPI_COSTS.tubulacao as any);
  addGroup(SINAPI_COSTS.reaterro);
  addGroup(SINAPI_COSTS.pavimentacao);
  addGroup(SINAPI_COSTS.pv);
  items.push(SINAPI_COSTS.botafora);
  addGroup(SINAPI_COSTS.assentamento.esgoto as any);
  addGroup(SINAPI_COSTS.assentamento.agua as any);
  items.push(SINAPI_COSTS.rebaixamento);
  addGroup(SINAPI_COSTS.ligacao);
  return items;
}

/** Custom cost base that can override SINAPI prices. */
export interface CustomCostItem {
  codigo: string;
  descricao: string;
  unit: string;
  custo: number;
  fonte: string; // "SINAPI", "Própria", "ORSE", etc.
}

export interface CostDatabase {
  items: CustomCostItem[];
  fonte: string;
  dataRef: string;
}

/** Parse a custom cost spreadsheet (CSV/TXT). Supports flexible column mapping. */
export function parseCustomCostCSV(csvText: string): CostDatabase {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) throw new Error("Planilha de custos deve ter cabeçalho e dados.");

  let delimiter = ",";
  if (lines[0].includes(";")) delimiter = ";";
  else if (lines[0].includes("\t")) delimiter = "\t";

  const headers = lines[0].split(delimiter).map(h => h.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

  const findCol = (names: string[]): number => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const codigoIdx = findCol(["codigo", "item", "cod", "id"]);
  const descIdx = findCol(["descricao", "desc", "servico", "nome"]);
  const unitIdx = findCol(["unidade", "unit", "un", "driver"]);
  const custoIdx = findCol(["custo", "preco", "valor", "preco_unitario"]);
  const fonteIdx = findCol(["fonte", "base", "referencia"]);

  if (custoIdx < 0) throw new Error("Coluna de custo/preço não encontrada. Esperado: custo, preco ou valor.");

  const items: CustomCostItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(delimiter);
    const custo = parseFloat((parts[custoIdx] || "0").replace(",", "."));
    if (isNaN(custo) || custo <= 0) continue;

    items.push({
      codigo: codigoIdx >= 0 ? parts[codigoIdx]?.trim() || `ITEM${i}` : `ITEM${i}`,
      descricao: descIdx >= 0 ? parts[descIdx]?.trim() || "" : "",
      unit: unitIdx >= 0 ? parts[unitIdx]?.trim() || "un" : "un",
      custo,
      fonte: fonteIdx >= 0 ? parts[fonteIdx]?.trim() || "Própria" : "Própria",
    });
  }

  return { items, fonte: "Própria", dataRef: new Date().toISOString().split("T")[0] };
}
