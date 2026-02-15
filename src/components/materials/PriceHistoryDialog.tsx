import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface PriceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PriceHistoryDialog = ({ open, onOpenChange }: PriceHistoryDialogProps) => {
  const { data: priceHistory, isLoading } = useQuery({
    queryKey: ['price-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_history')
        .select(`
          *,
          materials (name, unit)
        `)
        .order('changed_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const getPriceChange = (oldPrice: number, newPrice: number) => {
    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    return {
      value: Math.abs(change).toFixed(2),
      isIncrease: newPrice > oldPrice
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Preços</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        )}

        {!isLoading && priceHistory && priceHistory.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma alteração de preço registrada
          </div>
        )}

        {!isLoading && priceHistory && priceHistory.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Preço Anterior</TableHead>
                  <TableHead className="text-right">Novo Preço</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                  <TableHead>Data da Alteração</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceHistory.map((history: any) => {
                  const change = getPriceChange(history.old_price, history.new_price);
                  return (
                    <TableRow key={history.id}>
                      <TableCell className="font-medium">
                        {history.materials?.name || 'Material não encontrado'}
                      </TableCell>
                      <TableCell>{history.materials?.unit || '-'}</TableCell>
                      <TableCell className="text-right">
                        R$ {history.old_price?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {history.new_price?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={change.isIncrease ? "destructive" : "default"}>
                          {change.isIncrease ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {change.value}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(history.changed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{history.notes || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
