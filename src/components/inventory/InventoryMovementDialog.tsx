import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { TrendingUp, TrendingDown, RefreshCw, ArrowRightLeft } from "lucide-react";

interface InventoryItem {
  id: string;
  material_name: string;
  unit: string | null;
  quantity_available: number;
}

interface InventoryMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  onSuccess: () => void;
}

export const InventoryMovementDialog = ({ open, onOpenChange, item, onSuccess }: InventoryMovementDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [movementType, setMovementType] = useState<'entrada' | 'saida' | 'ajuste' | 'transferencia'>('entrada');
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!item || !quantity || parseFloat(quantity) <= 0) {
      toast.error("Preencha a quantidade");
      return;
    }

    const qty = parseFloat(quantity);
    let newQuantity = item.quantity_available;

    if (movementType === 'entrada') {
      newQuantity += qty;
    } else if (movementType === 'saida') {
      if (qty > item.quantity_available) {
        toast.error("Quantidade insuficiente em estoque");
        return;
      }
      newQuantity -= qty;
    } else if (movementType === 'ajuste') {
      newQuantity = qty;
    }

    setIsLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      // Create movement record
      const { error: movementError } = await supabase
        .from("inventory_movements")
        .insert({
          inventory_id: item.id,
          movement_type: movementType,
          quantity: movementType === 'ajuste' ? (qty - item.quantity_available) : qty,
          reason: reason || null,
          created_by_user_id: userData.user.id,
        });

      if (movementError) throw movementError;

      // Update inventory quantity
      const { error: updateError } = await supabase
        .from("inventory")
        .update({ quantity_available: newQuantity })
        .eq("id", item.id);

      if (updateError) throw updateError;

      toast.success("Movimentação registrada com sucesso!");
      onSuccess();
      setQuantity("");
      setReason("");
      setMovementType('entrada');
    } catch (error: any) {
      toast.error("Erro ao registrar movimentação: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getMovementIcon = () => {
    switch (movementType) {
      case 'entrada':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'saida':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'ajuste':
        return <RefreshCw className="w-5 h-5 text-blue-500" />;
      case 'transferencia':
        return <ArrowRightLeft className="w-5 h-5 text-orange-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getMovementIcon()}
            Movimentar Estoque
          </DialogTitle>
          <DialogDescription>
            Material: {item?.material_name}
            <br />
            Quantidade atual: {item?.quantity_available} {item?.unit || ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="movementType">Tipo de Movimentação *</Label>
              <Select value={movementType} onValueChange={(value: any) => setMovementType(value)}>
                <SelectTrigger id="movementType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      Entrada
                    </div>
                  </SelectItem>
                  <SelectItem value="saida">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      Saída
                    </div>
                  </SelectItem>
                  <SelectItem value="ajuste">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-500" />
                      Ajuste
                    </div>
                  </SelectItem>
                  <SelectItem value="transferencia">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-orange-500" />
                      Transferência
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">
                {movementType === 'ajuste' ? 'Nova Quantidade *' : 'Quantidade *'}
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                required
              />
              {movementType === 'ajuste' && quantity && (
                <p className="text-sm text-muted-foreground">
                  Diferença: {(parseFloat(quantity) - (item?.quantity_available || 0)).toFixed(2)} {item?.unit || ''}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo da movimentação"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
