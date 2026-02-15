import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, CalendarOff, UserX, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarMoeda } from "@/utils/cltValidation";

export const FeriodosFaltas = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("feriados");
  const [isFeriadoDialogOpen, setIsFeriadoDialogOpen] = useState(false);
  const [isFaltaDialogOpen, setIsFaltaDialogOpen] = useState(false);

  const [feriadoForm, setFeriadoForm] = useState({
    nome: "",
    data: "",
    tipo: "nacional",
    recorrente: false,
  });

  const [faltaForm, setFaltaForm] = useState({
    funcionario_id: "",
    data: format(new Date(), "yyyy-MM-dd"),
    tipo: "injustificada",
    observacoes: "",
  });

  const { data: feriados = [] } = useQuery({
    queryKey: ["rh-feriados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriados")
        .select("*")
        .order("data");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: faltas = [] } = useQuery({
    queryKey: ["rh-faltas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faltas_funcionarios")
        .select(`
          *,
          funcionario:funcionarios(id, nome, cargo)
        `)
        .order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh-funcionarios-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const createFeriadoMutation = useMutation({
    mutationFn: async (data: typeof feriadoForm) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("feriados")
        .insert({
          user_id: userData.user.id,
          nome: data.nome,
          data: data.data,
          tipo: data.tipo,
          recorrente: data.recorrente,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-feriados"] });
      toast({ title: "Feriado cadastrado!" });
      setIsFeriadoDialogOpen(false);
      setFeriadoForm({ nome: "", data: "", tipo: "nacional", recorrente: false });
    },
    onError: (error) => {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    },
  });

  const deleteFeriadoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feriados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-feriados"] });
      toast({ title: "Feriado removido" });
    },
  });

  const createFaltaMutation = useMutation({
    mutationFn: async (data: typeof faltaForm) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("faltas_funcionarios")
        .insert({
          user_id: userData.user.id,
          funcionario_id: data.funcionario_id,
          data: data.data,
          tipo: data.tipo,
          observacoes: data.observacoes || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-faltas"] });
      toast({ title: "Falta registrada!" });
      setIsFaltaDialogOpen(false);
      setFaltaForm({ funcionario_id: "", data: format(new Date(), "yyyy-MM-dd"), tipo: "injustificada", observacoes: "" });
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
    },
  });

  const deleteFaltaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("faltas_funcionarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-faltas"] });
      toast({ title: "Falta removida" });
    },
  });

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="feriados" className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4" />
            Feriados
          </TabsTrigger>
          <TabsTrigger value="faltas" className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Faltas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feriados">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Feriados</CardTitle>
              <Button onClick={() => setIsFeriadoDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Feriado
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Recorrente</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feriados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum feriado cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    feriados.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.nome}</TableCell>
                        <TableCell>
                          {format(new Date(f.data), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{f.tipo}</Badge>
                        </TableCell>
                        <TableCell>
                          {f.recorrente ? (
                            <Badge className="bg-green-100 text-green-800">Sim</Badge>
                          ) : (
                            <Badge variant="secondary">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => deleteFeriadoMutation.mutate(f.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faltas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Faltas Registradas</CardTitle>
              <Button onClick={() => setIsFaltaDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Falta
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faltas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma falta registrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    faltas.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{f.funcionario?.nome}</p>
                            <p className="text-xs text-muted-foreground">{f.funcionario?.cargo}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(f.data), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            f.tipo === 'justificada' ? 'default' :
                            f.tipo === 'injustificada' ? 'destructive' : 'secondary'
                          }>
                            {f.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {f.observacoes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => deleteFaltaMutation.mutate(f.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Feriado */}
      <Dialog open={isFeriadoDialogOpen} onOpenChange={setIsFeriadoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Feriado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={feriadoForm.nome}
                onChange={(e) => setFeriadoForm({...feriadoForm, nome: e.target.value})}
                placeholder="Ex: Natal"
              />
            </div>
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={feriadoForm.data}
                onChange={(e) => setFeriadoForm({...feriadoForm, data: e.target.value})}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select 
                value={feriadoForm.tipo} 
                onValueChange={(v) => setFeriadoForm({...feriadoForm, tipo: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nacional">Nacional</SelectItem>
                  <SelectItem value="estadual">Estadual</SelectItem>
                  <SelectItem value="municipal">Municipal</SelectItem>
                  <SelectItem value="ponto_facultativo">Ponto Facultativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeriadoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createFeriadoMutation.mutate(feriadoForm)}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Falta */}
      <Dialog open={isFaltaDialogOpen} onOpenChange={setIsFaltaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Falta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário *</Label>
              <Select 
                value={faltaForm.funcionario_id} 
                onValueChange={(v) => setFaltaForm({...faltaForm, funcionario_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={faltaForm.data}
                onChange={(e) => setFaltaForm({...faltaForm, data: e.target.value})}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select 
                value={faltaForm.tipo} 
                onValueChange={(v) => setFaltaForm({...faltaForm, tipo: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="justificada">Justificada</SelectItem>
                  <SelectItem value="injustificada">Injustificada</SelectItem>
                  <SelectItem value="atraso">Atraso</SelectItem>
                  <SelectItem value="atestado">Atestado Médico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={faltaForm.observacoes}
                onChange={(e) => setFaltaForm({...faltaForm, observacoes: e.target.value})}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFaltaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createFaltaMutation.mutate(faltaForm)}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
