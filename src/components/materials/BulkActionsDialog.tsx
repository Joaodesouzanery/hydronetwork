import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Building2, FolderOpen, Download } from "lucide-react";
import * as XLSX from 'xlsx';

interface BulkActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMaterials: string[];
  materials?: any[];
  onClearSelection: () => void;
}

export const BulkActionsDialog = ({ 
  open, 
  onOpenChange, 
  selectedMaterials, 
  materials = [],
  onClearSelection 
}: BulkActionsDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Price adjustment state
  const [priceOperation, setPriceOperation] = useState<'set' | 'increase_percent' | 'decrease_percent' | 'increase_value' | 'decrease_value'>('increase_percent');
  const [priceValue, setPriceValue] = useState("");
  
  // Supplier state
  const [newSupplier, setNewSupplier] = useState("");
  
  // Category state
  const [newCategory, setNewCategory] = useState("");

  // Get unique categories and suppliers from materials
  const { data: allMaterials } = useQuery({
    queryKey: ['materials-for-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('category, supplier');
      if (error) throw error;
      return data || [];
    }
  });

  const uniqueCategories = [...new Set(allMaterials?.map(m => m.category).filter(Boolean) || [])];
  const uniqueSuppliers = [...new Set(allMaterials?.map(m => m.supplier).filter(Boolean) || [])];

  const selectedMaterialsData = materials.filter(m => selectedMaterials.includes(m.id));

  // Bulk price update mutation
  const bulkPriceMutation = useMutation({
    mutationFn: async () => {
      const numValue = parseFloat(priceValue);
      if (isNaN(numValue)) throw new Error("Valor inválido");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      for (const materialId of selectedMaterials) {
        const material = materials.find(m => m.id === materialId);
        if (!material) continue;

        let newPrice: number;
        const currentPrice = material.current_price || 0;

        switch (priceOperation) {
          case 'set':
            newPrice = numValue;
            break;
          case 'increase_percent':
            newPrice = currentPrice * (1 + numValue / 100);
            break;
          case 'decrease_percent':
            newPrice = currentPrice * (1 - numValue / 100);
            break;
          case 'increase_value':
            newPrice = currentPrice + numValue;
            break;
          case 'decrease_value':
            newPrice = Math.max(0, currentPrice - numValue);
            break;
          default:
            newPrice = currentPrice;
        }

        newPrice = Math.round(newPrice * 100) / 100;

        // Record price history
        if (currentPrice !== newPrice) {
          await supabase.from('price_history').insert({
            material_id: materialId,
            old_price: currentPrice,
            new_price: newPrice,
            changed_by_user_id: user.id
          });

          await supabase
            .from('materials')
            .update({ current_price: newPrice })
            .eq('id', materialId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
      toast({ title: `Preços de ${selectedMaterials.length} materiais atualizados!` });
      onOpenChange(false);
      onClearSelection();
      setPriceValue("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar preços",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Bulk supplier update mutation
  const bulkSupplierMutation = useMutation({
    mutationFn: async () => {
      if (!newSupplier.trim()) throw new Error("Fornecedor não pode estar vazio");

      const { error } = await supabase
        .from('materials')
        .update({ supplier: newSupplier.trim() })
        .in('id', selectedMaterials);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
      toast({ title: `Fornecedor de ${selectedMaterials.length} materiais atualizado!` });
      onOpenChange(false);
      onClearSelection();
      setNewSupplier("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar fornecedor",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Bulk category update mutation
  const bulkCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!newCategory.trim()) throw new Error("Categoria não pode estar vazia");

      const { error } = await supabase
        .from('materials')
        .update({ category: newCategory.trim() })
        .in('id', selectedMaterials);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
      toast({ title: `Categoria de ${selectedMaterials.length} materiais atualizada!` });
      onOpenChange(false);
      onClearSelection();
      setNewCategory("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar categoria",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Export selected materials with proper Excel formatting
  const handleExport = (format: 'excel' | 'csv') => {
    const exportData = selectedMaterialsData.map(m => ({
      'Descrição': m.name || '',
      'Marca': m.brand || '',
      'Categoria': m.category || '',
      'Fornecedor': m.supplier || '',
      'Medida': m.measurement || '',
      'Unidade': m.unit || '',
      'Preço Material': m.material_price || 0,
      'Preço M.O.': m.labor_price || 0,
      'Preço Total': m.current_price || 0,
      'Palavras-Chave': (m.keywords || []).join(', ')
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 40 }, // Descrição
      { wch: 15 }, // Marca
      { wch: 15 }, // Categoria
      { wch: 20 }, // Fornecedor
      { wch: 12 }, // Medida
      { wch: 10 }, // Unidade
      { wch: 15 }, // Preço Material
      { wch: 15 }, // Preço M.O.
      { wch: 15 }, // Preço Total
      { wch: 30 }, // Palavras-Chave
    ];
    ws['!cols'] = colWidths;

    // Format currency columns (columns G, H, I - indices 6, 7, 8)
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      // Price columns formatting
      for (let col = 6; col <= 8; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellAddress]) {
          ws[cellAddress].t = 'n'; // Ensure number type
          ws[cellAddress].z = '"R$" #,##0.00'; // Brazilian currency format
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Materiais");

    const fileName = `materiais_selecionados_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'excel') {
      XLSX.writeFile(wb, `${fileName}.xlsx`, { bookType: 'xlsx', cellStyles: true });
    } else {
      XLSX.writeFile(wb, `${fileName}.csv`, { bookType: 'csv' });
    }

    toast({ title: `${selectedMaterials.length} materiais exportados!` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ações em Bloco</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-4">
          {selectedMaterials.length} materiais selecionados
        </div>

        <Tabs defaultValue="price" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="price" className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="hidden sm:inline">Preço</span>
            </TabsTrigger>
            <TabsTrigger value="supplier" className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              <span className="hidden sm:inline">Fornecedor</span>
            </TabsTrigger>
            <TabsTrigger value="category" className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              <span className="hidden sm:inline">Categoria</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Exportar</span>
            </TabsTrigger>
          </TabsList>

          {/* Price Tab */}
          <TabsContent value="price" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Tipo de Ajuste</Label>
              <Select value={priceOperation} onValueChange={(v: any) => setPriceOperation(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Definir Valor Fixo</SelectItem>
                  <SelectItem value="increase_percent">Aumentar por %</SelectItem>
                  <SelectItem value="decrease_percent">Diminuir por %</SelectItem>
                  <SelectItem value="increase_value">Aumentar por Valor (R$)</SelectItem>
                  <SelectItem value="decrease_value">Diminuir por Valor (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {priceOperation === 'set' ? 'Novo Preço (R$)' : 
                 priceOperation.includes('percent') ? 'Porcentagem (%)' : 'Valor (R$)'}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={priceValue}
                onChange={(e) => setPriceValue(e.target.value)}
                placeholder={priceOperation.includes('percent') ? 'Ex: 10 para 10%' : 'Ex: 5.50'}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={() => bulkPriceMutation.mutate()}
              disabled={!priceValue || bulkPriceMutation.isPending}
            >
              {bulkPriceMutation.isPending ? "Aplicando..." : "Aplicar Ajuste de Preço"}
            </Button>
          </TabsContent>

          {/* Supplier Tab */}
          <TabsContent value="supplier" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Novo Fornecedor</Label>
              <Input
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                placeholder="Digite o nome do fornecedor"
                list="suppliers-list"
              />
              <datalist id="suppliers-list">
                {uniqueSuppliers.map((s, i) => (
                  <option key={i} value={s} />
                ))}
              </datalist>
            </div>

            <Button 
              className="w-full" 
              onClick={() => bulkSupplierMutation.mutate()}
              disabled={!newSupplier.trim() || bulkSupplierMutation.isPending}
            >
              {bulkSupplierMutation.isPending ? "Aplicando..." : "Alterar Fornecedor"}
            </Button>
          </TabsContent>

          {/* Category Tab */}
          <TabsContent value="category" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nova Categoria</Label>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Digite a categoria"
                list="categories-list"
              />
              <datalist id="categories-list">
                {uniqueCategories.map((c, i) => (
                  <option key={i} value={c} />
                ))}
              </datalist>
            </div>

            <Button 
              className="w-full" 
              onClick={() => bulkCategoryMutation.mutate()}
              disabled={!newCategory.trim() || bulkCategoryMutation.isPending}
            >
              {bulkCategoryMutation.isPending ? "Aplicando..." : "Alterar Categoria"}
            </Button>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Exportar os {selectedMaterials.length} materiais selecionados
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline"
                className="w-full" 
                onClick={() => handleExport('excel')}
              >
                <Download className="h-4 w-4 mr-2" />
                Excel (.xlsx)
              </Button>
              <Button 
                variant="outline"
                className="w-full" 
                onClick={() => handleExport('csv')}
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
