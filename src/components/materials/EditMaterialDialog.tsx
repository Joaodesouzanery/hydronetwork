import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface EditMaterialDialogProps {
  material: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditMaterialDialog = ({ material, open, onOpenChange }: EditMaterialDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    brand: "",
    color: "",
    measurement: "",
    unit: "",
    material_price: "",
    labor_price: "",
    minimum_stock: "",
    current_stock: ""
  });

  useEffect(() => {
    if (material) {
      setFormData({
        name: material.name || "",
        description: material.description || "",
        brand: material.brand || "",
        color: material.color || "",
        measurement: material.measurement || "",
        unit: material.unit || "",
        material_price: material.material_price?.toString() || "",
        labor_price: material.labor_price?.toString() || "",
        minimum_stock: material.minimum_stock?.toString() || "",
        current_stock: material.current_stock?.toString() || ""
      });
      setKeywords(material.keywords || []);
    }
  }, [material]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const materialPrice = parseFloat(data.material_price) || 0;
      const laborPrice = parseFloat(data.labor_price) || 0;
      
      const { error } = await supabase
        .from('materials')
        .update({
          ...data,
          material_price: materialPrice,
          labor_price: laborPrice,
          current_price: materialPrice + laborPrice,
          minimum_stock: parseFloat(data.minimum_stock) || 0,
          current_stock: parseFloat(data.current_stock) || 0,
          keywords: keywords
        })
        .eq('id', material.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
      toast({ title: "Material atualizado com sucesso" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar material",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim().toLowerCase())) {
      setKeywords([...keywords, keywordInput.trim().toLowerCase()]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Material</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="measurement">Medida</Label>
              <Input
                id="measurement"
                value={formData.measurement}
                onChange={(e) => setFormData({ ...formData, measurement: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unidade *</Label>
              <Input
                id="unit"
                required
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material_price">Preço do Material (R$) *</Label>
              <Input
                id="material_price"
                type="number"
                step="0.01"
                required
                value={formData.material_price}
                onChange={(e) => setFormData({ ...formData, material_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labor_price">Preço da Mão de Obra (R$)</Label>
              <Input
                id="labor_price"
                type="number"
                step="0.01"
                value={formData.labor_price}
                onChange={(e) => setFormData({ ...formData, labor_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimum_stock">Estoque Mínimo</Label>
              <Input
                id="minimum_stock"
                type="number"
                step="0.01"
                value={formData.minimum_stock}
                onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_stock">Estoque Atual</Label>
              <Input
                id="current_stock"
                type="number"
                step="0.01"
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Palavras-chave / Sinônimos</Label>
            <div className="flex gap-2">
              <Input
                id="keywords"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Digite uma palavra-chave e pressione Enter"
              />
              <Button type="button" onClick={addKeyword} variant="outline">
                Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Adicione sinônimos para que a IA identifique automaticamente este material nas planilhas
            </p>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
