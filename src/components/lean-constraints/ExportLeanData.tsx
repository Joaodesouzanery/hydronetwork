import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { LpsConstraint, WeeklyReport } from '@/types/lean-constraints';
import { CONSTRAINT_TYPES } from '@/types/lean-constraints';
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
      downloadFile(csv, `restricoes-lean-${date}.csv`, 'text/csv');
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

      doc.setFontSize(18);
      doc.text('Relatório de Restrições Lean', 14, 22);
      doc.setFontSize(10);
      doc.text(`Projeto: ${projectName} | Gerado em: ${date}`, 14, 30);

      if (weeklyReport) {
        doc.setFontSize(12);
        doc.text('Resumo Semanal', 14, 42);
        doc.setFontSize(9);
        const summaryLines = [
          `Período: ${weeklyReport.weekStart} a ${weeklyReport.weekEnd}`,
          `Restrições Ativas: ${weeklyReport.totalAtivas} | Críticas: ${weeklyReport.totalCriticas}`,
          `Novas na Semana: ${weeklyReport.novasSemana} | Resolvidas: ${weeklyReport.resolvidasSemana}`,
          `Vencidas: ${weeklyReport.vencidas}`,
          `PPC: ${weeklyReport.ppc}% | PPC Ajustado: ${weeklyReport.ppcAdjusted}%`,
        ];
        summaryLines.forEach((line, i) => doc.text(line, 14, 50 + i * 6));
      }

      let y = weeklyReport ? 85 : 42;
      doc.setFontSize(12);
      doc.text('Restrições', 14, y);
      y += 8;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Data', 14, y);
      doc.text('Tipo', 40, y);
      doc.text('Descrição', 85, y);
      doc.text('Status', 155, y);
      doc.text('Impacto', 178, y);
      doc.setFont('helvetica', 'normal');
      y += 6;

      for (const c of constraints) {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(c.data_identificacao || '', 14, y);
        doc.text((CONSTRAINT_TYPES[c.tipo_restricao] || '').substring(0, 20), 40, y);
        doc.text((c.descricao || '').substring(0, 35), 85, y);
        doc.text(c.status, 155, y);
        doc.text(c.impacto, 178, y);
        y += 5;
      }

      doc.save(`restricoes-lean-${new Date().toISOString().split('T')[0]}.pdf`);
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
          <Download className="h-4 w-4 mr-1" />
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
