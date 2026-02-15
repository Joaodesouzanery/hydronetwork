import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface IntelligentSpreadsheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const IntelligentSpreadsheetDialog = ({ open, onOpenChange }: IntelligentSpreadsheetDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedMaterials, setProcessedMaterials] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'export'>('upload');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: keywords } = useQuery({
    queryKey: ['custom-keywords'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('custom_keywords')
        .select('*')
        .eq('created_by_user_id', user.id);
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: catalogedMaterials } = useQuery({
    queryKey: ['cataloged-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: budgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('created_by_user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const [selectedBudget, setSelectedBudget] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      toast({
        title: "Processando com IA...",
        description: "Identificando materiais inteligentemente"
      });

      const { data: processedData, error } = await supabase.functions.invoke('process-spreadsheet', {
        body: {
          spreadsheetData: jsonData,
          customKeywords: keywords || [],
          catalogedMaterials: catalogedMaterials || []
        }
      });

      if (error) throw error;

      setProcessedMaterials(processedData.materials || []);
      setStep('preview');

      toast({
        title: "Processamento concluído!",
        description: `${processedData.materials?.length || 0} materiais identificados`
      });
    } catch (error: any) {
      console.error('Erro ao processar planilha:', error);
      toast({
        title: "Erro ao processar",
        description: error.message || "Não foi possível processar a planilha",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToSpreadsheet = () => {
    const ws = XLSX.utils.json_to_sheet(
      processedMaterials.map(m => ({
        'Material': m.name,
        'Marca': m.brand || '',
        'Cor': m.color || '',
        'Medida': m.measurement || '',
        'Unidade': m.unit,
        'Quantidade': m.quantity,
        'Preço Material (R$)': m.material_price || 0,
        'Preço M.O. (R$)': m.labor_price || 0,
        'Preço Total (R$)': m.price || 0,
        'Total (R$)': m.total || 0,
        'Confiança (%)': Math.round(m.confidence)
      }))
    );
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Materiais');
    XLSX.writeFile(wb, `materiais_processados_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Planilha exportada!",
      description: "Arquivo salvo com sucesso"
    });
  };

  const importToBudget = async () => {
    if (!selectedBudget) {
      toast({
        title: "Selecione um orçamento",
        description: "Escolha o orçamento onde deseja importar os materiais",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: existingItems } = await supabase
        .from('budget_items')
        .select('item_number')
        .eq('budget_id', selectedBudget)
        .order('item_number', { ascending: false })
        .limit(1);

      const startNumber = existingItems && existingItems.length > 0 
        ? existingItems[0].item_number + 1 
        : 1;

      const itemsToInsert = processedMaterials.map((material, index) => ({
        budget_id: selectedBudget,
        item_number: startNumber + index,
        description: `${material.name}${material.brand ? ' - ' + material.brand : ''}${material.color ? ' - ' + material.color : ''}${material.measurement ? ' - ' + material.measurement : ''}`,
        unit: material.unit,
        quantity: material.quantity,
        unit_price_material: material.price || 0,
        unit_price_labor: 0,
        bdi_percentage: 0,
        subtotal_material: (material.quantity * (material.price || 0)),
        subtotal_labor: 0,
        subtotal_bdi: 0,
        total: (material.quantity * (material.price || 0)),
      }));

      const { error } = await supabase
        .from('budget_items')
        .insert(itemsToInsert);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['budget-items'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });

      toast({
        title: "Sucesso!",
        description: `${itemsToInsert.length} materiais importados para o orçamento`
      });

      onOpenChange(false);
      resetDialog();
    } catch (error: any) {
      toast({
        title: "Erro ao importar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetDialog = () => {
    setFile(null);
    setStep('upload');
    setProcessedMaterials([]);
    setSelectedBudget("");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetDialog();
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Processamento Inteligente de Planilhas</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Upload da Planilha</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                A IA identificará materiais, marcas, cores e medidas automaticamente usando suas palavras-chave configuradas
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Como funciona:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Faça upload da planilha com descrições de materiais</li>
                <li>A IA identifica e separa: nome, marca, cor, medidas</li>
                <li>Revise os materiais identificados</li>
                <li>Exporte para planilha ou importe para orçamentos</li>
              </ol>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={processFile} 
                disabled={!file || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando com IA...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Processar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && processedMaterials.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-semibold">{processedMaterials.length} materiais identificados</p>
            </div>

            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Medida</TableHead>
                    <TableHead>Un</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Preço Mat.</TableHead>
                    <TableHead>Preço M.O.</TableHead>
                    <TableHead>Preço Total</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Conf.%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedMaterials.map((material, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>{material.brand || '-'}</TableCell>
                      <TableCell>{material.color || '-'}</TableCell>
                      <TableCell>{material.measurement || '-'}</TableCell>
                      <TableCell>{material.unit}</TableCell>
                      <TableCell>{material.quantity}</TableCell>
                      <TableCell>R$ {material.material_price?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>R$ {material.labor_price?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>R$ {material.price?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell className="font-medium">R$ {material.total?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>
                        <span className={material.confidence >= 80 ? 'text-green-600' : 'text-yellow-600'}>
                          {Math.round(material.confidence)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="budget-select">Importar para Orçamento (Opcional)</Label>
                <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                  <SelectTrigger id="budget-select">
                    <SelectValue placeholder="Selecione um orçamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets?.map(budget => (
                      <SelectItem key={budget.id} value={budget.id}>
                        {budget.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Voltar
                </Button>
                <Button variant="outline" onClick={exportToSpreadsheet}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Planilha
                </Button>
                {selectedBudget && (
                  <Button onClick={importToBudget}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar para Orçamento
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
