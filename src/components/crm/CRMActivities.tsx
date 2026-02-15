import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Search, Phone, Users, Calendar, CheckSquare, FileText,
  Clock, AlertCircle, Filter, Pencil, Trash2
} from "lucide-react";
import { format, isBefore, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Activity {
  id: string;
  activity_type: "task" | "call" | "meeting" | "followup" | "note";
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  status: "pending" | "completed" | "cancelled";
  is_recurring: boolean;
  recurrence_pattern: string | null;
  contact_id: string | null;
  account_id: string | null;
  deal_id: string | null;
  completed_at: string | null;
  created_at: string;
  contact?: { id: string; full_name: string } | null;
  account?: { id: string; name: string } | null;
  deal?: { id: string; name: string } | null;
}

const ACTIVITY_TYPES = [
  { value: "task", label: "Tarefa", icon: CheckSquare, color: "bg-blue-100 text-blue-800" },
  { value: "call", label: "Ligação", icon: Phone, color: "bg-green-100 text-green-800" },
  { value: "meeting", label: "Reunião", icon: Users, color: "bg-purple-100 text-purple-800" },
  { value: "followup", label: "Follow-up", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  { value: "note", label: "Nota Interna", icon: FileText, color: "bg-gray-100 text-gray-800" },
];

export const CRMActivities = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const [formData, setFormData] = useState({
    activity_type: "task" as "task" | "call" | "meeting" | "followup" | "note",
    title: "",
    description: "",
    due_date: "",
    due_time: "",
    contact_id: "",
    account_id: "",
    deal_id: "",
    is_recurring: false,
    recurrence_pattern: "",
  });

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["crm-activities", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("crm_activities")
        .select(`
          *,
          contact:crm_contacts(id, full_name),
          account:crm_accounts(id, name),
          deal:crm_deals(id, name)
        `)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus as "pending" | "completed" | "cancelled");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Activity[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["crm-contacts-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select("id, full_name")
        .eq("is_archived", false)
        .order("full_name");
      if (error) throw error;
      return data || [];
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

  const { data: deals = [] } = useQuery({
    queryKey: ["crm-deals-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("id, name")
        .eq("status", "open")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { data: result, error } = await supabase
        .from("crm_activities")
        .insert({
          created_by_user_id: userData.user.id,
          activity_type: data.activity_type,
          title: data.title,
          description: data.description || null,
          due_date: data.due_date || null,
          due_time: data.due_time || null,
          contact_id: data.contact_id || null,
          account_id: data.account_id || null,
          deal_id: data.deal_id || null,
          is_recurring: data.is_recurring,
          recurrence_pattern: data.recurrence_pattern || null,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "activity",
        entity_id: result.id,
        action: "created",
        new_values: result as any,
      }]);

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-activities"] });
      toast({ title: "Atividade criada com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao criar atividade", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { data: result, error } = await supabase
        .from("crm_activities")
        .update({
          activity_type: data.activity_type,
          title: data.title,
          description: data.description || null,
          due_date: data.due_date || null,
          due_time: data.due_time || null,
          contact_id: data.contact_id || null,
          account_id: data.account_id || null,
          deal_id: data.deal_id || null,
          is_recurring: data.is_recurring,
          recurrence_pattern: data.recurrence_pattern || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-activities"] });
      toast({ title: "Atividade atualizada!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("crm_activities")
        .update({
          status: completed ? "completed" : "pending",
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;

      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "activity",
        entity_id: id,
        action: completed ? "completed" : "reopened",
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-activities"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_activities")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-activities"] });
      toast({ title: "Atividade removida" });
    },
  });

  const resetForm = () => {
    setFormData({
      activity_type: "task",
      title: "",
      description: "",
      due_date: "",
      due_time: "",
      contact_id: "",
      account_id: "",
      deal_id: "",
      is_recurring: false,
      recurrence_pattern: "",
    });
    setEditingActivity(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: "Título é obrigatório", variant: "destructive" });
      return;
    }

    if (editingActivity) {
      updateMutation.mutate({ id: editingActivity.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setFormData({
      activity_type: activity.activity_type as "task" | "call" | "meeting" | "followup" | "note",
      title: activity.title,
      description: activity.description || "",
      due_date: activity.due_date || "",
      due_time: activity.due_time || "",
      contact_id: activity.contact_id || "",
      account_id: activity.account_id || "",
      deal_id: activity.deal_id || "",
      is_recurring: activity.is_recurring,
      recurrence_pattern: activity.recurrence_pattern || "",
    });
    setIsDialogOpen(true);
  };

  const isOverdue = (activity: Activity) => {
    if (!activity.due_date || activity.status !== "pending") return false;
    return isBefore(parseISO(activity.due_date), new Date()) && !isToday(parseISO(activity.due_date));
  };

  const isDueToday = (activity: Activity) => {
    if (!activity.due_date) return false;
    return isToday(parseISO(activity.due_date));
  };

  const filteredActivities = activities.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === "all" || a.activity_type === filterType;
    return matchesSearch && matchesType;
  });

  const getActivityTypeInfo = (type: string) => {
    return ACTIVITY_TYPES.find(t => t.value === type) || ACTIVITY_TYPES[0];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar atividades..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {ACTIVITY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Atividade
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Vinculado a</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma atividade encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredActivities.map((activity) => {
                  const typeInfo = getActivityTypeInfo(activity.activity_type);
                  const TypeIcon = typeInfo.icon;
                  const overdue = isOverdue(activity);
                  const dueToday = isDueToday(activity);

                  return (
                    <TableRow 
                      key={activity.id} 
                      className={`
                        ${activity.status === "completed" ? "opacity-60" : ""}
                        ${overdue ? "bg-red-50" : ""}
                        ${dueToday && activity.status === "pending" ? "bg-yellow-50" : ""}
                      `}
                    >
                      <TableCell>
                        <Checkbox
                          checked={activity.status === "completed"}
                          onCheckedChange={(checked) => 
                            toggleStatusMutation.mutate({ id: activity.id, completed: !!checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className={activity.status === "completed" ? "line-through" : ""}>
                          <p className="font-medium">{activity.title}</p>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {activity.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeInfo.color}>
                          <TypeIcon className="h-3 w-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {activity.due_date ? (
                          <div className={`flex items-center gap-1 ${overdue ? "text-red-600 font-medium" : ""}`}>
                            {overdue && <AlertCircle className="h-3 w-3" />}
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(activity.due_date), "dd/MM/yyyy", { locale: ptBR })}
                            {activity.due_time && ` ${activity.due_time.slice(0, 5)}`}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sem data</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {activity.contact && (
                            <p className="text-xs">{activity.contact.full_name}</p>
                          )}
                          {activity.account && (
                            <p className="text-xs text-muted-foreground">{activity.account.name}</p>
                          )}
                          {activity.deal && (
                            <p className="text-xs text-muted-foreground">{activity.deal.name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          activity.status === "completed" ? "default" :
                          activity.status === "cancelled" ? "secondary" :
                          overdue ? "destructive" : "outline"
                        }>
                          {activity.status === "completed" ? "Concluída" :
                           activity.status === "cancelled" ? "Cancelada" :
                           overdue ? "Atrasada" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(activity)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => deleteMutation.mutate(activity.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de criação/edição */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingActivity ? "Editar Atividade" : "Nova Atividade"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="activity_type">Tipo de Atividade</Label>
              <Select
                value={formData.activity_type}
                onValueChange={(value: any) => setFormData({ ...formData, activity_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Título da atividade"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalhes da atividade..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="due_date">Data</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="due_time">Hora</Label>
                <Input
                  id="due_time"
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contact_id">Contato</Label>
              <Select
                value={formData.contact_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, contact_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="account_id">Empresa</Label>
              <Select
                value={formData.account_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, account_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deal_id">Oportunidade</Label>
              <Select
                value={formData.deal_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, deal_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {deals.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingActivity ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
