import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Check, X, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SpreadsheetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SpreadsheetUploadDialog = ({ open, onOpenChange }: SpreadsheetUploadDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [extractedMaterials, setExtractedMaterials] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { data: keywords } = useQuery({
    queryKey: ['custom-keywords'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_keywords').select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(','));
      
      const { data, error } = await supabase.functions.invoke('process-spreadsheet', {
        body: { spreadsheetData: rows, customKeywords: keywords }
      });

      if (error) throw error;
      setExtractedMaterials(data.materials || []);
      toast({ title: "Planilha processada com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao processar planilha", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const saveMaterials = useMutation({
    mutationFn: async (materials: any[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const materialsToInsert = materials.map(m => ({
        name: m.name, brand: m.brand, color: m.color, measurement: m.measurement,
        unit: m.unit, current_price: m.price, minimum_stock: 0,
        current_stock: m.quantity, created_by_user_id: user.id
      }));

      const { error } = await supabase.from('materials').insert(materialsToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast({ title: "Materiais salvos com sucesso!" });
      onOpenChange(false);
      setFile(null);
      setExtractedMaterials([]);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar materiais", description: error.message, variant: "destructive" });
    }
  });

  const updateMaterial = (index: number, field: string, value: any) => {
    const updated = [...extractedMaterials];
    updated[index][field] = value;
    setExtractedMaterials(updated);
  };

  const removeMaterial = (index: number) => {
    setExtractedMaterials(extractedMaterials.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Planilha com IA</DialogTitle>
        </DialogHeader>

        {extractedMaterials.length === 0 ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">Faça upload de uma planilha CSV ou Excel</p>
              <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="max-w-xs mx-auto" />
            </div>
            {file && (
              <div className="flex justify-center">
                <Button onClick={processFile} disabled={isProcessing}>
                  {isProcessing ? "Processando com IA..." : "Processar com IA"}
                </Button>
              </div>
            )}
            {isProcessing && (
              <div className="space-y-2">
                <Progress value={50} className="w-full" />
                <p className="text-xs text-center text-muted-foreground">
                  A IA está identificando materiais com suas palavras-chave e sinônimos...
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{extractedMaterials.length} materiais identificados</p>
                <p className="text-xs text-muted-foreground">Usando palavras-chave e sinônimos</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setExtractedMaterials([])}>Cancelar</Button>
                <Button onClick={() => saveMaterials.mutate(extractedMaterials)}>Salvar Todos</Button>
              </div>
            </div>
            <div className="space-y-2">
              {extractedMaterials.map((material, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <Badge variant={material.confidence >= 95 ? "default" : "secondary"}>
                      {material.confidence >= 95 && <Check className="h-3 w-3 mr-1" />}
                      {material.confidence}% confiança
                    </Badge>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => setEditingIndex(editingIndex === index ? null : index)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeMaterial(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {editingIndex === index ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div><Label className="text-xs">Nome</Label><Input value={material.name} onChange={(e) => updateMaterial(index, 'name', e.target.value)} /></div>
                      <div><Label className="text-xs">Marca</Label><Input value={material.brand || ''} onChange={(e) => updateMaterial(index, 'brand', e.target.value)} /></div>
                      <div><Label className="text-xs">Cor</Label><Input value={material.color || ''} onChange={(e) => updateMaterial(index, 'color', e.target.value)} /></div>
                      <div><Label className="text-xs">Medida</Label><Input value={material.measurement || ''} onChange={(e) => updateMaterial(index, 'measurement', e.target.value)} /></div>
                      <div><Label className="text-xs">Unidade</Label><Input value={material.unit} onChange={(e) => updateMaterial(index, 'unit', e.target.value)} /></div>
                      <div><Label className="text-xs">Preço</Label><Input type="number" step="0.01" value={material.price} onChange={(e) => updateMaterial(index, 'price', parseFloat(e.target.value))} /></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Nome:</span><p className="font-medium">{material.name}</p></div>
                      {material.brand && <div><span className="text-muted-foreground">Marca:</span><p>{material.brand}</p></div>}
                      {material.color && <div><span className="text-muted-foreground">Cor:</span><p>{material.color}</p></div>}
                      <div><span className="text-muted-foreground">Preço:</span><p>R$ {material.price?.toFixed(2)}</p></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
