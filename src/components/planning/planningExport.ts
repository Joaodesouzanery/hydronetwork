import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ProjectData, ProjectSummary, formatCurrency, formatNumber, calculateSummary } from './planningUtils';

export function exportToExcel(project: ProjectData): void {
  const summary = calculateSummary(project.trechos, project.pontos);
  const wb = XLSX.utils.book_new();

  // Sheet 1: Orçamento
  const orcData = project.trechos.map(t => ({
    '#': t.index,
    'ID Início': t.id_inicio,
    'ID Fim': t.id_fim,
    'Comprimento (m)': t.comprimento,
    'Declividade (%)': t.declividade_percentual,
    'Tipo de Rede': t.tipo_rede,
    'Diâmetro (mm)': t.diametro_mm,
    'Material': t.material,
    'Custo Unit. (R$)': t.custo_unitario,
    'Custo Total (R$)': t.custo_total,
  }));
  const ws1 = XLSX.utils.json_to_sheet(orcData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Orçamento');

  // Sheet 2: Resumo
  const resumoData = [
    { 'Indicador': 'Total de Trechos', 'Valor': summary.totalTrechos },
    { 'Indicador': 'Comprimento Total (m)', 'Valor': summary.comprimentoTotal },
    { 'Indicador': 'Custo Total (R$)', 'Valor': summary.custoTotal },
    { 'Indicador': 'Custo Médio (R$/m)', 'Valor': summary.custoMedio },
    { 'Indicador': 'Declividade Mínima (%)', 'Valor': summary.declivMin },
    { 'Indicador': 'Declividade Máxima (%)', 'Valor': summary.declivMax },
    { 'Indicador': 'Declividade Média (%)', 'Valor': summary.declivMedia },
    { 'Indicador': 'Desnível Total (m)', 'Valor': summary.desnivelTotal },
  ];
  const ws2 = XLSX.utils.json_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo');

  // Sheet 3: Custos por Tipo
  const tipoData = [
    {
      'Tipo': 'Esgoto por Gravidade',
      'Trechos': summary.gravityCount,
      'Comprimento (m)': summary.gravityLength,
      'Custo (R$)': summary.gravityCost,
    },
    {
      'Tipo': 'Elevatória / Booster',
      'Trechos': summary.pumpCount,
      'Comprimento (m)': summary.pumpLength,
      'Custo (R$)': summary.pumpCost,
    },
  ];
  const ws3 = XLSX.utils.json_to_sheet(tipoData);
  XLSX.utils.book_append_sheet(wb, ws3, 'Custos por Tipo');

  XLSX.writeFile(wb, `${project.config.nome || 'projeto'}_orcamento.xlsx`);
}

export function exportToPDF(project: ProjectData): void {
  const summary = calculateSummary(project.trechos, project.pontos);
  const doc = new jsPDF('l', 'mm', 'a4');

  // Header
  doc.setFontSize(18);
  doc.text('Relatório de Pré-Dimensionamento', 14, 20);
  doc.setFontSize(12);
  doc.text(`Projeto: ${project.config.nome}`, 14, 30);
  doc.text(`Data: ${new Date(project.createdAt).toLocaleDateString('pt-BR')}`, 14, 37);
  if (project.config.responsavel) {
    doc.text(`Responsável: ${project.config.responsavel}`, 14, 44);
  }

  // Summary
  doc.setFontSize(14);
  doc.text('Resumo Executivo', 14, 56);
  doc.setFontSize(10);
  const summaryLines = [
    `Total de Trechos: ${summary.totalTrechos}`,
    `Comprimento Total: ${formatNumber(summary.comprimentoTotal)} m`,
    `Custo Total: ${formatCurrency(summary.custoTotal)}`,
    `Custo Médio: ${formatCurrency(summary.custoMedio)}/m`,
    `Gravidade: ${summary.gravityCount} trechos (${formatNumber(summary.gravityLength)} m)`,
    `Elevatória: ${summary.pumpCount} trechos (${formatNumber(summary.pumpLength)} m)`,
  ];
  summaryLines.forEach((line, i) => doc.text(line, 14, 64 + i * 6));

  // Table
  const tableData = project.trechos.map(t => [
    t.index,
    t.id_inicio,
    t.id_fim,
    formatNumber(t.comprimento),
    `${t.declividade_percentual}%`,
    t.tipo_rede,
    t.diametro_mm,
    t.material,
    formatCurrency(t.custo_unitario),
    formatCurrency(t.custo_total),
  ]);

  (doc as any).autoTable({
    head: [['#', 'ID Início', 'ID Fim', 'Comp. (m)', 'Decliv. (%)', 'Tipo', 'Ø (mm)', 'Material', 'Custo Unit.', 'Custo Total']],
    body: tableData,
    startY: 100,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')} | Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  doc.save(`${project.config.nome || 'projeto'}_relatorio.pdf`);
}
