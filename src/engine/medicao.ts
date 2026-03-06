/**
 * Measurement (Medição) Engine for HydroNetwork.
 *
 * Handles:
 * 1) Import measurement spreadsheets (CSV/TXT/XLSX)
 * 2) Auto-map measurement items to network trechos
 * 3) Calculate quantities per trecho based on drivers
 * 4) Calculate cost, measurement value, and margin per trecho
 * 5) Generate schedule data per trecho
 * 6) Support RDO (daily work log) per-trecho tracking
 * 7) Export enriched attribute table for GIS
 */

import * as XLSX from "xlsx";
import type { Trecho } from "./domain";
import type { QuantRow } from "../components/hydronetwork/modules/QuantitiesModule";

// ══════════════════════════════════════
// Types
// ══════════════════════════════════════

export interface MedicaoItem {
  item_medicao: string;
  descricao: string;
  tipo_rede: string;         // "ESGOTO", "AGUA", "DRENAGEM"
  dn_min: number;
  dn_max: number;
  driver: string;            // "m", "m2", "m3", "un", "dia"
  regra_quantidade: string;  // column name: "comprimento", "escavacao_m3", "pavimento_m2", etc.
  preco_unitario: number;
}

export interface MedicaoRegra {
  item: MedicaoItem;
  matched: boolean;
  quantidade: number;
  valor_total: number;
}

export interface TrechoMedicao {
  trecho_id: string;
  inicio: string;
  fim: string;
  comprimento: number;
  dn: number;
  prof: number;
  tipo_rede: string;
  material: string;
  // Quantities from network
  escavacao_m3: number;
  reaterro_m3: number;
  bota_fora_m3: number;
  pavimento_m2: number;
  escoramento_m2: number;
  // Measurement items matched
  itens_medicao: MedicaoRegra[];
  // Calculated values
  med_total: number;          // Total measurement value (sum of all items)
  cus_total: number;          // Total cost (from SINAPI/custom base)
  margem: number;             // Margin = med_total - cus_total
  margem_pct: number;         // Margin % = (margem / med_total) × 100
  // Schedule
  prazo_dias: number;
  data_inicio: string;
  data_fim: string;
  // Execution tracking
  qtd_executada: number;      // m executed
  pct_executado: number;      // % complete
  med_realizada: number;      // Measurement value realized
  custo_real: number;         // Actual cost spent
}

export interface RDOTrechoEntry {
  data: string;               // YYYY-MM-DD
  trecho_id: string;
  quantidade_executada: number;
  medicao_realizada: number;
  custo_real: number;
  observacao?: string;
}

export interface MedicaoSummary {
  total_trechos: number;
  extensao_total: number;
  medicao_total: number;
  custo_total: number;
  margem_total: number;
  margem_pct: number;
  prazo_total_dias: number;
  itens_count: number;
  por_tipo_rede: Record<string, { medicao: number; custo: number; extensao: number }>;
}

// ══════════════════════════════════════
// 1) IMPORT MEASUREMENT SPREADSHEET
// ══════════════════════════════════════

export function parseMedicaoCSV(csvText: string): MedicaoItem[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) throw new Error("Planilha de medição deve ter cabeçalho e dados.");

  let delimiter = ",";
  if (lines[0].includes(";")) delimiter = ";";
  else if (lines[0].includes("\t")) delimiter = "\t";

  const rawHeaders = lines[0].split(delimiter).map(h => h.trim());
  const headers = rawHeaders.map(h =>
    h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_")
  );

  const findCol = (names: string[]): number => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const itemIdx = findCol(["item_medicao", "item", "codigo", "cod"]);
  const descIdx = findCol(["descricao", "desc", "servico", "nome"]);
  const tipoIdx = findCol(["tipo_rede", "tipo", "rede", "sistema"]);
  const dnMinIdx = findCol(["dn_min", "diametro_min", "dn_de"]);
  const dnMaxIdx = findCol(["dn_max", "diametro_max", "dn_ate"]);
  const driverIdx = findCol(["driver", "unidade", "un"]);
  const regraIdx = findCol(["regra_quantidade", "regra", "quantidade_campo", "campo"]);
  const precoIdx = findCol(["preco_unitario", "preco", "valor", "custo"]);

  if (precoIdx < 0) throw new Error("Coluna de preço não encontrada (preco_unitario, preco, valor ou custo).");

  const items: MedicaoItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(delimiter).map(p => p.trim());

    const preco = parseFloat((parts[precoIdx] || "0").replace(",", "."));
    if (isNaN(preco) || preco <= 0) continue;

    items.push({
      item_medicao: itemIdx >= 0 ? parts[itemIdx] || `ITEM${i}` : `ITEM${i}`,
      descricao: descIdx >= 0 ? parts[descIdx] || "" : "",
      tipo_rede: tipoIdx >= 0 ? (parts[tipoIdx] || "ESGOTO").toUpperCase() : "ESGOTO",
      dn_min: dnMinIdx >= 0 ? parseFloat(parts[dnMinIdx]) || 0 : 0,
      dn_max: dnMaxIdx >= 0 ? parseFloat(parts[dnMaxIdx]) || 9999 : 9999,
      driver: driverIdx >= 0 ? parts[driverIdx] || "m" : "m",
      regra_quantidade: regraIdx >= 0 ? parts[regraIdx] || "comprimento" : "comprimento",
      preco_unitario: preco,
    });
  }

  return items;
}

export function parseMedicaoXLSX(buffer: ArrayBuffer): MedicaoItem[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (data.length === 0) throw new Error("Planilha de medição vazia.");

  const rawHeaders = Object.keys(data[0]);
  const normalizeHeader = (h: string) =>
    h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");

  const colMap: Record<string, string> = {};
  rawHeaders.forEach(raw => {
    colMap[normalizeHeader(raw)] = raw;
  });

  const findCol = (names: string[]): string | null => {
    for (const n of names) {
      const found = Object.keys(colMap).find(k => k.includes(n));
      if (found) return colMap[found];
    }
    return null;
  };

  const itemCol = findCol(["item_medicao", "item", "codigo"]);
  const descCol = findCol(["descricao", "desc", "servico"]);
  const tipoCol = findCol(["tipo_rede", "tipo", "rede"]);
  const dnMinCol = findCol(["dn_min", "diametro_min"]);
  const dnMaxCol = findCol(["dn_max", "diametro_max"]);
  const driverCol = findCol(["driver", "unidade"]);
  const regraCol = findCol(["regra_quantidade", "regra", "campo"]);
  const precoCol = findCol(["preco_unitario", "preco", "valor", "custo"]);

  if (!precoCol) throw new Error("Coluna de preço não encontrada.");

  return data.map((row, i) => ({
    item_medicao: itemCol ? String(row[itemCol] || `ITEM${i + 1}`) : `ITEM${i + 1}`,
    descricao: descCol ? String(row[descCol] || "") : "",
    tipo_rede: tipoCol ? String(row[tipoCol] || "ESGOTO").toUpperCase() : "ESGOTO",
    dn_min: dnMinCol ? Number(row[dnMinCol]) || 0 : 0,
    dn_max: dnMaxCol ? Number(row[dnMaxCol]) || 9999 : 9999,
    driver: driverCol ? String(row[driverCol] || "m") : "m",
    regra_quantidade: regraCol ? String(row[regraCol] || "comprimento") : "comprimento",
    preco_unitario: Number(row[precoCol]) || 0,
  })).filter(item => item.preco_unitario > 0);
}

export function parseMedicaoFile(file: File): Promise<MedicaoItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "txt") {
      reader.onload = (e) => {
        try { resolve(parseMedicaoCSV(e.target?.result as string)); }
        catch (err) { reject(err); }
      };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      reader.onload = (e) => {
        try { resolve(parseMedicaoXLSX(e.target?.result as ArrayBuffer)); }
        catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error(`Formato não suportado: .${ext}. Use CSV, TXT, XLS ou XLSX.`));
    }
  });
}

// ══════════════════════════════════════
// 2) AUTO-MAP MEASUREMENT ITEMS TO TRECHOS
// ══════════════════════════════════════

function getTipoRedeNormalized(trecho: Trecho): string {
  const tipo = (trecho.tipoRedeManual || trecho.tipoRede || "").toLowerCase();
  if (tipo.includes("esgoto") || tipo.includes("sewer") || tipo.includes("gravidade")) return "ESGOTO";
  if (tipo.includes("agua") || tipo.includes("water")) return "AGUA";
  if (tipo.includes("drenagem") || tipo.includes("drain")) return "DRENAGEM";
  return "ESGOTO"; // default
}

function matchesMedicaoItem(item: MedicaoItem, tipoRede: string, dn: number): boolean {
  // Type match
  if (item.tipo_rede && item.tipo_rede !== tipoRede) return false;
  // DN range match
  if (dn < item.dn_min || dn > item.dn_max) return false;
  return true;
}

function getQuantidadeFromDriver(
  regra: string,
  trecho: Trecho,
  quantRow?: QuantRow
): number {
  const r = regra.toLowerCase();
  // Direct trecho attributes
  if (r === "comprimento" || r === "m" || r === "length") return trecho.comprimento;
  // Quantity fields from QuantRow
  if (quantRow) {
    if (r === "escavacao_m3" || r === "escavacao") return quantRow.escavacao;
    if (r === "reaterro_m3" || r === "reaterro") return quantRow.reaterro;
    if (r === "bota_fora_m3" || r === "botafora" || r === "bota_fora") return quantRow.botafora;
    if (r === "pavimento_m2" || r === "pavimento") return quantRow.pavimento;
    if (r === "escoramento_m2" || r === "escoramento") return quantRow.escorArea;
    if (r === "berco" || r === "berco_vol") return quantRow.bercoVol;
    if (r === "envoltoria" || r === "envoltoria_vol") return quantRow.envoltoriaVol;
  }
  // Special drivers
  if (r === "numero_pvs" || r === "un_pv" || r === "pv") return 1; // 1 PV per trecho start
  if (r === "rebaixamento_dias" || r === "dias_rebaixamento" || r === "dias") return 1; // placeholder
  if (r === "ligacao" || r === "ligacoes") return 1; // placeholder
  return trecho.comprimento; // fallback to length
}

// ══════════════════════════════════════
// 3) CALCULATE MEASUREMENT PER TRECHO
// ══════════════════════════════════════

export function calcularMedicaoPorTrecho(
  trechos: Trecho[],
  quantRows: QuantRow[],
  medicaoItems: MedicaoItem[],
  produtividadeDia: number = 12,
  numEquipes: number = 1,
  dataInicio: string = new Date().toISOString().split("T")[0],
): TrechoMedicao[] {
  // Index quantRows by trecho name for quick lookup
  const quantMap = new Map<string, QuantRow>();
  quantRows.forEach(qr => {
    quantMap.set(qr.id, qr);
    quantMap.set(qr.trecho, qr);
  });

  let diaAcumulado = 0;

  return trechos.map((trecho, idx) => {
    const trechoId = `T${String(idx + 1).padStart(2, "0")}`;
    const trechoNome = trecho.nomeTrecho || `${trecho.idInicio}→${trecho.idFim}`;
    const tipoRede = getTipoRedeNormalized(trecho);
    const dn = trecho.diametroMm;
    const quantRow = quantMap.get(trechoId) || quantMap.get(trechoNome);

    // Match measurement items to this trecho
    const itens: MedicaoRegra[] = medicaoItems
      .filter(item => matchesMedicaoItem(item, tipoRede, dn))
      .map(item => {
        const quantidade = getQuantidadeFromDriver(item.regra_quantidade, trecho, quantRow);
        return {
          item,
          matched: true,
          quantidade,
          valor_total: quantidade * item.preco_unitario,
        };
      });

    const medTotal = itens.reduce((s, i) => s + i.valor_total, 0);
    const cusTotal = quantRow?.custoTotal || 0;
    const margem = medTotal - cusTotal;
    const margemPct = medTotal > 0 ? (margem / medTotal) * 100 : 0;

    // Schedule calculation
    const diasExecucao = Math.max(1, Math.ceil(trecho.comprimento / (produtividadeDia * numEquipes)));
    const inicio = new Date(dataInicio);
    inicio.setDate(inicio.getDate() + diaAcumulado);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + diasExecucao - 1);
    diaAcumulado += diasExecucao;

    return {
      trecho_id: trechoId,
      inicio: trecho.idInicio,
      fim: trecho.idFim,
      comprimento: trecho.comprimento,
      dn,
      prof: quantRow?.prof || 1.5,
      tipo_rede: tipoRede,
      material: trecho.material,
      escavacao_m3: quantRow?.escavacao || 0,
      reaterro_m3: quantRow?.reaterro || 0,
      bota_fora_m3: quantRow?.botafora || 0,
      pavimento_m2: quantRow?.pavimento || 0,
      escoramento_m2: quantRow?.escorArea || 0,
      itens_medicao: itens,
      med_total: medTotal,
      cus_total: cusTotal,
      margem,
      margem_pct: margemPct,
      prazo_dias: diasExecucao,
      data_inicio: inicio.toISOString().split("T")[0],
      data_fim: fim.toISOString().split("T")[0],
      qtd_executada: 0,
      pct_executado: 0,
      med_realizada: 0,
      custo_real: 0,
    };
  });
}

// ══════════════════════════════════════
// 4) SUMMARY
// ══════════════════════════════════════

export function calcularResumoMedicao(medicoes: TrechoMedicao[]): MedicaoSummary {
  const porTipoRede: Record<string, { medicao: number; custo: number; extensao: number }> = {};

  let medTotal = 0, cusTotal = 0, extTotal = 0;

  for (const m of medicoes) {
    medTotal += m.med_total;
    cusTotal += m.cus_total;
    extTotal += m.comprimento;

    if (!porTipoRede[m.tipo_rede]) {
      porTipoRede[m.tipo_rede] = { medicao: 0, custo: 0, extensao: 0 };
    }
    porTipoRede[m.tipo_rede].medicao += m.med_total;
    porTipoRede[m.tipo_rede].custo += m.cus_total;
    porTipoRede[m.tipo_rede].extensao += m.comprimento;
  }

  const margem = medTotal - cusTotal;
  const prazoMax = medicoes.length > 0
    ? Math.max(...medicoes.map(m => {
        const fim = new Date(m.data_fim);
        const ini = new Date(medicoes[0].data_inicio);
        return Math.ceil((fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }))
    : 0;

  const allItems = new Set<string>();
  medicoes.forEach(m => (m.itens_medicao || []).forEach(i => allItems.add(i.item.item_medicao)));

  return {
    total_trechos: medicoes.length,
    extensao_total: extTotal,
    medicao_total: medTotal,
    custo_total: cusTotal,
    margem_total: margem,
    margem_pct: medTotal > 0 ? (margem / medTotal) * 100 : 0,
    prazo_total_dias: prazoMax,
    itens_count: allItems.size,
    por_tipo_rede: porTipoRede,
  };
}

// ══════════════════════════════════════
// 5) RDO PER-TRECHO TRACKING
// ══════════════════════════════════════

export function aplicarRDOTrecho(
  medicoes: TrechoMedicao[],
  rdoEntries: RDOTrechoEntry[]
): TrechoMedicao[] {
  const entryMap = new Map<string, RDOTrechoEntry[]>();
  rdoEntries.forEach(e => {
    const list = entryMap.get(e.trecho_id) || [];
    list.push(e);
    entryMap.set(e.trecho_id, list);
  });

  return medicoes.map(m => {
    const entries = entryMap.get(m.trecho_id) || [];
    const qtdExecutada = entries.reduce((s, e) => s + e.quantidade_executada, 0);
    const medRealizada = entries.reduce((s, e) => s + e.medicao_realizada, 0);
    const custoReal = entries.reduce((s, e) => s + e.custo_real, 0);

    return {
      ...m,
      qtd_executada: qtdExecutada,
      pct_executado: m.comprimento > 0 ? (qtdExecutada / m.comprimento) * 100 : 0,
      med_realizada: medRealizada,
      custo_real: custoReal,
    };
  });
}

// ══════════════════════════════════════
// 6) RECALCULATE (after price/rule change)
// ══════════════════════════════════════

export function recalcularMedicao(
  medicoes: TrechoMedicao[],
  trechos: Trecho[],
  quantRows: QuantRow[],
  medicaoItems: MedicaoItem[],
  produtividadeDia: number,
  numEquipes: number,
  dataInicio: string,
): TrechoMedicao[] {
  // Preserve execution data
  const execMap = new Map<string, { qtd: number; med: number; cus: number }>();
  medicoes.forEach(m => {
    execMap.set(m.trecho_id, {
      qtd: m.qtd_executada,
      med: m.med_realizada,
      cus: m.custo_real,
    });
  });

  const recalculated = calcularMedicaoPorTrecho(
    trechos, quantRows, medicaoItems, produtividadeDia, numEquipes, dataInicio
  );

  // Restore execution data
  return recalculated.map(m => {
    const exec = execMap.get(m.trecho_id);
    if (exec) {
      return {
        ...m,
        qtd_executada: exec.qtd,
        pct_executado: m.comprimento > 0 ? (exec.qtd / m.comprimento) * 100 : 0,
        med_realizada: exec.med,
        custo_real: exec.cus,
      };
    }
    return m;
  });
}

// ══════════════════════════════════════
// 7) EXPORT FUNCTIONS
// ══════════════════════════════════════

export function exportMedicaoExcel(medicoes: TrechoMedicao[], filename = "medicao_trechos.xlsx"): void {
  const wb = XLSX.utils.book_new();

  // Main sheet - per trecho
  const mainData = medicoes.map(m => ({
    "Trecho": m.trecho_id,
    "Início": m.inicio,
    "Fim": m.fim,
    "Comprimento (m)": Math.round(m.comprimento * 100) / 100,
    "DN (mm)": m.dn,
    "Prof (m)": Math.round(m.prof * 100) / 100,
    "Tipo Rede": m.tipo_rede,
    "Material": m.material,
    "Escavação (m³)": Math.round(m.escavacao_m3 * 100) / 100,
    "Reaterro (m³)": Math.round(m.reaterro_m3 * 100) / 100,
    "Bota-fora (m³)": Math.round(m.bota_fora_m3 * 100) / 100,
    "Pavimento (m²)": Math.round(m.pavimento_m2 * 100) / 100,
    "Medição Total (R$)": Math.round(m.med_total * 100) / 100,
    "Custo Total (R$)": Math.round(m.cus_total * 100) / 100,
    "Margem (R$)": Math.round(m.margem * 100) / 100,
    "Margem (%)": Math.round(m.margem_pct * 10) / 10,
    "Prazo (dias)": m.prazo_dias,
    "Data Início": m.data_inicio,
    "Data Fim": m.data_fim,
    "Executado (m)": Math.round(m.qtd_executada * 100) / 100,
    "% Executado": Math.round(m.pct_executado * 10) / 10,
    "Medição Realiz. (R$)": Math.round(m.med_realizada * 100) / 100,
    "Custo Real (R$)": Math.round(m.custo_real * 100) / 100,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mainData), "Medição por Trecho");

  // Detail sheet - items per trecho
  const detailData: Record<string, unknown>[] = [];
  medicoes.forEach(m => {
    m.itens_medicao.forEach(i => {
      detailData.push({
        "Trecho": m.trecho_id,
        "Item": i.item.item_medicao,
        "Descrição": i.item.descricao,
        "Driver": i.item.driver,
        "Quantidade": Math.round(i.quantidade * 100) / 100,
        "Preço Unit. (R$)": i.item.preco_unitario,
        "Valor Total (R$)": Math.round(i.valor_total * 100) / 100,
      });
    });
  });
  if (detailData.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailData), "Itens Detalhados");
  }

  // Summary sheet
  const summary = calcularResumoMedicao(medicoes);
  const summaryData = [
    { "Métrica": "Total de Trechos", "Valor": summary.total_trechos },
    { "Métrica": "Extensão Total (m)", "Valor": Math.round(summary.extensao_total * 100) / 100 },
    { "Métrica": "Medição Total (R$)", "Valor": Math.round(summary.medicao_total * 100) / 100 },
    { "Métrica": "Custo Total (R$)", "Valor": Math.round(summary.custo_total * 100) / 100 },
    { "Métrica": "Margem Total (R$)", "Valor": Math.round(summary.margem_total * 100) / 100 },
    { "Métrica": "Margem (%)", "Valor": Math.round(summary.margem_pct * 10) / 10 },
    { "Métrica": "Prazo Total (dias)", "Valor": summary.prazo_total_dias },
    { "Métrica": "Itens de Medição", "Valor": summary.itens_count },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumo");

  XLSX.writeFile(wb, filename);
}

export function exportMedicaoCSV(medicoes: TrechoMedicao[]): string {
  const headers = [
    "trecho_id", "inicio", "fim", "comprimento", "dn", "prof", "tipo_rede", "material",
    "escavacao_m3", "reaterro_m3", "bota_fora_m3", "pavimento_m2",
    "med_total", "cus_total", "margem", "margem_pct",
    "prazo_dias", "data_inicio", "data_fim",
    "qtd_executada", "pct_executado", "med_realizada", "custo_real",
  ];

  const rows = medicoes.map(m => [
    m.trecho_id, m.inicio, m.fim,
    m.comprimento.toFixed(2), m.dn, m.prof.toFixed(2),
    m.tipo_rede, m.material,
    m.escavacao_m3.toFixed(2), m.reaterro_m3.toFixed(2),
    m.bota_fora_m3.toFixed(2), m.pavimento_m2.toFixed(2),
    m.med_total.toFixed(2), m.cus_total.toFixed(2),
    m.margem.toFixed(2), m.margem_pct.toFixed(1),
    m.prazo_dias, m.data_inicio, m.data_fim,
    m.qtd_executada.toFixed(2), m.pct_executado.toFixed(1),
    m.med_realizada.toFixed(2), m.custo_real.toFixed(2),
  ].join(";"));

  return [headers.join(";"), ...rows].join("\n");
}

// ══════════════════════════════════════
// 8) GIS EXPORT HELPERS
// ══════════════════════════════════════

/** Generate GeoJSON FeatureCollection with measurement attributes. */
export function medicaoToGeoJSON(
  medicoes: TrechoMedicao[],
  trechos: Trecho[],
): GeoJSON.FeatureCollection {
  const features = medicoes.map((m, idx) => {
    const trecho = trechos[idx];
    if (!trecho) return null;

    // Primary measurement item
    const primaryItem = m.itens_medicao[0];

    return {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [trecho.xInicio, trecho.yInicio],
          [trecho.xFim, trecho.yFim],
        ],
      },
      properties: {
        trecho_id: m.trecho_id,
        inicio: m.inicio,
        fim: m.fim,
        compriment: m.comprimento,  // SHP 10-char limit
        dn: m.dn,
        prof: m.prof,
        tipo_rede: m.tipo_rede,
        material: m.material,
        escav_m3: m.escavacao_m3,
        reat_m3: m.reaterro_m3,
        btfr_m3: m.bota_fora_m3,
        pav_m2: m.pavimento_m2,
        escor_m2: m.escoramento_m2,
        item_med: primaryItem?.item.item_medicao || "",
        med_desc: primaryItem?.item.descricao || "",
        med_un: primaryItem?.item.driver || "",
        med_qtd: primaryItem?.quantidade || 0,
        med_preco: primaryItem?.item.preco_unitario || 0,
        med_total: m.med_total,
        cus_total: m.cus_total,
        margem: m.margem,
        margem_pct: m.margem_pct,
        prazo_dias: m.prazo_dias,
        data_ini: m.data_inicio,
        data_fim: m.data_fim,
        qtd_exec: m.qtd_executada,
        pct_exec: m.pct_executado,
        med_real: m.med_realizada,
        cus_real: m.custo_real,
      },
    };
  }).filter(Boolean);

  return {
    type: "FeatureCollection",
    features: features as GeoJSON.Feature[],
  };
}

/** Truncate property names for SHP compatibility (10 char limit). */
export function truncateFieldNames(
  properties: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const usedNames = new Set<string>();

  for (const [key, value] of Object.entries(properties)) {
    let shortName = key.substring(0, 10);
    // Ensure unique
    let counter = 1;
    while (usedNames.has(shortName)) {
      const suffix = String(counter);
      shortName = key.substring(0, 10 - suffix.length) + suffix;
      counter++;
    }
    usedNames.add(shortName);
    result[shortName] = value;
  }

  return result;
}

// ══════════════════════════════════════
// 9) STORAGE
// ══════════════════════════════════════

const MEDICAO_ITEMS_KEY = "hydronetwork_medicao_items";
const MEDICAO_TRECHOS_KEY = "hydronetwork_medicao_trechos";
const RDO_TRECHO_KEY = "hydronetwork_rdo_trechos";

export function saveMedicaoItems(items: MedicaoItem[]): void {
  localStorage.setItem(MEDICAO_ITEMS_KEY, JSON.stringify(items));
}

export function loadMedicaoItems(): MedicaoItem[] {
  try {
    const data = localStorage.getItem(MEDICAO_ITEMS_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveMedicaoTrechos(medicoes: TrechoMedicao[]): void {
  localStorage.setItem(MEDICAO_TRECHOS_KEY, JSON.stringify(medicoes));
}

export function loadMedicaoTrechos(): TrechoMedicao[] {
  try {
    const data = localStorage.getItem(MEDICAO_TRECHOS_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveRDOTrechoEntries(entries: RDOTrechoEntry[]): void {
  localStorage.setItem(RDO_TRECHO_KEY, JSON.stringify(entries));
}

export function loadRDOTrechoEntries(): RDOTrechoEntry[] {
  const data = localStorage.getItem(RDO_TRECHO_KEY);
  return data ? JSON.parse(data) : [];
}
