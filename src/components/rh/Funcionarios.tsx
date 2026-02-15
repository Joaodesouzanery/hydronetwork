import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, User } from "lucide-react";
import { format } from "date-fns";
import { formatarMoeda } from "@/utils/cltValidation";

interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  departamento: string | null;
  salario_base: number;
  data_admissao: string | null;
  tipo_contrato: string;
  ativo: boolean;
  email: string | null;
  telefone: string | null;
  unidade_id: string | null;
  unidade?: { id: string; nome: string } | null;
}

export const Funcionarios = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState<Funcionario | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    cargo: "",
    departamento: "",
    salario_base: 0,
    data_admissao: "",
    tipo_contrato: "clt",
    email: "",
    telefone: "",
    unidade_id: "",
  });

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["rh-funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select(`
          *,
          unidade:unidades(id, nome)
        `)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as Funcionario[];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["rh-unidades-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("funcionarios")
        .insert({
          user_id: userData.user.id,
          nome: data.nome,
          cpf: data.cpf || null,
          cargo: data.cargo || null,
          departamento: data.departamento || null,
          salario_base: data.salario_base,
          data_admissao: data.data_admissao || null,
          tipo_contrato: data.tipo_contrato,
          email: data.email || null,
          telefone: data.telefone || null,
          unidade_id: data.unidade_id || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-funcionarios"] });
      toast({ title: "Funcionário cadastrado!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("funcionarios")
        .update({
          nome: data.nome,
          cpf: data.cpf || null,
          cargo: data.cargo || null,
          departamento: data.departamento || null,
          salario_base: data.salario_base,
          data_admissao: data.data_admissao || null,
          tipo_contrato: data.tipo_contrato,
          email: data.email || null,
          telefone: data.telefone || null,
          unidade_id: data.unidade_id || null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-funcionarios"] });
      toast({ title: "Funcionário atualizado!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete - apenas desativa
      const { error } = await supabase
        .from("funcionarios")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-funcionarios"] });
      toast({ title: "Funcionário desativado" });
    },
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      cpf: "",
      cargo: "",
      departamento: "",
      salario_base: 0,
      data_admissao: "",
      tipo_contrato: "clt",
      email: "",
      telefone: "",
      unidade_id: "",
    });
    setEditingFuncionario(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    if (editingFuncionario) {
      updateMutation.mutate({ id: editingFuncionario.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (func: Funcionario) => {
    setEditingFuncionario(func);
    setFormData({
      nome: func.nome,
      cpf: func.cpf || "",
      cargo: func.cargo || "",
      departamento: func.departamento || "",
      salario_base: func.salario_base || 0,
      data_admissao: func.data_admissao || "",
      tipo_contrato: func.tipo_contrato || "clt",
      email: func.email || "",
      telefone: func.telefone || "",
      unidade_id: func.unidade_id || "",
    });
    setIsDialogOpen(true);
  };

  const filteredFuncionarios = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(search.toLowerCase()) ||
    (f.cargo && f.cargo.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar funcionários..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Funcionário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Salário Base</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : filteredFuncionarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum funcionário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredFuncionarios.map((func) => (
                  <TableRow key={func.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{func.nome}</p>
                          {func.email && <p className="text-xs text-muted-foreground">{func.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{func.cargo || "-"}</TableCell>
                    <TableCell>{func.unidade?.nome || "-"}</TableCell>
                    <TableCell>{formatarMoeda(func.salario_base || 0)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{func.tipo_contrato?.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(func)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteMutation.mutate(func.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFuncionario ? "Editar Funcionário" : "Novo Funcionário"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                />
              </div>
              <div>
                <Label>CPF</Label>
                <Input
                  value={formData.cpf}
                  onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cargo</Label>
                <Input
                  value={formData.cargo}
                  onChange={(e) => setFormData({...formData, cargo: e.target.value})}
                />
              </div>
              <div>
                <Label>Departamento</Label>
                <Input
                  value={formData.departamento}
                  onChange={(e) => setFormData({...formData, departamento: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Salário Base</Label>
                <Input
                  type="number"
                  value={formData.salario_base}
                  onChange={(e) => setFormData({...formData, salario_base: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label>Data Admissão</Label>
                <Input
                  type="date"
                  value={formData.data_admissao}
                  onChange={(e) => setFormData({...formData, data_admissao: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo Contrato</Label>
                <Select 
                  value={formData.tipo_contrato} 
                  onValueChange={(v) => setFormData({...formData, tipo_contrato: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clt">CLT</SelectItem>
                    <SelectItem value="pj">PJ</SelectItem>
                    <SelectItem value="temporario">Temporário</SelectItem>
                    <SelectItem value="estagio">Estágio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select 
                  value={formData.unidade_id} 
                  onValueChange={(v) => setFormData({...formData, unidade_id: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSubmit}>
              {editingFuncionario ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
