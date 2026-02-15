import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface EditableMaterialsTableProps {
  materials: any[];
  isLoading: boolean;
  onEdit: (material: any) => void;
  onDelete: (id: string) => void;
  selectedMaterials: string[];
  onSelectionChange: (selected: string[]) => void;
}

export const EditableMaterialsTable = ({ 
  materials, 
  isLoading, 
  onEdit, 
  onDelete, 
  selectedMaterials, 
  onSelectionChange 
}: EditableMaterialsTableProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<any>({});

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('materials')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast({ title: "Material atualizado com sucesso!" });
      setEditingId(null);
      setEditedValues({});
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar material",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const toggleSelection = (id: string) => {
    if (selectedMaterials.includes(id)) {
      onSelectionChange(selectedMaterials.filter(m => m !== id));
    } else {
      onSelectionChange([...selectedMaterials, id]);
    }
  };

  const toggleAll = () => {
    if (selectedMaterials.length === materials.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(materials.map(m => m.id));
    }
  };

  const startEditing = (material: any) => {
    setEditingId(material.id);
    setEditedValues({
      name: material.name,
      brand: material.brand,
      color: material.color,
      measurement: material.measurement,
      unit: material.unit,
      current_price: material.current_price,
      minimum_stock: material.minimum_stock,
      current_stock: material.current_stock,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditedValues({});
  };

  const saveEditing = () => {
    if (!editingId) return;
    
    const updates = {
      ...editedValues,
      current_price: parseFloat(editedValues.current_price),
      minimum_stock: parseFloat(editedValues.minimum_stock),
      current_stock: parseFloat(editedValues.current_stock),
    };
    
    updateMutation.mutate({ id: editingId, updates });
  };

  const updateEditedValue = (field: string, value: any) => {
    setEditedValues({ ...editedValues, [field]: value });
  };

  const calculateBDI = (material: any) => {
    const bdiPercentage = 0.28; // 28% BDI padrão
    const materialCost = material.current_stock * material.current_price;
    return materialCost * bdiPercentage;
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum material encontrado
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedMaterials.length === materials.length}
                onCheckedChange={toggleAll}
              />
            </TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Cor</TableHead>
            <TableHead>Medida</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-right">PR. MAT.</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
            <TableHead className="text-right">Estoque Mín.</TableHead>
            <TableHead className="text-right">Estoque Atual</TableHead>
            <TableHead className="text-right">BDI (28%)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((material) => {
            const isLowStock = material.current_stock <= material.minimum_stock;
            const isOutOfStock = material.current_stock === 0;
            const isEditing = editingId === material.id;
            
            return (
              <TableRow key={material.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedMaterials.includes(material.id)}
                    onCheckedChange={() => toggleSelection(material.id)}
                  />
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editedValues.name}
                      onChange={(e) => updateEditedValue('name', e.target.value)}
                      className="min-w-[150px]"
                    />
                  ) : (
                    <span className="font-medium">{material.name}</span>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editedValues.brand}
                      onChange={(e) => updateEditedValue('brand', e.target.value)}
                    />
                  ) : (
                    material.brand || "-"
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editedValues.color}
                      onChange={(e) => updateEditedValue('color', e.target.value)}
                    />
                  ) : (
                    material.color || "-"
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editedValues.measurement}
                      onChange={(e) => updateEditedValue('measurement', e.target.value)}
                    />
                  ) : (
                    material.measurement || "-"
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editedValues.unit}
                      onChange={(e) => updateEditedValue('unit', e.target.value)}
                    />
                  ) : (
                    material.unit
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editedValues.current_price}
                      onChange={(e) => updateEditedValue('current_price', e.target.value)}
                      className="text-right"
                    />
                  ) : (
                    `R$ ${material.current_price?.toFixed(2) || "0.00"}`
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editedValues.current_stock}
                      onChange={(e) => updateEditedValue('current_stock', e.target.value)}
                      className="text-right"
                    />
                  ) : (
                    material.current_stock || 0
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editedValues.minimum_stock}
                      onChange={(e) => updateEditedValue('minimum_stock', e.target.value)}
                      className="text-right"
                    />
                  ) : (
                    material.minimum_stock || 0
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {material.current_stock || 0}
                </TableCell>
                <TableCell className="text-right">
                  R$ {calculateBDI(material).toFixed(2)}
                </TableCell>
                <TableCell>
                  {isOutOfStock ? (
                    <Badge variant="destructive">Sem Estoque</Badge>
                  ) : isLowStock ? (
                    <Badge variant="secondary">Estoque Baixo</Badge>
                  ) : (
                    <Badge variant="default">Normal</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={saveEditing}
                          disabled={updateMutation.isPending}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditing(material)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(material.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
