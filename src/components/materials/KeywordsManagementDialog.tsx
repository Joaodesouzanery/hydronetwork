import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Download, Upload, Edit2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface KeywordsManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KeywordsManagementDialog = ({ open, onOpenChange }: KeywordsManagementDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKeyword, setNewKeyword] = useState({ type: 'material', value: '', synonyms: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSynonyms, setEditSynonyms] = useState('');

  const { data: keywords, isLoading } = useQuery({
    queryKey: ['custom-keywords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_keywords')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const addMutation = useMutation({
    mutationFn: async (keyword: { type: string; value: string; synonyms: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const synonymsArray = keyword.synonyms
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const { error } = await supabase.from('custom_keywords').insert({
        keyword_type: keyword.type,
        keyword_value: keyword.value,
        synonyms: synonymsArray,
        created_by_user_id: user.id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-keywords'] });
      toast({ title: "Palavra-chave adicionada!" });
      setNewKeyword({ type: 'material', value: '', synonyms: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar palavra-chave",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateSynonymsMutation = useMutation({
    mutationFn: async ({ id, synonyms }: { id: string; synonyms: string }) => {
      const synonymsArray = synonyms
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const { error } = await supabase
        .from('custom_keywords')
        .update({ synonyms: synonymsArray })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-keywords'] });
      toast({ title: "Sinônimos atualizados!" });
      setEditingId(null);
      setEditSynonyms('');
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar sinônimos",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_keywords')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-keywords'] });
      toast({ title: "Palavra-chave removida!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover palavra-chave",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const exportKeywords = () => {
    const json = JSON.stringify(keywords, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'palavras-chave.json';
    a.click();
  };

  const importKeywords = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const toInsert = imported.map((k: any) => ({
          keyword_type: k.keyword_type,
          keyword_value: k.keyword_value,
          synonyms: k.synonyms || [],
          created_by_user_id: user.id
        }));

        const { error } = await supabase.from('custom_keywords').insert(toInsert);
        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ['custom-keywords'] });
        toast({ title: "Palavras-chave importadas!" });
      } catch (error: any) {
        toast({
          title: "Erro ao importar",
          description: error.message,
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  const keywordsByType = keywords?.reduce((acc: any, keyword) => {
    if (!acc[keyword.keyword_type]) {
      acc[keyword.keyword_type] = [];
    }
    acc[keyword.keyword_type].push(keyword);
    return acc;
  }, {});

  const handleAddKeyword = () => {
    if (!newKeyword.value.trim()) {
      toast({
        title: "Preencha o valor da palavra-chave",
        variant: "destructive"
      });
      return;
    }
    addMutation.mutate(newKeyword);
  };

  const startEditSynonyms = (keyword: any) => {
    setEditingId(keyword.id);
    setEditSynonyms(keyword.synonyms?.join(', ') || '');
  };

  const saveSynonyms = (id: string) => {
    updateSynonymsMutation.mutate({ id, synonyms: editSynonyms });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Palavras-chave e Sinônimos</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Adicionar Nova Palavra-chave</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={newKeyword.type}
                  onValueChange={(value) => setNewKeyword({ ...newKeyword, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material (Sinônimos)</SelectItem>
                    <SelectItem value="brand">Marca</SelectItem>
                    <SelectItem value="color">Cor</SelectItem>
                    <SelectItem value="unit">Unidade</SelectItem>
                    <SelectItem value="general">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  value={newKeyword.value}
                  onChange={(e) => setNewKeyword({ ...newKeyword, value: e.target.value })}
                  placeholder="Ex: Tigre"
                />
              </div>
              <div className="space-y-2">
                <Label>Sinônimos (separados por vírgula)</Label>
                <Input
                  value={newKeyword.synonyms}
                  onChange={(e) => setNewKeyword({ ...newKeyword, synonyms: e.target.value })}
                  placeholder="Ex: Tigre SA, Tigre Brasil"
                />
              </div>
              <div className="space-y-2">
                <Label className="invisible">Ação</Label>
                <Button
                  onClick={handleAddKeyword}
                  disabled={addMutation.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={exportKeywords}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" asChild>
              <label>
                <Upload className="h-4 w-4 mr-2" />
                Importar
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={importKeywords}
                />
              </label>
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : !keywords?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma palavra-chave cadastrada
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(keywordsByType || {}).map(([type, items]: [string, any]) => (
                <div key={type} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 capitalize">
                    {type === 'material' ? 'Materiais (Sinônimos)' :
                     type === 'brand' ? 'Marcas' :
                     type === 'color' ? 'Cores' :
                     type === 'unit' ? 'Unidades' : 'Geral'}
                  </h3>
                  <div className="space-y-3">
                    {items.map((keyword: any) => (
                      <div key={keyword.id} className="flex flex-col gap-2 p-3 bg-muted/50 rounded">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{keyword.keyword_value}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(keyword.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {editingId !== keyword.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditSynonyms(keyword)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        {editingId === keyword.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editSynonyms}
                              onChange={(e) => setEditSynonyms(e.target.value)}
                              placeholder="Sinônimos separados por vírgula"
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              onClick={() => saveSynonyms(keyword.id)}
                              disabled={updateSynonymsMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setEditSynonyms('');
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          keyword.synonyms && keyword.synonyms.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-sm text-muted-foreground">Sinônimos:</span>
                              {keyword.synonyms.map((syn: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {syn}
                                </Badge>
                              ))}
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
