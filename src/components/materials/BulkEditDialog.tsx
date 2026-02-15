import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMaterials: string[];
  onClearSelection: () => void;
}

export const BulkEditDialog = ({ open, onOpenChange, selectedMaterials, onClearSelection }: BulkEditDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editType, setEditType] = useState<'price' | 'stock' | 'minimum'>('price');
  const [value, setValue] = useState("");
  const [operation, setOperation] = useState<'set' | 'increase' | 'decrease'>('set');

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) throw new Error("Valor inválido");

      for (const materialId of selectedMaterials) {
        if (operation === 'set') {
          const updateData: any = {};
          if (editType === 'price') updateData.current_price = numValue;
          if (editType === 'stock') updateData.current_stock = numValue;
          if (editType === 'minimum') updateData.minimum_stock = numValue;

          const { error } = await supabase
            .from('materials')
            .update(updateData)
            .eq('id', materialId);
          
          if (error) throw error;
        } else {
          // For increase/decrease, we need to fetch current value first
          const { data: material, error: fetchError } = await supabase
            .from('materials')
            .select('current_price, current_stock, minimum_stock')
            .eq('id', materialId)
            .single();

          if (fetchError) throw fetchError;

          let currentValue = 0;
          if (editType === 'price') currentValue = material.current_price;
          if (editType === 'stock') currentValue = material.current_stock;
          if (editType === 'minimum') currentValue = material.minimum_stock;

          const newValue = operation === 'increase' 
            ? currentValue + numValue 
            : Math.max(0, currentValue - numValue);

          const updateData: any = {};
          if (editType === 'price') updateData.current_price = newValue;
          if (editType === 'stock') updateData.current_stock = newValue;
          if (editType === 'minimum') updateData.minimum_stock = newValue;

          const { error } = await supabase
            .from('materials')
            .update(updateData)
            .eq('id', materialId);
          
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast({ title: `${selectedMaterials.length} materiais atualizados com sucesso!` });
      onOpenChange(false);
      onClearSelection();
      setValue("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar materiais",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edição em Massa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {selectedMaterials.length} materiais selecionados
          </div>

          <div className="space-y-2">
            <Label>Campo a Editar</Label>
            <Select value={editType} onValueChange={(v: any) => setEditType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Preço Unitário</SelectItem>
                <SelectItem value="stock">Estoque Atual</SelectItem>
                <SelectItem value="minimum">Estoque Mínimo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Operação</Label>
            <Select value={operation} onValueChange={(v: any) => setOperation(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="set">Definir Valor</SelectItem>
                <SelectItem value="increase">Aumentar</SelectItem>
                <SelectItem value="decrease">Diminuir</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              {operation === 'set' ? 'Novo Valor' : 'Valor da Alteração'}
            </Label>
            <Input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={operation === 'set' ? 'Digite o novo valor' : 'Digite o valor a alterar'}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => bulkUpdateMutation.mutate()}
              disabled={!value || bulkUpdateMutation.isPending}
            >
              {bulkUpdateMutation.isPending ? "Atualizando..." : "Aplicar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
