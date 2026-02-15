import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Search, Building2, Archive, RotateCcw, Pencil, 
  History, Users, Target, MapPin, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Account {
  id: string;
  name: string;
  cnpj: string | null;
  sector: string | null;
  city: string | null;
  state: string | null;
  tags: string[];
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  contacts_count?: number;
  deals_count?: number;
}

export const CRMAccounts = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicates, setDuplicates] = useState<Account[]>([]);
  const [pendingAccount, setPendingAccount] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    sector: "",
    city: "",
    state: "",
    tags: "",
    notes: "",
  });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["crm-accounts", showArchived],
    queryFn: async () => {
      const query = supabase
        .from("crm_accounts")
        .select("*")
        .order("name");

      if (!showArchived) {
        query.eq("is_archived", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Account[];
    },
  });

  const { data: contactCounts = {} } = useQuery({
    queryKey: ["crm-accounts-contact-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select("account_id")
        .not("account_id", "is", null);
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data || []).forEach((c: any) => {
        counts[c.account_id] = (counts[c.account_id] || 0) + 1;
      });
      return counts;
    },
  });

  const { data: dealCounts = {} } = useQuery({
    queryKey: ["crm-accounts-deal-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("account_id")
        .not("account_id", "is", null);
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data || []).forEach((d: any) => {
        counts[d.account_id] = (counts[d.account_id] || 0) + 1;
      });
      return counts;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["crm-account-history", showHistory],
    enabled: !!showHistory,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_history")
        .select("*")
        .eq("entity_type", "account")
        .eq("entity_id", showHistory!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const normalizeText = (text: string) => 
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const checkDuplicates = (name: string, cnpj: string): Account[] => {
    const found: Account[] = [];
    const normName = normalizeText(name);
    const normCnpj = cnpj ? cnpj.replace(/\D/g, "") : "";

    for (const a of accounts) {
      if (editingAccount && a.id === editingAccount.id) continue;

      if (a.cnpj && normCnpj) {
        const aCnpj = a.cnpj.replace(/\D/g, "");
        if (aCnpj === normCnpj) {
          found.push(a);
          continue;
        }
      }

      const aName = normalizeText(a.name);
      if (aName === normName || aName.includes(normName) || normName.includes(aName)) {
        found.push(a);
      }
    }

    return found;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { data: result, error } = await supabase
        .from("crm_accounts")
        .insert({
          created_by_user_id: userData.user.id,
          name: data.name,
          cnpj: data.cnpj || null,
          sector: data.sector || null,
          city: data.city || null,
          state: data.state || null,
          tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "account",
        entity_id: result.id,
        action: "created",
        new_values: result as any,
      }]);

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-accounts"] });
      toast({ title: "Empresa criada com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao criar empresa", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const oldAccount = accounts.find(a => a.id === id);

      const { data: result, error } = await supabase
        .from("crm_accounts")
        .update({
          name: data.name,
          cnpj: data.cnpj || null,
          sector: data.sector || null,
          city: data.city || null,
          state: data.state || null,
          tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          notes: data.notes || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "account",
        entity_id: id,
        action: "updated",
        old_values: oldAccount as any,
        new_values: result as any,
      }]);

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-accounts"] });
      toast({ title: "Empresa atualizada com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar empresa", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("crm_accounts")
        .update({ is_archived: archive })
        .eq("id", id);

      if (error) throw error;

      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "account",
        entity_id: id,
        action: archive ? "archived" : "restored",
      }]);
    },
    onSuccess: (_, { archive }) => {
      queryClient.invalidateQueries({ queryKey: ["crm-accounts"] });
      toast({ title: archive ? "Empresa arquivada" : "Empresa restaurada" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      cnpj: "",
      sector: "",
      city: "",
      state: "",
      tags: "",
      notes: "",
    });
    setEditingAccount(null);
    setIsDialogOpen(false);
    setDuplicates([]);
    setShowDuplicateWarning(false);
    setPendingAccount(null);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    const found = checkDuplicates(formData.name, formData.cnpj);
    
    if (found.length > 0 && !showDuplicateWarning) {
      setDuplicates(found);
      setPendingAccount(formData);
      setShowDuplicateWarning(true);
      return;
    }

    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleConfirmCreate = () => {
    if (pendingAccount) {
      if (editingAccount) {
        updateMutation.mutate({ id: editingAccount.id, data: pendingAccount });
      } else {
        createMutation.mutate(pendingAccount);
      }
    }
    setShowDuplicateWarning(false);
    setDuplicates([]);
    setPendingAccount(null);
  };

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      cnpj: account.cnpj || "",
      sector: account.sector || "",
      city: account.city || "",
      state: account.state || "",
      tags: account.tags?.join(", ") || "",
      notes: account.notes || "",
    });
    setIsDialogOpen(true);
  };

  const filteredAccounts = accounts.filter(a => {
    const searchLower = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(searchLower) ||
      (a.cnpj && a.cnpj.includes(searchLower)) ||
      (a.sector && a.sector.toLowerCase().includes(searchLower)) ||
      (a.city && a.city.toLowerCase().includes(searchLower))
    );
  });

  const BRAZILIAN_STATES = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={showArchived ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="h-4 w-4 mr-2" />
            {showArchived ? "Ocultar Arquivadas" : "Ver Arquivadas"}
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Contatos</TableHead>
                <TableHead>Oportunidades</TableHead>
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
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account) => (
                  <TableRow key={account.id} className={account.is_archived ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p>{account.name}</p>
                          {account.tags && account.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {account.tags.slice(0, 2).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {account.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{account.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {account.cnpj}
                    </TableCell>
                    <TableCell>{account.sector}</TableCell>
                    <TableCell>
                      {(account.city || account.state) && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {account.city}{account.city && account.state ? "/" : ""}{account.state}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {contactCounts[account.id] || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        {dealCounts[account.id] || 0}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(account)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setShowHistory(account.id)}>
                          <History className="h-4 w-4" />
                        </Button>
                        {account.is_archived ? (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => archiveMutation.mutate({ id: account.id, archive: false })}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => archiveMutation.mutate({ id: account.id, archive: true })}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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
              {editingAccount ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome da Empresa *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sector">Setor</Label>
                <Input
                  id="sector"
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                  placeholder="Construção, Varejo, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="São Paulo"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="cliente, parceiro, grande porte"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas sobre a empresa..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingAccount ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de aviso de duplicatas */}
      <Dialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Possíveis Duplicatas Encontradas
            </DialogTitle>
            <DialogDescription>
              Encontramos empresas similares. Deseja continuar mesmo assim?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {duplicates.map((dup) => (
              <div key={dup.id} className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{dup.name}</p>
                {dup.cnpj && <p className="text-sm text-muted-foreground">CNPJ: {dup.cnpj}</p>}
                {dup.city && <p className="text-sm text-muted-foreground">{dup.city}/{dup.state}</p>}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateWarning(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmCreate}>
              Criar Mesmo Assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de histórico */}
      <Dialog open={!!showHistory} onOpenChange={(open) => !open && setShowHistory(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico da Empresa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum histórico registrado
              </p>
            ) : (
              history.map((h: any) => (
                <div key={h.id} className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline">{h.action}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {h.notes && <p className="text-sm mt-2">{h.notes}</p>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
