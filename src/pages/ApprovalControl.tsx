import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Plus, ClipboardCheck, Clock, CheckCircle, XCircle, AlertTriangle,
  Search, Trash2, Edit, RotateCcw, Send, FileText, Calendar
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

type Status = "pendente" | "em_analise" | "aprovado" | "reprovado" | "revisao";

interface ApprovalRecord {
  id: string;
  nome_projeto: string;
  etapa: string;
  sub_etapa: string;
  emissor: string;
  destinatario: string;
  data_envio: string;
  prazo: string;
  status: Status;
  observacoes: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock },
  em_analise: { label: "Em Análise", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Search },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle },
  reprovado: { label: "Reprovado", color: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
  revisao: { label: "Revisão", color: "bg-orange-100 text-orange-800 border-orange-300", icon: RotateCcw },
};

const ETAPAS = [
  "Projeto Básico",
  "Projeto Executivo",
  "Projeto Complementar",
  "Licenciamento Ambiental",
  "Aprovação Prefeitura",
  "Aprovação Concessionária",
  "As-Built",
  "Outro",
];

const LS_KEY = "approval_control_records";

const genId = () => crypto.randomUUID();

const ApprovalControl = () => {
  const [records, setRecords] = useState<ApprovalRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
  });
  const [filter, setFilter] = useState({ status: "all", etapa: "all", search: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_projeto: "", etapa: "", sub_etapa: "", emissor: "",
    destinatario: "", data_envio: new Date().toISOString().split("T")[0],
    prazo: "", observacoes: "",
  });

  // Load from Supabase on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { data } = await (supabase as any)
          .from("project_approval_control")
          .select("*")
          .eq("user_id", session.user.id)
          .order("data_envio", { ascending: false });
        if (data && data.length > 0) {
          const localIds = new Set(records.map(r => r.id));
          const cloudOnly = data.filter((r: any) => !localIds.has(r.id)).map((r: any) => ({
            id: r.id, nome_projeto: r.nome_projeto, etapa: r.etapa,
            sub_etapa: r.sub_etapa || "", emissor: r.emissor,
            destinatario: r.destinatario || "", data_envio: r.data_envio,
            prazo: r.prazo || "", status: r.status, observacoes: r.observacoes || "",
            updated_at: r.updated_at,
          }));
          if (cloudOnly.length > 0) {
            const merged = [...records, ...cloudOnly];
            setRecords(merged);
            localStorage.setItem(LS_KEY, JSON.stringify(merged));
          }
        }
      } catch { /* offline */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (updated: ApprovalRecord[]) => {
    setRecords(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  const syncToSupabase = async (record: ApprovalRecord) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      await (supabase as any).from("project_approval_control").upsert({
        id: record.id,
        user_id: session.user.id,
        nome_projeto: record.nome_projeto,
        etapa: record.etapa,
        sub_etapa: record.sub_etapa || null,
        emissor: record.emissor,
        destinatario: record.destinatario || null,
        data_envio: record.data_envio,
        prazo: record.prazo || null,
        status: record.status,
        observacoes: record.observacoes || null,
      }, { onConflict: "id" });
    } catch { /* offline */ }
  };

  const deleteFromSupabase = async (id: string) => {
    try {
      await (supabase as any).from("project_approval_control").delete().eq("id", id);
    } catch { /* offline */ }
  };

  const resetForm = () => {
    setForm({
      nome_projeto: "", etapa: "", sub_etapa: "", emissor: "",
      destinatario: "", data_envio: new Date().toISOString().split("T")[0],
      prazo: "", observacoes: "",
    });
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!form.nome_projeto || !form.etapa || !form.emissor) {
      toast.error("Preencha os campos obrigatórios: Projeto, Etapa e Emissor");
      return;
    }
    if (editingId) {
      const updated = records.map(r => r.id === editingId
        ? { ...r, ...form, updated_at: new Date().toISOString() }
        : r
      );
      save(updated);
      const record = updated.find(r => r.id === editingId)!;
      syncToSupabase(record);
      toast.success("Registro atualizado!");
    } else {
      const record: ApprovalRecord = {
        id: genId(), ...form, status: "pendente" as Status,
        updated_at: new Date().toISOString(),
      };
      const updated = [record, ...records];
      save(updated);
      syncToSupabase(record);
      toast.success("Submissão registrada!");
    }
    resetForm();
    setDialogOpen(false);
  };

  const handleEdit = (record: ApprovalRecord) => {
    setForm({
      nome_projeto: record.nome_projeto, etapa: record.etapa,
      sub_etapa: record.sub_etapa, emissor: record.emissor,
      destinatario: record.destinatario,
      data_envio: record.data_envio?.split("T")[0] || "",
      prazo: record.prazo?.split("T")[0] || "", observacoes: record.observacoes,
    });
    setEditingId(record.id);
    setDialogOpen(true);
  };

  const handleStatusChange = (id: string, newStatus: Status) => {
    const updated = records.map(r => r.id === id
      ? { ...r, status: newStatus, updated_at: new Date().toISOString() }
      : r
    );
    save(updated);
    const record = updated.find(r => r.id === id)!;
    syncToSupabase(record);
    toast.success(`Status alterado para: ${STATUS_CONFIG[newStatus].label}`);
  };

  const handleDelete = (id: string) => {
    const updated = records.filter(r => r.id !== id);
    save(updated);
    deleteFromSupabase(id);
    toast.success("Registro excluído");
  };

  const isOverdue = (r: ApprovalRecord) =>
    r.prazo && new Date(r.prazo) < new Date() && ["pendente", "em_analise"].includes(r.status);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filter.status !== "all" && filter.status !== "vencidos" && r.status !== filter.status) return false;
      if (filter.status === "vencidos" && !isOverdue(r)) return false;
      if (filter.etapa !== "all" && r.etapa !== filter.etapa) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        if (!r.nome_projeto.toLowerCase().includes(q) &&
            !r.emissor.toLowerCase().includes(q) &&
            !r.destinatario.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [records, filter]);

  const stats = useMemo(() => ({
    total: records.length,
    pendentes: records.filter(r => r.status === "pendente").length,
    aprovados: records.filter(r => r.status === "aprovado").length,
    vencidos: records.filter(r => isOverdue(r)).length,
  }), [records]);

  const formatDate = (d: string) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6 space-y-6 overflow-auto">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
                <ClipboardCheck className="h-6 w-6 text-primary" />
                Controle de Aprovação de Projetos
              </h1>
              <p className="text-sm text-muted-foreground">Gerencie submissões, prazos e aprovações de documentos</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Enviados", value: stats.total, icon: Send, color: "text-blue-600" },
              { label: "Pendentes", value: stats.pendentes, icon: Clock, color: "text-yellow-600" },
              { label: "Aprovados", value: stats.aprovados, icon: CheckCircle, color: "text-green-600" },
              { label: "Vencidos", value: stats.vencidos, icon: AlertTriangle, color: "text-red-600" },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    </div>
                    <s.icon className={`h-8 w-8 ${s.color} opacity-30`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters + New Button */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Projeto, emissor ou destinatário..."
                  className="pl-9"
                  value={filter.search}
                  onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                />
              </div>
            </div>
            <div className="w-[180px]">
              <Label className="text-xs">Etapa</Label>
              <Select value={filter.etapa} onValueChange={v => setFilter(f => ({ ...f, etapa: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as etapas</SelectItem>
                  {ETAPAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Nova Submissão
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {editingId ? "Editar Submissão" : "Nova Submissão"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome do Projeto *</Label>
                    <Input value={form.nome_projeto} onChange={e => setForm(f => ({ ...f, nome_projeto: e.target.value }))} placeholder="Ex: Rede de Esgoto — Bairro Norte" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Etapa *</Label>
                      <Select value={form.etapa} onValueChange={v => setForm(f => ({ ...f, etapa: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {ETAPAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Sub-etapa / Revisão</Label>
                      <Input value={form.sub_etapa} onChange={e => setForm(f => ({ ...f, sub_etapa: e.target.value }))} placeholder="Ex: Rev. 01" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Emissor *</Label>
                      <Input value={form.emissor} onChange={e => setForm(f => ({ ...f, emissor: e.target.value }))} placeholder="Quem enviou" />
                    </div>
                    <div>
                      <Label>Destinatário</Label>
                      <Input value={form.destinatario} onChange={e => setForm(f => ({ ...f, destinatario: e.target.value }))} placeholder="Para quem" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Data de Envio</Label>
                      <Input type="date" value={form.data_envio} onChange={e => setForm(f => ({ ...f, data_envio: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Prazo</Label>
                      <Input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Notas adicionais..." rows={3} />
                  </div>
                  <Button onClick={handleSubmit} className="w-full gap-2">
                    {editingId ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingId ? "Salvar Alterações" : "Registrar Submissão"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tabs */}
          <Tabs value={filter.status} onValueChange={v => setFilter(f => ({ ...f, status: v }))}>
            <TabsList>
              <TabsTrigger value="all">Todos ({records.length})</TabsTrigger>
              <TabsTrigger value="pendente">Pendentes ({stats.pendentes})</TabsTrigger>
              <TabsTrigger value="aprovado">Aprovados ({stats.aprovados})</TabsTrigger>
              <TabsTrigger value="vencidos" className="text-red-600">Vencidos ({stats.vencidos})</TabsTrigger>
            </TabsList>

            <TabsContent value={filter.status} className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Data Envio</TableHead>
                          <TableHead>Projeto</TableHead>
                          <TableHead>Etapa</TableHead>
                          <TableHead>Sub-etapa</TableHead>
                          <TableHead>Emissor</TableHead>
                          <TableHead>Destinatário</TableHead>
                          <TableHead className="w-[100px]">Prazo</TableHead>
                          <TableHead className="w-[120px]">Status</TableHead>
                          <TableHead className="w-[100px]">Atualizado</TableHead>
                          <TableHead className="w-[160px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                              <p className="font-medium">Nenhum registro encontrado</p>
                              <p className="text-xs mt-1">Clique em "Nova Submissão" para começar</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filtered.map(r => {
                            const overdue = isOverdue(r);
                            const cfg = STATUS_CONFIG[r.status];
                            return (
                              <TableRow key={r.id} className={overdue ? "bg-red-50 dark:bg-red-950/20" : ""}>
                                <TableCell className="text-xs font-mono">{formatDate(r.data_envio)}</TableCell>
                                <TableCell className="font-medium text-sm max-w-[200px] truncate">{r.nome_projeto}</TableCell>
                                <TableCell className="text-xs">{r.etapa}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{r.sub_etapa || "—"}</TableCell>
                                <TableCell className="text-xs">{r.emissor}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{r.destinatario || "—"}</TableCell>
                                <TableCell className={`text-xs font-mono ${overdue ? "text-red-600 font-bold" : ""}`}>
                                  {formatDate(r.prazo)}
                                  {overdue && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                                    <cfg.icon className="h-3 w-3 mr-1" />
                                    {cfg.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground font-mono">{formatDate(r.updated_at)}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1 justify-end">
                                    {r.status !== "aprovado" && (
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Aprovar"
                                        onClick={() => handleStatusChange(r.id, "aprovado")}>
                                        <CheckCircle className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {r.status !== "reprovado" && (
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" title="Reprovar"
                                        onClick={() => handleStatusChange(r.id, "reprovado")}>
                                        <XCircle className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {r.status !== "revisao" && (
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-600" title="Pedir Revisão"
                                        onClick={() => handleStatusChange(r.id, "revisao")}>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar"
                                      onClick={() => handleEdit(r)}>
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir"
                                      onClick={() => handleDelete(r.id)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default ApprovalControl;
