import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddBudgetItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
}

export const AddBudgetItemDialog = ({ open, onOpenChange, budgetId }: AddBudgetItemDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [formData, setFormData] = useState({
    description: "",
    unit: "",
    quantity: "",
    unit_price_material: "",
    unit_price_labor: "",
    bdi_percentage: "25",
    material_id: ""
  });

  const { data: materials } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase.from('materials').select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: existingItems } = useQuery({
    queryKey: ['budget-items', budgetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('item_number')
        .eq('budget_id', budgetId)
        .order('item_number', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data || [];
    }
  });

  const handleMaterialSelect = (materialId: string) => {
    const material = materials?.find(m => m.id === materialId);
    if (material) {
      setSelectedMaterial(materialId);
      setFormData({
        ...formData,
        description: material.name,
        unit: material.unit,
        unit_price_material: material.current_price.toString(),
        material_id: materialId
      });
    }
  };

  const calculateTotals = () => {
    const qty = parseFloat(formData.quantity) || 0;
    const priceMat = parseFloat(formData.unit_price_material) || 0;
    const priceLabor = parseFloat(formData.unit_price_labor) || 0;
    const bdi = parseFloat(formData.bdi_percentage) || 0;

    const subtotalMaterial = qty * priceMat;
    const subtotalLabor = qty * priceLabor;
    const subtotalBdi = (subtotalMaterial + subtotalLabor) * (bdi / 100);
    const total = subtotalMaterial + subtotalLabor + subtotalBdi;

    return { subtotalMaterial, subtotalLabor, subtotalBdi, total };
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const nextItemNumber = (existingItems?.[0]?.item_number || 0) + 1;
      const totals = calculateTotals();

      const { error } = await supabase.from('budget_items').insert({
        budget_id: budgetId,
        item_number: nextItemNumber,
        material_id: selectedMaterial || null,
        description: formData.description,
        unit: formData.unit,
        quantity: parseFloat(formData.quantity),
        unit_price_material: parseFloat(formData.unit_price_material) || 0,
        unit_price_labor: parseFloat(formData.unit_price_labor) || 0,
        bdi_percentage: parseFloat(formData.bdi_percentage) || 0,
        subtotal_material: totals.subtotalMaterial,
        subtotal_labor: totals.subtotalLabor,
        subtotal_bdi: totals.subtotalBdi,
        total: totals.total,
        price_at_creation: parseFloat(formData.unit_price_material) || 0
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-items', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Item adicionado!" });
      onOpenChange(false);
      setFormData({
        description: "",
        unit: "",
        quantity: "",
        unit_price_material: "",
        unit_price_labor: "",
        bdi_percentage: "25",
        material_id: ""
      });
      setSelectedMaterial("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Item ao Orçamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Buscar Material Cadastrado (Opcional)</Label>
            <Select value={selectedMaterial} onValueChange={handleMaterialSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um material" />
              </SelectTrigger>
              <SelectContent>
                {materials?.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.name} - R$ {material.current_price.toFixed(2)}/{material.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Input
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="m, m², kg, un..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Preço Unitário Material (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.unit_price_material}
                onChange={(e) => setFormData({ ...formData, unit_price_material: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Preço Unitário Mão de Obra (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.unit_price_labor}
                onChange={(e) => setFormData({ ...formData, unit_price_labor: e.target.value })}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Percentual BDI (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.bdi_percentage}
                onChange={(e) => setFormData({ ...formData, bdi_percentage: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal Material:</span>
              <span>R$ {totals.subtotalMaterial.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal Mão de Obra:</span>
              <span>R$ {totals.subtotalLabor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal BDI:</span>
              <span>R$ {totals.subtotalBdi.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>TOTAL:</span>
              <span>R$ {totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
