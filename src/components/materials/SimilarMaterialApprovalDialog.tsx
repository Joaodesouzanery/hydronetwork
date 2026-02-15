import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, SkipForward, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SimilarMaterial {
  material: {
    id: string;
    name: string;
    brand?: string;
    category?: string;
    material_price?: number;
    labor_price?: number;
    unit?: string;
    measurement?: string;
    description?: string;
    color?: string;
    supplier?: string;
  };
  similarity: number;
  matchType: string;
}

interface PendingApproval {
  index: number;
  description: string;
  unit?: string;
  quantity?: number;
  match: SimilarMaterial;
}

interface SimilarMaterialApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: PendingApproval | null;
  onApprove: () => void;
  onReject: () => void;
  onSkip: () => void;
  onNewMaterialCreated?: (material: any) => void;
  totalPending: number;
  currentIndex: number;
}

export function SimilarMaterialApprovalDialog({
  open,
  onOpenChange,
  pending,
  onApprove,
  onReject,
  onSkip,
  onNewMaterialCreated,
  totalPending,
  currentIndex,
}: SimilarMaterialApprovalDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNewMaterialForm, setShowNewMaterialForm] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    unit: "UN",
    material_price: "",
    labor_price: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const materialPrice = parseFloat(newMaterial.material_price) || 0;
      const laborPrice = parseFloat(newMaterial.labor_price) || 0;

      const { data, error } = await supabase.from('materials').insert({
        name: newMaterial.name,
        unit: newMaterial.unit,
        material_price: materialPrice,
        labor_price: laborPrice,
        current_price: materialPrice + laborPrice,
        created_by_user_id: user.id
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
      toast({ title: "Material criado e aplicado!" });
      setShowNewMaterialForm(false);
      setNewMaterial({ name: "", unit: "UN", material_price: "", labor_price: "" });
      onNewMaterialCreated?.(data);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar material",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (!pending) return null;

  const { description, match } = pending;
  const material = match.material;
  const totalPrice = (material.material_price || 0) + (material.labor_price || 0);

  const handleCreateNew = () => {
    setNewMaterial({
      name: description,
      unit: "UN",
      material_price: "",
      labor_price: "",
    });
    setShowNewMaterialForm(true);
  };

  const handleSubmitNew = () => {
    if (!newMaterial.name || !newMaterial.material_price) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Nome e Preço do Material são obrigatórios",
        variant: "destructive"
      });
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{showNewMaterialForm ? "Cadastrar Novo Material" : "Confirmar Material Similar"}</span>
            <Badge variant="outline">
              {currentIndex + 1} de {totalPending}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {showNewMaterialForm 
              ? "Cadastre um novo material com o preço correto."
              : "Encontramos um material similar. Confirme se deseja usar este preço ou cadastre um novo."}
          </DialogDescription>
        </DialogHeader>

        {!showNewMaterialForm ? (
          <>
            <div className="space-y-4 py-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Descrição na planilha:</p>
                <p className="font-medium">{description}</p>
                {(pending.unit || pending.quantity) && (
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    {pending.quantity && <span>Quantidade: <strong>{pending.quantity}</strong></span>}
                    {pending.unit && <span>Unidade: <strong>{pending.unit}</strong></span>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center">
                <span className="text-muted-foreground">↓</span>
              </div>

              <div className="p-4 border rounded-lg border-primary/50 bg-primary/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Material encontrado:</p>
                  <Badge 
                    variant={match.matchType === 'Exato' ? 'default' : 
                            match.matchType === 'Parcial' ? 'secondary' : 'outline'}
                  >
                    {match.matchType === 'Similaridade' 
                      ? `${match.similarity.toFixed(0)}% similar` 
                      : match.matchType}
                  </Badge>
                </div>
                <p className="font-semibold text-lg">{material.name}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Unidade</p>
                    <p className="font-medium">{material.unit || 'UN'}</p>
                  </div>
                  {material.brand && (
                    <div>
                      <p className="text-muted-foreground">Marca</p>
                      <p className="font-medium">{material.brand}</p>
                    </div>
                  )}
                  {material.category && (
                    <div>
                      <p className="text-muted-foreground">Categoria</p>
                      <p className="font-medium">{material.category}</p>
                    </div>
                  )}
                  {material.measurement && (
                    <div>
                      <p className="text-muted-foreground">Medida</p>
                      <p className="font-medium">{material.measurement}</p>
                    </div>
                  )}
                  {material.color && (
                    <div>
                      <p className="text-muted-foreground">Cor</p>
                      <p className="font-medium">{material.color}</p>
                    </div>
                  )}
                  {material.supplier && (
                    <div>
                      <p className="text-muted-foreground">Fornecedor</p>
                      <p className="font-medium">{material.supplier}</p>
                    </div>
                  )}
                </div>

                {material.description && (
                  <div className="mt-3 text-sm">
                    <p className="text-muted-foreground">Descrição</p>
                    <p className="font-medium">{material.description}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 mt-4 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Material</p>
                    <p className="text-blue-600 font-semibold">
                      R$ {(material.material_price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mão de Obra</p>
                    <p className="text-orange-600 font-semibold">
                      R$ {(material.labor_price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-green-600 font-bold text-lg">
                      R$ {totalPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={onSkip} className="sm:mr-auto">
                <SkipForward className="h-4 w-4 mr-2" />
                Pular
              </Button>
              <Button variant="secondary" onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Novo
              </Button>
              <Button variant="destructive" onClick={onReject}>
                <X className="h-4 w-4 mr-2" />
                Não é esse
              </Button>
              <Button onClick={onApprove}>
                <Check className="h-4 w-4 mr-2" />
                Sim, usar este
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Nome do Material *</Label>
                <Input
                  id="new-name"
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-unit">Unidade *</Label>
                  <Input
                    id="new-unit"
                    value={newMaterial.unit}
                    onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                    placeholder="UN, m², kg..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-mat-price">Preço Material (R$) *</Label>
                  <Input
                    id="new-mat-price"
                    type="number"
                    step="0.01"
                    value={newMaterial.material_price}
                    onChange={(e) => setNewMaterial({ ...newMaterial, material_price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-labor-price">Preço MDO (R$)</Label>
                  <Input
                    id="new-labor-price"
                    type="number"
                    step="0.01"
                    value={newMaterial.labor_price}
                    onChange={(e) => setNewMaterial({ ...newMaterial, labor_price: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowNewMaterialForm(false)} className="sm:mr-auto">
                Voltar
              </Button>
              <Button onClick={handleSubmitNew} disabled={createMutation.isPending}>
                <Check className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Criando..." : "Criar e Aplicar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}