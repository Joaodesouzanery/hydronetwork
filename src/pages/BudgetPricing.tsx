import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Search, Download, Save, PlusCircle, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from 'xlsx';
import { extractPdfText } from "@/lib/pdfTextExtractor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SimilarMaterialApprovalDialog } from "@/components/materials/SimilarMaterialApprovalDialog";
import { AddMaterialDialog } from "@/components/materials/AddMaterialDialog";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";

interface ProcessedItem {
  description: string;
  cleanedDescription?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  unit_price_material: number;
  unit_price_labor: number;
  total: number;
  material_id: string | null;
  material_name?: string;
  matched: boolean;
  match_type?: string;
  similarity?: number;
  needsApproval?: boolean;
  approved?: boolean;
  originalRow?: any;
}

interface SimilarMaterial {
  material: any;
  similarity: number;
  matchType: string;
}

interface PendingApproval {
  index: number;
  description: string;
  match: SimilarMaterial;
}

const BudgetPricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearchingPrices, setIsSearchingPrices] = useState(false);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [showReview, setShowReview] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Approval flow states
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [currentApprovalIndex, setCurrentApprovalIndex] = useState(0);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showAddMaterialDialog, setShowAddMaterialDialog] = useState(false);
  const [notFoundItemToAdd, setNotFoundItemToAdd] = useState<{ index: number; description: string } | null>(null);

  const { data: budgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: materialsCatalog = [] } = useQuery({
    queryKey: ["materials-for-budget-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id,name,unit,material_price,labor_price,keywords_norm,description_norm,measurement")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // Stopwords (palavras irrelevantes)
  const STOPWORDS = new Set([
    'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'em', 'e', 'ou', 'a', 'o', 'os', 'as',
    'um', 'uma', 'fornecimento', 'servico', 'execucao', 'tipo'
  ]);

  // Dicionário de siglas
  const SIGLAS: Record<string, string[]> = {
    'art': ['anotacao de responsabilidade tecnica', 'anotacao responsabilidade tecnica'],
    'pcmso': ['programa de controle medico de saude ocupacional', 'programa controle medico saude ocupacional'],
    'aso': ['atestado de saude ocupacional', 'atestado saude ocupacional'],
    'ppp': ['perfil profissiografico previdenciario'],
    'epi': ['equipamento de protecao individual', 'equipamento protecao individual'],
    'epc': ['equipamento de protecao coletiva', 'equipamento protecao coletiva'],
    'mdo': ['mao de obra'],
    'mat': ['material'],
    'fck': ['resistencia caracteristica compressao']
  };

  // Dicionário de sinônimos
  const SINONIMOS: Record<string, string[]> = {
    'limpeza pos obra': ['limpeza final', 'pos obra', 'limpeza apos obra'],
    'limpeza final': ['limpeza pos obra', 'pos obra'],
    'concreto': ['concreto usinado', 'concreto estrutural'],
    'engenharia': ['servico tecnico', 'servicos tecnicos'],
    'mao de obra': ['servico', 'servicos', 'mdo'],
    'alvenaria': ['levantamento de parede', 'parede'],
    'demolicao': ['retirada', 'remocao']
  };

  // Palavras com peso maior (relevância)
  const PALAVRAS_RELEVANTES = new Set([
    'concreto', 'alvenaria', 'demolicao', 'art', 'limpeza', 'mao', 'obra',
    'engenharia', 'pintura', 'instalacao', 'eletrica', 'hidraulica', 'estrutural',
    'fundacao', 'revestimento', 'piso', 'telhado', 'cobertura'
  ]);

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ") // Remove símbolos
      .replace(/\d+/g, " ") // Remove números isolados
      .replace(/\s+/g, " ")
      .trim();
  };

  // Limpa descrição extraída - melhora identificação
  const cleanDescription = (text: string): string => {
    if (!text) return '';
    
    let cleaned = text
      // Remove códigos/números no início (ex: "1.1", "01.", "A1-", etc)
      .replace(/^[\d\.\-]+\s*/g, '')
      .replace(/^[A-Z]?\d+[\.\-\s]+/gi, '')
      // Remove referências a itens (ex: "(item 1)", "[ref: 123]")
      .replace(/\(item\s*\d+\)/gi, '')
      .replace(/\[ref[:\s]*\d+\]/gi, '')
      // Remove unidades no final entre parênteses
      .replace(/\s*\([^)]*(?:un|m2|m3|m|kg|l|pç|pc|cx|und|vb|cj|gb|mês)\s*\)$/gi, '')
      // Remove "fornecimento e instalação de" etc redundantes
      .replace(/^(?:fornecimento\s*(?:e\s*)?(?:instalação|execução|aplicação)\s*(?:de|do|da)?\s*)/gi, '')
      .replace(/^(?:serviço\s*(?:de|do|da)\s*)/gi, '')
      .replace(/^(?:execução\s*(?:de|do|da)\s*)/gi, '')
      // Limpa espaços extras
      .replace(/\s+/g, ' ')
      .trim();
    
    // Se ficou muito curto, usa o original
    if (cleaned.length < 3 && text.length > 3) {
      cleaned = text.trim();
    }
    
    return cleaned;
  };

  // Tokeniza e remove stopwords
  const tokenize = (text: string): string[] => {
    const normalized = normalizeText(text);
    return normalized
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOPWORDS.has(word));
  };

  // Expande siglas e sinônimos
  const expandText = (text: string): Set<string> => {
    const variations = new Set<string>();
    const normalized = normalizeText(text);
    variations.add(normalized);

    // Expande siglas
    for (const [sigla, expansoes] of Object.entries(SIGLAS)) {
      if (normalized.includes(sigla)) {
        expansoes.forEach(exp => variations.add(normalized.replace(sigla, exp)));
      }
      expansoes.forEach(exp => {
        if (normalized.includes(exp)) {
          variations.add(normalized.replace(exp, sigla));
        }
      });
    }

    // Expande sinônimos
    for (const [termo, sinonimos] of Object.entries(SINONIMOS)) {
      if (normalized.includes(termo)) {
        sinonimos.forEach(sin => variations.add(normalized.replace(termo, sin)));
      }
    }

    return variations;
  };

  // Calcula distância de Levenshtein
  const levenshteinDistance = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[len1][len2];
  };

  // Calcula similaridade ponderada por tokens
  const calculateSimilarity = (desc1: string, desc2: string): number => {
    const tokens1 = tokenize(desc1);
    const tokens2 = tokenize(desc2);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    let totalScore = 0;
    let maxScore = 0;

    tokens1.forEach(token1 => {
      const weight = PALAVRAS_RELEVANTES.has(token1) ? 2 : 1;
      maxScore += weight;

      let bestMatch = 0;
      tokens2.forEach(token2 => {
        const maxLen = Math.max(token1.length, token2.length);
        const distance = levenshteinDistance(token1, token2);
        const similarity = 1 - distance / maxLen;
        bestMatch = Math.max(bestMatch, similarity);
      });

      totalScore += bestMatch * weight;
    });

    return maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  };

  // Tokeniza texto em array de palavras-chave normalizadas
  const tokenizeKeywords = (text: string): string[] => {
    const normalized = normalizeText(text);
    const tokens = normalized.split(/[\s,|;]+/);
    return [...new Set(tokens.filter(t => t.length > 2))];
  };

  // Extrai medidas do texto (ex: "30m", "16mm", "4k")
  const extractMeasurements = (text: string): string[] => {
    const measurementPatterns = [
      /\d+(?:[.,]\d+)?(?:m|mm|cm|km|kg|g|l|ml|w|v|a|pol|\"|\')(?:\s|$)/gi,
      /\d+k\b/gi,
    ];
    
    const measurements: string[] = [];
    for (const pattern of measurementPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        measurements.push(...matches.map(m => normalizeText(m)));
      }
    }
    return [...new Set(measurements)];
  };

  // Calcula score de matching baseado em overlap de tokens
  const calculateKeywordMatchScore = (
    importedTokens: string[],
    catalogTokens: string[],
    importedMeasurements: string[],
    catalogMeasurements: string[],
    importedUnit?: string,
    catalogUnit?: string
  ): { score: number; matchedTokens: number } => {
    let score = 0;
    
    const matchedTokens = importedTokens.filter(t => catalogTokens.includes(t)).length;
    const totalTokens = Math.max(importedTokens.length, 1);
    const overlapPercentage = matchedTokens / totalTokens;
    
    // +70 se overlap >= 2 tokens OU >= 60% dos tokens
    if (matchedTokens >= 2 || overlapPercentage >= 0.6) {
      score += 70;
    } else if (matchedTokens >= 1) {
      score += 30;
    }
    
    // +20 se medida bater
    if (importedMeasurements.length > 0 && catalogMeasurements.length > 0) {
      const measurementMatch = importedMeasurements.some(m => 
        catalogMeasurements.some(cm => m === cm || cm.includes(m) || m.includes(cm))
      );
      if (measurementMatch) score += 20;
    }
    
    // +10 se unidade bater
    if (importedUnit && catalogUnit) {
      const normImportedUnit = normalizeText(importedUnit);
      const normCatalogUnit = normalizeText(catalogUnit);
      if (normImportedUnit === normCatalogUnit || 
          (normImportedUnit === "und" && normCatalogUnit === "un") ||
          (normImportedUnit === "un" && normCatalogUnit === "und")) {
        score += 10;
      }
    }
    
    return { score, matchedTokens };
  };

  const findMatchingMaterial = async (description: string, unit?: string) => {
    // Usa catálogo já carregado (evita N consultas ao backend e deixa a tela bem mais rápida)
    const materials = materialsCatalog as any[];
    if (!materials || materials.length === 0) return null;

    const normalizedDescription = normalizeText(description);
    const descVariations = expandText(description);
    const importedTokens = tokenizeKeywords(description);
    const importedMeasurements = extractMeasurements(description);

    // CAMADA 1: BUSCA EXATA
    const exactMatches: any[] = [];
    for (const variation of descVariations) {
      const matches = materials.filter(m => 
        normalizeText(m.name) === variation
      );
      exactMatches.push(...matches);
    }

    if (exactMatches.length > 0) {
      const matchWithPrice = exactMatches.find(m => {
        const matPrice = Number(m.material_price || 0);
        const labPrice = Number(m.labor_price || 0);
        return matPrice > 0 || labPrice > 0;
      });
      
      if (matchWithPrice) {
        console.log(`[MATCH EXATO COM PREÇO] ${description} → ${matchWithPrice.name}`);
        return { material: matchWithPrice, matchType: 'Exato', similarity: 100 };
      }
      
      console.log(`[MATCH EXATO SEM PREÇO] ${description} → ${exactMatches[0].name}`);
      return { material: exactMatches[0], matchType: 'Exato', similarity: 100 };
    }

    // CAMADA 2: BUSCA POR KEYWORDS NORMALIZADAS (PRIORIDADE!)
    interface KeywordCandidate {
      material: any;
      score: number;
      matchedTokens: number;
    }
    
    const keywordCandidates: KeywordCandidate[] = [];
    
    for (const m of materials) {
      const catalogTokens = (m.keywords_norm && m.keywords_norm.length > 0) 
        ? m.keywords_norm 
        : tokenizeKeywords(m.name);
      
      const catalogMeasurements = extractMeasurements(m.name);
      if (m.measurement) {
        catalogMeasurements.push(normalizeText(m.measurement));
      }
      
      const { score, matchedTokens } = calculateKeywordMatchScore(
        importedTokens,
        catalogTokens,
        importedMeasurements,
        catalogMeasurements,
        unit,
        m.unit
      );
      
      if (score >= 30) {
        keywordCandidates.push({ material: m, score, matchedTokens });
      }
    }
    
    keywordCandidates.sort((a, b) => b.score - a.score);
    
    if (keywordCandidates.length > 0) {
      const best = keywordCandidates[0];
      
      if (best.score >= 80) {
        console.log(`[MATCH KEYWORDS ${best.score}pts, ${best.matchedTokens} tokens] ${description} → ${best.material.name}`);
        return {
          material: best.material,
          similarity: Math.min(95, 70 + best.matchedTokens * 5),
          matchType: `Palavras-chave (${best.matchedTokens} tokens)`,
        };
      } else if (best.score >= 60) {
        console.log(`[MATCH KEYWORDS PARCIAL ${best.score}pts] ${description} → ${best.material.name}`);
        return {
          material: best.material,
          similarity: Math.min(85, 60 + best.matchedTokens * 5),
          matchType: `Possivelmente igual (${best.matchedTokens} tokens)`,
        };
      }
    }

    // CAMADA 3: BUSCA "CONTÉM" (fallback)
    const containsMatches: any[] = [];
    for (const variation of descVariations) {
      const matches = materials.filter(m => {
        const normalizedMaterialName = normalizeText(m.name);
        const materialVariations = expandText(m.name);
        
        for (const matVar of materialVariations) {
          if (variation.includes(matVar) || matVar.includes(variation)) {
            return true;
          }
        }
        
        return variation.includes(normalizedMaterialName) || 
               normalizedMaterialName.includes(variation);
      });
      containsMatches.push(...matches);
    }

    if (containsMatches.length > 0) {
      const uniqueMatches = Array.from(new Set(containsMatches.map(m => m.id)))
        .map(id => containsMatches.find(m => m.id === id)!);
      
      const matchWithPrice = uniqueMatches.find(m => {
        const matPrice = Number(m.material_price || 0);
        const labPrice = Number(m.labor_price || 0);
        return matPrice > 0 || labPrice > 0;
      });
      
      if (matchWithPrice) {
        console.log(`[MATCH PARCIAL COM PREÇO] ${description} → ${matchWithPrice.name}`);
        return { material: matchWithPrice, matchType: 'Parcial', similarity: 85 };
      }
      
      console.log(`[MATCH PARCIAL SEM PREÇO] ${description} → ${uniqueMatches[0].name}`);
      return { material: uniqueMatches[0], matchType: 'Parcial', similarity: 85 };
    }

    // CAMADA 4: BUSCA POR SIMILARIDADE LEVENSHTEIN (fallback)
    let bestMatch: { material: any; similarity: number } | null = null;

    materials.forEach(material => {
      const materialVariations = expandText(material.name);
      
      let maxSimilarity = 0;
      
      descVariations.forEach(descVar => {
        materialVariations.forEach(matVar => {
          const similarity = calculateSimilarity(descVar, matVar);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        });
      });

      const directSimilarity = calculateSimilarity(description, material.name);
      maxSimilarity = Math.max(maxSimilarity, directSimilarity);

      if (maxSimilarity >= 70 && (!bestMatch || maxSimilarity > bestMatch.similarity)) {
        bestMatch = { material, similarity: maxSimilarity };
      }
    });

    if (bestMatch) {
      console.log(`[MATCH SIMILARIDADE ${bestMatch.similarity.toFixed(1)}%] ${description} → ${bestMatch.material.name}`);
      return { 
        material: bestMatch.material, 
        matchType: 'Similaridade', 
        similarity: bestMatch.similarity 
      };
    }

    console.log(`[SEM MATCH] ${description}`);
    return null;
  };

  const coerceNumberBR = (v: unknown): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(
        v
          .replace(/R\$\s*/gi, "")
          .replace(/\./g, "")
          .replace(/,/g, ".")
          .replace(/[^0-9.-]/g, "")
          .trim(),
      );
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      let jsonData: any[] = [];

      // Verifica se é PDF
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        console.log('Processing PDF file...');

        // Caminho rápido e mais preciso: extrai texto no navegador e envia para o backend
        // (evita mandar o PDF inteiro para IA e elimina intermitência)
        let pdfText = "";
        try {
          pdfText = await extractPdfText(file);
        } catch (e) {
          console.warn("Falha ao extrair texto do PDF no navegador; tentando fallback.", e);
        }

        let pdfData: any;
        let pdfError: any;

        if (pdfText && pdfText.trim().length > 20) {
          ({ data: pdfData, error: pdfError } = await supabase.functions.invoke('extract-pdf-data', {
            body: { pdfText },
          }));
        } else {
          // Fallback: base64 (pode ser PDF escaneado). Mantém limite para evitar timeouts.
          const MAX_BYTES_FALLBACK = 5 * 1024 * 1024;
          if (file.size > MAX_BYTES_FALLBACK) {
            throw new Error(
              "Este PDF parece não ter texto selecionável e é grande demais para o processamento direto. Tente um PDF com texto (não escaneado) ou envie em Excel.",
            );
          }

          const arrayBuffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
          );

          ({ data: pdfData, error: pdfError } = await supabase.functions.invoke('extract-pdf-data', {
            body: { pdfBase64: base64 },
          }));
        }

        if (pdfError) {
          throw new Error(`Erro ao processar PDF: ${pdfError.message}`);
        }

        if (!pdfData?.items || pdfData.items.length === 0) {
          throw new Error('Nenhum dado encontrado no PDF');
        }

        jsonData = pdfData.items;
        console.log('PDF processed successfully:', jsonData.length, 'items found');
        
      } else {
        // Processa arquivo Excel
        console.log('Processing Excel file...');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log('Excel processed:', jsonData.length, 'rows found');
      }

      if (!jsonData || jsonData.length === 0) {
        throw new Error("O arquivo está vazio ou não pôde ser lido");
      }

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

      const isPdfImport = isPdf;

      for (let i = 0; i < jsonData.length; i++) {
        const rowData: any = jsonData[i];
        
        const rawDescription = findColumnValue(rowData, [
          'descricao', 'description', 'desc', 'item', 'material', 'servico'
        ]);
        
        // Limpa a descrição para melhor identificação
        const cleanedDesc = cleanDescription(rawDescription);
        
        const quantityStr = findColumnValue(rowData, [
          'quantidade', 'quantity', 'qtd', 'qtde'
        ]);
        let quantity = parseFloat(quantityStr.replace(',', '.')) || 0;
        if (quantity <= 0 && isPdfImport) quantity = 1;

        const unit = findColumnValue(rowData, [
          'unidade', 'unit', 'un', 'und'
        ]) || 'UN';

        // Preços (quando vierem do PDF/planilha)
        const materialPrice = coerceNumberBR(
          findColumnValue(rowData, ['preço material', 'preco material', 'material_price', 'preco mat', 'mat'])
        );
        const laborPrice = coerceNumberBR(
          findColumnValue(rowData, ['preço m.o.', 'preco m.o.', 'preço mo', 'preco mo', 'labor_price', 'mdo', 'mao de obra'])
        );
        const totalPrice = coerceNumberBR(
          findColumnValue(rowData, ['preço total', 'preco total', 'total', 'price', 'preco'])
        );

        const extractedUnitPrice = totalPrice || (materialPrice + laborPrice) || 0;

        if (!rawDescription || rawDescription.length < 2 || quantity <= 0) {
          continue;
        }

        // Cria item com descrição limpa para matching
        items.push({
          description: rawDescription,
          cleanedDescription: cleanedDesc,
          quantity,
          unit,
          unit_price: extractedUnitPrice,
          unit_price_material: materialPrice,
          unit_price_labor: laborPrice,
          total: extractedUnitPrice > 0 ? quantity * extractedUnitPrice : 0,
          material_id: null,
          matched: extractedUnitPrice > 0,
          needsApproval: false,
          approved: false,
          match_type: extractedUnitPrice > 0 ? 'Preço do arquivo' : 'Aguardando precificação',
          originalRow: rowData
        });
      }

      if (items.length === 0) {
        throw new Error("Nenhum item válido encontrado");
      }

      setProcessedItems(items);
      setShowReview(true);

      toast({
        title: "Planilha importada",
        description: `${items.length} itens carregados. Buscando preços automaticamente...`,
      });

      // Busca preços automaticamente após importação
      setIsProcessing(false);
      await searchPricesAutomatically(items);

    } catch (error: any) {
      toast({
        title: "Erro ao processar arquivo",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const searchPricesAutomatically = async (items: ProcessedItem[]) => {
    setIsSearchingPrices(true);
    try {
      const updatedItems: ProcessedItem[] = [];
      const pendingApprovalsList: PendingApproval[] = [];
      let foundCount = 0;
      let notFoundCount = 0;
      let pendingCount = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        const hasImportedPrice =
          (item.unit_price_material || 0) > 0 ||
          (item.unit_price_labor || 0) > 0 ||
          (item.unit_price || 0) > 0;

        // Se já veio com preço do arquivo, a gente só tenta identificar o material (sem sobrescrever preços)
        if (hasImportedPrice) {
          const searchDesc = item.cleanedDescription || item.description;
          const match = await findMatchingMaterial(searchDesc, item.unit);

          if (match) {
            updatedItems.push({
              ...item,
              material_id: match.material.id,
              material_name: match.material.name,
              matched: true,
              match_type: 'Preço do arquivo (identificado)',
              total: item.quantity * (item.unit_price || ((item.unit_price_material || 0) + (item.unit_price_labor || 0))),
            });
          } else {
            updatedItems.push({
              ...item,
              matched: true,
              match_type: 'Preço do arquivo',
              total: item.quantity * (item.unit_price || ((item.unit_price_material || 0) + (item.unit_price_labor || 0))),
            });
          }
          foundCount++;
          continue;
        }

        // Usa descrição limpa para melhor matching
        const searchDesc = item.cleanedDescription || item.description;
        const match = await findMatchingMaterial(searchDesc);
        
        if (match) {
          const material = match.material;
          const materialPrice = (material.material_price ?? 0) as number;
          const laborPrice = (material.labor_price ?? 0) as number;
          const totalUnitPrice = materialPrice + laborPrice;
          const hasValidPrice = totalUnitPrice > 0;

          // Se for match por similaridade (não exato), precisa de aprovação
          const needsUserApproval = match.matchType === 'Similaridade' || match.matchType === 'Parcial';

          let matchTypeLabel = '';
          if (match.matchType === 'Exato') {
            matchTypeLabel = 'Encontrado (exato)';
          } else if (match.matchType === 'Parcial') {
            matchTypeLabel = `Aguardando aprovação (parcial)`;
          } else if (match.matchType === 'Similaridade') {
            matchTypeLabel = `Aguardando aprovação (${match.similarity.toFixed(0)}%)`;
          }

          const newItem: ProcessedItem = {
            ...item,
            unit_price: needsUserApproval ? 0 : (hasValidPrice ? totalUnitPrice : 0),
            unit_price_material: needsUserApproval ? 0 : materialPrice,
            unit_price_labor: needsUserApproval ? 0 : laborPrice,
            total: needsUserApproval ? 0 : (hasValidPrice ? item.quantity * totalUnitPrice : 0),
            material_id: needsUserApproval ? null : material.id,
            material_name: needsUserApproval ? undefined : material.name,
            matched: needsUserApproval ? false : hasValidPrice,
            match_type: needsUserApproval ? matchTypeLabel : (hasValidPrice ? matchTypeLabel : 'Preço não cadastrado'),
            similarity: match.similarity,
            needsApproval: needsUserApproval && hasValidPrice,
            approved: false,
          };
          
          updatedItems.push(newItem);

          if (needsUserApproval && hasValidPrice) {
            pendingApprovalsList.push({
              index: i,
              description: item.description,
              match: {
                material,
                similarity: match.similarity,
                matchType: match.matchType
              }
            });
            pendingCount++;
          } else if (hasValidPrice) {
            foundCount++;
          } else {
            notFoundCount++;
          }
        } else {
          updatedItems.push({
            ...item,
            matched: false,
            match_type: 'Não encontrado',
          });
          notFoundCount++;
        }
      }

      setProcessedItems(updatedItems);

      // Se há itens pendentes de aprovação, mostra o dialog
      if (pendingApprovalsList.length > 0) {
        setPendingApprovals(pendingApprovalsList);
        setCurrentApprovalIndex(0);
        setShowApprovalDialog(true);
        
        toast({
          title: "Revisão necessária",
          description: `${pendingCount} itens encontrados por similaridade precisam da sua aprovação.`,
        });
      } else {
        toast({
          title: "Precificação automática concluída",
          description: `${foundCount} itens precificados automaticamente e ${notFoundCount} não encontrados.`,
        });
      }

    } catch (error: any) {
      toast({
        title: "Erro ao buscar preços",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearchingPrices(false);
    }
  };

  // Approval handlers
  const handleApproval = (approve: boolean) => {
    const pending = pendingApprovals[currentApprovalIndex];
    if (!pending) return;

    const material = pending.match.material;
    const materialPrice = (material.material_price ?? 0) as number;
    const laborPrice = (material.labor_price ?? 0) as number;
    const totalUnitPrice = materialPrice + laborPrice;

    setProcessedItems(prev => {
      const updated = [...prev];
      const itemIndex = pending.index;
      
      if (approve) {
        updated[itemIndex] = {
          ...updated[itemIndex],
          unit_price: totalUnitPrice,
          unit_price_material: materialPrice,
          unit_price_labor: laborPrice,
          total: updated[itemIndex].quantity * totalUnitPrice,
          material_id: material.id,
          material_name: material.name,
          matched: true,
          match_type: `Aprovado (${pending.match.similarity.toFixed(0)}%)`,
          needsApproval: false,
          approved: true,
        };
      } else {
        updated[itemIndex] = {
          ...updated[itemIndex],
          match_type: 'Rejeitado - buscar manualmente',
          needsApproval: false,
          approved: false,
        };
      }
      return updated;
    });

    moveToNextApproval();
  };

  const handleSkipApproval = () => {
    moveToNextApproval();
  };

  const moveToNextApproval = () => {
    if (currentApprovalIndex < pendingApprovals.length - 1) {
      setCurrentApprovalIndex(prev => prev + 1);
    } else {
      setShowApprovalDialog(false);
      setPendingApprovals([]);
      setCurrentApprovalIndex(0);
      
      toast({
        title: "Revisão concluída",
        description: "Todos os itens similares foram revisados.",
      });
    }
  };

  // Handler para quando um novo material é criado no dialog de aprovação
  const handleNewMaterialCreated = (material: any) => {
    const pending = pendingApprovals[currentApprovalIndex];
    if (!pending) return;

    const materialPrice = Number(material.material_price || 0);
    const laborPrice = Number(material.labor_price || 0);
    const totalUnitPrice = materialPrice + laborPrice;

    setProcessedItems(prev => {
      const updated = [...prev];
      const itemIndex = pending.index;
      
      updated[itemIndex] = {
        ...updated[itemIndex],
        unit_price: totalUnitPrice,
        unit_price_material: materialPrice,
        unit_price_labor: laborPrice,
        total: updated[itemIndex].quantity * totalUnitPrice,
        material_id: material.id,
        material_name: material.name,
        matched: true,
        match_type: 'Cadastrado manualmente',
        needsApproval: false,
        approved: true,
      };
      return updated;
    });

    moveToNextApproval();
  };

  // Handler para cadastrar material de item "Não encontrado"
  const handleAddNotFoundMaterial = (index: number, description: string) => {
    setNotFoundItemToAdd({ index, description });
    setShowAddMaterialDialog(true);
  };

  // Callback quando material é criado para item "Não encontrado"
  const handleNotFoundMaterialCreated = () => {
    // O material foi criado, agora vamos buscar os preços novamente apenas para esse item
    if (notFoundItemToAdd !== null) {
      toast({
        title: "Material cadastrado!",
        description: "Clique em 'Buscar Preços Novamente' para atualizar os valores.",
      });
    }
    setNotFoundItemToAdd(null);
    setShowAddMaterialDialog(false);
  };

  const searchPrices = async () => {
    await searchPricesAutomatically(processedItems);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBudgetId) {
        throw new Error("Selecione um orçamento");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: existingItems } = await supabase
        .from('budget_items')
        .select('item_number')
        .eq('budget_id', selectedBudgetId)
        .order('item_number', { ascending: false })
        .limit(1);

      const startNumber = existingItems && existingItems.length > 0 
        ? existingItems[0].item_number + 1 
        : 1;

      const itemsToInsert = processedItems.map((item, index) => ({
        budget_id: selectedBudgetId,
        item_number: startNumber + index,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unit_price_material: item.unit_price_material || 0,
        unit_price_labor: item.unit_price_labor || 0,
        bdi_percentage: 0,
        subtotal_material: item.quantity * (item.unit_price_material || 0),
        subtotal_labor: item.quantity * (item.unit_price_labor || 0),
        subtotal_bdi: 0,
        total: item.total,
        material_id: item.material_id || null,
        price_at_creation: item.unit_price || null
      }));

      const { error } = await supabase
        .from('budget_items')
        .insert(itemsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-items'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({
        title: "Sucesso",
        description: "Orçamento salvo com sucesso!",
      });
      handleReset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    // Prepara dados com numeração de item
    const exportData = processedItems.map((item, index) => ({
      'Item': index + 1,
      'Descrição': item.description,
      'Qtde': item.quantity,
      'Unid.': item.unit,
      'Preço Unitário: Preço do Material (MAT)': Number(item.unit_price_material || 0).toFixed(2),
      'Preço da Mão de Obra (MDO)': Number(item.unit_price_labor || 0).toFixed(2),
      'Preço Unitário Total': Number(item.unit_price || 0).toFixed(2),
      'Total do Item': Number(item.total || 0).toFixed(2),
      'Status Precificação': item.match_type || 'Não buscado',
    }));

    // Adiciona linha de total
    const totalRow: any = {
      'Item': '',
      'Descrição': 'TOTAL GERAL',
      'Qtde': '',
      'Unid.': '',
      'Preço Unitário: Preço do Material (MAT)': '',
      'Preço da Mão de Obra (MDO)': '',
      'Preço Unitário Total': '',
      'Total do Item': totalValue.toFixed(2),
      'Status Precificação': '',
    };
    exportData.push(totalRow);

    // Cria planilha
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Define larguras das colunas
    const colWidths = [
      { wch: 6 },   // Item
      { wch: 50 },  // Descrição
      { wch: 10 },  // Qtde
      { wch: 8 },   // Unid.
      { wch: 18 },  // MAT
      { wch: 18 },  // MDO
      { wch: 18 },  // Preço Unitário Total
      { wch: 15 },  // Total do Item
      { wch: 25 },  // Status
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orçamento Precificado');
    
    const fileName = file?.name.replace(/\.(xlsx|xls|pdf)$/i, '') || 'orcamento';
    XLSX.writeFile(wb, `${fileName}_precificado_${new Date().getTime()}.xlsx`);

    toast({
      title: "Sucesso",
      description: "Planilha exportada com formatação organizada!",
    });
  };

  const handleReset = () => {
    setFile(null);
    setProcessedItems([]);
    setShowReview(false);
    setSelectedBudgetId("");
  };

  const matchedCount = processedItems.filter(i => 
    i.matched && i.unit_price > 0
  ).length;
  const totalValue = processedItems.reduce((sum, item) => sum + item.total, 0);

  const tutorialSteps = [
    {
      title: "Importe sua planilha",
      description: "Envie um Excel ou PDF com descrição, quantidade e unidade para buscar preços na sua base privada."
    },
    {
      title: "Revise os matches",
      description: "Verifique itens que foram precificados automaticamente e ajuste os que ficaram pendentes."
    },
    {
      title: "Aprove similaridades",
      description: "Quando houver dúvida de correspondência, confirme o material correto ou cadastre um novo."
    },
    {
      title: "Exporte a planilha precificada",
      description: "Baixe a planilha final com preços aplicados e totais calculados."
    }
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/budgets')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Precificação Privada</h1>
              <p className="text-muted-foreground">Importe uma planilha (Excel ou PDF) e busque preços na sua base privada</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => setShowTutorial(true)}>
            <BookOpen className="h-4 w-4 mr-2" />
            Tutorial
          </Button>
        </div>

        {!showReview ? (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-4 p-6 border rounded-lg bg-card">
              <div className="space-y-2">
                <Label htmlFor="file">Arquivo da Planilha (.xlsx, .xls, .pdf)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls,.pdf"
                  onChange={handleFileChange}
                />
                <p className="text-sm text-muted-foreground">
                  Colunas obrigatórias: <strong>Descrição</strong>, <strong>Quantidade</strong> e <strong>Unidade</strong>
                  <br />
                  Os preços MAT e MDO serão buscados automaticamente na <strong>Gestão de Preços</strong>
                  <br />
                  <strong>Formatos aceitos:</strong> Excel (.xlsx, .xls) ou PDF
                </p>
              </div>

              <Button 
                onClick={processFile} 
                disabled={!file || isProcessing}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? "Processando..." : "Importar Planilha"}
              </Button>
            </div>

            <PageTutorialButton pageKey="budget-pricing" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {matchedCount} de {processedItems.length} itens precificados
                </p>
                <p className="text-2xl font-bold">
                  Total: R$ {totalValue.toFixed(2)}
                </p>
              </div>
              <Badge variant={matchedCount === processedItems.length ? "default" : "secondary"}>
                {matchedCount === processedItems.length ? "Todos precificados" : "Revisão necessária"}
              </Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Item</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Un</TableHead>
                    <TableHead>Preço MAT</TableHead>
                    <TableHead>Preço MDO</TableHead>
                    <TableHead>Preço Unit. Total</TableHead>
                    <TableHead>Preço Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium max-w-xs" title={item.description}>
                        {item.description}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>
                        <span className={item.unit_price_material > 0 ? "text-blue-600" : "text-muted-foreground"}>
                          R$ {item.unit_price_material.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={item.unit_price_labor > 0 ? "text-orange-600" : "text-muted-foreground"}>
                          R$ {item.unit_price_labor.toFixed(2)}
                        </span>
                      </TableCell>
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
                          variant={
                            item.match_type?.startsWith('Encontrado (exato)') ? 'default' :
                            item.match_type?.startsWith('Aprovado') ? 'default' :
                            item.match_type?.startsWith('Aguardando aprovação') ? 'secondary' :
                            item.match_type === 'Aguardando precificação' ? 'outline' :
                            'destructive'
                          }
                        >
                          {item.match_type || 'Não encontrado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Seção de itens Não Encontrados */}
            {processedItems.filter(i => i.match_type === 'Não encontrado' || i.match_type?.startsWith('Rejeitado')).length > 0 && (
              <div className="p-4 border rounded-lg bg-destructive/5 border-destructive/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-destructive">
                      Itens Não Encontrados ({processedItems.filter(i => i.match_type === 'Não encontrado' || i.match_type?.startsWith('Rejeitado')).length})
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Cadastre esses materiais na Gestão de Preços para precificá-los
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/prices')}
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Abrir Gestão de Preços
                  </Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {processedItems.map((item, index) => (
                    (item.match_type === 'Não encontrado' || item.match_type?.startsWith('Rejeitado')) && (
                      <div key={index} className="flex items-center justify-between p-3 bg-background rounded border">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" title={item.description}>
                            {index + 1}. {item.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} {item.unit}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => handleAddNotFoundMaterial(index, item.description)}
                        >
                          <PlusCircle className="h-3 w-3 mr-1" />
                          Cadastrar
                        </Button>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Salvar em qual orçamento? (opcional)</Label>
                <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um orçamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets?.map((budget) => (
                      <SelectItem key={budget.id} value={budget.id}>
                        {budget.name} {budget.budget_number ? `(${budget.budget_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={handleReset}>
                  Nova Importação
                </Button>
                <div className="flex gap-2">
                  <Button 
                    onClick={searchPrices}
                    disabled={isSearchingPrices}
                    variant="secondary"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {isSearchingPrices ? "Buscando..." : "Buscar Preços Novamente"}
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={handleExport}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                  {selectedBudgetId && (
                    <Button 
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar no Orçamento
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Dialog de aprovação de materiais similares */}
      <SimilarMaterialApprovalDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        pending={pendingApprovals[currentApprovalIndex] || null}
        onApprove={() => handleApproval(true)}
        onReject={() => handleApproval(false)}
        onSkip={handleSkipApproval}
        onNewMaterialCreated={handleNewMaterialCreated}
        totalPending={pendingApprovals.length}
        currentIndex={currentApprovalIndex}
      />

      {/* Dialog para cadastrar material de item Não Encontrado */}
      <AddMaterialDialog
        open={showAddMaterialDialog}
        onOpenChange={(open) => {
          setShowAddMaterialDialog(open);
          if (!open) {
            handleNotFoundMaterialCreated();
          }
        }}
        initialName={notFoundItemToAdd?.description}
      />
    </div>
  );
};

export default BudgetPricing;
