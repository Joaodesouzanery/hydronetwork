import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BudgetsTableProps {
  budgets: any[];
  isLoading: boolean;
  onEdit: (budget: any) => void;
}

export const BudgetsTable = ({ budgets, isLoading, onEdit }: BudgetsTableProps) => {
  const { toast } = useToast();

  const handleExportExcel = async (budget: any) => {
    try {
      const { data: items } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budget.id)
        .order('item_number', { ascending: true });

      if (!items || items.length === 0) {
        toast({
          title: "Orçamento vazio",
          description: "Este orçamento não possui itens",
          variant: "destructive"
        });
        return;
      }

      const exportData = items.map((item) => ({
        'Item': item.item_number,
        'Descrição': item.description,
        'Quantidade': item.quantity,
        'Unidade': item.unit,
        'Preço Material': Number(item.unit_price_material || 0).toFixed(2),
        'Preço MDO': Number(item.unit_price_labor || 0).toFixed(2),
        'BDI (%)': Number(item.bdi_percentage || 0).toFixed(2),
        'Subtotal Material': Number(item.subtotal_material || 0).toFixed(2),
        'Subtotal MDO': Number(item.subtotal_labor || 0).toFixed(2),
        'Subtotal BDI': Number(item.subtotal_bdi || 0).toFixed(2),
        'Total': Number(item.total || 0).toFixed(2),
      }));

      // Adiciona totais
      exportData.push({
        'Item': '' as any,
        'Descrição': 'TOTAL GERAL',
        'Quantidade': '' as any,
        'Unidade': '',
        'Preço Material': '',
        'Preço MDO': '',
        'BDI (%)': '',
        'Subtotal Material': Number(budget.total_material || 0).toFixed(2),
        'Subtotal MDO': Number(budget.total_labor || 0).toFixed(2),
        'Subtotal BDI': Number(budget.total_bdi || 0).toFixed(2),
        'Total': Number(budget.total_amount || 0).toFixed(2),
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      ws['!cols'] = [
        { wch: 8 },
        { wch: 50 },
        { wch: 12 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orçamento');
      
      const fileName = `${budget.budget_number || budget.name}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({ title: "Exportado!", description: "Planilha Excel gerada com sucesso" });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleExportPDF = async (budget: any) => {
    try {
      const { data: items } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budget.id)
        .order('item_number', { ascending: true });

      if (!items || items.length === 0) {
        toast({
          title: "Orçamento vazio",
          description: "Este orçamento não possui itens",
          variant: "destructive"
        });
        return;
      }

      const doc = new jsPDF();
      
      // Cabeçalho
      doc.setFontSize(18);
      doc.text('ORÇAMENTO', 14, 22);
      
      doc.setFontSize(12);
      doc.text(`${budget.budget_number || ''} - ${budget.name}`, 14, 32);
      
      doc.setFontSize(10);
      if (budget.client_name) {
        doc.text(`Cliente: ${budget.client_name}`, 14, 40);
      }
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 48);
      doc.text(`Status: ${budget.status}`, 14, 56);

      // Tabela
      const tableData = items.map((item) => [
        item.item_number,
        item.description.substring(0, 35) + (item.description.length > 35 ? '...' : ''),
        item.quantity,
        item.unit,
        `R$ ${Number(item.unit_price_material || 0).toFixed(2)}`,
        `R$ ${Number(item.unit_price_labor || 0).toFixed(2)}`,
        `R$ ${Number(item.total || 0).toFixed(2)}`,
      ]);

      (doc as any).autoTable({
        head: [['Item', 'Descrição', 'Qtd', 'Un', 'Preço MAT', 'Preço MDO', 'Total']],
        body: tableData,
        startY: 65,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 60 },
          2: { cellWidth: 15 },
          3: { cellWidth: 15 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 25 },
        },
      });

      // Total
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`TOTAL GERAL: R$ ${Number(budget.total_amount || 0).toFixed(2)}`, 14, finalY);

      const fileName = `${budget.budget_number || budget.name}_${new Date().getTime()}.pdf`;
      doc.save(fileName);

      toast({ title: "Exportado!", description: "PDF gerado com sucesso" });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (isLoading) return <div className="text-center py-8">Carregando...</div>;
  if (budgets.length === 0) return <div className="text-center py-8 text-muted-foreground">Nenhum orçamento encontrado</div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets.map((budget) => (
            <TableRow key={budget.id}>
              <TableCell>{budget.budget_number}</TableCell>
              <TableCell className="font-medium">{budget.name}</TableCell>
              <TableCell>{budget.client_name || "-"}</TableCell>
              <TableCell className="text-right">R$ {budget.total_amount?.toFixed(2) || "0.00"}</TableCell>
              <TableCell><Badge>{budget.status}</Badge></TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(budget)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExportExcel(budget)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Exportar Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportPDF(budget)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Exportar PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
