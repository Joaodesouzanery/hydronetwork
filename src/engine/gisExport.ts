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
  // Measurement
  item_med: string;
  med_qtd: number;
  med_total: number;
  // Cost
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
): string {
  const quantMap = new Map<string, QuantRow>();
  quantRows.forEach((qr, i) => quantMap.set(`T${String(i + 1).padStart(2, "0")}`, qr));

  const medMap = new Map<string, TrechoMedicao>();
  medicoes.forEach(m => medMap.set(m.trecho_id, m));

  const features = trechos.map((t, idx) => {
    const trechoId = `T${String(idx + 1).padStart(2, "0")}`;
    const qr = quantMap.get(trechoId);
    const med = medMap.get(trechoId);
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
        item_med: primaryItem?.item.item_medicao || "",
        med_qtd: primaryItem ? Math.round(primaryItem.quantidade * 100) / 100 : 0,
        med_total: med ? Math.round(med.med_total * 100) / 100 : 0,
        cus_total: med ? Math.round(med.cus_total * 100) / 100 : (qr ? Math.round(qr.custoTotal * 100) / 100 : 0),
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
): string {
  const quantMap = new Map<string, QuantRow>();
  quantRows.forEach((qr, i) => quantMap.set(`T${String(i + 1).padStart(2, "0")}`, qr));
  const medMap = new Map<string, TrechoMedicao>();
  medicoes.forEach(m => medMap.set(m.trecho_id, m));

  const headers = [
    "trecho_id", "inicio", "fim",
    "x_inicio", "y_inicio", "cota_inicio",
    "x_fim", "y_fim", "cota_fim",
    "comprimento", "dn", "prof", "tipo_rede", "material",
    "escavacao_m3", "reaterro_m3", "bota_fora_m3", "pavimento_m2", "escoramento_m2",
    "item_med", "med_qtd", "med_total",
    "cus_total", "margem", "margem_pct",
    "prazo_dias", "data_inicio", "data_fim",
    "pct_executado",
  ];

  const rows = trechos.map((t, idx) => {
    const trechoId = `T${String(idx + 1).padStart(2, "0")}`;
    const qr = quantMap.get(trechoId);
    const med = medMap.get(trechoId);
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
      primaryItem?.item.item_medicao || "", (primaryItem?.quantidade || 0).toFixed(2),
      (med?.med_total || 0).toFixed(2),
      (med?.cus_total || qr?.custoTotal || 0).toFixed(2),
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
  filename = "hydronetwork_gis_export.xlsx",
): void {
  const quantMap = new Map<string, QuantRow>();
  quantRows.forEach((qr, i) => quantMap.set(`T${String(i + 1).padStart(2, "0")}`, qr));
  const medMap = new Map<string, TrechoMedicao>();
  medicoes.forEach(m => medMap.set(m.trecho_id, m));

  const wb = XLSX.utils.book_new();

  const data = trechos.map((t, idx) => {
    const trechoId = `T${String(idx + 1).padStart(2, "0")}`;
    const qr = quantMap.get(trechoId);
    const med = medMap.get(trechoId);
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
      "Escavação (m³)": qr ? Math.round(qr.escavacao * 100) / 100 : 0,
      "Reaterro (m³)": qr ? Math.round(qr.reaterro * 100) / 100 : 0,
      "Bota-fora (m³)": qr ? Math.round(qr.botafora * 100) / 100 : 0,
      "Pavimento (m²)": qr ? Math.round(qr.pavimento * 100) / 100 : 0,
      "Escoramento (m²)": qr ? Math.round(qr.escorArea * 100) / 100 : 0,
      "Item Medição": primaryItem?.item.item_medicao || "",
      "Descrição Medição": primaryItem?.item.descricao || "",
      "Driver": primaryItem?.item.driver || "",
      "Qtd Medição": primaryItem ? Math.round(primaryItem.quantidade * 100) / 100 : 0,
      "Preço Unit. (R$)": primaryItem?.item.preco_unitario || 0,
      "Medição Total (R$)": med ? Math.round(med.med_total * 100) / 100 : 0,
      "Custo Total (R$)": med ? Math.round(med.cus_total * 100) / 100 : (qr ? Math.round(qr.custoTotal * 100) / 100 : 0),
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
  filename = "hydronetwork_trechos.geojson",
): void {
  const content = exportGeoJSON(trechos, quantRows, medicoes);
  downloadBlob(content, filename, "application/geo+json");
}

export function downloadGISCSV(
  trechos: Trecho[],
  quantRows: QuantRow[],
  medicoes: TrechoMedicao[],
  filename = "hydronetwork_trechos.csv",
): void {
  const content = exportGISCSV(trechos, quantRows, medicoes);
  downloadBlob(content, filename, "text/csv;charset=utf-8");
}
