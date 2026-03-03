import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LpsConstraint, WeeklyReport } from '@/types/lean-constraints';
import { CONSTRAINT_TYPES, STATUS_LABELS, IMPACT_LABELS, type ConstraintType } from '@/types/lean-constraints';
import { exportConstraintsToCSV } from '@/engine/lean-constraints';

interface ExportLeanDataProps {
  constraints: LpsConstraint[];
  weeklyReport?: WeeklyReport | null;
  projectName?: string;
}

export function ExportLeanData({ constraints, weeklyReport, projectName = 'Projeto' }: ExportLeanDataProps) {
  const [exporting, setExporting] = useState(false);

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    try {
      setExporting(true);
      const csv = exportConstraintsToCSV(constraints);
      const date = new Date().toISOString().split('T')[0];
      downloadFile(csv, `restricoes-lean-${projectName.replace(/\s+/g, '-')}-${date}.csv`, 'text/csv');
      toast.success('CSV exportado com sucesso!');
    } catch {
      toast.error('Erro ao exportar CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const date = new Date().toLocaleDateString('pt-BR');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header bar
      doc.setFillColor(79, 70, 229); // indigo-600
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Restrições Lean', 14, 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${projectName} | Gerado em: ${date}`, 14, 28);

      doc.setTextColor(0, 0, 0);
      let y = 45;

      // Weekly summary
      if (weeklyReport) {
        doc.setFillColor(245, 245, 245);
        doc.rect(10, y - 5, pageWidth - 20, 45, 'F');

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo da Semana', 14, y + 3);
        y += 10;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const col1x = 14;
        const col2x = pageWidth / 2 + 5;

        doc.text(`Periodo: ${weeklyReport.weekStart} a ${weeklyReport.weekEnd}`, col1x, y);
        doc.text(`PPC: ${weeklyReport.ppc}%  |  PPC Ajustado: ${weeklyReport.ppcAdjusted}%`, col2x, y);
        y += 6;
        doc.text(`Restricoes Ativas: ${weeklyReport.totalAtivas}`, col1x, y);
        doc.text(`Criticas: ${weeklyReport.totalCriticas}`, col2x, y);
        y += 6;
        doc.text(`Novas na Semana: ${weeklyReport.novasSemana}`, col1x, y);
        doc.text(`Resolvidas na Semana: ${weeklyReport.resolvidasSemana}`, col2x, y);
        y += 6;
        doc.text(`Vencidas: ${weeklyReport.vencidas}`, col1x, y);

        if (weeklyReport.topConstraintTypes.length > 0) {
          const topTypes = weeklyReport.topConstraintTypes
            .slice(0, 3)
            .map(t => `${CONSTRAINT_TYPES[t.tipo as ConstraintType] || t.tipo} (${t.count})`)
            .join(', ');
          doc.text(`Top tipos: ${topTypes}`, col2x, y);
        }

        y += 15;
      }

      // Table header
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`Restricoes (${constraints.length})`, 14, y);
      y += 8;

      // Table column headers
      const cols = [14, 38, 73, 125, 155, 180];
      const headers = ['Data', 'Tipo', 'Descricao', 'Status', 'Impacto', 'Prazo'];

      doc.setFillColor(79, 70, 229);
      doc.rect(10, y - 4, pageWidth - 20, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      headers.forEach((h, i) => doc.text(h, cols[i], y));
      doc.setTextColor(0, 0, 0);
      y += 7;

      // Table rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      for (let i = 0; i < constraints.length; i++) {
        if (y > 275) {
          doc.addPage();
          y = 20;

          // Repeat header on new page
          doc.setFillColor(79, 70, 229);
          doc.rect(10, y - 4, pageWidth - 20, 7, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          headers.forEach((h, idx) => doc.text(h, cols[idx], y));
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          y += 7;
        }

        const c = constraints[i];

        // Alternating row colors
        if (i % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(10, y - 3.5, pageWidth - 20, 5.5, 'F');
        }

        doc.text(c.data_identificacao || '', cols[0], y);
        doc.text((CONSTRAINT_TYPES[c.tipo_restricao] || '').substring(0, 18), cols[1], y);
        doc.text((c.descricao || '').substring(0, 28), cols[2], y);
        doc.text(STATUS_LABELS[c.status] || c.status, cols[3], y);
        doc.text(IMPACT_LABELS[c.impacto] || c.impacto, cols[4], y);
        doc.text(c.data_prevista_resolucao || '—', cols[5], y);
        y += 5.5;
      }

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Pagina ${p} de ${totalPages} — Gerado automaticamente pelo sistema HydroNetwork`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }

      doc.save(`restricoes-lean-${projectName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch {
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting || constraints.length === 0}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar CSV (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
