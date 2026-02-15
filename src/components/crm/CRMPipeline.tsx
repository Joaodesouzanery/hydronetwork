import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Settings, DollarSign, Building2, User, Calendar, 
  ChevronRight, Trophy, XCircle, GripVertical, Target, TrendingUp
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  default_probability: number;
}

interface Deal {
  id: string;
  name: string;
  account_id: string | null;
  contact_id: string | null;
  stage_id: string | null;
  estimated_value: number;
  probability: number;
  expected_close_date: string | null;
  status: "open" | "won" | "lost";
  lost_reason: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  account?: { id: string; name: string } | null;
  contact?: { id: string; full_name: string } | null;
}

const DEFAULT_STAGES = [
  { name: "Prospecção", color: "#6366F1", position: 0, default_probability: 10 },
  { name: "Qualificação", color: "#8B5CF6", position: 1, default_probability: 25 },
  { name: "Proposta", color: "#EC4899", position: 2, default_probability: 50 },
  { name: "Negociação", color: "#F59E0B", position: 3, default_probability: 75 },
  { name: "Fechamento", color: "#10B981", position: 4, default_probability: 90 },
];

export const CRMPipeline = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState<{ deal: Deal; type: "won" | "lost" } | null>(null);
  const [lostReason, setLostReason] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    account_id: "",
    contact_id: "",
    stage_id: "",
    estimated_value: "",
    probability: "",
    expected_close_date: "",
    notes: "",
    tags: "",
  });

  const { data: stages = [], isLoading: loadingStages } = useQuery({
    queryKey: ["crm-pipeline-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipeline_stages")
        .select("*")
        .order("position");
      if (error) throw error;
      return (data || []) as Stage[];
    },
  });

  const { data: deals = [], isLoading: loadingDeals } = useQuery({
    queryKey: ["crm-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("*, account:crm_accounts(id, name), contact:crm_contacts(id, full_name)")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Deal[];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["crm-accounts-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_accounts")
        .select("id, name")
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["crm-contacts-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select("id, full_name, account_id")
        .eq("is_archived", false)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Inicializar estágios padrão se não existirem
  const initializeStagesMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const stagesWithUser = DEFAULT_STAGES.map(s => ({
        ...s,
        created_by_user_id: userData.user!.id,
      }));

      const { error } = await supabase
        .from("crm_pipeline_stages")
        .insert(stagesWithUser);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-pipeline-stages"] });
    },
  });

  useEffect(() => {
    if (!loadingStages && stages.length === 0) {
      initializeStagesMutation.mutate();
    }
  }, [loadingStages, stages.length]);

  const createDealMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const stage = stages.find(s => s.id === data.stage_id);

      const { data: result, error } = await supabase
        .from("crm_deals")
        .insert({
          created_by_user_id: userData.user.id,
          name: data.name,
          account_id: data.account_id || null,
          contact_id: data.contact_id || null,
          stage_id: data.stage_id || null,
          estimated_value: parseFloat(data.estimated_value) || 0,
          probability: parseInt(data.probability) || stage?.default_probability || 50,
          expected_close_date: data.expected_close_date || null,
          notes: data.notes || null,
          tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "deal",
        entity_id: result.id,
        action: "created",
        new_values: result as any,
      }]);

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      toast({ title: "Oportunidade criada com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao criar oportunidade", description: error.message, variant: "destructive" });
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const oldDeal = deals.find(d => d.id === id);

      const { data: result, error } = await supabase
        .from("crm_deals")
        .update({
          name: data.name,
          account_id: data.account_id || null,
          contact_id: data.contact_id || null,
          stage_id: data.stage_id || null,
          estimated_value: parseFloat(data.estimated_value) || 0,
          probability: parseInt(data.probability) || 50,
          expected_close_date: data.expected_close_date || null,
          notes: data.notes || null,
          tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "deal",
        entity_id: id,
        action: "updated",
        old_values: oldDeal as any,
        new_values: result as any,
      }]);

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      toast({ title: "Oportunidade atualizada com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar oportunidade", description: error.message, variant: "destructive" });
    },
  });

  const moveDealMutation = useMutation({
    mutationFn: async ({ dealId, newStageId }: { dealId: string; newStageId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const deal = deals.find(d => d.id === dealId);
      const newStage = stages.find(s => s.id === newStageId);

      const { error } = await supabase
        .from("crm_deals")
        .update({
          stage_id: newStageId,
          probability: newStage?.default_probability || 50,
        })
        .eq("id", dealId);

      if (error) throw error;

      await supabase.from("crm_deal_stage_history").insert([{
        deal_id: dealId,
        from_stage_id: deal?.stage_id || null,
        to_stage_id: newStageId,
        changed_by_user_id: userData.user.id,
      }]);

      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "deal",
        entity_id: dealId,
        action: "stage_changed",
        old_values: { stage_id: deal?.stage_id } as any,
        new_values: { stage_id: newStageId } as any,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      toast({ title: "Oportunidade movida!" });
    },
  });

  const closeDealMutation = useMutation({
    mutationFn: async ({ dealId, status, reason }: { dealId: string; status: "won" | "lost"; reason?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("crm_deals")
        .update({
          status,
          lost_reason: status === "lost" ? reason : null,
          closed_at: new Date().toISOString(),
        })
        .eq("id", dealId);

      if (error) throw error;

      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "deal",
        entity_id: dealId,
        action: status === "won" ? "deal_won" : "deal_lost",
        new_values: { status, lost_reason: reason } as any,
      }]);
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deals-dashboard"] });
      toast({ 
        title: status === "won" ? "🎉 Oportunidade ganha!" : "Oportunidade perdida",
        variant: status === "won" ? "default" : "destructive",
      });
      setShowCloseDialog(null);
      setLostReason("");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      account_id: "",
      contact_id: "",
      stage_id: stages[0]?.id || "",
      estimated_value: "",
      probability: "",
      expected_close_date: "",
      notes: "",
      tags: "",
    });
    setEditingDeal(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    if (editingDeal) {
      updateDealMutation.mutate({ id: editingDeal.id, data: formData });
    } else {
      createDealMutation.mutate(formData);
    }
  };

  const openEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setFormData({
      name: deal.name,
      account_id: deal.account_id || "",
      contact_id: deal.contact_id || "",
      stage_id: deal.stage_id || "",
      estimated_value: deal.estimated_value?.toString() || "",
      probability: deal.probability?.toString() || "",
      expected_close_date: deal.expected_close_date || "",
      notes: deal.notes || "",
      tags: deal.tags?.join(", ") || "",
    });
    setIsDialogOpen(true);
  };

  const getDealsForStage = (stageId: string) => {
    return deals.filter(d => d.stage_id === stageId);
  };

  const getTotalValueForStage = (stageId: string) => {
    return getDealsForStage(stageId).reduce((sum, d) => sum + Number(d.estimated_value || 0), 0);
  };

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData("dealId", dealId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("dealId");
    if (dealId) {
      const deal = deals.find(d => d.id === dealId);
      if (deal && deal.stage_id !== stageId) {
        moveDealMutation.mutate({ dealId, newStageId: stageId });
      }
    }
  };

  const filteredContacts = formData.account_id 
    ? contacts.filter(c => c.account_id === formData.account_id)
    : contacts;

  // Calculate totals
  const totalOpenValue = deals.reduce((sum, d) => sum + Number(d.estimated_value || 0), 0);
  const totalWeightedValue = deals.reduce((sum, d) => sum + Number(d.estimated_value || 0) * (d.probability / 100), 0);

  return (
    <div className="space-y-6">
      {/* Pipeline Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/30 border-indigo-200 dark:border-indigo-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{deals.length}</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">Oportunidades Abertas</p>
              </div>
              <Target className="h-8 w-8 text-indigo-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  R$ {totalOpenValue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">Valor Total em Aberto</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  R$ {totalWeightedValue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Valor Ponderado</p>
              </div>
              <ChevronRight className="h-8 w-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stages.length}</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">Estágios no Pipeline</p>
              </div>
              <Settings className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Pipeline de Vendas</h2>
          <p className="text-sm text-muted-foreground">
            Arraste as oportunidades entre os estágios para atualizar
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="shadow-md">
          <Plus className="h-4 w-4 mr-2" />
          Nova Oportunidade
        </Button>
      </div>

      {loadingStages || loadingDeals ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = getDealsForStage(stage.id);
            const totalValue = getTotalValueForStage(stage.id);

            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-80"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        <CardTitle className="text-sm font-medium">
                          {stage.name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {stageDeals.length}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2 min-h-[300px]">
                    {stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        className="p-3 bg-background border rounded-lg cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                        onClick={() => openEdit(deal)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{deal.name}</p>
                            {deal.account && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Building2 className="h-3 w-3" />
                                {deal.account.name}
                              </p>
                            )}
                            {deal.contact && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {deal.contact.full_name}
                              </p>
                            )}
                          </div>
                          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-green-600">
                            R$ {Number(deal.estimated_value || 0).toLocaleString("pt-BR")}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCloseDialog({ deal, type: "won" });
                              }}
                            >
                              <Trophy className="h-3 w-3 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCloseDialog({ deal, type: "lost" });
                              }}
                            >
                              <XCircle className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </div>
                        {deal.expected_close_date && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(deal.expected_close_date), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog de criação/edição de oportunidade */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDeal ? "Editar Oportunidade" : "Nova Oportunidade"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome da Oportunidade *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Projeto Residencial XYZ"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="account_id">Empresa</Label>
                <Select
                  value={formData.account_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, account_id: value === "none" ? "" : value, contact_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact_id">Contato Principal</Label>
                <Select
                  value={formData.contact_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, contact_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {filteredContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="stage_id">Estágio</Label>
                <Select
                  value={formData.stage_id}
                  onValueChange={(value) => {
                    const stage = stages.find(s => s.id === value);
                    setFormData({ 
                      ...formData, 
                      stage_id: value,
                      probability: stage?.default_probability?.toString() || formData.probability,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="probability">Probabilidade (%)</Label>
                <Input
                  id="probability"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                  placeholder="50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="estimated_value">Valor Estimado (R$)</Label>
                <Input
                  id="estimated_value"
                  type="number"
                  step="0.01"
                  value={formData.estimated_value}
                  onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                  placeholder="10000.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expected_close_date">Previsão de Fechamento</Label>
                <Input
                  id="expected_close_date"
                  type="date"
                  value={formData.expected_close_date}
                  onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="residencial, urgente, grande porte"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas sobre a oportunidade..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createDealMutation.isPending || updateDealMutation.isPending}>
              {editingDeal ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de fechar oportunidade */}
      <Dialog open={!!showCloseDialog} onOpenChange={(open) => !open && setShowCloseDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {showCloseDialog?.type === "won" ? (
                <>
                  <Trophy className="h-5 w-5 text-green-600" />
                  Marcar como Ganha
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Marcar como Perdida
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {showCloseDialog?.type === "won" 
                ? "Parabéns! Confirme que esta oportunidade foi ganha."
                : "Informe o motivo da perda para registro."
              }
            </DialogDescription>
          </DialogHeader>

          {showCloseDialog?.type === "lost" && (
            <div className="grid gap-2 py-4">
              <Label htmlFor="lost_reason">Motivo da Perda *</Label>
              <Textarea
                id="lost_reason"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Explique o motivo da perda..."
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCloseDialog(null); setLostReason(""); }}>
              Cancelar
            </Button>
            <Button
              variant={showCloseDialog?.type === "won" ? "default" : "destructive"}
              onClick={() => {
                if (showCloseDialog?.type === "lost" && !lostReason.trim()) {
                  toast({ title: "Motivo é obrigatório", variant: "destructive" });
                  return;
                }
                closeDealMutation.mutate({
                  dealId: showCloseDialog!.deal.id,
                  status: showCloseDialog!.type,
                  reason: lostReason,
                });
              }}
              disabled={closeDealMutation.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
