import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, TrendingDown, TrendingUp, PieChart, Target } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarMoeda } from "@/utils/cltValidation";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--muted))'];

export const DashboardPrimeCost = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCMVDialogOpen, setIsCMVDialogOpen] = useState(false);
  const [isMetaDialogOpen, setIsMetaDialogOpen] = useState(false);
  
  const hoje = new Date();
  const inicioMes = startOfMonth(hoje).toISOString().split('T')[0];
  const fimMes = endOfMonth(hoje).toISOString().split('T')[0];

  const [cmvForm, setCmvForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    valor: 0,
    categoria: "",
    descricao: "",
  });

  const [metaForm, setMetaForm] = useState({
    meta_prime_cost_percent: 50,
    meta_cmo_percent: 30,
    meta_cmv_percent: 20,
  });

  // Buscar CMO das escalas
  const { data: cmoTotal = 0 } = useQuery({
    queryKey: ["rh-cmo-total", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escalas_clt")
        .select("custo_total")
        .gte("data", inicioMes)
        .lte("data", fimMes);
      if (error) throw error;
      return (data || []).reduce((acc, e) => acc + Number(e.custo_total || 0), 0);
    },
  });

  // Buscar CMV lançamentos
  const { data: cmvLancamentos = [] } = useQuery({
    queryKey: ["rh-cmv", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_lancamentos")
        .select("*")
        .gte("data", inicioMes)
        .lte("data", fimMes)
        .order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar metas
  const { data: metas } = useQuery({
    queryKey: ["rh-metas-prime-cost"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_prime_cost")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Buscar receita (entregas)
  const { data: receitaTotal = 0 } = useQuery({
    queryKey: ["rh-receita-total", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entregas_produtividade")
        .select("receita")
        .gte("data", inicioMes)
        .lte("data", fimMes);
      if (error) throw error;
      return (data || []).reduce((acc, e) => acc + Number(e.receita || 0), 0);
    },
  });

  const cmvTotal = cmvLancamentos.reduce((acc, l) => acc + Number(l.valor || 0), 0);
  const primeCost = cmoTotal + cmvTotal;
  const primeCostPercent = receitaTotal > 0 ? (primeCost / receitaTotal) * 100 : 0;
  const cmoPercent = receitaTotal > 0 ? (cmoTotal / receitaTotal) * 100 : 0;
  const cmvPercent = receitaTotal > 0 ? (cmvTotal / receitaTotal) * 100 : 0;

  const metaPrimeCost = metas?.meta_prime_cost_percent || 50;
  const metaCMO = metas?.meta_cmo_percent || 30;
  const metaCMV = metas?.meta_cmv_percent || 20;

  // Score de performance (100 = perfeito)
  const scorePerformance = Math.max(0, Math.min(100, 100 - (primeCostPercent - metaPrimeCost)));

  const pieData = [
    { name: 'CMO', value: cmoTotal },
    { name: 'CMV', value: cmvTotal },
  ];

  const createCMVMutation = useMutation({
    mutationFn: async (data: typeof cmvForm) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("cmv_lancamentos")
        .insert({
          user_id: userData.user.id,
          data: data.data,
          valor: data.valor,
          categoria: data.categoria || null,
          descricao: data.descricao || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-cmv"] });
      toast({ title: "CMV registrado!" });
      setIsCMVDialogOpen(false);
      setCmvForm({ data: format(new Date(), "yyyy-MM-dd"), valor: 0, categoria: "", descricao: "" });
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
    },
  });

  const updateMetasMutation = useMutation({
    mutationFn: async (data: typeof metaForm) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("metas_prime_cost")
        .upsert({
          user_id: userData.user.id,
          meta_prime_cost_percent: data.meta_prime_cost_percent,
          meta_cmo_percent: data.meta_cmo_percent,
          meta_cmv_percent: data.meta_cmv_percent,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-metas-prime-cost"] });
      toast({ title: "Metas atualizadas!" });
      setIsMetaDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prime Cost</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarMoeda(primeCost)}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={primeCostPercent <= metaPrimeCost ? "default" : "destructive"}>
                {primeCostPercent.toFixed(1)}%
              </Badge>
              <span className="text-xs text-muted-foreground">meta: {metaPrimeCost}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMO (Mão de Obra)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarMoeda(cmoTotal)}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={cmoPercent <= metaCMO ? "default" : "secondary"}>
                {cmoPercent.toFixed(1)}%
              </Badge>
              <span className="text-xs text-muted-foreground">meta: {metaCMO}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV (Materiais)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarMoeda(cmvTotal)}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={cmvPercent <= metaCMV ? "default" : "secondary"}>
                {cmvPercent.toFixed(1)}%
              </Badge>
              <span className="text-xs text-muted-foreground">meta: {metaCMV}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score Performance</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scorePerformance.toFixed(0)}</div>
            <Progress value={scorePerformance} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <Button onClick={() => setIsCMVDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Registrar CMV
        </Button>
        <Button variant="outline" onClick={() => {
          setMetaForm({
            meta_prime_cost_percent: metas?.meta_prime_cost_percent || 50,
            meta_cmo_percent: metas?.meta_cmo_percent || 30,
            meta_cmv_percent: metas?.meta_cmv_percent || 20,
          });
          setIsMetaDialogOpen(true);
        }}>
          <Target className="h-4 w-4 mr-2" />
          Configurar Metas
        </Button>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Composição Prime Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meta vs Realizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Prime Cost', meta: metaPrimeCost, realizado: primeCostPercent },
                    { name: 'CMO', meta: metaCMO, realizado: cmoPercent },
                    { name: 'CMV', meta: metaCMV, realizado: cmvPercent },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis unit="%" />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  <Legend />
                  <Bar dataKey="meta" fill="hsl(var(--muted))" name="Meta" />
                  <Bar dataKey="realizado" fill="hsl(var(--primary))" name="Realizado" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog CMV */}
      <Dialog open={isCMVDialogOpen} onOpenChange={setIsCMVDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar CMV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={cmvForm.data}
                onChange={(e) => setCmvForm({...cmvForm, data: e.target.value})}
              />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                value={cmvForm.valor}
                onChange={(e) => setCmvForm({...cmvForm, valor: parseFloat(e.target.value)})}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input
                value={cmvForm.categoria}
                onChange={(e) => setCmvForm({...cmvForm, categoria: e.target.value})}
                placeholder="Ex: Materiais de construção"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={cmvForm.descricao}
                onChange={(e) => setCmvForm({...cmvForm, descricao: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCMVDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createCMVMutation.mutate(cmvForm)}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Metas */}
      <Dialog open={isMetaDialogOpen} onOpenChange={setIsMetaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Metas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Meta Prime Cost (%)</Label>
              <Input
                type="number"
                value={metaForm.meta_prime_cost_percent}
                onChange={(e) => setMetaForm({...metaForm, meta_prime_cost_percent: parseFloat(e.target.value)})}
              />
            </div>
            <div>
              <Label>Meta CMO (%)</Label>
              <Input
                type="number"
                value={metaForm.meta_cmo_percent}
                onChange={(e) => setMetaForm({...metaForm, meta_cmo_percent: parseFloat(e.target.value)})}
              />
            </div>
            <div>
              <Label>Meta CMV (%)</Label>
              <Input
                type="number"
                value={metaForm.meta_cmv_percent}
                onChange={(e) => setMetaForm({...metaForm, meta_cmv_percent: parseFloat(e.target.value)})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMetaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateMetasMutation.mutate(metaForm)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
