import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface MaterialsTableProps {
  materials: any[];
  isLoading: boolean;
  onEdit: (material: any) => void;
  onDelete: (id: string) => void;
  selectedMaterials: string[];
  onSelectionChange: (selected: string[]) => void;
}

export const MaterialsTable = ({ materials, isLoading, onEdit, onDelete, selectedMaterials, onSelectionChange }: MaterialsTableProps) => {
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
    <div className="rounded-md border">
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
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Estoque Mín.</TableHead>
            <TableHead className="text-right">Estoque Atual</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((material) => {
            const isLowStock = material.current_stock <= material.minimum_stock;
            const isOutOfStock = material.current_stock === 0;
            
            return (
              <TableRow key={material.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedMaterials.includes(material.id)}
                    onCheckedChange={() => toggleSelection(material.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{material.name}</TableCell>
                <TableCell>{material.brand || "-"}</TableCell>
                <TableCell>{material.color || "-"}</TableCell>
                <TableCell>{material.measurement || "-"}</TableCell>
                <TableCell>{material.unit}</TableCell>
                <TableCell className="text-right">
                  R$ {material.current_price?.toFixed(2) || "0.00"}
                </TableCell>
                <TableCell className="text-right">
                  {material.minimum_stock || 0}
                </TableCell>
                <TableCell className="text-right">
                  {material.current_stock || 0}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(material)}
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
