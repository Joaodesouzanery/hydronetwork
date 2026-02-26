import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, FolderOpen, Trash2, Copy, Edit, X, Plus, Loader2 } from "lucide-react";
import {
  SavedPlan, getSavedPlans, getSavedPlansAsync, deleteSavedPlanAsync,
  duplicatePlanAsync, savePlanAsync, createDefaultPlan,
} from "@/engine/savedPlanning";

interface SavedPlansDialogProps {
  onLoadPlan: (plan: SavedPlan) => void;
  onClose: () => void;
  currentPlanId?: string;
}

export function SavedPlansDialog({ onLoadPlan, onClose, currentPlanId }: SavedPlansDialogProps) {
  const [plans, setPlans] = useState<SavedPlan[]>(getSavedPlans());
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [newPlanName, setNewPlanName] = useState("");

  // Load plans from Supabase on mount
  useEffect(() => {
    getSavedPlansAsync()
      .then(setPlans)
      .catch(() => setPlans(getSavedPlans()))
      .finally(() => setLoading(false));
  }, []);

  const refreshPlans = async () => {
    try {
      const updated = await getSavedPlansAsync();
      setPlans(updated);
    } catch {
      setPlans(getSavedPlans());
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSavedPlanAsync(id);
    await refreshPlans();
    toast.success("Planejamento excluído.");
  };

  const handleDuplicate = async (id: string) => {
    const copy = await duplicatePlanAsync(id);
    if (copy) {
      await refreshPlans();
      toast.success("Planejamento duplicado.");
    }
  };

  const handleEditSave = async (plan: SavedPlan) => {
    await savePlanAsync({ ...plan, name: editName, description: editDesc });
    await refreshPlans();
    setEditingId(null);
    toast.success("Planejamento atualizado.");
  };

  const handleCreateNew = async () => {
    if (!newPlanName.trim()) {
      toast.error("Digite um nome para o planejamento.");
      return;
    }
    const plan = createDefaultPlan(newPlanName.trim());
    await savePlanAsync(plan);
    await refreshPlans();
    setNewPlanName("");
    toast.success("Novo planejamento criado.");
    onLoadPlan(plan);
  };

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-5 w-5" /> Planejamentos Salvos
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new */}
        <div className="flex gap-2">
          <Input
            placeholder="Nome do novo planejamento..."
            value={newPlanName}
            onChange={e => setNewPlanName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreateNew()}
            className="flex-1"
          />
          <Button onClick={handleCreateNew} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Criar Novo
          </Button>
        </div>

        {/* Plans list */}
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando planejamentos...</span>
          </div>
        ) : plans.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">
            Nenhum planejamento salvo. Crie um novo acima.
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {plans.map(plan => (
              <Card key={plan.id} className={`${plan.id === currentPlanId ? "border-primary bg-primary/5" : ""}`}>
                <CardContent className="pt-3 pb-3">
                  {editingId === plan.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Nome"
                      />
                      <Input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        placeholder="Descrição (opcional)"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEditSave(plan)}>
                          <Save className="h-3 w-3 mr-1" /> Salvar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm truncate">{plan.name}</h4>
                          {plan.id === currentPlanId && (
                            <Badge variant="outline" className="text-xs border-primary text-primary">Ativo</Badge>
                          )}
                        </div>
                        {plan.description && (
                          <p className="text-xs text-muted-foreground truncate">{plan.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{plan.numEquipes} equipes</span>
                          <span>{plan.metrosDia} m/dia</span>
                          <span>{plan.trechoMetadata.length} trechos config.</span>
                          {plan.scheduleSnapshot && (
                            <span>{plan.scheduleSnapshot.totalDays} dias</span>
                          )}
                          <span>{new Date(plan.updatedAt).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onLoadPlan(plan)} title="Abrir">
                          <FolderOpen className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                          setEditingId(plan.id);
                          setEditName(plan.name);
                          setEditDesc(plan.description);
                        }} title="Editar">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDuplicate(plan.id)} title="Duplicar">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(plan.id)} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
