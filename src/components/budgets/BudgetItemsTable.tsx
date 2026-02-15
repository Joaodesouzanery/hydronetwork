import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BudgetItemsTableProps {
  items: any[];
  budgetId: string;
}

export const BudgetItemsTable = ({ items, budgetId }: BudgetItemsTableProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('budget_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-items', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Item removido" });
    }
  });

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg">
        Nenhum item adicionado
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Nº</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Un</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-right">Preço Mat.</TableHead>
            <TableHead className="text-right">Preço M.O.</TableHead>
            <TableHead className="text-right">BDI %</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={item.id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell className="font-medium">{item.description}</TableCell>
              <TableCell>{item.unit}</TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right">R$ {item.unit_price_material.toFixed(2)}</TableCell>
              <TableCell className="text-right">R$ {item.unit_price_labor.toFixed(2)}</TableCell>
              <TableCell className="text-right">{item.bdi_percentage}%</TableCell>
              <TableCell className="text-right font-medium">R$ {item.total.toFixed(2)}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
