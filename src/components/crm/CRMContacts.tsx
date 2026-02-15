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
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Search, Mail, Phone, Building2, Archive, RotateCcw, Pencil, 
  History, Upload, AlertTriangle, User, PlusCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  phone_secondary: string | null;
  job_title: string | null;
  tags: string[];
  status: string;
  is_archived: boolean;
  notes: string | null;
  account_id: string | null;
  created_at: string;
  account?: { id: string; name: string } | null;
}

interface DuplicateCheck {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  matchType: string;
}

export const CRMContacts = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCheck[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingContact, setPendingContact] = useState<any>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    phone_secondary: "",
    job_title: "",
    tags: "",
    notes: "",
    account_id: "",
    status: "active",
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm-contacts", showArchived],
    queryFn: async () => {
      const query = supabase
        .from("crm_contacts")
        .select("*, account:crm_accounts(id, name)")
        .order("created_at", { ascending: false });

      if (!showArchived) {
        query.eq("is_archived", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Contact[];
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

  const { data: history = [] } = useQuery({
    queryKey: ["crm-contact-history", showHistory],
    enabled: !!showHistory,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_history")
        .select("*")
        .eq("entity_type", "contact")
        .eq("entity_id", showHistory!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const normalizeText = (text: string) => 
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const checkDuplicates = (name: string, email: string, phone: string): DuplicateCheck[] => {
    const found: DuplicateCheck[] = [];
    const normName = normalizeText(name);
    const normEmail = email ? normalizeText(email) : "";
    const normPhone = phone ? phone.replace(/\D/g, "") : "";

    for (const c of contacts) {
      if (editingContact && c.id === editingContact.id) continue;

      const matches: string[] = [];
      
      if (c.email && normEmail && normalizeText(c.email) === normEmail) {
        matches.push("E-mail");
      }
      
      if (c.phone && normPhone) {
        const cPhone = c.phone.replace(/\D/g, "");
        if (cPhone === normPhone) matches.push("Telefone");
      }
      
      const cName = normalizeText(c.full_name);
      const similarity = calculateSimilarity(normName, cName);
      if (similarity > 0.8) matches.push("Nome similar");

      if (matches.length > 0) {
        found.push({
          id: c.id,
          full_name: c.full_name,
          email: c.email,
          phone: c.phone,
          matchType: matches.join(", "),
        });
      }
    }

    return found;
  };

  const calculateSimilarity = (s1: string, s2: string): number => {
    if (s1 === s2) return 1;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1;
    
    const editDistance = (a: string, b: string): number => {
      const matrix: number[][] = [];
      for (let i = 0; i <= a.length; i++) matrix[i] = [i];
      for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          );
        }
      }
      return matrix[a.length][b.length];
    };
    
    return (longer.length - editDistance(longer, shorter)) / longer.length;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { data: result, error } = await supabase
        .from("crm_contacts")
        .insert([{
          created_by_user_id: userData.user.id,
          full_name: data.full_name,
          email: data.email || null,
          phone: data.phone || null,
          phone_secondary: data.phone_secondary || null,
          job_title: data.job_title || null,
          tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          notes: data.notes || null,
          account_id: data.account_id || null,
          status: data.status as "active" | "inactive" | "archived",
        }])
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico
      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "contact",
        entity_id: result.id,
        action: "created",
        new_values: result as any,
      }]);

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast({ title: "Contato criado com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao criar contato", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const oldContact = contacts.find(c => c.id === id);

      const { data: result, error } = await supabase
        .from("crm_contacts")
        .update({
          full_name: data.full_name,
          email: data.email || null,
          phone: data.phone || null,
          phone_secondary: data.phone_secondary || null,
          job_title: data.job_title || null,
          tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          notes: data.notes || null,
          account_id: data.account_id || null,
          status: data.status as "active" | "inactive" | "archived",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico
      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "contact",
        entity_id: id,
        action: "updated",
        old_values: oldContact as any,
        new_values: result as any,
      }]);

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast({ title: "Contato atualizado com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar contato", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("crm_contacts")
        .update({ is_archived: archive })
        .eq("id", id);

      if (error) throw error;

      await supabase.from("crm_history").insert([{
        created_by_user_id: userData.user.id,
        entity_type: "contact",
        entity_id: id,
        action: archive ? "archived" : "restored",
      }]);
    },
    onSuccess: (_, { archive }) => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast({ title: archive ? "Contato arquivado" : "Contato restaurado" });
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("crm_accounts")
        .insert([{
          created_by_user_id: userData.user.id,
          name: name.trim(),
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-accounts-select"] });
      setFormData({ ...formData, account_id: data.id });
      setNewAccountName("");
      setIsCreatingAccount(false);
      toast({ title: "Empresa criada com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar empresa", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      phone_secondary: "",
      job_title: "",
      tags: "",
      notes: "",
      account_id: "",
      status: "active",
    });
    setEditingContact(null);
    setIsDialogOpen(false);
    setDuplicates([]);
    setShowDuplicateWarning(false);
    setPendingContact(null);
  };

  const handleSubmit = () => {
    if (!formData.full_name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    const found = checkDuplicates(formData.full_name, formData.email, formData.phone);
    
    if (found.length > 0 && !showDuplicateWarning) {
      setDuplicates(found);
      setPendingContact(formData);
      setShowDuplicateWarning(true);
      return;
    }

    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleConfirmCreate = () => {
    if (pendingContact) {
      if (editingContact) {
        updateMutation.mutate({ id: editingContact.id, data: pendingContact });
      } else {
        createMutation.mutate(pendingContact);
      }
    }
    setShowDuplicateWarning(false);
    setDuplicates([]);
    setPendingContact(null);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      full_name: contact.full_name,
      email: contact.email || "",
      phone: contact.phone || "",
      phone_secondary: contact.phone_secondary || "",
      job_title: contact.job_title || "",
      tags: contact.tags?.join(", ") || "",
      notes: contact.notes || "",
      account_id: contact.account_id || "",
      status: contact.status,
    });
    setIsDialogOpen(true);
  };

  const filteredContacts = contacts.filter(c => {
    const searchLower = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(searchLower) ||
      (c.email && c.email.toLowerCase().includes(searchLower)) ||
      (c.phone && c.phone.includes(searchLower)) ||
      (c.job_title && c.job_title.toLowerCase().includes(searchLower))
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "inactive": return "bg-yellow-100 text-yellow-800";
      case "archived": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{contacts.filter(c => !c.is_archived).length}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Contatos Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <Building2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{contacts.filter(c => c.account_id && !c.is_archived).length}</p>
                <p className="text-xs text-green-600 dark:text-green-400">Com Empresa</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/10">
                <Mail className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{contacts.filter(c => c.email && !c.is_archived).length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Com E-mail</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-500/10">
                <Archive className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{contacts.filter(c => c.is_archived).length}</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">Arquivados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, telefone ou cargo..."
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
            {showArchived ? "Ocultar Arquivados" : "Ver Arquivados"}
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="shadow-md">
            <Plus className="h-4 w-4 mr-2" />
            Novo Contato
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Cargo</TableHead>
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
              ) : filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum contato encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className={contact.is_archived ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {contact.full_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.account && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {contact.account.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{contact.job_title}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(contact.status)}>
                        {contact.status === "active" ? "Ativo" : contact.status === "inactive" ? "Inativo" : "Arquivado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(contact)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setShowHistory(contact.id)}>
                          <History className="h-4 w-4" />
                        </Button>
                        {contact.is_archived ? (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => archiveMutation.mutate({ id: contact.id, archive: false })}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => archiveMutation.mutate({ id: contact.id, archive: true })}
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
              {editingContact ? "Editar Contato" : "Novo Contato"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nome do contato"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone_secondary">Telefone Secundário</Label>
                <Input
                  id="phone_secondary"
                  value={formData.phone_secondary}
                  onChange={(e) => setFormData({ ...formData, phone_secondary: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="job_title">Cargo/Função</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  placeholder="Diretor, Gerente, etc."
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="account_id">Empresa Vinculada</Label>
              {isCreatingAccount ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da nova empresa"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => {
                      if (newAccountName.trim()) {
                        createAccountMutation.mutate(newAccountName);
                      }
                    }}
                    disabled={!newAccountName.trim() || createAccountMutation.isPending}
                  >
                    {createAccountMutation.isPending ? "..." : "Salvar"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setIsCreatingAccount(false);
                      setNewAccountName("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={formData.account_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, account_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione uma empresa (opcional)" />
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
                  <Button 
                    size="icon" 
                    variant="outline" 
                    title="Criar nova empresa"
                    onClick={() => setIsCreatingAccount(true)}
                  >
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="cliente, importante, construção"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => 
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas sobre o contato..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingContact ? "Salvar" : "Criar"}
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
              Encontramos contatos similares. Deseja continuar mesmo assim?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {duplicates.map((dup) => (
              <div key={dup.id} className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{dup.full_name}</p>
                {dup.email && <p className="text-sm text-muted-foreground">{dup.email}</p>}
                {dup.phone && <p className="text-sm text-muted-foreground">{dup.phone}</p>}
                <Badge variant="outline" className="mt-1">{dup.matchType}</Badge>
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
              Histórico do Contato
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
