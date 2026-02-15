import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Check, X, Search, Plus, Trash2, Settings2 } from "lucide-react";
import { AddMaterialDialog } from "@/components/materials/AddMaterialDialog";
import { EditMaterialDialog } from "@/components/materials/EditMaterialDialog";
import { BulkActionsDialog } from "@/components/materials/BulkActionsDialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const PriceManagementTable = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkActionsDialog, setShowBulkActionsDialog] = useState(false);

  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, newPrice }: { id: string; newPrice: number }) => {
      const material = materials?.find(m => m.id === id);
      if (!material) throw new Error("Material não encontrado");

      // IMPORTANTE: Só atualiza se o preço realmente mudou
      if (material.current_price === newPrice) {
        console.log("Preço não mudou, ignorando atualização");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error: historyError } = await supabase
        .from('price_history')
        .insert({
          material_id: id,
          old_price: material.current_price || 0,
          new_price: newPrice,
          changed_by_user_id: user.id
        });

      if (historyError) throw historyError;

      const { error: updateError } = await supabase
        .from('materials')
        .update({ current_price: newPrice })
        .eq('id', id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
      toast({
        title: "Preço atualizado!",
        description: "O novo preço será usado automaticamente em novos orçamentos."
      });
      setEditingId(null);
      setEditPrice("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar preço",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('materials')
        .delete()
        .in('id', ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast({
        title: "Materiais excluídos",
        description: `${count} material(is) excluído(s) com sucesso.`
      });
      setSelectedItems(new Set());
      setShowDeleteDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir materiais",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Função para normalizar texto para busca
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const filteredMaterials = materials?.filter(material => {
    if (!searchTerm) return true;
    
    const search = normalizeText(searchTerm);
    
    const matchName = normalizeText(material.name).includes(search);
    const matchBrand = material.brand ? normalizeText(material.brand).includes(search) : false;
    const matchCategory = material.category ? normalizeText(material.category).includes(search) : false;
    const matchSupplier = material.supplier ? normalizeText(material.supplier).includes(search) : false;
    const matchDescription = material.description ? normalizeText(material.description).includes(search) : false;
    
    const matchKeywords = material.keywords && Array.isArray(material.keywords) 
      ? material.keywords.some((kw: string) => normalizeText(kw).includes(search))
      : false;
    
    const searchTokens = search.split(' ').filter(t => t.length >= 2);
    const materialText = normalizeText(
      `${material.name} ${material.brand || ''} ${material.category || ''} ${material.description || ''}`
    );
    const matchTokens = searchTokens.length > 0 
      ? searchTokens.every(token => materialText.includes(token))
      : false;
    
    return matchName || matchBrand || matchCategory || matchSupplier || 
           matchDescription || matchKeywords || matchTokens;
  }) || [];

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredMaterials.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredMaterials.map(m => m.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedItems.size > 0) {
      setShowDeleteDialog(true);
    }
  };

  const confirmDelete = () => {
    deleteMutation.mutate(Array.from(selectedItems));
  };

  const startEdit = (id: string, currentPrice: number) => {
    setEditingId(id);
    setEditPrice(currentPrice.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPrice("");
  };

  const saveEdit = (id: string) => {
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast({
        title: "Preço inválido",
        description: "Por favor, insira um valor válido.",
        variant: "destructive"
      });
      return;
    }
    updatePriceMutation.mutate({ id, newPrice });
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Gestão de Preços</h2>
            <p className="text-muted-foreground">
              Atualize os preços dos materiais. Novos orçamentos usarão automaticamente os preços mais recentes.
            </p>
          </div>
          <div className="flex gap-2">
            {selectedItems.size > 0 && (
              <>
                <Button variant="outline" onClick={() => setShowBulkActionsDialog(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Ações ({selectedItems.size})
                </Button>
                <Button variant="destructive" onClick={handleDeleteSelected}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir ({selectedItems.size})
                </Button>
              </>
            )}
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Preço
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar materiais..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox 
                    checked={filteredMaterials.length > 0 && selectedItems.size === filteredMaterials.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Medida</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Preço Material</TableHead>
                <TableHead>Preço M.O.</TableHead>
                <TableHead>Preço Total</TableHead>
                <TableHead>Palavras-chave</TableHead>
                <TableHead className="text-right">Editar Preço</TableHead>
                <TableHead className="text-right">Editar Tudo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {filteredMaterials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  Nenhum material cadastrado
                </TableCell>
              </TableRow>
              ) : (
                filteredMaterials.map((material) => (
                  <TableRow key={material.id} className={selectedItems.has(material.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedItems.has(material.id)}
                        onCheckedChange={() => toggleSelectItem(material.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{material.name}</TableCell>
                    <TableCell>{material.brand || "-"}</TableCell>
                    <TableCell>{material.category || "-"}</TableCell>
                    <TableCell>{material.supplier || "-"}</TableCell>
                    <TableCell>{material.measurement || "-"}</TableCell>
                    <TableCell>{material.unit}</TableCell>
                    <TableCell>
                      R$ {material.material_price?.toFixed(2) || "0.00"}
                    </TableCell>
                    <TableCell>
                      R$ {material.labor_price?.toFixed(2) || "0.00"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {editingId === material.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-32"
                          autoFocus
                        />
                      ) : (
                        `R$ ${material.current_price?.toFixed(2) || "0.00"}`
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {material.keywords && material.keywords.length > 0 ? (
                          <>
                            {material.keywords.slice(0, 3).map((kw: string, i: number) => (
                              <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                                {kw}
                              </span>
                            ))}
                            {material.keywords.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{material.keywords.length - 3}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === material.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(material.id)}
                            disabled={updatePriceMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(material.id, material.current_price)}
                          title="Editar apenas preço"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingMaterial(material);
                          setShowEditDialog(true);
                        }}
                        title="Editar todas as informações"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddMaterialDialog 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen}
      />
      
      {editingMaterial && (
        <EditMaterialDialog
          material={editingMaterial}
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) setEditingMaterial(null);
          }}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedItems.size} material(is)? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkActionsDialog
        open={showBulkActionsDialog}
        onOpenChange={setShowBulkActionsDialog}
        selectedMaterials={Array.from(selectedItems)}
        materials={filteredMaterials}
        onClearSelection={() => setSelectedItems(new Set())}
      />
    </Card>
  );
};
