import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Building2, Download, Filter, TrendingUp, Users, FileText, Eye, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--destructive))'];

const Production = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [obras, setObras] = useState<any[]>([]);
  const [selectedObra, setSelectedObra] = useState<string>("all");
  const [producaoData, setProducaoData] = useState<any[]>([]);
  const [metasData, setMetasData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadData();
  }, [selectedObra]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Carregar obras
      const { data: obrasData } = await supabase
          .from('obras')
          .select('*')
          .order('created_at', { ascending: false });
      
      if (obrasData) setObras(obrasData);

      // Carregar dados de produção
        let query = supabase
          .from('formularios_producao')
          .select('*, obras(nome)');
        
        if (selectedObra !== "all") {
          query = query.eq('obra_id', selectedObra);
        }

        const { data: producao } = await query;
        if (producao) setProducaoData(producao);

        // Carregar metas
        let metasQuery = supabase
          .from('metas_producao')
          .select('*, obras(nome)');
        
        if (selectedObra !== "all") {
          metasQuery = metasQuery.eq('obra_id', selectedObra);
        }

      const { data: metas } = await metasQuery;
      if (metas) setMetasData(metas);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  };

  // Processar dados para gráficos
  const getChartData = () => {
    const dataByFrente = producaoData.reduce((acc: any, item) => {
      const frente = item.frente_servico;
      if (!acc[frente]) {
        acc[frente] = { name: frente, producao: 0, count: 0 };
      }
      
      const quantidade = item.respostas?.quantidade || 0;
      acc[frente].producao += Number(quantidade);
      acc[frente].count += 1;
      
      return acc;
    }, {});

    return Object.values(dataByFrente);
  };

  const getProductionTrend = () => {
    const last7Days = producaoData
      .slice(-7)
      .map(item => ({
        data: new Date(item.data_registro).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        producao: Number(item.respostas?.quantidade || 0)
      }));
    
    return last7Days;
  };

  const getMetasComparison = () => {
    return metasData.map(meta => {
      const producaoFrente = producaoData
        .filter(p => p.frente_servico === meta.frente_servico)
        .reduce((sum, p) => sum + Number(p.respostas?.quantidade || 0), 0);
      
      const diasDecorridos = producaoData.filter(p => p.frente_servico === meta.frente_servico).length || 1;
      const metaTotal = Number(meta.meta_diaria) * diasDecorridos;
      
      return {
        frente: meta.frente_servico,
        meta: metaTotal,
        realizado: producaoFrente,
        percentual: ((producaoFrente / metaTotal) * 100).toFixed(1)
      };
    });
  };

  const exportToPDF = () => {
    toast.success("Gerando relatório PDF...");
    // Implementação de exportação será adicionada
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const chartData = getChartData();
  const trendData = getProductionTrend();
  const metasComparison = getMetasComparison();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <Building2 className="w-6 h-6 mr-2" />
                <span className="font-bold">ConstruData</span>
              </Button>
              <h1 className="text-xl font-semibold">Controle de Produção</h1>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedObra} onValueChange={setSelectedObra}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrar por obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as obras</SelectItem>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={exportToPDF}>
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Registros</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{producaoData.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Obras Ativas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{obras.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Metas Configuradas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metasData.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média Diária</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {producaoData.length > 0 ? Math.round(producaoData.reduce((sum, p) => sum + Number(p.respostas?.quantidade || 0), 0) / producaoData.length) : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="trends">Tendências</TabsTrigger>
            <TabsTrigger value="goals">Metas vs Realizado</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Produção por Frente de Serviço</CardTitle>
                  <CardDescription>Total acumulado por frente</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="producao" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribuição de Registros</CardTitle>
                  <CardDescription>Por frente de serviço</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evolução da Produção</CardTitle>
                <CardDescription>Últimos 7 registros</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="producao" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="goals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Comparação: Metas vs Realizado</CardTitle>
                <CardDescription>Performance por frente de serviço</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={metasComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="frente" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="meta" fill="hsl(var(--secondary))" name="Meta" />
                    <Bar dataKey="realizado" fill="hsl(var(--primary))" name="Realizado" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Percentual de Atingimento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metasComparison.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="font-medium">{item.frente}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(Number(item.percentual), 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${Number(item.percentual) >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                          {item.percentual}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Production;
