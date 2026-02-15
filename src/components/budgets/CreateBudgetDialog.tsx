import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BudgetItemsTable } from "./BudgetItemsTable";
import { AddBudgetItemDialog } from "./AddBudgetItemDialog";
import { SpreadsheetUploadDialog } from "./SpreadsheetUploadDialog";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: any;
}

export const CreateBudgetDialog = ({ open, onOpenChange, budget }: CreateBudgetDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    client_name: "",
    client_contact: "",
    valid_until: "",
    payment_terms: "",
    notes: ""
  });

  const { data: items } = useQuery({
    queryKey: ['budget-items', budget?.id],
    queryFn: async () => {
      if (!budget?.id) return [];
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budget.id)
        .order('item_number');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!budget?.id
  });

  useEffect(() => {
    if (budget) {
      setFormData({
        name: budget.name || "",
        description: budget.description || "",
        client_name: budget.client_name || "",
        client_contact: budget.client_contact || "",
        valid_until: budget.valid_until || "",
        payment_terms: budget.payment_terms || "",
        notes: budget.notes || ""
      });
    }
  }, [budget]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (budget?.id) {
        const { error } = await supabase
          .from('budgets')
          .update(data)
          .eq('id', budget.id);
        if (error) throw error;
        return budget.id;
      } else {
        const { data: newBudget, error } = await supabase.from('budgets').insert({
          ...data,
          created_by_user_id: user.id
        }).select().single();
        if (error) throw error;
        return newBudget.id;
      }
    },
    onSuccess: (budgetId) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      if (!budget?.id) {
        // Se é um novo orçamento, recarrega com o ID para poder importar planilha
        queryClient.setQueryData(['current-budget'], budgetId);
      }
      toast({ title: budget?.id ? "Orçamento atualizado!" : "Orçamento criado! Agora você pode importar a planilha." });
      if (!budget?.id) {
        // Mantém o diálogo aberto para permitir importar planilha
        queryClient.invalidateQueries({ queryKey: ['budgets'] });
      } else {
        onOpenChange(false);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar orçamento",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const exportToExcel = () => {
    if (!budget) return;

    const ws = XLSX.utils.json_to_sheet(items?.map((item: any, index: number) => ({
      'Nº': index + 1,
      'Descrição': item.description,
      'Unidade': item.unit,
      'Quantidade': item.quantity,
      'Preço Material': item.unit_price_material,
      'Preço Mão de Obra': item.unit_price_labor,
      'BDI %': item.bdi_percentage,
      'Total': item.total
    })) || []);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orçamento');
    XLSX.writeFile(wb, `orcamento-${budget.budget_number}.xlsx`);
  };

  const exportToPDF = () => {
    if (!budget) return;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('ORÇAMENTO', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Número: ${budget.budget_number}`, 20, 35);
    doc.text(`Cliente: ${budget.client_name || '-'}`, 20, 42);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 49);

    (doc as any).autoTable({
      startY: 60,
      head: [['Nº', 'Descrição', 'Un', 'Qtd', 'Preço Mat.', 'Preço M.O.', 'BDI %', 'Total']],
      body: items?.map((item: any, index: number) => [
        index + 1,
        item.description,
        item.unit,
        item.quantity,
        `R$ ${item.unit_price_material.toFixed(2)}`,
        `R$ ${item.unit_price_labor.toFixed(2)}`,
        `${item.bdi_percentage}%`,
        `R$ ${item.total.toFixed(2)}`
      ]) || [],
      foot: [[
        '', '', '', '', '', '', 'TOTAL:',
        `R$ ${budget.total_amount?.toFixed(2) || '0.00'}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      footStyles: { fillColor: [52, 73, 94], fontStyle: 'bold' }
    });

    doc.save(`orcamento-${budget.budget_number}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{budget ? "Editar" : "Novo"} Orçamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Orçamento *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contato do Cliente</Label>
              <Input
                value={formData.client_contact}
                onChange={(e) => setFormData({ ...formData, client_contact: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Válido Até</Label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Condições de Pagamento</Label>
            <Textarea
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          {budget && (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Itens do Orçamento</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportToExcel}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToPDF}>
                    <FileDown className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button onClick={() => setIsAddItemOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Item
                  </Button>
                  <Button variant="secondary" onClick={() => setIsUploadOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Importar Planilha
                  </Button>
                </div>
              </div>

              <BudgetItemsTable items={items || []} budgetId={budget.id} />

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Material:</span>
                  <span className="font-medium">R$ {budget.total_material?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Mão de Obra:</span>
                  <span className="font-medium">R$ {budget.total_labor?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total BDI:</span>
                  <span className="font-medium">R$ {budget.total_bdi?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>TOTAL GERAL:</span>
                  <span>R$ {budget.total_amount?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        {budget && (
          <>
            <AddBudgetItemDialog
              open={isAddItemOpen}
              onOpenChange={setIsAddItemOpen}
              budgetId={budget.id}
            />
            <SpreadsheetUploadDialog
              open={isUploadOpen}
              onOpenChange={setIsUploadOpen}
              budgetId={budget.id}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
