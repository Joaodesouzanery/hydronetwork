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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Calendar, Clock, AlertTriangle, Download, Search, Filter
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  calcularHorasTrabalhadas, 
  calcularHorasNoturnas, 
  validarEscalaCLT,
  calcularCustoEscala,
  formatarMoeda,
  gerarEscala6x1,
  gerarEscala12x36,
  CONFIG_CLT_PADRAO
} from "@/utils/cltValidation";

export const EscalasCLT = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    funcionario_id: "",
    data: format(new Date(), "yyyy-MM-dd"),
    hora_entrada: "08:00",
    hora_saida: "17:00",
    hora_inicio_intervalo: "12:00",
    hora_fim_intervalo: "13:00",
    tipo_escala: "diaria",
    is_folga: false,
  });

  const [generateData, setGenerateData] = useState({
    funcionario_id: "",
    tipo_escala: "6x1",
    data_inicio: format(new Date(), "yyyy-MM-dd"),
    hora_entrada: "08:00",
    dias: 30,
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh-funcionarios-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo, salario_base")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: escalas = [], isLoading } = useQuery({
    queryKey: ["rh-escalas", dateFilter],
    queryFn: async () => {
      const startDate = startOfWeek(new Date(dateFilter), { weekStartsOn: 1 });
      const endDate = endOfWeek(new Date(dateFilter), { weekStartsOn: 1 });
      
      const { data, error } = await supabase
        .from("escalas_clt")
        .select(`
          *,
          funcionario:funcionarios(id, nome, cargo, salario_base)
        `)
        .gte("data", format(startDate, "yyyy-MM-dd"))
        .lte("data", format(endDate, "yyyy-MM-dd"))
        .order("data");
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const funcionario = funcionarios.find(f => f.id === data.funcionario_id);
      const salarioBase = funcionario?.salario_base || 0;

      // Calcular horas e custos
      const horasTrabalhadas = data.is_folga ? 0 : calcularHorasTrabalhadas(
        data.hora_entrada, 
        data.hora_saida,
        data.hora_inicio_intervalo,
        data.hora_fim_intervalo
      );
      const horasNoturnas = data.is_folga ? 0 : calcularHorasNoturnas(data.hora_entrada, data.hora_saida);
      const isDomingo = new Date(data.data).getDay() === 0;
      
      const custos = calcularCustoEscala(
        horasTrabalhadas, 
        horasNoturnas, 
        salarioBase, 
        isDomingo, 
        false
      );

      // Validar CLT
      const alertas = validarEscalaCLT(
        horasTrabalhadas,
        horasNoturnas,
        !!data.hora_inicio_intervalo,
        0, // TODO: calcular dias consecutivos
        12 // TODO: calcular descanso anterior
      );

      const { error } = await supabase
        .from("escalas_clt")
        .insert({
          user_id: userData.user.id,
          funcionario_id: data.funcionario_id,
          data: data.data,
          hora_entrada: data.hora_entrada,
          hora_saida: data.hora_saida,
          hora_inicio_intervalo: data.hora_inicio_intervalo || null,
          hora_fim_intervalo: data.hora_fim_intervalo || null,
          tipo_escala: data.tipo_escala,
          is_folga: data.is_folga,
          is_domingo: isDomingo,
          horas_normais: custos.horasNormais,
          horas_extras: custos.horasExtras,
          horas_noturnas: horasNoturnas,
          valor_hora_normal: custos.valorHoraNormal,
          valor_hora_extra: custos.valorHoraExtra,
          valor_adicional_noturno: custos.valorAdicionalNoturno,
          custo_total: custos.custoTotal,
          alertas_clt: alertas as any,
          status_clt: alertas.some(a => a.tipo === 'bloqueio') ? 'bloqueio' : 'ok',
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-escalas"] });
      toast({ title: "Escala criada com sucesso!" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar escala", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: typeof generateData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const funcionario = funcionarios.find(f => f.id === data.funcionario_id);
      const salarioBase = funcionario?.salario_base || 0;

      let escalasGeradas;
      if (data.tipo_escala === "6x1") {
        escalasGeradas = gerarEscala6x1(
          new Date(data.data_inicio),
          data.funcionario_id,
          data.hora_entrada,
          "17:00",
          data.dias
        );
      } else if (data.tipo_escala === "12x36") {
        escalasGeradas = gerarEscala12x36(
          new Date(data.data_inicio),
          data.funcionario_id,
          data.hora_entrada,
          data.dias
        );
      } else {
        throw new Error("Tipo de escala não suportado");
      }

      // Inserir todas as escalas
      for (const escala of escalasGeradas) {
        const horasTrabalhadas = escala.is_folga ? 0 : calcularHorasTrabalhadas(
          escala.hora_entrada, 
          escala.hora_saida
        );
        const horasNoturnas = escala.is_folga ? 0 : calcularHorasNoturnas(escala.hora_entrada, escala.hora_saida);
        const isDomingo = new Date(escala.data).getDay() === 0;
        
        const custos = calcularCustoEscala(
          horasTrabalhadas, 
          horasNoturnas, 
          salarioBase, 
          isDomingo, 
          false
        );

        await supabase
          .from("escalas_clt")
          .upsert({
            user_id: userData.user.id,
            funcionario_id: escala.funcionario_id,
            data: escala.data,
            hora_entrada: escala.hora_entrada,
            hora_saida: escala.hora_saida,
            tipo_escala: escala.tipo_escala,
            is_folga: escala.is_folga,
            is_domingo: isDomingo,
            horas_normais: custos.horasNormais,
            horas_extras: custos.horasExtras,
            horas_noturnas: horasNoturnas,
            custo_total: custos.custoTotal,
            status_clt: 'ok',
          } as any, {
            onConflict: 'funcionario_id,data'
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-escalas"] });
      toast({ title: "Escalas geradas com sucesso!" });
      setIsGenerateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao gerar escalas", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      funcionario_id: "",
      data: format(new Date(), "yyyy-MM-dd"),
      hora_entrada: "08:00",
      hora_saida: "17:00",
      hora_inicio_intervalo: "12:00",
      hora_fim_intervalo: "13:00",
      tipo_escala: "diaria",
      is_folga: false,
    });
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const start = startOfWeek(new Date(dateFilter), { weekStartsOn: 1 });
    return addDays(start, i);
  });

  // Calculate summary stats
  const totalCusto = escalas.reduce((sum, e: any) => sum + Number(e.custo_total || 0), 0);
  const totalHoras = escalas.reduce((sum, e: any) => sum + Number(e.horas_normais || 0) + Number(e.horas_extras || 0), 0);
  const totalExtras = escalas.reduce((sum, e: any) => sum + Number(e.horas_extras || 0), 0);
  const alertasCount = escalas.filter((e: any) => e.alertas_clt && (e.alertas_clt as any[]).length > 0).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalHoras.toFixed(0)}h</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Total de Horas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{totalExtras.toFixed(1)}h</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Horas Extras</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <Download className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatarMoeda(totalCusto)}</p>
                <p className="text-xs text-green-600 dark:text-green-400">Custo Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br ${alertasCount > 0 ? 'from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200 dark:border-red-800' : 'from-gray-50 to-gray-100 dark:from-gray-950/50 dark:to-gray-900/30 border-gray-200 dark:border-gray-800'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${alertasCount > 0 ? 'bg-red-500/10' : 'bg-gray-500/10'}`}>
                <AlertTriangle className={`h-5 w-5 ${alertasCount > 0 ? 'text-red-600' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${alertasCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>{alertasCount}</p>
                <p className={`text-xs ${alertasCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>Alertas CLT</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-44"
          />
          <Select value={viewMode} onValueChange={(v: "lista" | "calendario") => setViewMode(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lista">Lista</SelectItem>
              <SelectItem value="calendario">Calendário</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsGenerateDialogOpen(true)}>
            <Calendar className="h-4 w-4 mr-2" />
            Gerar Escala
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="shadow-md">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : escalas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma escala encontrada para este período
                  </TableCell>
                </TableRow>
              ) : (
                escalas.map((escala: any) => (
                  <TableRow 
                    key={escala.id}
                    className={escala.is_folga ? "bg-muted/30" : ""}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{escala.funcionario?.nome}</p>
                        <p className="text-xs text-muted-foreground">{escala.funcionario?.cargo}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {format(new Date(escala.data), "dd/MM (EEE)", { locale: ptBR })}
                        {escala.is_domingo && <Badge variant="secondary" className="text-xs">Dom</Badge>}
                        {escala.is_feriado && <Badge variant="destructive" className="text-xs">Feriado</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {escala.is_folga ? (
                        <Badge variant="outline">Folga</Badge>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {escala.hora_entrada?.slice(0, 5)} - {escala.hora_saida?.slice(0, 5)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!escala.is_folga && (
                        <div>
                          <span>{Number(escala.horas_normais || 0).toFixed(1)}h</span>
                          {Number(escala.horas_extras) > 0 && (
                            <span className="text-amber-600 ml-1">
                              +{Number(escala.horas_extras).toFixed(1)}h extra
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {!escala.is_folga && formatarMoeda(Number(escala.custo_total || 0))}
                    </TableCell>
                    <TableCell>
                      {escala.status_clt === 'bloqueio' ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Bloqueio
                        </Badge>
                      ) : escala.alertas_clt && (escala.alertas_clt as any[]).length > 0 ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          {(escala.alertas_clt as any[]).length} alerta(s)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog para adicionar escala */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Escala</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário</Label>
              <Select 
                value={formData.funcionario_id} 
                onValueChange={(v) => setFormData({...formData, funcionario_id: v})}
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
              <Label>Data</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({...formData, data: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Entrada</Label>
                <Input
                  type="time"
                  value={formData.hora_entrada}
                  onChange={(e) => setFormData({...formData, hora_entrada: e.target.value})}
                />
              </div>
              <div>
                <Label>Saída</Label>
                <Input
                  type="time"
                  value={formData.hora_saida}
                  onChange={(e) => setFormData({...formData, hora_saida: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início Intervalo</Label>
                <Input
                  type="time"
                  value={formData.hora_inicio_intervalo}
                  onChange={(e) => setFormData({...formData, hora_inicio_intervalo: e.target.value})}
                />
              </div>
              <div>
                <Label>Fim Intervalo</Label>
                <Input
                  type="time"
                  value={formData.hora_fim_intervalo}
                  onChange={(e) => setFormData({...formData, hora_fim_intervalo: e.target.value})}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate(formData)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para gerar escalas */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Escala Automática</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário</Label>
              <Select 
                value={generateData.funcionario_id} 
                onValueChange={(v) => setGenerateData({...generateData, funcionario_id: v})}
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
              <Label>Tipo de Escala</Label>
              <Select 
                value={generateData.tipo_escala} 
                onValueChange={(v) => setGenerateData({...generateData, tipo_escala: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6x1">6x1 (6 dias trabalho, 1 folga)</SelectItem>
                  <SelectItem value="12x36">12x36 (12h trabalho, 36h folga)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Início</Label>
              <Input
                type="date"
                value={generateData.data_inicio}
                onChange={(e) => setGenerateData({...generateData, data_inicio: e.target.value})}
              />
            </div>
            <div>
              <Label>Hora Entrada</Label>
              <Input
                type="time"
                value={generateData.hora_entrada}
                onChange={(e) => setGenerateData({...generateData, hora_entrada: e.target.value})}
              />
            </div>
            <div>
              <Label>Dias a gerar</Label>
              <Input
                type="number"
                value={generateData.dias}
                onChange={(e) => setGenerateData({...generateData, dias: parseInt(e.target.value)})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => generateMutation.mutate(generateData)}>Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
