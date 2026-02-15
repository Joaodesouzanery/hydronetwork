import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, Save, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SpreadsheetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
}

interface ProcessedItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  unit_price_material: number;
  unit_price_labor: number;
  total: number;
  material_id: string | null;
  material_name?: string;
  matched: boolean;
  match_type?: string; // Status: 'Encontrado' ou 'Preço não encontrado' ou 'Não buscado'
  originalRow?: any;
}

export const SpreadsheetUploadDialog = ({ open, onOpenChange, budgetId }: SpreadsheetUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearchingPrices, setIsSearchingPrices] = useState(false);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [originalData, setOriginalData] = useState<any[]>([]); // Armazena dados originais
  const [columnMapping, setColumnMapping] = useState<any>({}); // Mapeia colunas originais
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Função para normalizar texto (remover acentos, espaços extras, etc)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Função SIMPLIFICADA para buscar material correspondente
  const findMatchingMaterial = async (description: string) => {
    const { data: materials } = await supabase
      .from('materials')
      .select('*');
    
    if (!materials || materials.length === 0) return null;

    const normalizedDescription = normalizeText(description);

    // 1. BUSCA EXATA: igualdade direta
    const exactMatch = materials.find(m => 
      normalizeText(m.name) === normalizedDescription
    );
    if (exactMatch) {
      console.log(`[MATCH EXATO] ${description} → ${exactMatch.name}`);
      return { material: exactMatch, matchType: 'Exato' };
    }

    // 2. BUSCA PARCIAL: nome do material contido na descrição OU vice-versa
    const partialMatch = materials.find(m => {
      const normalizedMaterialName = normalizeText(m.name);
      return normalizedDescription.includes(normalizedMaterialName) || 
             normalizedMaterialName.includes(normalizedDescription);
    });
    
    if (partialMatch) {
      console.log(`[MATCH PARCIAL] ${description} → ${partialMatch.name}`);
      return { material: partialMatch, matchType: 'Parcial' };
    }

    // 3. NÃO ENCONTRADO
    console.log(`[SEM MATCH] ${description}`);
    return null;
  };

  const importMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Busca o maior item_number atual
      const { data: existingItems } = await supabase
        .from('budget_items')
        .select('item_number')
        .eq('budget_id', budgetId)
        .order('item_number', { ascending: false })
        .limit(1);

      const startNumber = existingItems && existingItems.length > 0 
        ? existingItems[0].item_number + 1 
        : 1;

      const itemsToInsert = items.map((item, index) => {
        const qty = parseFloat(String(item.quantity)) || 0;
        const unitPrice = item.unit_price || 0;
        const subtotalMat = qty * (item.unit_price_material || 0);
        const subtotalLab = qty * (item.unit_price_labor || 0);
        const total = qty * unitPrice;
        
        return {
          budget_id: budgetId,
          item_number: startNumber + index,
          description: item.description,
          unit: item.unit || 'UN',
          quantity: qty,
          unit_price_material: item.unit_price_material || 0,
          unit_price_labor: item.unit_price_labor || 0,
          bdi_percentage: 0,
          subtotal_material: subtotalMat,
          subtotal_labor: subtotalLab,
          subtotal_bdi: 0,
          total: total,
          material_id: item.material_id || null,
          price_at_creation: unitPrice || null
        };
      });

      const { error } = await supabase
        .from('budget_items')
        .insert(itemsToInsert);

      if (error) throw error;

      return items.filter(i => i.matched).length;
    },
    onSuccess: (matchedCount) => {
      queryClient.invalidateQueries({ queryKey: ['budget-items'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({
        title: "Sucesso",
        description: `Orçamento salvo! ${matchedCount} itens precificados.`,
      });
      onOpenChange(false);
      setFile(null);
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      let jsonData: any[] = [];

      // Verifica se é PDF
      if (file.type === 'application/pdf') {
        console.log('Processing PDF file...');
        
        // Converte PDF para base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );

        // Chama edge function para extrair dados do PDF
        const { data: pdfData, error: pdfError } = await supabase.functions.invoke(
          'extract-pdf-data',
          {
            body: { pdfBase64: base64 }
          }
        );

        if (pdfError) {
          throw new Error(`Erro ao processar PDF: ${pdfError.message}`);
        }

        if (!pdfData?.items || pdfData.items.length === 0) {
          throw new Error('Nenhum dado encontrado no PDF');
        }

        jsonData = pdfData.items;
        console.log('PDF processed successfully:', jsonData.length, 'items found');
        
      } else {
        // Processa arquivo Excel localmente
        console.log('Processing Excel file...');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log('Excel processed:', jsonData.length, 'rows found');
      }

      if (!jsonData || jsonData.length === 0) {
        throw new Error("A planilha está vazia ou não pôde ser lida");
      }

      // Função para encontrar valor por múltiplas variações de nome de coluna
      const findColumnValue = (row: any, variations: string[]): string => {
        for (const key of Object.keys(row)) {
          const normalizedKey = normalizeText(key);
          for (const variation of variations) {
            if (normalizedKey.includes(normalizeText(variation))) {
              return String(row[key] || '').trim();
            }
          }
        }
        return '';
      };

      const items: ProcessedItem[] = [];
      const skippedRows: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const rowData: any = jsonData[i];
        
        // Busca descrição com múltiplas variações
        const description = findColumnValue(rowData, [
          'descricao', 'description', 'desc', 'item', 
          'material', 'servico', 'service', 'produto'
        ]);
        
        // Busca quantidade
        const quantityStr = findColumnValue(rowData, [
          'quantidade', 'quantity', 'qtd', 'qtde', 'quant'
        ]);
        const quantity = parseFloat(quantityStr.replace(',', '.')) || 0;

        // Busca unidade
        const unit = findColumnValue(rowData, [
          'unidade', 'unit', 'un', 'und', 'medida'
        ]) || 'UN';

        // Validação mais permissiva
        if (!description || description.length < 2) {
          skippedRows.push(`Linha ${i + 2}: Descrição inválida ou vazia`);
          continue;
        }

        if (quantity <= 0) {
          skippedRows.push(`Linha ${i + 2}: Quantidade inválida (${quantityStr})`);
          continue;
        }

        // NÃO faz matching automático - apenas carrega os dados
        items.push({
          description,
          quantity,
          unit,
          unit_price: 0, // Inicia sem preço
          unit_price_material: 0,
          unit_price_labor: 0,
          total: 0,
          material_id: null,
          matched: false,
          match_type: 'Não buscado',
          originalRow: rowData
        });
      }

      if (items.length === 0) {
        let errorMsg = "Nenhum item válido encontrado na planilha.";
        if (skippedRows.length > 0) {
          errorMsg += "\n\nLinhas ignoradas:\n" + skippedRows.slice(0, 5).join('\n');
          if (skippedRows.length > 5) {
            errorMsg += `\n... e mais ${skippedRows.length - 5} linhas`;
          }
        }
        errorMsg += "\n\nVerifique se a planilha contém as colunas: Descrição, Quantidade e Unidade";
        throw new Error(errorMsg);
      }

      // Armazena dados originais para exportação
      setOriginalData(jsonData);
      
      // Mapeia colunas encontradas
      if (jsonData.length > 0) {
        const firstRow = jsonData[0];
        const mapping: any = {};
        
        Object.keys(firstRow).forEach(key => {
          const normalizedKey = normalizeText(key);
          if (normalizedKey.includes('descri') || normalizedKey.includes('item') || 
              normalizedKey.includes('material') || normalizedKey.includes('servico')) {
            mapping.description = key;
          }
          if (normalizedKey.includes('quant') || normalizedKey.includes('qtd')) {
            mapping.quantity = key;
          }
          if (normalizedKey.includes('unid') || normalizedKey.includes('unit')) {
            mapping.unit = key;
          }
        });
        
        setColumnMapping(mapping);
      }
      
      setProcessedItems(items);
      setShowReview(true);

      // Feedback sobre linhas ignoradas
      if (skippedRows.length > 0) {
        console.warn(`${skippedRows.length} linhas foram ignoradas:`, skippedRows);
      }

      toast({
        title: "Planilha importada",
        description: `${items.length} itens carregados. Clique em "Buscar na Gestão de Preços" para precificar.`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao processar arquivo",
        description: error.message || "Verifique se o arquivo está no formato correto",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Nova função: buscar preços na Gestão de Preços
  const searchPrices = async () => {
    setIsSearchingPrices(true);
    try {
      const updatedItems: ProcessedItem[] = [];
      let foundCount = 0;
      let notFoundCount = 0;

      for (const item of processedItems) {
        // Busca material correspondente (exato ou parcial)
        const match = await findMatchingMaterial(item.description);
        
        if (match) {
          const material = match.material;
          
          // Obtém preço: prioridade para current_price
          const baseMaterialPrice = (material.material_price ?? 0) as number;
          const baseLaborPrice = (material.labor_price ?? 0) as number;
          const computedFallbackPrice = baseMaterialPrice + baseLaborPrice;
          const unitPrice = (material.current_price && material.current_price > 0
            ? material.current_price
            : computedFallbackPrice) || 0;

          const hasValidPrice = unitPrice > 0;

          updatedItems.push({
            ...item,
            unit_price: hasValidPrice ? unitPrice : 0,
            unit_price_material: baseMaterialPrice,
            unit_price_labor: baseLaborPrice,
            total: hasValidPrice ? item.quantity * unitPrice : 0,
            material_id: material.id,
            material_name: material.name,
            matched: hasValidPrice,
            match_type: hasValidPrice ? 'Encontrado' : 'Preço não encontrado',
          });
          
          if (hasValidPrice) foundCount++;
          else notFoundCount++;
        } else {
          // Não encontrou correspondência
          updatedItems.push({
            ...item,
            matched: false,
            match_type: 'Preço não encontrado',
          });
          notFoundCount++;
        }
      }

      setProcessedItems(updatedItems);
      
      toast({
        title: "Precificação concluída",
        description: `${foundCount} itens precificados e ${notFoundCount} não encontrados.`,
      });

    } catch (error: any) {
      console.error('Erro ao buscar preços:', error);
      toast({
        title: "Erro ao buscar preços",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearchingPrices(false);
    }
  };

  const handleExport = async () => {
    try {
      // SALVA automaticamente antes de exportar
      await importMutation.mutateAsync(processedItems);

      // Exporta no formato original da planilha
      const exportData = processedItems.map((item, index) => {
        const originalRow = item.originalRow || {};
        const exportRow = { ...originalRow };
        
        // Adiciona/atualiza colunas de preço
        exportRow['Material Encontrado'] = item.material_name || '';
        exportRow['Preço Unitário (R$)'] = item.unit_price.toFixed(2);
        exportRow['Preço Total (R$)'] = item.total.toFixed(2);
        exportRow['Status Precificação'] = item.matched ? 'Precificado Automaticamente' : 'Aguardando Preço';
        exportRow['Match'] = item.match_type || '';
        
        return exportRow;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-ajusta largura das colunas
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      ws['!cols'] = colWidths;
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orçamento Precificado');
      
      const fileName = file?.name.replace(/\.(xlsx|xls|pdf)$/i, '') || 'orcamento';
      XLSX.writeFile(wb, `${fileName}_precificado_${new Date().getTime()}.xlsx`);

      toast({
        title: "Sucesso",
        description: "Orçamento exportado e salvo no sistema!",
      });
      
      handleClose();
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    await importMutation.mutateAsync(processedItems);
  };

  const handleClose = () => {
    setFile(null);
    setProcessedItems([]);
    setOriginalData([]);
    setColumnMapping({});
    setShowReview(false);
    onOpenChange(false);
  };

  const matchedCount = processedItems.filter(i => i.matched && i.unit_price > 0).length;
  const totalValue = processedItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showReview ? "Revisão do Orçamento" : "Importar Planilha de Orçamento"}
          </DialogTitle>
        </DialogHeader>

        {!showReview ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Arquivo da Planilha (.xlsx, .xls, .pdf)</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls,.pdf"
                onChange={handleFileChange}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                A planilha deve conter colunas com os seguintes dados:
                <br />
                <strong>• Descrição</strong> (ou Item, Material, Serviço)
                <br />
                <strong>• Quantidade</strong> (ou Qtd, Qtde)
                <br />
                <strong>• Unidade</strong> (ou Un, Und) - opcional, padrão: UN
                <br />
                <br />
                <strong>Formatos aceitos:</strong> Excel (.xlsx, .xls) ou PDF
                <br />
                Após importar, clique em "Buscar na Gestão de Preços" para precificar automaticamente.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={processFile} 
                disabled={!file || isProcessing}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? "Processando..." : "Importar Planilha"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {matchedCount} de {processedItems.length} itens precificados
                </p>
                <p className="text-2xl font-bold">
                  Total: R$ {totalValue.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant={matchedCount === processedItems.length ? "default" : "secondary"}>
                  {matchedCount === processedItems.length ? "Todos precificados" : "Revisão necessária"}
                </Badge>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Preço Unitário</TableHead>
                    <TableHead>Preço Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium max-w-xs" title={item.description}>
                        {item.description}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>
                        <span className={item.unit_price > 0 ? "font-semibold text-green-600" : "text-muted-foreground"}>
                          R$ {item.unit_price.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">
                        R$ {item.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={item.match_type === 'Encontrado' ? 'default' : 'destructive'}
                        >
                          {item.match_type || 'Não buscado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <div className="flex gap-2">
                <Button 
                  onClick={searchPrices}
                  disabled={isSearchingPrices || processedItems.every(i => i.matched && i.unit_price > 0)}
                  variant="secondary"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {isSearchingPrices ? "Buscando..." : "Buscar na Gestão de Preços"}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={handleExport}
                  disabled={importMutation.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar e Salvar
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Orçamento
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
