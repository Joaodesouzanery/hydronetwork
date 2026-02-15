import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Save, X, CheckCircle, AlertCircle, Check, SkipForward, Plus, Trash2, Settings2, DollarSign, Building2, FolderOpen, Download, Edit2, Tag } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

interface MaterialImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExtractedMaterial {
  name: string;
  description?: string;
  unit: string;
  quantity?: number;
  current_price?: number;
  material_price?: number;
  labor_price?: number;
  category?: string;
  supplier?: string;
  keywords?: string[];
  existingMaterial?: any;
  similarity?: number;
  matchType?: string;
  needsApproval?: boolean;
  approved?: boolean;
  isNew?: boolean;
  isExactDuplicate?: boolean;
  hasPriceChange?: boolean;
  newPrice?: number;
  newMaterialPrice?: number;
  newLaborPrice?: number;
}

export const MaterialImportDialog = ({ open, onOpenChange }: MaterialImportDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedMaterials, setExtractedMaterials] = useState<ExtractedMaterial[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [pendingApprovalIndex, setPendingApprovalIndex] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showBulkPriceDialog, setShowBulkPriceDialog] = useState(false);
  const [showBulkSupplierDialog, setShowBulkSupplierDialog] = useState(false);
  const [showBulkCategoryDialog, setShowBulkCategoryDialog] = useState(false);
  const [bulkPriceOperation, setBulkPriceOperation] = useState<'set' | 'increase_percent' | 'decrease_percent'>('increase_percent');
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkSupplier, setBulkSupplier] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [isEditingKeywords, setIsEditingKeywords] = useState(false);
  const [editingKeywordsValue, setEditingKeywordsValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  type MaterialRow = Record<string, any> & {
    id: string;
    name: string;
    current_price?: number | null;
    material_price?: number | null;
    labor_price?: number | null;
    keywords?: string[] | null;
    keywords_norm?: string[] | null;
    description_norm?: string | null;
    category?: string | null;
    measurement?: string | null;
  };

  const catalogRef = useRef<MaterialRow[]>([]);

  const fetchMaterialsCatalog = async (): Promise<MaterialRow[]> => {
    // Inclui keywords_norm e description_norm para matching por tokens
    const { data, error } = await supabase
      .from("materials")
      .select("id,name,unit,current_price,material_price,labor_price,keywords,keywords_norm,description_norm,category,measurement");
    if (error) throw error;
    return (data || []) as MaterialRow[];
  };

  const { data: existingMaterials = [] } = useQuery<MaterialRow[]>({
    queryKey: ["materials-for-import"],
    queryFn: fetchMaterialsCatalog,
    staleTime: 0,
  });

  // Busca palavras-chave customizadas do tipo "material" para identificar sinônimos
  const { data: customMaterialKeywords = [] } = useQuery({
    queryKey: ["custom-material-keywords"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_keywords")
        .select("keyword_value, synonyms")
        .eq("keyword_type", "material");
      if (error) throw error;
      return (data || []) as Array<{ keyword_value: string; synonyms: string[] | null }>;
    },
    staleTime: 0,
  });

  // Ref para custom keywords
  const customKeywordsRef = useRef<Array<{ keyword_value: string; synonyms: string[] | null }>>([]);
  
  useEffect(() => {
    customKeywordsRef.current = customMaterialKeywords;
  }, [customMaterialKeywords]);

  useEffect(() => {
    catalogRef.current = existingMaterials;
  }, [existingMaterials]);

  const getFreshCatalog = async (): Promise<MaterialRow[]> => {
    try {
      const catalog = await queryClient.fetchQuery<MaterialRow[]>({
        queryKey: ["materials-for-import"],
        queryFn: fetchMaterialsCatalog,
      });
      catalogRef.current = catalog || [];
      return catalog || [];
    } catch {
      catalogRef.current = existingMaterials;
      return existingMaterials;
    }
  };
  // Normaliza texto removendo acentos, caracteres especiais e espaços extras
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Tokeniza texto em array de palavras-chave normalizadas
  const tokenizeKeywords = (text: string): string[] => {
    const normalized = normalizeText(text);
    // Divide por espaço, vírgula, pipe e ponto-e-vírgula
    const tokens = normalized.split(/[\s,|;]+/);
    // Remove tokens vazios, duplicados e com menos de 3 caracteres
    const uniqueTokens = [...new Set(tokens.filter(t => t.length > 2))];
    return uniqueTokens;
  };

  // Extrai medidas do texto (ex: "30m", "16mm", "4k", "2.0")
  const extractMeasurements = (text: string): string[] => {
    const normalized = normalizeText(text);
    // Padrões para medidas: números seguidos de unidades ou formatos específicos
    const measurementPatterns = [
      /\d+(?:[.,]\d+)?(?:m|mm|cm|km|kg|g|l|ml|w|v|a|pol|\"|\')(?:\s|$)/gi,
      /\d+k\b/gi, // 4k
      /\d+(?:\.\d+)?(?:mm|cm|m)\b/gi,
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
    catalogUnit?: string,
    importedCategory?: string,
    catalogCategory?: string
  ): { score: number; matchedTokens: number; totalTokens: number } => {
    let score = 0;
    
    // Conta tokens em comum
    const matchedTokens = importedTokens.filter(t => catalogTokens.includes(t)).length;
    const totalTokens = Math.max(importedTokens.length, 1);
    const overlapPercentage = matchedTokens / totalTokens;
    
    // +70 se overlap >= 2 tokens OU >= 60% dos tokens
    if (matchedTokens >= 2 || overlapPercentage >= 0.6) {
      score += 70;
    } else if (matchedTokens >= 1) {
      // Bonus parcial para 1 token em comum
      score += 30;
    }
    
    // +20 se medida bater (ex: 30m, 16mm)
    if (importedMeasurements.length > 0 && catalogMeasurements.length > 0) {
      const measurementMatch = importedMeasurements.some(m => 
        catalogMeasurements.some(cm => m === cm || cm.includes(m) || m.includes(cm))
      );
      if (measurementMatch) {
        score += 20;
      }
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
    
    // +10 se categoria bater (se existir)
    if (importedCategory && catalogCategory) {
      const normImportedCat = normalizeText(importedCategory);
      const normCatalogCat = normalizeText(catalogCategory);
      if (normImportedCat === normCatalogCat || 
          normImportedCat.includes(normCatalogCat) || 
          normCatalogCat.includes(normImportedCat)) {
        score += 10;
      }
    }
    
    return { score, matchedTokens, totalTokens };
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const invokeExtractPdfData = async (
    body: Record<string, any> | ArrayBuffer,
  ): Promise<{ items: any[] }> => {
    let last: { error: any; response?: Response } | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);

      try {
        const { data, error, response } = await supabase.functions.invoke("extract-pdf-data", {
          body,
          signal: controller.signal,
        });

        if (!error) return (data || { items: [] }) as { items: any[] };

        last = { error, response };

        const status = response?.status;
        const retryable =
          error?.name === "FunctionsFetchError" ||
          (typeof status === "number" && [502, 503, 504].includes(status));

        if (!retryable || attempt === 3) break;
        await sleep(600 * attempt);
      } finally {
        clearTimeout(timeout);
      }
    }

    if (last?.response) {
      let text = "";
      try {
        text = await last.response.text();
      } catch {
        // ignore
      }
      throw new Error(text ? `${last.response.status} ${text}` : `HTTP ${last.response.status}`);
    }

    const msg = typeof last?.error?.message === "string" ? last.error.message : "Falha ao processar PDF";
    const ctx = typeof last?.error?.context?.message === "string" ? ` (${last.error.context.message})` : "";
    throw new Error(`${msg}${ctx}`);
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

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

  const calculateSimilarity = (text1: string, text2: string): number => {
    const norm1 = normalizeText(text1);
    const norm2 = normalizeText(text2);
    
    if (norm1 === norm2) return 100;
    
    const maxLen = Math.max(norm1.length, norm2.length);
    const distance = levenshteinDistance(norm1, norm2);
    return Math.max(0, (1 - distance / maxLen) * 100);
  };

  const findSimilarMaterial = (
    name: string,
    importedPrice?: number,
    importedMaterialPrice?: number,
    importedLaborPrice?: number,
    importedUnit?: string,
    importedKeywords?: string[],
    importedCategory?: string
  ): {
    material: any;
    similarity: number;
    matchType: string;
    isExactDuplicate?: boolean;
    hasPriceChange?: boolean;
    matchScore?: number;
    matchedTokens?: number;
  } | null => {
    const catalog = (catalogRef.current && catalogRef.current.length > 0)
      ? catalogRef.current
      : (existingMaterials || []);

    if (catalog.length === 0) return null;

    const normalizedName = normalizeText(name);
    const normalizedUnit = normalizeText(importedUnit || 'un');
    
    // Tokeniza o nome importado para matching por keywords
    const importedTokens = tokenizeKeywords(name);
    // Adiciona keywords importadas aos tokens
    if (importedKeywords && importedKeywords.length > 0) {
      for (const kw of importedKeywords) {
        const kwTokens = tokenizeKeywords(kw);
        for (const t of kwTokens) {
          if (!importedTokens.includes(t)) {
            importedTokens.push(t);
          }
        }
      }
    }
    
    // Extrai medidas do nome importado
    const importedMeasurements = extractMeasurements(name);

    // ========== 1. BUSCA EXATA - considera nome E unidade ==========
    const exactMatch = catalog.find((m) => {
      const catName = normalizeText(m.name);
      const catUnit = normalizeText(m.unit || 'un');
      return catName === normalizedName && catUnit === normalizedUnit;
    });
    
    if (exactMatch) {
      const existingTotal = (exactMatch.material_price || 0) + (exactMatch.labor_price || 0);
      const newTotal =
        (importedMaterialPrice || 0) + (importedLaborPrice || 0) || importedPrice || 0;
      const hasPriceChange = newTotal > 0 && Math.abs(existingTotal - newTotal) > 0.01;

      return {
        material: exactMatch,
        similarity: 100,
        matchType: "Exato",
        isExactDuplicate: true,
        hasPriceChange,
        matchScore: 100,
      };
    }

    // ========== 2. BUSCA POR NOME (sem unidade) ==========
    const nameOnlyMatch = catalog.find((m) => normalizeText(m.name) === normalizedName);
    if (nameOnlyMatch) {
      return {
        material: nameOnlyMatch,
        similarity: 95,
        matchType: "Mesmo nome, unidade diferente",
        isExactDuplicate: false,
        hasPriceChange: false,
        matchScore: 95,
      };
    }

    // ========== 3. BUSCA POR SINÔNIMOS CUSTOMIZADOS ==========
    const customKeywords = customKeywordsRef.current || [];
    for (const customKw of customKeywords) {
      const normalizedKwValue = normalizeText(customKw.keyword_value);
      const allSynonyms = [normalizedKwValue, ...(customKw.synonyms || []).map((s) => normalizeText(s))];
      
      let matchedSynonym: string | null = null;
      for (const syn of allSynonyms) {
        if (syn.length > 3 && normalizedName.includes(syn)) {
          matchedSynonym = syn;
          break;
        }
      }
      
      if (matchedSynonym) {
        const synonymMatch = catalog.find((m) => {
          const normalizedMatName = normalizeText(m.name);
          const materialKeywords = (m.keywords || []).map((k: string) => normalizeText(k));
          
          for (const syn of allSynonyms) {
            if (syn.length > 3) {
              if (normalizedMatName.includes(syn)) return true;
              if (materialKeywords.some((kw) => kw.includes(syn) || syn.includes(kw))) return true;
            }
          }
          return false;
        });
        
        if (synonymMatch) {
          return {
            material: synonymMatch,
            similarity: 92,
            matchType: "Sinônimo customizado",
            isExactDuplicate: false,
            hasPriceChange: false,
            matchScore: 92,
          };
        }
      }
    }

    // ========== 4. BUSCA POR SCORE DE KEYWORDS NORMALIZADAS (PRIORIDADE!) ==========
    // Esta é a busca principal baseada em overlap de tokens
    interface KeywordCandidate {
      material: MaterialRow;
      score: number;
      matchedTokens: number;
      totalTokens: number;
    }
    
    const keywordCandidates: KeywordCandidate[] = [];
    
    for (const m of catalog) {
      // Usa keywords_norm se disponível, senão tokeniza do nome
      const catalogTokens = (m.keywords_norm && m.keywords_norm.length > 0) 
        ? m.keywords_norm 
        : tokenizeKeywords(m.name);
      
      // Extrai medidas do material do catálogo
      const catalogMeasurements = extractMeasurements(m.name);
      if (m.measurement) {
        catalogMeasurements.push(normalizeText(m.measurement));
      }
      
      const { score, matchedTokens, totalTokens } = calculateKeywordMatchScore(
        importedTokens,
        catalogTokens,
        importedMeasurements,
        catalogMeasurements,
        importedUnit,
        m.unit,
        importedCategory,
        m.category || undefined
      );
      
      // Score mínimo de 30 para considerar (pelo menos 1 token em comum)
      if (score >= 30) {
        keywordCandidates.push({ material: m, score, matchedTokens, totalTokens });
      }
    }
    
    // Ordena por score decrescente
    keywordCandidates.sort((a, b) => b.score - a.score);
    
    if (keywordCandidates.length > 0) {
      const best = keywordCandidates[0];
      
      // Score >= 80: "Mesmo material" (alta confiança)
      // Score >= 60: "Material possivelmente igual" (média confiança)
      // Score >= 30: "Palavra-chave similar" (baixa confiança)
      
      if (best.score >= 80) {
        return {
          material: best.material,
          similarity: Math.min(95, 70 + best.matchedTokens * 5),
          matchType: `Palavras-chave (${best.matchedTokens} tokens)`,
          isExactDuplicate: false,
          hasPriceChange: false,
          matchScore: best.score,
          matchedTokens: best.matchedTokens,
        };
      } else if (best.score >= 60) {
        return {
          material: best.material,
          similarity: Math.min(85, 60 + best.matchedTokens * 5),
          matchType: `Possivelmente igual (${best.matchedTokens} tokens)`,
          isExactDuplicate: false,
          hasPriceChange: false,
          matchScore: best.score,
          matchedTokens: best.matchedTokens,
        };
      } else if (best.score >= 30) {
        return {
          material: best.material,
          similarity: Math.min(70, 40 + best.matchedTokens * 10),
          matchType: `Palavra-chave similar`,
          isExactDuplicate: false,
          hasPriceChange: false,
          matchScore: best.score,
          matchedTokens: best.matchedTokens,
        };
      }
    }

    // ========== 5. BUSCA PARCIAL (fallback) ==========
    const partialMatch = catalog.find((m) => {
      const normalizedMat = normalizeText(m.name);
      return normalizedName.includes(normalizedMat) || normalizedMat.includes(normalizedName);
    });
    if (partialMatch) {
      return { 
        material: partialMatch, 
        similarity: 85, 
        matchType: "Parcial",
        matchScore: 50,
      };
    }

    // ========== 6. BUSCA POR SIMILARIDADE LEVENSHTEIN (fallback) ==========
    let bestMatch: { material: any; similarity: number } | null = null;
    catalog.forEach((m) => {
      const similarity = calculateSimilarity(name, m.name);
      if (similarity >= 60 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { material: m, similarity };
      }
    });

    if (bestMatch) {
      return {
        material: bestMatch.material,
        similarity: bestMatch.similarity,
        matchType: "Similaridade",
        matchScore: Math.round(bestMatch.similarity * 0.5),
      };
    }

    return null;
  };

  const normalizeImportKeyText = (text: string) => {
    return normalizeText(
      text
        // remove apenas tokens monetários “colados” com R$ (sem afetar medidas tipo 01,00)
        .replace(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/gi, " ")
        .replace(/\d{1,3}(?:\.\d{3})*,\d{2}\s*R\$/gi, " ")
        .replace(/\bR\$\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
  };

  const getImportKey = (name: string, unit?: string) => {
    const safeUnit = unit || "UN";
    const normalizedUnit = normalizeText(safeUnit) === "und" ? "un" : normalizeText(safeUnit);
    return `${normalizeImportKeyText(name)}|${normalizedUnit}`;
  };

  const mergeImportedMaterial = (base: ExtractedMaterial, incoming: ExtractedMaterial): ExtractedMaterial => {
    const pickNonEmpty = (a?: string | null, b?: string | null) => (a && a.trim() ? a : (b && b.trim() ? b : a)) as any;
    const pickPositive = (a?: number | null, b?: number | null) => ((a ?? 0) > 0 ? a : (b ?? 0) > 0 ? b : a) as any;

    const mergedKeywords = Array.from(
      new Set([...(base.keywords || []), ...(incoming.keywords || [])].map((k) => normalizeText(k)).filter(Boolean))
    );

    return {
      ...base,
      // mantém o nome “mais completo”
      name: (incoming.name?.length || 0) > (base.name?.length || 0) ? incoming.name : base.name,
      description: pickNonEmpty(base.description, incoming.description),
      supplier: pickNonEmpty(base.supplier, incoming.supplier),
      category: pickNonEmpty(base.category, incoming.category),
      quantity: Math.max(base.quantity ?? 0, incoming.quantity ?? 0) || base.quantity || incoming.quantity,
      material_price: pickPositive(base.material_price, incoming.material_price),
      labor_price: pickPositive(base.labor_price, incoming.labor_price),
      current_price: pickPositive(base.current_price, incoming.current_price),
      keywords: mergedKeywords,
    };
  };

  const dedupeImportedMaterials = (materials: ExtractedMaterial[]) => {
    const indexByKey = new Map<string, number>();
    const deduped: ExtractedMaterial[] = [];
    let duplicatesMerged = 0;

    for (const m of materials) {
      const key = getImportKey(m.name, m.unit);
      const idx = indexByKey.get(key);

      if (idx === undefined) {
        indexByKey.set(key, deduped.length);
        deduped.push(m);
        continue;
      }

      // Em vez de “pular”, consolida duplicados para evitar itens repetidos na revisão.
      deduped[idx] = mergeImportedMaterial(deduped[idx], m);
      duplicatesMerged++;
    }

    return { deduped, duplicatesSkipped: duplicatesMerged };
  };

  const applyMatchingToImportedMaterials = (
    materials: ExtractedMaterial[]
  ): { materials: ExtractedMaterial[]; pendingApprovals: number[] } => {
    const pendingApprovals: number[] = [];

    const catalog = (catalogRef.current && catalogRef.current.length > 0)
      ? catalogRef.current
      : (existingMaterials || []);

    // Sem catálogo carregado ainda: trata tudo como novo.
    if (catalog.length === 0) {
      return {
        materials: materials.map((m) => ({ ...m, isNew: true })),
        pendingApprovals,
      };
    }

    const updated = materials.map((m) => {
      const importedMaterialPrice = m.material_price ?? 0;
      const importedLaborPrice = m.labor_price ?? 0;
      const importedSplitTotal = importedMaterialPrice + importedLaborPrice;
      const importedTotal = importedSplitTotal > 0 ? importedSplitTotal : (m.current_price ?? 0);

      const normalizedMatch = findSimilarMaterial(
        m.name,
        importedTotal,
        importedMaterialPrice,
        importedLaborPrice,
        m.unit,
        m.keywords,
        m.category
      );

      if (!normalizedMatch) {
        return {
          ...m,
          isNew: true,
          matchType: m.matchType || (importedTotal > 0 ? "Com preço" : "Novo material"),
        };
      }

      if (normalizedMatch.isExactDuplicate) {
        if (normalizedMatch.hasPriceChange) {
          const newMaterialPrice = importedSplitTotal > 0 ? importedMaterialPrice : importedTotal;
          const newLaborPrice = importedSplitTotal > 0 ? importedLaborPrice : 0;

          return {
            ...m,
            existingMaterial: normalizedMatch.material,
            similarity: 100,
            matchType: "Duplicado - Preço diferente",
            isExactDuplicate: true,
            hasPriceChange: true,
            needsApproval: true,
            approved: false,
            isNew: false,
            current_price: normalizedMatch.material.current_price || 0,
            material_price: normalizedMatch.material.material_price || 0,
            labor_price: normalizedMatch.material.labor_price || 0,
            newPrice: importedTotal,
            newMaterialPrice,
            newLaborPrice,
          } satisfies ExtractedMaterial;
        }

        return {
          ...m,
          existingMaterial: normalizedMatch.material,
          similarity: 100,
          matchType: "Já existe (ignorado)",
          isExactDuplicate: true,
          hasPriceChange: false,
          isNew: false,
          current_price: normalizedMatch.material.current_price || 0,
          material_price: normalizedMatch.material.material_price || 0,
          labor_price: normalizedMatch.material.labor_price || 0,
        } satisfies ExtractedMaterial;
      }

      // Similar (não exato): pede confirmação.
      return {
        ...m,
        existingMaterial: normalizedMatch.material,
        similarity: normalizedMatch.similarity,
        matchType: normalizedMatch.matchType,
        needsApproval: true,
        approved: false,
        isNew: true,
        current_price: importedTotal || normalizedMatch.material.current_price || 0,
        material_price: importedMaterialPrice || normalizedMatch.material.material_price || 0,
        labor_price: importedLaborPrice || normalizedMatch.material.labor_price || 0,
      } satisfies ExtractedMaterial;
    });

    updated.forEach((m, i) => {
      if (m.needsApproval) pendingApprovals.push(i);
    });

    return { materials: updated, pendingApprovals };
  };

  const prepareImportedMaterialsForReview = (materials: ExtractedMaterial[]) => {
    const { deduped, duplicatesSkipped } = dedupeImportedMaterials(materials);
    const { materials: matched } = applyMatchingToImportedMaterials(deduped);

    // Remove itens que já existem exatamente no catálogo e NÃO têm mudança de preço.
    const filtered = matched.filter((m) => !(m.isExactDuplicate && !m.hasPriceChange));
    const existingSkipped = matched.length - filtered.length;

    const pendingApprovals: number[] = [];
    filtered.forEach((m, i) => {
      if (m.needsApproval) pendingApprovals.push(i);
    });

    return { materials: filtered, pendingApprovals, duplicatesSkipped, existingSkipped };
  };

  const updatePriceMutation = useMutation({
    mutationFn: async (materials: ExtractedMaterial[]) => {
      // Filtra materiais que são duplicatas exatas com alteração de preço aprovada
      const materialsToUpdate = materials.filter(m => 
        m.isExactDuplicate && 
        m.hasPriceChange && 
        m.approved && 
        m.existingMaterial?.id
      );

      for (const material of materialsToUpdate) {
        const { error } = await supabase
          .from('materials')
          .update({
            material_price: material.newMaterialPrice ?? material.material_price ?? 0,
            labor_price: material.newLaborPrice ?? material.labor_price ?? 0,
            current_price: (material.newMaterialPrice ?? material.material_price ?? 0) + (material.newLaborPrice ?? material.labor_price ?? 0),
            updated_at: new Date().toISOString()
          })
          .eq('id', material.existingMaterial.id);

        if (error) throw error;
      }

      return materialsToUpdate.length;
    },
    onSuccess: (count) => {
      if (count > 0) {
        queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
        queryClient.invalidateQueries({ queryKey: ['materials'] });
        queryClient.invalidateQueries({ queryKey: ['materials-for-import'] });
        toast({
          title: "Sucesso",
          description: `${count} ${count === 1 ? 'material atualizado' : 'materiais atualizados'} com sucesso!`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar preços",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Função para verificar duplicados potenciais após importação
  const checkForPotentialDuplicates = async (insertedCount: number) => {
    if (insertedCount === 0) return;

    try {
      // Busca materiais com keywords_norm para análise
      const { data: materials } = await supabase
        .from('materials')
        .select('id, name, keywords_norm')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!materials || materials.length < 2) return;

      // Análise rápida de duplicados potenciais
      let duplicateCount = 0;
      const processedIds = new Set<string>();

      for (let i = 0; i < Math.min(materials.length, 50); i++) {
        const material = materials[i];
        if (processedIds.has(material.id)) continue;
        
        const materialTokens = material.keywords_norm || [];
        if (materialTokens.length === 0) continue;

        for (let j = i + 1; j < materials.length; j++) {
          const candidate = materials[j];
          if (processedIds.has(candidate.id)) continue;
          
          const candidateTokens = candidate.keywords_norm || [];
          if (candidateTokens.length === 0) continue;

          const commonTokens = materialTokens.filter((t: string) => candidateTokens.includes(t));
          if (commonTokens.length >= 2) {
            duplicateCount++;
            processedIds.add(candidate.id);
            break;
          }
        }
      }

      if (duplicateCount > 0) {
        toast({
          title: "Duplicados detectados",
          description: `Foram detectados ${duplicateCount} possíveis materiais duplicados. Acesse Materiais > Duplicados para revisar.`,
          duration: 8000,
        });
      }
    } catch (error) {
      console.error('Erro ao verificar duplicados:', error);
    }
  };

  const importMutation = useMutation({
    mutationFn: async (materials: ExtractedMaterial[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Primeiro, atualiza os preços dos materiais existentes
      await updatePriceMutation.mutateAsync(materials);

      // Filtra apenas os materiais novos (não existentes e aprovados ou sem match)
      // Exclui duplicatas exatas
      const materialsToInsert = materials
        .filter(m => m.isNew === true && !m.existingMaterial && !m.isExactDuplicate)
        .map(material => ({
          name: material.name,
          description: material.description || null,
          unit: material.unit,
          current_price: material.current_price || 0,
          material_price: material.material_price || 0,
          labor_price: material.labor_price || 0,
          current_stock: material.quantity || null,
          category: material.category || null,
          supplier: material.supplier || null,
          keywords: material.keywords || [],
          created_by_user_id: user.id,
        }));

      if (materialsToInsert.length > 0) {
        const { error } = await supabase
          .from('materials')
          .insert(materialsToInsert);

        if (error) throw error;
      }

      return materialsToInsert.length;
    },
    onSuccess: async (count) => {
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials-for-import'] });
      queryClient.invalidateQueries({ queryKey: ['materials-duplicates-analysis'] });
      toast({
        title: "Sucesso",
        description: `${count} ${count === 1 ? 'material adicionado' : 'materiais adicionados'} com sucesso!`,
      });
      
      // Verifica duplicados potenciais após importação
      setTimeout(() => {
        checkForPotentialDuplicates(count);
      }, 1500);
      
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao importar materiais",
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
      let useAIProcessing = false;

      // Garante catálogo atualizado (evita importar duplicados quando ainda não carregou)
      const catalog = await getFreshCatalog();

      if (file.type === 'application/pdf') {
        // Verifica tamanho do arquivo (máximo 5MB)
        const maxSizeMB = 5;
        if (file.size > maxSizeMB * 1024 * 1024) {
          throw new Error(`O arquivo PDF é muito grande. Tamanho máximo: ${maxSizeMB}MB`);
        }

        // Preferimos extrair TEXTO do PDF no client (rápido) e mandar apenas texto para o backend.
        // Isso evita timeouts e elimina o "Failed to fetch" quando o processamento fica pesado.

        toast({
          title: "Extraindo dados do PDF...",
          description: "Lendo o PDF e identificando todos os itens (todas as páginas)"
        });

        let pdfData: any = null;

        try {
          const pdfText = await extractPdfText(file);

          // Se o PDF for digital, o texto vem preenchido e o processamento fica leve.
          // Se vier praticamente vazio (PDF escaneado/imagem), caímos no modo binário.
          if (pdfText && pdfText.trim().length >= 200) {
            pdfData = await invokeExtractPdfData({ pdfText });
          } else {
            // Fallback: envia o PDF como binário (auth + headers gerenciados pelo client).
            pdfData = await invokeExtractPdfData(await file.arrayBuffer());
          }
        } catch (err: any) {
          console.error('Erro ao chamar extract-pdf-data:', err);
          const msg = typeof err?.message === 'string' ? err.message : 'Falha ao processar PDF';
          throw new Error(`Erro ao processar PDF: ${msg}`);
        }
        
        if (!pdfData?.items || pdfData.items.length === 0) {
          throw new Error('Nenhum dado encontrado no PDF. Verifique se o arquivo contém uma tabela de materiais.');
        }

        // Processa diretamente os itens do PDF com o novo formato padronizado
        const pdfMaterialsRaw: ExtractedMaterial[] = pdfData.items.map((item: any) => {
          const materialPrice = item.material_price || 0;
          const laborPrice = item.labor_price || 0;
          const totalPrice = item.price || (materialPrice + laborPrice);

          return {
            name: item.description || item.name || '',
            description: item.description || item.name || '',
            unit: item.unit || 'UN',
            quantity: 1,
            current_price: totalPrice,
            material_price: materialPrice,
            labor_price: laborPrice,
            supplier: item.supplier || undefined,
            keywords: Array.isArray(item.keywords) ? item.keywords : [],
            isNew: true,
            matchType: totalPrice > 0 ? 'Com preço' : 'Novo material',
          };
        }).filter((m: ExtractedMaterial) => m.name && m.name.length > 1);

        const { materials: pdfMaterials, pendingApprovals, duplicatesSkipped, existingSkipped } =
          prepareImportedMaterialsForReview(pdfMaterialsRaw);

        setExtractedMaterials(pdfMaterials);
        setShowReview(true);

        // Se há materiais similares/duplicados pendentes de aprovação, inicia o fluxo de aprovação
        if (pendingApprovals.length > 0) {
          setPendingApprovalIndex(pendingApprovals[0]);
          toast({
            title: "Materiais encontrados no catálogo",
            description: `${pendingApprovals.length} itens precisam da sua confirmação${duplicatesSkipped > 0 ? ` • ${duplicatesSkipped} duplicados no arquivo foram ignorados` : ''}${existingSkipped > 0 ? ` • ${existingSkipped} já existiam e foram ignorados` : ''}`,
          });
        }

        const withPrices = pdfMaterials.filter(m => (m.current_price || 0) > 0).length;
        toast({
          title: "PDF processado!",
          description: `${pdfMaterials.length} materiais para revisão, ${withPrices} com preços${duplicatesSkipped > 0 ? ` • ${duplicatesSkipped} duplicados ignorados` : ''}${existingSkipped > 0 ? ` • ${existingSkipped} já existiam e foram ignorados` : ''}`,
        });
        setIsProcessing(false);
        return;
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
        useAIProcessing = true;
      }

      if (!jsonData || jsonData.length === 0) {
        throw new Error("A planilha está vazia ou não pôde ser lida");
      }

      // If we have cataloged materials, use AI processing to find prices
      if (useAIProcessing && catalog.length > 0) {
        toast({
          title: "Processando com IA...",
          description: "Identificando materiais e buscando preços no catálogo"
        });

        const { data: aiProcessedData, error: aiError } = await supabase.functions.invoke('process-spreadsheet', {
          body: {
            spreadsheetData: jsonData,
            customKeywords: [],
            catalogedMaterials: catalog
          }
        });

        if (!aiError && aiProcessedData?.materials && aiProcessedData.materials.length > 0) {
          // Use AI-processed materials with prices
          const aiMaterialsRaw: ExtractedMaterial[] = aiProcessedData.materials.map((m: any) => {
            const hasPrice = (m.material_price && m.material_price > 0) || (m.labor_price && m.labor_price > 0) || (m.price && m.price > 0);
            return {
              name: m.name,
              description: m.name,
              unit: m.unit || 'UN',
              quantity: m.quantity || 1,
              current_price: m.price || ((m.material_price || 0) + (m.labor_price || 0)) || 0,
              material_price: m.material_price || 0,
              labor_price: m.labor_price || 0,
              category: m.brand ? `Marca: ${m.brand}` : undefined,
              supplier: undefined,
              isNew: true,
              matchType: hasPrice ? `Preço encontrado (${Math.round(m.confidence || 0)}%)` : 'Novo material',
              similarity: m.confidence || 0,
            };
          });

          const { materials: aiMaterials, pendingApprovals, duplicatesSkipped, existingSkipped } =
            prepareImportedMaterialsForReview(aiMaterialsRaw);

          const withPrices = aiMaterials.filter(m => (m.current_price || 0) > 0).length;

          setExtractedMaterials(aiMaterials);
          setShowReview(true);

          if (pendingApprovals.length > 0) {
            setPendingApprovalIndex(pendingApprovals[0]);
            toast({
              title: "Materiais encontrados no catálogo",
              description: `${pendingApprovals.length} itens precisam da sua confirmação${duplicatesSkipped > 0 ? ` • ${duplicatesSkipped} duplicados no arquivo foram ignorados` : ''}${existingSkipped > 0 ? ` • ${existingSkipped} já existiam e foram ignorados` : ''}`,
            });
          }

          toast({
            title: "Processamento concluído!",
            description: `${aiMaterials.length} materiais para revisão, ${withPrices} com preços encontrados${duplicatesSkipped > 0 ? ` • ${duplicatesSkipped} duplicados ignorados` : ''}${existingSkipped > 0 ? ` • ${existingSkipped} já existiam e foram ignorados` : ''}`,
          });
          return;
        }
      }

      // Parse Excel with EXACT column reading - preserving original values
      const getExactColumnValue = (row: any, variations: string[]): string => {
        // First try exact column name match
        for (const key of Object.keys(row)) {
          const keyLower = key.toLowerCase().trim();
          for (const variation of variations) {
            if (keyLower === variation.toLowerCase()) {
              const value = row[key];
              // Return exact value without modifications
              if (value === null || value === undefined) return '';
              return String(value).trim();
            }
          }
        }
        // Then try partial match
        for (const key of Object.keys(row)) {
          const normalizedKey = normalizeText(key);
          for (const variation of variations) {
            if (normalizedKey.includes(normalizeText(variation))) {
              const value = row[key];
              if (value === null || value === undefined) return '';
              return String(value).trim();
            }
          }
        }
        return '';
      };

      // Parse price with EXACT precision - handles Brazilian and international formats
      const parseExactPrice = (value: any): number => {
        if (value === null || value === undefined) return 0;
        
        // If it's already a number (Excel numeric cell), return it directly
        if (typeof value === 'number') {
          return Number.isFinite(value) ? value : 0;
        }
        
        const strValue = String(value).trim();
        if (!strValue || strValue === '-' || strValue === 'R$ -' || strValue === '-') return 0;
        
        // Remove currency symbols and spaces
        let cleaned = strValue.replace(/R\$\s*/gi, '').replace(/\s/g, '');
        
        // Detect format: Brazilian (1.234,56) vs International (1,234.56)
        const hasCommaAsDecimal = /\d,\d{2}$/.test(cleaned);
        const hasDotAsDecimal = /\d\.\d{2}$/.test(cleaned);
        
        if (hasCommaAsDecimal) {
          // Brazilian format: 1.234,56 -> 1234.56
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else if (hasDotAsDecimal && cleaned.includes(',')) {
          // International format with thousand separator: 1,234.56 -> 1234.56
          cleaned = cleaned.replace(/,/g, '');
        } else if (cleaned.includes(',') && !cleaned.includes('.')) {
          // Only comma, likely decimal: 123,45 -> 123.45
          cleaned = cleaned.replace(',', '.');
        }
        
        // Remove any remaining non-numeric characters except dot and minus
        cleaned = cleaned.replace(/[^\d.-]/g, '');
        
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      // Get RAW row data directly from Excel - preserving all original values
      const getRawExcelData = (row: any) => {
        const result: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          result[key.toLowerCase().trim()] = row[key];
        }
        return result;
      };

      const materials: ExtractedMaterial[] = [];
      const pendingApprovals: number[] = [];
      const seenImportKeys = new Set<string>();
      let duplicatesSkipped = 0;
      let existingSkipped = 0;

      console.log(`Processing ${jsonData.length} rows from Excel`);

      for (let i = 0; i < jsonData.length; i++) {
        const rowData: any = jsonData[i];
        const rawData = getRawExcelData(rowData);
        
        // Log first row for debugging
        if (i === 0) {
          console.log('First row columns:', Object.keys(rowData));
          console.log('First row raw data:', rawData);
        }
        
        // Colunas padronizadas - LEITURA EXATA
        const name = getExactColumnValue(rowData, ['descricao', 'descrição', 'description', 'nome', 'name', 'item', 'material']);
        const unit = getExactColumnValue(rowData, ['unidade', 'unit', 'un', 'und']) || 'UN';
        const supplier = getExactColumnValue(rowData, ['fornecedor', 'supplier']) || undefined;
        
        // Preços - LEITURA EXATA com detecção de formato
        const materialPriceRaw = getExactColumnValue(rowData, ['preco material', 'preço material', 'material_price', 'valor material']);
        const laborPriceRaw = getExactColumnValue(rowData, ['preco m.o.', 'preço m.o.', 'preco mo', 'preço mo', 'labor_price', 'mao de obra', 'mão de obra', 'valor mo']);
        const totalPriceRaw = getExactColumnValue(rowData, ['preco total', 'preço total', 'total', 'price', 'valor', 'valor total']);
        const keywordsStr = getExactColumnValue(rowData, ['palavras-chave', 'palavras chave', 'keywords', 'tags']);
        
        const materialPrice = parseExactPrice(materialPriceRaw);
        const laborPrice = parseExactPrice(laborPriceRaw);
        const totalPrice = parseExactPrice(totalPriceRaw) || (materialPrice + laborPrice);
        const keywords = keywordsStr ? keywordsStr.split(/[,;|]/).map(k => k.trim()).filter(k => k.length > 0) : [];

        if (!name || name.length < 2) continue;

        const importKey = getImportKey(name, unit);
        if (seenImportKeys.has(importKey)) {
          duplicatesSkipped++;
          continue;
        }
        seenImportKeys.add(importKey);

        // Busca material similar COM os preços e keywords importados
        const similar = findSimilarMaterial(name, totalPrice, materialPrice, laborPrice, unit, keywords);
        
        if (similar) {
          if (similar.isExactDuplicate) {
            // Material já existe - verificar se há alteração de preço
            if (similar.hasPriceChange) {
              // Duplicata com preço diferente - precisa de aprovação para atualizar
              materials.push({
                name,
                description: name,
                unit,
                current_price: similar.material.current_price || 0,
                material_price: similar.material.material_price || 0,
                labor_price: similar.material.labor_price || 0,
                newPrice: totalPrice,
                newMaterialPrice: materialPrice,
                newLaborPrice: laborPrice,
                supplier,
                keywords,
                existingMaterial: similar.material,
                similarity: 100,
                matchType: 'Duplicado - Preço diferente',
                isExactDuplicate: true,
                hasPriceChange: true,
                needsApproval: true,
                approved: false,
                isNew: false,
              });
              pendingApprovals.push(materials.length - 1);
            } else {
              // Duplicata exata sem mudança de preço - ignorar silenciosamente
              existingSkipped++;
              continue;
            }
          } else {
            // Similar encontrado, precisa de aprovação
            materials.push({
              name,
              description: name,
              unit,
              current_price: totalPrice || similar.material.current_price || 0,
              material_price: materialPrice || similar.material.material_price || 0,
              labor_price: laborPrice || similar.material.labor_price || 0,
              supplier,
              keywords,
              existingMaterial: similar.material,
              similarity: similar.similarity,
              matchType: similar.matchType,
              needsApproval: true,
              approved: false,
              isNew: true,
            });
            pendingApprovals.push(materials.length - 1);
          }
        } else {
          materials.push({
            name,
            description: name,
            unit,
            current_price: totalPrice,
            material_price: materialPrice,
            labor_price: laborPrice,
            supplier,
            keywords,
            isNew: true,
            matchType: totalPrice > 0 ? 'Com preço' : 'Novo material',
          });
        }
      }

      if (materials.length === 0) {
        throw new Error("Nenhum material válido encontrado na planilha.");
      }

      setExtractedMaterials(materials);
      setShowReview(true);

      // Se há materiais similares pendentes de aprovação, inicia o fluxo de aprovação
      if (pendingApprovals.length > 0) {
        setPendingApprovalIndex(pendingApprovals[0]);
        toast({
          title: "Materiais similares encontrados",
          description: `${pendingApprovals.length} materiais precisam da sua confirmação${duplicatesSkipped > 0 ? ` • ${duplicatesSkipped} duplicados no arquivo foram ignorados` : ''}${existingSkipped > 0 ? ` • ${existingSkipped} já existiam e foram ignorados` : ''}`,
        });
      } else if (duplicatesSkipped > 0 || existingSkipped > 0) {
        toast({
          title: "Itens ignorados",
          description: `${duplicatesSkipped > 0 ? `${duplicatesSkipped} duplicados no arquivo` : ''}${duplicatesSkipped > 0 && existingSkipped > 0 ? ' • ' : ''}${existingSkipped > 0 ? `${existingSkipped} já existiam no catálogo` : ''}`,
        });
      }
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

  const handleApproval = (index: number, useExisting: boolean, updatePrice: boolean = false) => {
    setExtractedMaterials(prev => {
      const updated = [...prev];
      const material = updated[index];
      
      if (material.isExactDuplicate && material.hasPriceChange) {
        // Para duplicatas com preço diferente
        if (updatePrice) {
          // Usuário quer atualizar o preço
          updated[index] = {
            ...material,
            needsApproval: false,
            approved: true,
            isNew: false,
            matchType: 'Preço será atualizado',
          };
        } else {
          // Usuário não quer atualizar - manter como está
          updated[index] = {
            ...material,
            needsApproval: false,
            approved: false,
            isNew: false,
            hasPriceChange: false,
            matchType: 'Mantido como está',
          };
        }
      } else {
        // Para materiais similares (não exatos)
        const creatingNew = !useExisting;
        updated[index] = {
          ...material,
          needsApproval: false,
          approved: true,
          isNew: creatingNew,
          existingMaterial: creatingNew ? undefined : material.existingMaterial,
          similarity: creatingNew ? undefined : material.similarity,
          matchType: useExisting ? 'Usando existente' : 'Cadastrar novo',
        };
      }
      return updated;
    });

    // Move para próximo pendente
    const nextPending = extractedMaterials.findIndex(
      (m, i) => i > index && m.needsApproval
    );
    if (nextPending >= 0) {
      setPendingApprovalIndex(nextPending);
    } else {
      setPendingApprovalIndex(null);
    }
  };

  const handleSkipApproval = (index: number) => {
    setExtractedMaterials(prev => {
      const updated = [...prev];
      const material = updated[index];
      
      if (material.isExactDuplicate) {
        // Para duplicatas, pular significa manter como está
        updated[index] = {
          ...material,
          needsApproval: false,
          approved: false,
          isNew: false,
          hasPriceChange: false,
          matchType: 'Ignorado',
        };
      } else {
        // Para similares, pular significa criar novo
        updated[index] = {
          ...material,
          needsApproval: false,
          isNew: true,
          existingMaterial: undefined,
          similarity: undefined,
          matchType: 'Cadastrar novo',
        };
      }
      return updated;
    });

    const nextPending = extractedMaterials.findIndex(
      (m, i) => i > index && m.needsApproval
    );
    if (nextPending >= 0) {
      setPendingApprovalIndex(nextPending);
    } else {
      setPendingApprovalIndex(null);
    }
  };

  // Função para iniciar edição de keywords
  const handleStartEditKeywords = () => {
    if (pendingApprovalIndex !== null) {
      const current = extractedMaterials[pendingApprovalIndex];
      setEditingKeywordsValue((current.keywords || []).join(', '));
      setIsEditingKeywords(true);
    }
  };

  // Função para salvar keywords editadas e re-processar matching
  const handleSaveKeywords = () => {
    if (pendingApprovalIndex === null) return;
    
    const newKeywords = editingKeywordsValue
      .split(/[,;|]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    setExtractedMaterials(prev => {
      const updated = [...prev];
      updated[pendingApprovalIndex] = {
        ...updated[pendingApprovalIndex],
        keywords: newKeywords,
      };
      return updated;
    });
    
    setIsEditingKeywords(false);
    setEditingKeywordsValue("");
    
    toast({
      title: "Palavras-chave atualizadas",
      description: "As keywords foram salvas. O matching será recalculado na próxima importação.",
    });
  };

  const handleImport = async () => {
    await importMutation.mutateAsync(extractedMaterials);
  };

  const handleClose = () => {
    setFile(null);
    setExtractedMaterials([]);
    setShowReview(false);
    setPendingApprovalIndex(null);
    setIsEditingKeywords(false);
    setEditingKeywordsValue("");
    onOpenChange(false);
  };

  const removeItem = (index: number) => {
    setExtractedMaterials(prev => prev.filter((_, i) => i !== index));
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const toggleSelectItem = (index: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const newItems = extractedMaterials.filter(m => m.isNew).map((_, i) => i);
    if (selectedItems.size === newItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(newItems));
    }
  };

  const deleteSelectedItems = () => {
    setExtractedMaterials(prev => prev.filter((_, i) => !selectedItems.has(i)));
    setSelectedItems(new Set());
  };

  const applyBulkPrice = () => {
    const numValue = parseFloat(bulkPriceValue);
    if (isNaN(numValue)) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }

    setExtractedMaterials(prev => {
      const updated = [...prev];
      selectedItems.forEach(index => {
        if (!updated[index].isNew) return;
        
        const currentPrice = updated[index].current_price || 0;
        let newPrice: number;

        switch (bulkPriceOperation) {
          case 'set':
            newPrice = numValue;
            break;
          case 'increase_percent':
            newPrice = currentPrice * (1 + numValue / 100);
            break;
          case 'decrease_percent':
            newPrice = currentPrice * (1 - numValue / 100);
            break;
          default:
            newPrice = currentPrice;
        }

        updated[index] = {
          ...updated[index],
          current_price: Math.round(newPrice * 100) / 100,
          material_price: Math.round(newPrice * 100) / 100,
        };
      });
      return updated;
    });

    toast({ title: `Preços de ${selectedItems.size} itens atualizados!` });
    setShowBulkPriceDialog(false);
    setBulkPriceValue("");
  };

  const applyBulkSupplier = () => {
    if (!bulkSupplier.trim()) {
      toast({ title: "Fornecedor não pode estar vazio", variant: "destructive" });
      return;
    }

    setExtractedMaterials(prev => {
      const updated = [...prev];
      selectedItems.forEach(index => {
        if (!updated[index].isNew) return;
        updated[index] = { ...updated[index], supplier: bulkSupplier.trim() };
      });
      return updated;
    });

    toast({ title: `Fornecedor de ${selectedItems.size} itens atualizado!` });
    setShowBulkSupplierDialog(false);
    setBulkSupplier("");
  };

  const applyBulkCategory = () => {
    if (!bulkCategory.trim()) {
      toast({ title: "Categoria não pode estar vazia", variant: "destructive" });
      return;
    }

    setExtractedMaterials(prev => {
      const updated = [...prev];
      selectedItems.forEach(index => {
        if (!updated[index].isNew) return;
        updated[index] = { ...updated[index], category: bulkCategory.trim() };
      });
      return updated;
    });

    toast({ title: `Categoria de ${selectedItems.size} itens atualizada!` });
    setShowBulkCategoryDialog(false);
    setBulkCategory("");
  };

  const exportSelectedItems = () => {
    const selectedMaterials = extractedMaterials.filter((_, i) => selectedItems.has(i));
    
    const exportData = selectedMaterials.map(m => ({
      'Descrição': m.name,
      'Unidade': m.unit,
      'Fornecedor': m.supplier || '',
      'Categoria': m.category || '',
      'Preço Material': m.material_price || 0,
      'Preço M.O.': m.labor_price || 0,
      'Preço Total': m.current_price || 0,
      'Palavras-Chave': (m.keywords || []).join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Materiais");
    XLSX.writeFile(wb, `materiais_selecionados_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({ title: `${selectedItems.size} itens exportados!` });
  };

  const currentPending = pendingApprovalIndex !== null ? extractedMaterials[pendingApprovalIndex] : null;
  const newMaterialsCount = extractedMaterials.filter(m => m.isNew && !m.needsApproval && !m.isExactDuplicate).length;
  const updatePriceCount = extractedMaterials.filter(m => m.isExactDuplicate && m.hasPriceChange && m.approved).length;
  // Preços são opcionais agora
  const missingPriceCount = 0;
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {pendingApprovalIndex !== null 
              ? (currentPending?.isExactDuplicate && currentPending?.hasPriceChange 
                  ? "Material Duplicado Encontrado" 
                  : "Confirmar Material Similar")
              : showReview ? "Revisão dos Materiais" : "Importar Materiais"}
          </DialogTitle>
          {pendingApprovalIndex !== null && currentPending && (
            <DialogDescription>
              {currentPending.isExactDuplicate && currentPending.hasPriceChange
                ? "Este material já existe na sua base de dados, mas com um preço diferente. Deseja atualizar o preço?"
                : "Encontramos um material com palavras-chave semelhantes. É o mesmo produto?"}
            </DialogDescription>
          )}
        </DialogHeader>

        {pendingApprovalIndex !== null && currentPending ? (
          <div className="space-y-4 py-4">
            {currentPending.isExactDuplicate && currentPending.hasPriceChange ? (
              /* UI para duplicata com preço diferente */
              <>
                <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">Material já existe na base de dados</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Identificamos que "{currentPending.name}" já está cadastrado, mas com um preço diferente.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-2">Preço atual na base:</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Material:</span>
                        <span className="font-semibold text-blue-600">
                          R$ {(currentPending.existingMaterial?.material_price || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Mão de Obra:</span>
                        <span className="font-semibold text-orange-600">
                          R$ {(currentPending.existingMaterial?.labor_price || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-sm font-medium">Total:</span>
                        <span className="font-bold">
                          R$ {((currentPending.existingMaterial?.material_price || 0) + (currentPending.existingMaterial?.labor_price || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg bg-primary/5 border-primary/30">
                    <p className="text-sm text-muted-foreground mb-2">Novo preço (da planilha):</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Material:</span>
                        <span className="font-semibold text-blue-600">
                          R$ {(currentPending.newMaterialPrice || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Mão de Obra:</span>
                        <span className="font-semibold text-orange-600">
                          R$ {(currentPending.newLaborPrice || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-sm font-medium">Total:</span>
                        <span className="font-bold text-primary">
                          R$ {((currentPending.newMaterialPrice || 0) + (currentPending.newLaborPrice || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => handleSkipApproval(pendingApprovalIndex)} className="sm:mr-auto">
                    <X className="h-4 w-4 mr-2" />
                    Ignorar
                  </Button>
                  <Button variant="secondary" onClick={() => handleApproval(pendingApprovalIndex, true, false)}>
                    <SkipForward className="h-4 w-4 mr-2" />
                    Manter Preço Atual
                  </Button>
                  <Button onClick={() => handleApproval(pendingApprovalIndex, true, true)}>
                    <Check className="h-4 w-4 mr-2" />
                    Atualizar Preço
                  </Button>
                </DialogFooter>
              </>
            ) : (
              /* UI para material similar (não exato) */
              <>
                <div className="p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Material na planilha:</p>
                  <p className="font-medium">{currentPending.name}</p>
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    {currentPending.unit && <span>Unidade: <strong>{currentPending.unit}</strong></span>}
                    {currentPending.quantity && <span>Quantidade: <strong>{currentPending.quantity}</strong></span>}
                  </div>
                  {/* Mostrar tokens identificados no nome importado */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground">Tokens identificados:</span>
                    {tokenizeKeywords(currentPending.name).slice(0, 8).map((token, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {token}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <span className="text-muted-foreground">↓</span>
                </div>

                <div className="p-4 border rounded-lg border-primary/50 bg-primary/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Material possivelmente igual encontrado:</p>
                    <div className="flex gap-2">
                      <Badge variant={currentPending.matchType?.includes('Palavras-chave') ? 'default' : 'secondary'}>
                        {currentPending.matchType || 'Similar'}
                      </Badge>
                      <Badge variant="outline">
                        {currentPending.similarity?.toFixed(0)}% confiança
                      </Badge>
                    </div>
                  </div>
                  <p className="font-semibold text-lg">{currentPending.existingMaterial?.name}</p>
                  
                  {/* Mostrar tokens em comum se disponível */}
                  {currentPending.existingMaterial?.keywords_norm && currentPending.existingMaterial.keywords_norm.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Palavras-chave:</span>
                      {currentPending.existingMaterial.keywords_norm.slice(0, 8).map((kw: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                      {currentPending.existingMaterial.keywords_norm.length > 8 && (
                        <Badge variant="outline" className="text-xs">
                          +{currentPending.existingMaterial.keywords_norm.length - 8}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Unidade</p>
                      <p className="font-medium">{currentPending.existingMaterial?.unit || 'UN'}</p>
                    </div>
                    {currentPending.existingMaterial?.category && (
                      <div>
                        <p className="text-muted-foreground">Categoria</p>
                        <p className="font-medium">{currentPending.existingMaterial.category}</p>
                      </div>
                    )}
                    {currentPending.existingMaterial?.supplier && (
                      <div>
                        <p className="text-muted-foreground">Fornecedor</p>
                        <p className="font-medium">{currentPending.existingMaterial.supplier}</p>
                      </div>
                    )}
                  </div>

                  {(currentPending.existingMaterial?.material_price || currentPending.existingMaterial?.labor_price) && (
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Material</p>
                        <p className="text-blue-600 font-semibold">
                          R$ {(currentPending.existingMaterial.material_price || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Mão de Obra</p>
                        <p className="text-orange-600 font-semibold">
                          R$ {(currentPending.existingMaterial.labor_price || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Formulário de edição de keywords */}
                {isEditingKeywords && (
                  <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <Label className="font-medium">Editar Palavras-chave</Label>
                    </div>
                    <Input 
                      value={editingKeywordsValue}
                      onChange={(e) => setEditingKeywordsValue(e.target.value)}
                      placeholder="cabo, hdmi, 4k, 30m (separadas por vírgula)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Adicione palavras-chave que ajudam a identificar este material. Separe por vírgula.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingKeywords(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveKeywords}>
                        Salvar Keywords
                      </Button>
                    </div>
                  </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <div className="flex gap-2 sm:mr-auto">
                    <Button variant="outline" onClick={() => handleSkipApproval(pendingApprovalIndex)}>
                      <SkipForward className="h-4 w-4 mr-2" />
                      Pular
                    </Button>
                    {!isEditingKeywords && (
                      <Button variant="ghost" onClick={handleStartEditKeywords}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Editar Keywords
                      </Button>
                    )}
                  </div>
                  <Button variant="secondary" onClick={() => handleApproval(pendingApprovalIndex, false)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Novo
                  </Button>
                  <Button onClick={() => handleApproval(pendingApprovalIndex, true)}>
                    <Check className="h-4 w-4 mr-2" />
                    Vincular ao Existente
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        ) : !showReview ? (
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
                A planilha deve conter as seguintes colunas padronizadas:
                <br />
                <strong>• Descrição</strong> (obrigatório)
                <br />
                <strong>• Unidade</strong> (obrigatório)
                <br />
                <strong>• Fornecedor</strong> (opcional)
                <br />
                <strong>• Preço Material</strong> (opcional)
                <br />
                <strong>• Preço M.O.</strong> (opcional)
                <br />
                <strong>• Preço Total</strong> (opcional - calculado automaticamente)
                <br />
                <strong>• Palavras-Chave</strong> (opcional - separadas por vírgula)
                <br />
                <br />
                O sistema identifica materiais duplicados e oferece opção de atualizar preços.
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={processFile} 
                disabled={!file || isProcessing}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? "Processando..." : "Processar Planilha"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
               <div className="space-y-1">
                 <p className="text-sm font-medium">
                   {newMaterialsCount} novos materiais para adicionar
                   {updatePriceCount > 0 && ` • ${updatePriceCount} preços para atualizar`}
                 </p>
                 <p className="text-xs text-muted-foreground">
                   {extractedMaterials.filter(m => !m.isNew && !m.hasPriceChange).length} já existem na base (serão ignorados)
                 </p>
                </div>
              {selectedItems.size > 0 && (
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings2 className="h-4 w-4 mr-2" />
                        Ações ({selectedItems.size})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowBulkPriceDialog(true)}>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Ajustar Preços
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowBulkSupplierDialog(true)}>
                        <Building2 className="h-4 w-4 mr-2" />
                        Alterar Fornecedor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowBulkCategoryDialog(true)}>
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Alterar Categoria
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={exportSelectedItems}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Selecionados
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={deleteSelectedItems}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              )}
             </div>

            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox 
                        checked={selectedItems.size > 0 && selectedItems.size === extractedMaterials.filter(m => m.isNew).length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Nome/Descrição</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Preço Material</TableHead>
                    <TableHead>Preço M.O.</TableHead>
                    <TableHead>Preço Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedMaterials.map((material, index) => (
                    <TableRow key={index} className={!material.isNew ? 'opacity-50' : selectedItems.has(index) ? 'bg-muted/50' : ''}>
                      <TableCell className="w-[40px]">
                        {material.isNew && (
                          <Checkbox 
                            checked={selectedItems.has(index)}
                            onCheckedChange={() => toggleSelectItem(index)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {material.name}
                      </TableCell>
                      <TableCell>{material.unit}</TableCell>
                      <TableCell>
                        {material.isNew ? (
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={0}
                            value={material.material_price ?? ""}
                            onChange={(e) => {
                              const next = e.target.value === "" ? undefined : Number(e.target.value);
                              setExtractedMaterials((prev) => {
                                const updated = [...prev];
                                const matPrice = Number.isFinite(next as number) ? next || 0 : 0;
                                const labPrice = updated[index].labor_price || 0;
                                updated[index] = { 
                                  ...updated[index], 
                                  material_price: matPrice,
                                  current_price: matPrice + labPrice
                                };
                                return updated;
                              });
                            }}
                            placeholder="0,00"
                            className="h-8 w-24"
                          />
                        ) : (
                          `R$ ${(material.material_price || 0).toFixed(2)}`
                        )}
                      </TableCell>
                      <TableCell>
                        {material.isNew ? (
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={0}
                            value={material.labor_price ?? ""}
                            onChange={(e) => {
                              const next = e.target.value === "" ? undefined : Number(e.target.value);
                              setExtractedMaterials((prev) => {
                                const updated = [...prev];
                                const matPrice = updated[index].material_price || 0;
                                const labPrice = Number.isFinite(next as number) ? next || 0 : 0;
                                updated[index] = { 
                                  ...updated[index], 
                                  labor_price: labPrice,
                                  current_price: matPrice + labPrice
                                };
                                return updated;
                              });
                            }}
                            placeholder="0,00"
                            className="h-8 w-24"
                          />
                        ) : (
                          `R$ ${(material.labor_price || 0).toFixed(2)}`
                        )}
                      </TableCell>
                       <TableCell>
                         {material.isNew ? (
                           <span className="font-medium text-primary">
                             R$ {(material.current_price || 0).toFixed(2)}
                           </span>
                         ) : material.hasPriceChange && material.approved ? (
                           <div className="space-y-1">
                             <span className="text-muted-foreground line-through text-xs">
                               R$ {(material.current_price || 0).toFixed(2)}
                             </span>
                             <span className="font-medium text-green-600 block">
                               R$ {((material.newMaterialPrice || 0) + (material.newLaborPrice || 0)).toFixed(2)}
                             </span>
                           </div>
                         ) : material.current_price ? (
                           `R$ ${material.current_price.toFixed(2)}`
                         ) : (
                           <span className="text-muted-foreground">-</span>
                         )}
                       </TableCell>
                      <TableCell>
                        <Badge variant={
                          material.matchType?.includes('atualizado') || material.matchType?.includes('Atualizar') ? 'default' :
                          material.isNew === false ? 'secondary' :
                          material.matchType === 'Cadastrar novo' ? 'default' :
                          material.matchType === 'Usando existente' ? 'secondary' :
                          material.matchType?.includes('Ignorado') || material.matchType?.includes('Mantido') ? 'outline' :
                          'outline'
                        }>
                          {material.matchType || 'Novo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {material.isNew && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="h-8 w-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="flex-1"
              >
                Cancelar
              </Button>
               <Button 
                 onClick={handleImport}
                 disabled={(newMaterialsCount === 0 && updatePriceCount === 0) || importMutation.isPending}
                 className="flex-1"
               >
                 <Save className="h-4 w-4 mr-2" />
                 {importMutation.isPending ? "Processando..." : 
                   newMaterialsCount > 0 && updatePriceCount > 0 
                     ? `Adicionar ${newMaterialsCount} e Atualizar ${updatePriceCount}`
                     : newMaterialsCount > 0 
                       ? `Adicionar ${newMaterialsCount} Materiais`
                       : `Atualizar ${updatePriceCount} Preços`
                 }
               </Button>
            </div>
          </div>
        )}

        {/* Bulk Price Dialog */}
        <Dialog open={showBulkPriceDialog} onOpenChange={setShowBulkPriceDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Ajustar Preços em Bloco</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Ajuste</Label>
                <select 
                  className="w-full border rounded-md p-2"
                  value={bulkPriceOperation}
                  onChange={(e) => setBulkPriceOperation(e.target.value as any)}
                >
                  <option value="set">Definir Valor Fixo</option>
                  <option value="increase_percent">Aumentar por %</option>
                  <option value="decrease_percent">Diminuir por %</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>
                  {bulkPriceOperation === 'set' ? 'Novo Preço (R$)' : 'Porcentagem (%)'}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={bulkPriceValue}
                  onChange={(e) => setBulkPriceValue(e.target.value)}
                  placeholder={bulkPriceOperation === 'set' ? 'Ex: 10.50' : 'Ex: 10'}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowBulkPriceDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={applyBulkPrice} disabled={!bulkPriceValue}>
                  Aplicar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Supplier Dialog */}
        <Dialog open={showBulkSupplierDialog} onOpenChange={setShowBulkSupplierDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Alterar Fornecedor em Bloco</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Novo Fornecedor</Label>
                <Input
                  value={bulkSupplier}
                  onChange={(e) => setBulkSupplier(e.target.value)}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowBulkSupplierDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={applyBulkSupplier} disabled={!bulkSupplier.trim()}>
                  Aplicar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Category Dialog */}
        <Dialog open={showBulkCategoryDialog} onOpenChange={setShowBulkCategoryDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Alterar Categoria em Bloco</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nova Categoria</Label>
                <Input
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  placeholder="Nome da categoria"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowBulkCategoryDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={applyBulkCategory} disabled={!bulkCategory.trim()}>
                  Aplicar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
