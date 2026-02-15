import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, Trash2, Merge, RefreshCw, ChevronDown, ChevronRight, Wand2, CheckCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface MaterialData {
  id: string;
  name: string;
  unit: string;
  keywords?: string[] | null;
  keywords_norm?: string[] | null;
  material_price?: number | null;
  labor_price?: number | null;
  current_price?: number | null;
  category?: string | null;
  supplier?: string | null;
  measurement?: string | null;
  description?: string | null;
}

interface DuplicateGroup {
  id: string;
  primaryMaterial: MaterialData;
  duplicates: (MaterialData & { matchScore: number; matchedTokens: string[] })[];
  matchScore: number;
  matchedTokens: string[];
}

export const DuplicateMaterialsReport = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [minScore, setMinScore] = useState(70);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showSmartMergeDialog, setShowSmartMergeDialog] = useState(false);
  const [mergingGroup, setMergingGroup] = useState<DuplicateGroup | null>(null);
  const [keepMaterialId, setKeepMaterialId] = useState<string>("");
  const [mergeStrategy, setMergeStrategy] = useState<'best_price' | 'lowest_price' | 'most_keywords' | 'custom'>('best_price');
  const [mergePreview, setMergePreview] = useState<Partial<MaterialData> | null>(null);

  const { data: materials = [], isLoading, refetch } = useQuery({
    queryKey: ['materials-duplicates-analysis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, unit, keywords, keywords_norm, material_price, labor_price, current_price, category, supplier, measurement, description')
        .order('name');
      
      if (error) throw error;
      return (data || []) as MaterialData[];
    }
  });

  // Analisa materiais duplicados baseado em keywords_norm
  const duplicateGroups = useMemo(() => {
    if (materials.length === 0) return [];

    const groups: DuplicateGroup[] = [];
    const processedIds = new Set<string>();

    for (let i = 0; i < materials.length; i++) {
      const material = materials[i];
      if (processedIds.has(material.id)) continue;

      const materialTokens = material.keywords_norm || [];
      if (materialTokens.length === 0) continue;

      const duplicates: any[] = [];
      let bestMatchScore = 0;
      let bestMatchedTokens: string[] = [];

      for (let j = i + 1; j < materials.length; j++) {
        const candidate = materials[j];
        if (processedIds.has(candidate.id)) continue;

        const candidateTokens = candidate.keywords_norm || [];
        if (candidateTokens.length === 0) continue;

        // Calcula overlap de tokens
        const commonTokens = materialTokens.filter((t: string) => candidateTokens.includes(t));
        const overlapCount = commonTokens.length;
        const overlapPercentage = overlapCount / Math.min(materialTokens.length, candidateTokens.length);

        // Score de matching
        let score = 0;
        if (overlapCount >= 3) {
          score = 90;
        } else if (overlapCount >= 2 || overlapPercentage >= 0.6) {
          score = 70 + overlapCount * 5;
        } else if (overlapCount >= 1 && overlapPercentage >= 0.5) {
          score = 50 + overlapCount * 10;
        }

        // Bonus se unidade for igual
        if (material.unit?.toLowerCase() === candidate.unit?.toLowerCase()) {
          score += 10;
        }

        if (score >= minScore) {
          duplicates.push({ ...candidate, matchScore: score, matchedTokens: commonTokens });
          processedIds.add(candidate.id);

          if (score > bestMatchScore) {
            bestMatchScore = score;
            bestMatchedTokens = commonTokens;
          }
        }
      }

      if (duplicates.length > 0) {
        groups.push({
          id: material.id,
          primaryMaterial: material,
          duplicates: duplicates.sort((a, b) => b.matchScore - a.matchScore),
          matchScore: bestMatchScore,
          matchedTokens: bestMatchedTokens,
        });
        processedIds.add(material.id);
      }
    }

    return groups.sort((a, b) => b.matchScore - a.matchScore);
  }, [materials, minScore]);

  // Filtra por termo de busca
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return duplicateGroups;
    const term = searchTerm.toLowerCase();
    return duplicateGroups.filter(group => 
      group.primaryMaterial.name.toLowerCase().includes(term) ||
      group.duplicates.some(d => d.name.toLowerCase().includes(term))
    );
  }, [duplicateGroups, searchTerm]);

  // Mutation para deletar materiais
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('materials')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials-duplicates-analysis'] });
      toast({ title: "Materiais removidos com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover materiais", description: error.message, variant: "destructive" });
    }
  });

  // Mutation para atualizar material com dados mesclados
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MaterialData> }) => {
      const { error } = await supabase
        .from('materials')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials-duplicates-analysis'] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar material", description: error.message, variant: "destructive" });
    }
  });

  // Função para calcular merge inteligente
  const calculateSmartMerge = (group: DuplicateGroup, strategy: string): Partial<MaterialData> => {
    const allMaterials = [group.primaryMaterial, ...group.duplicates];
    
    // Escolhe o melhor nome (mais completo)
    const bestName = allMaterials.reduce((best, m) => 
      (m.name?.length || 0) > (best?.length || 0) ? m.name : best, 
      allMaterials[0].name
    );

    // Combina todas as keywords únicas
    const allKeywords = new Set<string>();
    const allKeywordsNorm = new Set<string>();
    allMaterials.forEach(m => {
      (m.keywords || []).forEach((k: string) => allKeywords.add(k));
      (m.keywords_norm || []).forEach((k: string) => allKeywordsNorm.add(k));
    });

    // Melhor preço baseado na estratégia
    let bestMaterialPrice = 0;
    let bestLaborPrice = 0;

    if (strategy === 'lowest_price') {
      // Menor preço total diferente de zero
      const priced = allMaterials
        .map(m => ({
          material: m,
          total: (m.material_price || 0) + (m.labor_price || 0)
        }))
        .filter(p => p.total > 0)
        .sort((a, b) => a.total - b.total);
      
      if (priced.length > 0) {
        bestMaterialPrice = priced[0].material.material_price || 0;
        bestLaborPrice = priced[0].material.labor_price || 0;
      }
    } else {
      // Maior preço (best_price) ou primeiro com preço
      const priced = allMaterials
        .map(m => ({
          material: m,
          total: (m.material_price || 0) + (m.labor_price || 0)
        }))
        .filter(p => p.total > 0)
        .sort((a, b) => b.total - a.total);
      
      if (priced.length > 0) {
        bestMaterialPrice = priced[0].material.material_price || 0;
        bestLaborPrice = priced[0].material.labor_price || 0;
      }
    }

    // Melhor categoria e fornecedor (primeiro não vazio)
    const bestCategory = allMaterials.find(m => m.category)?.category || null;
    const bestSupplier = allMaterials.find(m => m.supplier)?.supplier || null;
    const bestMeasurement = allMaterials.find(m => m.measurement)?.measurement || null;
    const bestDescription = allMaterials.reduce((best, m) => 
      (m.description?.length || 0) > (best?.length || 0) ? m.description : best, 
      null as string | null
    );

    return {
      name: bestName,
      keywords: Array.from(allKeywords),
      keywords_norm: Array.from(allKeywordsNorm),
      material_price: bestMaterialPrice,
      labor_price: bestLaborPrice,
      current_price: bestMaterialPrice + bestLaborPrice,
      category: bestCategory,
      supplier: bestSupplier,
      measurement: bestMeasurement,
      description: bestDescription,
    };
  };

  // Função para mesclar duplicados (mantém um, deleta os outros)
  const handleMerge = async () => {
    if (!mergingGroup || !keepMaterialId) return;

    const idsToDelete = [
      mergingGroup.primaryMaterial.id,
      ...mergingGroup.duplicates.map(d => d.id)
    ].filter(id => id !== keepMaterialId);

    await deleteMutation.mutateAsync(idsToDelete);
    setShowMergeDialog(false);
    setMergingGroup(null);
    setKeepMaterialId("");
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleSelectGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const openMergeDialog = (group: DuplicateGroup) => {
    setMergingGroup(group);
    setKeepMaterialId(group.primaryMaterial.id);
    setShowMergeDialog(true);
  };

  const openSmartMergeDialog = (group: DuplicateGroup) => {
    setMergingGroup(group);
    setMergeStrategy('best_price');
    const preview = calculateSmartMerge(group, 'best_price');
    setMergePreview(preview);
    setShowSmartMergeDialog(true);
  };

  const handleStrategyChange = (strategy: 'best_price' | 'lowest_price' | 'most_keywords' | 'custom') => {
    setMergeStrategy(strategy);
    if (mergingGroup) {
      const preview = calculateSmartMerge(mergingGroup, strategy);
      setMergePreview(preview);
    }
  };

  const handleSmartMerge = async () => {
    if (!mergingGroup || !mergePreview) return;

    try {
      // Atualiza o material principal com os dados mesclados
      const keepId = mergingGroup.primaryMaterial.id;
      await updateMutation.mutateAsync({ 
        id: keepId, 
        data: {
          name: mergePreview.name,
          keywords: mergePreview.keywords,
          material_price: mergePreview.material_price,
          labor_price: mergePreview.labor_price,
          current_price: mergePreview.current_price,
          category: mergePreview.category,
          supplier: mergePreview.supplier,
          measurement: mergePreview.measurement,
          description: mergePreview.description,
        } 
      });

      // Remove os duplicados
      const idsToDelete = mergingGroup.duplicates.map(d => d.id);
      if (idsToDelete.length > 0) {
        await deleteMutation.mutateAsync(idsToDelete);
      }

      toast({ 
        title: "Merge inteligente concluído", 
        description: `Material atualizado com os melhores dados de ${1 + idsToDelete.length} materiais.` 
      });

      setShowSmartMergeDialog(false);
      setMergingGroup(null);
      setMergePreview(null);
    } catch (error) {
      console.error('Erro no smart merge:', error);
    }
  };

  const totalDuplicates = duplicateGroups.reduce((acc, g) => acc + g.duplicates.length, 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Analisando catálogo...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Relatório de Duplicados Potenciais
          </CardTitle>
          <CardDescription>
            Análise de materiais que podem ser duplicados baseada em palavras-chave similares.
            {duplicateGroups.length > 0 && (
              <span className="block mt-1 font-medium text-amber-600">
                Encontrados {duplicateGroups.length} grupos com {totalDuplicates} possíveis duplicados
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar materiais..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Score mínimo:</span>
              <Input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-20"
                min={30}
                max={100}
              />
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reanalizar
            </Button>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum duplicado encontrado</p>
              <p className="text-sm">Seu catálogo parece estar limpo! Tente reduzir o score mínimo para uma análise mais ampla.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGroups.map((group) => (
                <Collapsible
                  key={group.id}
                  open={expandedGroups.has(group.id)}
                  onOpenChange={() => toggleGroup(group.id)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox
                          checked={selectedGroups.has(group.id)}
                          onCheckedChange={() => toggleSelectGroup(group.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {expandedGroups.has(group.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{group.primaryMaterial.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {group.primaryMaterial.unit}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant={group.matchScore >= 90 ? "destructive" : group.matchScore >= 70 ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {group.matchScore}% match
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {group.duplicates.length} possível(is) duplicado(s)
                            </span>
                            {group.matchedTokens.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                • Tokens: {group.matchedTokens.slice(0, 3).join(', ')}
                                {group.matchedTokens.length > 3 && ` +${group.matchedTokens.length - 3}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSmartMergeDialog(group);
                            }}
                          >
                            <Wand2 className="h-4 w-4 mr-2" />
                            Merge Inteligente
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openMergeDialog(group);
                            }}
                          >
                            <Merge className="h-4 w-4 mr-2" />
                            Manual
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/30">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40%]">Material</TableHead>
                              <TableHead>Unidade</TableHead>
                              <TableHead>Preço</TableHead>
                              <TableHead>Match</TableHead>
                              <TableHead>Tokens Comuns</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="bg-primary/5">
                              <TableCell className="font-medium">
                                {group.primaryMaterial.name}
                                <Badge variant="outline" className="ml-2 text-xs">Principal</Badge>
                              </TableCell>
                              <TableCell>{group.primaryMaterial.unit}</TableCell>
                              <TableCell>
                                R$ {((group.primaryMaterial.material_price || 0) + (group.primaryMaterial.labor_price || 0)).toFixed(2)}
                              </TableCell>
                              <TableCell>-</TableCell>
                              <TableCell>
                                {(group.primaryMaterial.keywords_norm || []).slice(0, 5).join(', ')}
                              </TableCell>
                            </TableRow>
                            {group.duplicates.map((dup) => (
                              <TableRow key={dup.id}>
                                <TableCell className="font-medium">{dup.name}</TableCell>
                                <TableCell>{dup.unit}</TableCell>
                                <TableCell>
                                  R$ {((dup.material_price || 0) + (dup.labor_price || 0)).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={dup.matchScore >= 90 ? "destructive" : dup.matchScore >= 70 ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {dup.matchScore}%
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {dup.matchedTokens?.join(', ')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mesclar Materiais Duplicados</DialogTitle>
            <DialogDescription>
              Selecione qual material manter. Os outros serão removidos do catálogo.
            </DialogDescription>
          </DialogHeader>
          
          {mergingGroup && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Escolha o material que deseja manter. Os demais serão excluídos permanentemente.
              </p>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {/* Material principal */}
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    keepMaterialId === mergingGroup.primaryMaterial.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setKeepMaterialId(mergingGroup.primaryMaterial.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={keepMaterialId === mergingGroup.primaryMaterial.id}
                      onCheckedChange={() => setKeepMaterialId(mergingGroup.primaryMaterial.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{mergingGroup.primaryMaterial.name}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span>Unidade: {mergingGroup.primaryMaterial.unit}</span>
                        <span>Preço: R$ {((mergingGroup.primaryMaterial.material_price || 0) + (mergingGroup.primaryMaterial.labor_price || 0)).toFixed(2)}</span>
                        {mergingGroup.primaryMaterial.category && (
                          <span>Categoria: {mergingGroup.primaryMaterial.category}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Duplicados */}
                {mergingGroup.duplicates.map((dup) => (
                  <div
                    key={dup.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      keepMaterialId === dup.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setKeepMaterialId(dup.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={keepMaterialId === dup.id}
                        onCheckedChange={() => setKeepMaterialId(dup.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{dup.name}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span>Unidade: {dup.unit}</span>
                          <span>Preço: R$ {((dup.material_price || 0) + (dup.labor_price || 0)).toFixed(2)}</span>
                          {dup.category && <span>Categoria: {dup.category}</span>}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {dup.matchScore}% match
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleMerge}
              disabled={!keepMaterialId || deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteMutation.isPending ? 'Removendo...' : `Remover ${mergingGroup ? mergingGroup.duplicates.length : 0} Duplicado(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Smart Merge Dialog */}
      <Dialog open={showSmartMergeDialog} onOpenChange={setShowSmartMergeDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Merge Inteligente
            </DialogTitle>
            <DialogDescription>
              O sistema combina automaticamente os melhores dados de cada material duplicado.
            </DialogDescription>
          </DialogHeader>
          
          {mergingGroup && mergePreview && (
            <div className="space-y-6 py-4">
              <div>
                <Label className="text-base font-medium">Estratégia de Merge</Label>
                <RadioGroup 
                  value={mergeStrategy} 
                  onValueChange={(v) => handleStrategyChange(v as typeof mergeStrategy)}
                  className="grid grid-cols-2 gap-4 mt-3"
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="best_price" id="best_price" />
                    <Label htmlFor="best_price" className="cursor-pointer flex-1">
                      <span className="font-medium">Melhor Preço</span>
                      <span className="block text-xs text-muted-foreground">Mantém o maior preço cadastrado</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="lowest_price" id="lowest_price" />
                    <Label htmlFor="lowest_price" className="cursor-pointer flex-1">
                      <span className="font-medium">Menor Preço</span>
                      <span className="block text-xs text-muted-foreground">Mantém o menor preço cadastrado</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="most_keywords" id="most_keywords" />
                    <Label htmlFor="most_keywords" className="cursor-pointer flex-1">
                      <span className="font-medium">Mais Completo</span>
                      <span className="block text-xs text-muted-foreground">Combina todas as informações</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Resultado do Merge
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground">Nome:</span>
                      <p className="font-medium">{mergePreview.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Preço Total:</span>
                      <p className="font-medium text-green-600">
                        R$ {((mergePreview.material_price || 0) + (mergePreview.labor_price || 0)).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Preço Material:</span>
                      <p className="font-medium">R$ {(mergePreview.material_price || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Preço Mão de Obra:</span>
                      <p className="font-medium">R$ {(mergePreview.labor_price || 0).toFixed(2)}</p>
                    </div>
                    {mergePreview.category && (
                      <div>
                        <span className="text-muted-foreground">Categoria:</span>
                        <p className="font-medium">{mergePreview.category}</p>
                      </div>
                    )}
                    {mergePreview.supplier && (
                      <div>
                        <span className="text-muted-foreground">Fornecedor:</span>
                        <p className="font-medium">{mergePreview.supplier}</p>
                      </div>
                    )}
                  </div>
                  {mergePreview.keywords && mergePreview.keywords.length > 0 && (
                    <div className="mt-3">
                      <span className="text-muted-foreground">Keywords combinadas:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(mergePreview.keywords as string[]).slice(0, 10).map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                        ))}
                        {(mergePreview.keywords as string[]).length > 10 && (
                          <Badge variant="outline" className="text-xs">
                            +{(mergePreview.keywords as string[]).length - 10} mais
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <strong>Ação:</strong> O material "{mergingGroup.primaryMaterial.name}" será atualizado com os dados acima e {mergingGroup.duplicates.length} duplicado(s) será(ão) removido(s).
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSmartMergeDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSmartMerge}
              disabled={updateMutation.isPending || deleteMutation.isPending}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              {updateMutation.isPending || deleteMutation.isPending ? 'Processando...' : 'Aplicar Merge Inteligente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
