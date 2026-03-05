/**
 * GIS Export Engine for HydroNetwork.
 *
 * Exports network data with full measurement/cost attributes to:
 * - GeoJSON
 * - CSV (with coordinates)
 * - GeoPackage-compatible JSON (for QGIS)
 * - SHP-compatible field names (10-char truncation)
 */

import * as XLSX from "xlsx";
import type { Trecho } from "./domain";
import type { QuantRow } from "../components/hydronetwork/modules/QuantitiesModule";
import type { TrechoMedicao } from "./medicao";

// Cost row from TrechoEditModule
export interface CostRowExport {
  id: string;
  trechoKey: string;
  nomeTrecho: string;
  comp: number;
  dn: number;
  custoEscavacao: number;
  custoTubo: number;
  custoReaterro: number;
  custoBerco?: number;
  custoEnvoltoria?: number;
  custoEscoramento?: number;
  custoBotafora?: number;
  custoPavimentacao?: number;
  custoPV: number;
  bdiPct: number;
  fonte: string;
  subtotal: number;
  total: number;
}

// Cost spreadsheet item
export interface CustoImportItemExport {
  item_custo: string;
  descricao: string;
  unidade: string;
  preco_unitario: number;
  fonte: string;
  enabled: boolean;
}

// ══════════════════════════════════════
// GeoJSON Export
// ══════════════════════════════════════

export interface GISAttributes {
  trecho_id: string;
  inicio: string;
  fim: string;
  comprimento: number;
  dn: number;
  prof: number;
  tipo_rede: string;
  material: string;
  // Quantities
  escav_m3: number;
  reat_m3: number;
  btfr_m3: number;
  pav_m2: number;
  escor_m2: number;
  // Detailed costs (from cost table)
  cst_esc: number;    // R$/m³ escavação
  cst_tubo: number;   // R$/m tubo
  cst_reat: number;   // R$/m³ reaterro
  cst_pv: number;     // R$/un PV
  bdi_pct: number;    // BDI %
  cst_fonte: string;  // SINAPI | Manual
  cst_sub: number;    // subtotal sem BDI
  cst_total: number;  // total com BDI
  // Measurement
  item_med: string;
  med_qtd: number;
  med_total: number;
  // Cost (from medição)
  cus_total: number;
  margem: number;
  // Schedule
  prazo_dias: number;
  data_ini: string;
  data_fim: string;
  // Execution
  pct_exec: number;
}

export function exportGeoJSON(
  trechos: Trecho[],
  quantRows: QuantRow[],
  medicoes: TrechoMedicao[],
  costRows?: CostRowExport[],
): string {
  const quantMap = new Map<string, QuantRow>();
  quantRows.forEach((qr, i) => quantMap.set(`T${String(i + 1).padStart(2, "0")}`, qr));

  const medMap = new Map<string, TrechoMedicao>();
  medicoes.forEach(m => medMap.set(m.trecho_id, m));

  const costMap = new Map<string, CostRowExport>();
  (costRows || []).forEach(c => costMap.set(c.id, c));

  const features = trechos.map((t, idx) => {
    const trechoId = `T${String(idx + 1).padStart(2, "0")}`;
    const qr = quantMap.get(trechoId);
    const med = medMap.get(trechoId);
    const cr = costMap.get(trechoId);
    const primaryItem = med?.itens_medicao?.[0];

    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [t.xInicio, t.yInicio, t.cotaInicio],
          [t.xFim, t.yFim, t.cotaFim],
        ],
      },
      properties: {
        trecho_id: trechoId,
        inicio: t.idInicio,
        fim: t.idFim,
        compriment: Math.round(t.comprimento * 100) / 100,
        dn: t.diametroMm,
        prof: qr ? Math.round(qr.prof * 100) / 100 : 0,
        tipo_rede: t.tipoRede,
        material: t.material,
        escav_m3: qr ? Math.round(qr.escavacao * 100) / 100 : 0,
        reat_m3: qr ? Math.round(qr.reaterro * 100) / 100 : 0,
        btfr_m3: qr ? Math.round(qr.botafora * 100) / 100 : 0,
        pav_m2: qr ? Math.round(qr.pavimento * 100) / 100 : 0,
        escor_m2: qr ? Math.round(qr.escorArea * 100) / 100 : 0,
        // Detailed cost attributes
        cst_esc: cr ? Math.round(cr.custoEscavacao * 100) / 100 : 0,
        cst_tubo: cr ? Math.round(cr.custoTubo * 100) / 100 : 0,
        cst_reat: cr ? Math.round(cr.custoReaterro * 100) / 100 : 0,
        cst_pv: cr ? Math.round(cr.custoPV * 100) / 100 : 0,
        bdi_pct: cr ? cr.bdiPct : 0,
        cst_fonte: cr?.fonte || "",
        cst_sub: cr ? Math.round(cr.subtotal * 100) / 100 : 0,
        cst_total: cr ? Math.round(cr.total * 100) / 100 : 0,
        // Measurement
        item_med: primaryItem?.item.item_medicao || "",
        med_qtd: primaryItem ? Math.round(primaryItem.quantidade * 100) / 100 : 0,
        med_total: med ? Math.round(med.med_total * 100) / 100 : 0,
        cus_total: med ? Math.round(med.cus_total * 100) / 100 : (cr ? Math.round(cr.total * 100) / 100 : (qr ? Math.round(qr.custoTotal * 100) / 100 : 0)),
        margem: med ? Math.round(med.margem * 100) / 100 : 0,
        prazo_dias: med?.prazo_dias || 0,
        data_ini: med?.data_inicio || "",
        data_fim: med?.data_fim || "",
        pct_exec: med ? Math.round(med.pct_executado * 10) / 10 : 0,
      },
    };
  });

  const fc = {
    type: "FeatureCollection",
    name: "HydroNetwork_Trechos",
    crs: {
      type: "name",
      properties: { name: "urn:ogc:def:crs:EPSG::4326" },
    },
    features,
  };

  return JSON.stringify(fc, null, 2);
}

// ══════════════════════════════════════
// CSV Export with coordinates
// ══════════════════════════════════════

export function exportGISCSV(
  trechos: Trecho[],
  quantRows: QuantRow[],
  medicoes: TrechoMedicao[],
  costRows?: CostRowExport[],
): string {
  const quantMap = new Map<string, QuantRow>();
  quantRows.forEach((qr, i) => quantMap.set(`T${String(i + 1).padStart(2, "0")}`, qr));
  const medMap = new Map<string, TrechoMedicao>();
  medicoes.forEach(m => medMap.set(m.trecho_id, m));
  const costMap = new Map<string, CostRowExport>();
  (costRows || []).forEach(c => costMap.set(c.id, c));

  const headers = [
    "trecho_id", "inicio", "fim",
    "x_inicio", "y_inicio", "cota_inicio",
    "x_fim", "y_fim", "cota_fim",
    "comprimento", "dn", "prof", "tipo_rede", "material",
    "escavacao_m3", "reaterro_m3", "bota_fora_m3", "pavimento_m2", "escoramento_m2",
    "custo_escavacao", "custo_tubo", "custo_reaterro", "custo_pv",
    "bdi_pct", "custo_fonte", "custo_subtotal", "custo_total_bdi",
    "item_med", "med_qtd", "med_total",
    "cus_total", "margem", "margem_pct",
    "prazo_dias", "data_inicio", "data_fim",
    "pct_executado",
  ];

  const rows = trechos.map((t, idx) => {
    const trechoId = `T${String(idx + 1).padStart(2, "0")}`;
    const qr = quantMap.get(trechoId);
    const med = medMap.get(trechoId);
    const cr = costMap.get(trechoId);
    const primaryItem = med?.itens_medicao?.[0];

    return [
      trechoId, t.idInicio, t.idFim,
      t.xInicio.toFixed(3), t.yInicio.toFixed(3), t.cotaInicio.toFixed(3),
      t.xFim.toFixed(3), t.yFim.toFixed(3), t.cotaFim.toFixed(3),
      t.comprimento.toFixed(2), t.diametroMm, (qr?.prof || 0).toFixed(2),
      t.tipoRede, t.material,
      (qr?.escavacao || 0).toFixed(2), (qr?.reaterro || 0).toFixed(2),
      (qr?.botafora || 0).toFixed(2), (qr?.pavimento || 0).toFixed(2),
      (qr?.escorArea || 0).toFixed(2),
      (cr?.custoEscavacao || 0).toFixed(2), (cr?.custoTubo || 0).toFixed(2),
      (cr?.custoReaterro || 0).toFixed(2), (cr?.custoPV || 0).toFixed(2),
      (cr?.bdiPct || 0).toFixed(1), cr?.fonte || "",
      (cr?.subtotal || 0).toFixed(2), (cr?.total || 0).toFixed(2),
      primaryItem?.item.item_medicao || "", (primaryItem?.quantidade || 0).toFixed(2),
      (med?.med_total || 0).toFixed(2),
      (med?.cus_total || cr?.total || qr?.custoTotal || 0).toFixed(2),
      (med?.margem || 0).toFixed(2), (med?.margem_pct || 0).toFixed(1),
      med?.prazo_dias || 0, med?.data_inicio || "", med?.data_fim || "",
      (med?.pct_executado || 0).toFixed(1),
    ].join(";");
  });

  return [headers.join(";"), ...rows].join("\n");
}

// ══════════════════════════════════════
// XLSX Export with full attributes
// ══════════════════════════════════════

export function exportGISExcel(
  trechos: Trecho[],
  quantRows: QuantRow[],
  medicoes: TrechoMedicao[],
  costRows?: CostRowExport[],
  filename = "hydronetwork_gis_export.xlsx",
): void {
  const quantMap = new Map<string, QuantRow>();
  quantRows.forEach((qr, i) => quantMap.set(`T${String(i + 1).padStart(2, "0")}`, qr));
  const medMap = new Map<string, TrechoMedicao>();
  medicoes.forEach(m => medMap.set(m.trecho_id, m));
  const costMap = new Map<string, CostRowExport>();
  (costRows || []).forEach(c => costMap.set(c.id, c));

  const wb = XLSX.utils.book_new();

  const data = trechos.map((t, idx) => {
    const trechoId = `T${String(idx + 1).padStart(2, "0")}`;
    const qr = quantMap.get(trechoId);
    const med = medMap.get(trechoId);
    const cr = costMap.get(trechoId);
    const primaryItem = med?.itens_medicao?.[0];

    return {
      "Trecho ID": trechoId,
      "Início": t.idInicio,
      "Fim": t.idFim,
      "X Início": t.xInicio,
      "Y Início": t.yInicio,
      "Cota Início": t.cotaInicio,
      "X Fim": t.xFim,
      "Y Fim": t.yFim,
      "Cota Fim": t.cotaFim,
      "Comprimento (m)": Math.round(t.comprimento * 100) / 100,
      "DN (mm)": t.diametroMm,
      "Profundidade (m)": qr ? Math.round(qr.prof * 100) / 100 : 0,
      "Tipo Rede": t.tipoRede,
      "Material": t.material,
      // Quantities
      "Escavação (m³)": qr ? Math.round(qr.escavacao * 100) / 100 : 0,
      "Reaterro (m³)": qr ? Math.round(qr.reaterro * 100) / 100 : 0,
      "Bota-fora (m³)": qr ? Math.round(qr.botafora * 100) / 100 : 0,
      "Pavimento (m²)": qr ? Math.round(qr.pavimento * 100) / 100 : 0,
      "Escoramento (m²)": qr ? Math.round(qr.escorArea * 100) / 100 : 0,
      // Detailed costs
      "Custo Escavação (R$/m³)": cr ? Math.round(cr.custoEscavacao * 100) / 100 : 0,
      "Custo Tubo (R$/m)": cr ? Math.round(cr.custoTubo * 100) / 100 : 0,
      "Custo Reaterro (R$/m³)": cr ? Math.round(cr.custoReaterro * 100) / 100 : 0,
      "Custo PV (R$/un)": cr ? Math.round(cr.custoPV * 100) / 100 : 0,
      "BDI (%)": cr?.bdiPct || 0,
      "Fonte Custo": cr?.fonte || "",
      "Subtotal s/ BDI (R$)": cr ? Math.round(cr.subtotal * 100) / 100 : 0,
      "Total c/ BDI (R$)": cr ? Math.round(cr.total * 100) / 100 : 0,
      // Measurement
      "Item Medição": primaryItem?.item.item_medicao || "",
      "Descrição Medição": primaryItem?.item.descricao || "",
      "Driver": primaryItem?.item.driver || "",
      "Qtd Medição": primaryItem ? Math.round(primaryItem.quantidade * 100) / 100 : 0,
      "Preço Unit. (R$)": primaryItem?.item.preco_unitario || 0,
      "Medição Total (R$)": med ? Math.round(med.med_total * 100) / 100 : 0,
      "Custo Total (R$)": med ? Math.round(med.cus_total * 100) / 100 : (cr ? Math.round(cr.total * 100) / 100 : (qr ? Math.round(qr.custoTotal * 100) / 100 : 0)),
      "Margem (R$)": med ? Math.round(med.margem * 100) / 100 : 0,
      "Margem (%)": med ? Math.round(med.margem_pct * 10) / 10 : 0,
      "Prazo (dias)": med?.prazo_dias || 0,
      "Data Início": med?.data_inicio || "",
      "Data Fim": med?.data_fim || "",
      "% Executado": med ? Math.round(med.pct_executado * 10) / 10 : 0,
      "Med. Realizada (R$)": med ? Math.round(med.med_realizada * 100) / 100 : 0,
      "Custo Real (R$)": med ? Math.round(med.custo_real * 100) / 100 : 0,
    };
  });

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Atributos GIS");
  XLSX.writeFile(wb, filename);
}

// ══════════════════════════════════════
// Cost spreadsheet export
// ══════════════════════════════════════

export function exportCustoSpreadsheet(
  custoItems: CustoImportItemExport[],
  costRows: CostRowExport[],
  filename = "planilha_custos.xlsx",
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Cost items (planilha de custo importada)
  if (custoItems.length > 0) {
    const itemsData = custoItems.map(item => ({
      "Item": item.item_custo,
      "Descrição": item.descricao,
      "Unidade": item.unidade,
      "Preço Unitário (R$)": Math.round(item.preco_unitario * 100) / 100,
      "Fonte": item.fonte,
      "Ativo": item.enabled ? "Sim" : "Não",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsData), "Itens de Custo");
  }

  // Sheet 2: Cost per trecho
  if (costRows.length > 0) {
    const trechoData = costRows.map(r => ({
      "ID": r.id,
      "Trecho": r.nomeTrecho,
      "Comprimento (m)": Math.round(r.comp * 100) / 100,
      "DN (mm)": r.dn,
      "Escavação (R$/m³)": Math.round(r.custoEscavacao * 100) / 100,
      "Tubo (R$/m)": Math.round(r.custoTubo * 100) / 100,
      "Reaterro (R$/m³)": Math.round(r.custoReaterro * 100) / 100,
      "PV (R$/un)": Math.round(r.custoPV * 100) / 100,
      "BDI (%)": r.bdiPct,
      "Fonte": r.fonte,
      "Subtotal (R$)": Math.round(r.subtotal * 100) / 100,
      "Total c/ BDI (R$)": Math.round(r.total * 100) / 100,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trechoData), "Custos por Trecho");

    // Summary
    const totalSubtotal = costRows.reduce((s, r) => s + r.subtotal, 0);
    const totalFinal = costRows.reduce((s, r) => s + r.total, 0);
    const summaryData = [
      { "Métrica": "Total de Trechos", "Valor": costRows.length },
      { "Métrica": "Subtotal s/ BDI (R$)", "Valor": Math.round(totalSubtotal * 100) / 100 },
      { "Métrica": "Total c/ BDI (R$)", "Valor": Math.round(totalFinal * 100) / 100 },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumo");
  }

  XLSX.writeFile(wb, filename);
}

// ══════════════════════════════════════
// Download helpers
// ══════════════════════════════════════

export function downloadBlob(content: string, filename: string, mimeType = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadGeoJSON(
  trechos: Trecho[],
  quantRows: QuantRow[],
  medicoes: TrechoMedicao[],
  costRows?: CostRowExport[],
  filename = "hydronetwork_trechos.geojson",
): void {
  const content = exportGeoJSON(trechos, quantRows, medicoes, costRows);
  downloadBlob(content, filename, "application/geo+json");
}

export function downloadGISCSV(
  trechos: Trecho[],
  quantRows: QuantRow[],
  medicoes: TrechoMedicao[],
  costRows?: CostRowExport[],
  filename = "hydronetwork_trechos.csv",
): void {
  const content = exportGISCSV(trechos, quantRows, medicoes, costRows);
  downloadBlob(content, filename, "text/csv;charset=utf-8");
}
