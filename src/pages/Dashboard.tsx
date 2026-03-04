import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ClipboardList, FileText, LogOut, Plus, Settings, Bell, Package, TrendingDown, History, Users, Image, Target, TrendingUp, AlertCircle, Warehouse, Wrench, Droplets, BarChart3, Package2, Activity, Archive, Gauge, QrCode, ClipboardX, DollarSign, Box, Newspaper, Link2, MapPin } from "lucide-react";
import { loadAllModuleData } from "@/engine/moduleExchange";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SurveyNotification } from "@/components/shared/SurveyNotification";
import { LogoText } from "@/components/shared/Logo";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [projectStats, setProjectStats] = useState<any>(null);
  const [productionStats, setProductionStats] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [hydroData, setHydroData] = useState<any>(null);
  const [hubNoticias, setHubNoticias] = useState<any[]>([]);
  const [hubLicitacoes, setHubLicitacoes] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }
      
      setUser(session.user);
      await Promise.all([loadProjects(), loadProductionStats(), loadRecentActivities(), loadHydroAndHubData()]);
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectStats(selectedProject);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (data && data.length > 0) {
      setProjects(data);
      setSelectedProject(data[0].id);
    }
  };

  const loadProjectStats = async (projectId: string) => {
    try {
      // Buscar RDOs do projeto
      const { data: rdos, error: rdoError } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('project_id', projectId);

      if (rdoError) throw rdoError;

      // Buscar serviços executados
      const { data: services, error: servicesError } = await supabase
        .from('executed_services')
        .select(`
          *,
          daily_reports!inner (project_id)
        `)
        .eq('daily_reports.project_id', projectId);

      if (servicesError) throw servicesError;

      // Buscar pedidos de material
      const { data: materials, error: materialsError } = await supabase
        .from('material_requests')
        .select('*')
        .eq('project_id', projectId);

      if (materialsError) throw materialsError;

      // Buscar fotos de validação
      const { data: photos, error: photosError } = await supabase
        .from('rdo_validation_photos')
        .select(`
          *,
          daily_reports!inner (project_id)
        `)
        .eq('daily_reports.project_id', projectId);

      if (photosError) throw photosError;

      setProjectStats({
        totalRDOs: rdos?.length || 0,
        totalServices: services?.length || 0,
        totalMaterials: materials?.length || 0,
        totalPhotos: photos?.length || 0,
        pendingMaterials: materials?.filter(m => m.status === 'pendente').length || 0
      });
    } catch (error: any) {
      console.error('Error loading project stats:', error);
    }
  };

  const loadProductionStats = async () => {
    try {
      // Últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateFilter = sevenDaysAgo.toISOString().split('T')[0];

      // Buscar metas e produção
      const { data: targets, error: targetsError } = await supabase
        .from('production_targets')
        .select(`
          *,
          services_catalog (name, unit)
        `)
        .gte('target_date', dateFilter);

      if (targetsError) throw targetsError;

      const { data: executed, error: executedError } = await supabase
        .from('executed_services')
        .select(`
          *,
          daily_reports!inner (report_date),
          services_catalog (name)
        `)
        .gte('daily_reports.report_date', dateFilter);

      if (executedError) throw executedError;

      const totalPlanned = targets?.reduce((sum, t) => sum + Number(t.target_quantity), 0) || 0;
      const totalExecuted = executed?.reduce((sum, e) => sum + Number(e.quantity), 0) || 0;
      const completionRate = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

      setProductionStats({
        totalPlanned,
        totalExecuted,
        completionRate: Math.round(completionRate),
        totalTargets: targets?.length || 0,
        servicesExecuted: executed?.length || 0
      });
    } catch (error: any) {
      console.error('Error loading production stats:', error);
    }
  };

  const loadRecentActivities = async () => {
    try {
      const activities: any[] = [];
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Buscar RDOs recentes
      const { data: rdos } = await supabase
        .from('daily_reports')
        .select('id, created_at, projects(name)')
        .order('created_at', { ascending: false })
        .limit(3);

      rdos?.forEach(rdo => {
        activities.push({
          type: 'rdo',
          title: 'Novo RDO criado',
          description: `Projeto: ${rdo.projects?.name || 'Sem projeto'}`,
          date: rdo.created_at,
          icon: ClipboardList
        });
      });

      // Buscar pedidos de material recentes
      const { data: materials } = await supabase
        .from('material_requests')
        .select('id, created_at, material_name, projects(name)')
        .order('created_at', { ascending: false })
        .limit(3);

      materials?.forEach(mat => {
        activities.push({
          type: 'material',
          title: 'Pedido de material',
          description: `${mat.material_name} - ${mat.projects?.name || 'Sem projeto'}`,
          date: mat.created_at,
          icon: Package
        });
      });

      // Buscar alertas recentes
      const { data: alerts } = await supabase
        .from('alerts')
        .select('id, created_at, alert_type')
        .order('created_at', { ascending: false })
        .limit(3);

      alerts?.forEach(alert => {
        activities.push({
          type: 'alert',
          title: 'Alerta criado',
          description: `Tipo: ${alert.alert_type}`,
          date: alert.created_at,
          icon: Bell
        });
      });

      // Ordenar por data e pegar os 10 mais recentes
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentActivities(activities.slice(0, 10));
    } catch (error) {
      console.error('Error loading recent activities:', error);
    }
  };

  const loadHydroAndHubData = async () => {
    try {
      // Load HydroNetwork module data from localStorage
      const moduleData = loadAllModuleData();
      if (moduleData.trechos.length > 0) {
        const totalPlanned = moduleData.trechos.reduce((s, t) => s + t.comprimento, 0);
        const overrides = JSON.parse(localStorage.getItem("hydronetwork_executed_overrides") || "{}");
        setHydroData({ totalTrechos: moduleData.trechos.length, totalPlanned, hasSchedule: !!moduleData.schedule, overrides });
      }

      // Load Hub news data
      const [notRes, licRes] = await Promise.all([
        fetch("/hub/noticias.json").catch(() => null),
        fetch("/hub/licitacoes.json").catch(() => null),
      ]);
      if (notRes?.ok) {
        const notData = await notRes.json();
        setHubNoticias((notData.noticias || []).slice(0, 5));
      }
      if (licRes?.ok) {
        const licData = await licRes.json();
        setHubLicitacoes((licData.licitacoes || []).slice(0, 3));
      }
    } catch (err) {
      console.error("Error loading hydro/hub data:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso!");
      navigate('/');
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <img src="/logo.svg" alt="ConstruData" className="h-10 mx-auto animate-pulse mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b border-border bg-background/90-md sticky top-0 z-10">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
                  <img src="/logo.svg" alt="ConstruData" className="h-8" />
                  <LogoText className="text-xl" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono text-muted-foreground hidden sm:inline">
                  {user?.user_metadata?.name || user?.email}
                </span>
                <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
                  <Settings className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 flex-1">
        {/* Survey Notification */}
        <SurveyNotification />

        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold font-mono mb-2">Bem-vindo ao CONSTRUDATA</h1>
          <p className="text-sm sm:text-base text-muted-foreground font-mono">
            Gerencie suas obras com eficiência e precisão
          </p>
        </div>

        <Tabs defaultValue="geral" className="space-y-4 sm:space-y-6">
          {/* Mobile-friendly tabs */}
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <TabsList className="inline-flex w-full sm:w-auto min-w-max">
              <TabsTrigger value="geral" className="flex-1 sm:flex-none text-xs sm:text-sm px-3 sm:px-4">Dashboard Geral</TabsTrigger>
              <TabsTrigger value="producao" className="flex-1 sm:flex-none text-xs sm:text-sm px-3 sm:px-4">Produção</TabsTrigger>
              <TabsTrigger value="projeto" className="flex-1 sm:flex-none text-xs sm:text-sm px-3 sm:px-4">Por Projeto</TabsTrigger>
            </TabsList>
          </div>

          {/* Dashboard Geral */}
          <TabsContent value="geral" className="space-y-6">
            {/* Dashboard 360º Section */}
            <div id="dashboard-360" className="space-y-3 sm:space-y-4 scroll-mt-20">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="h-6 sm:h-8 w-1 bg-gradient-to-b from-gradient-start to-gradient-end" />
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold font-mono">Dashboard 360º</h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground ml-4 sm:ml-7">
                Visão completa dos seus projetos em tempo real
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className="border-primary/30 p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Projetos Ativos</p>
                  <div className="text-2xl sm:text-3xl font-bold text-primary">
                    {projects.length}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Em andamento
                  </p>
                </Card>
                <Card className="border-secondary/30 p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Atividades</p>
                  <div className="text-2xl sm:text-3xl font-bold text-secondary">
                    {recentActivities.length}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Recentes
                  </p>
                </Card>
                <Card className="border-accent/30 p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Status</p>
                  <div className="text-2xl sm:text-3xl font-bold text-success">
                    Ótimo
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Operacional
                  </p>
                </Card>
                <Card className="border-warning/30 p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Alertas</p>
                  <div className="text-2xl sm:text-3xl font-bold text-warning">
                    0
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Nenhum ativo
                  </p>
                </Card>
              </div>
            </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          <Card className="hover:border-foreground/30 transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group active:scale-[0.98]" onClick={() => navigate('/projects')}>
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-primary flex items-center justify-center text-primary-foreground mb-2 sm:mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <CardTitle className="text-sm sm:text-base md:text-lg">Projetos</CardTitle>
              <CardDescription className="text-xs sm:text-sm hidden sm:block">
                Gerencie seus projetos
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-foreground/30 transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group active:scale-[0.98]" onClick={() => navigate('/rdo-new')}>
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-accent flex items-center justify-center text-accent-foreground mb-2 sm:mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <CardTitle className="text-sm sm:text-base md:text-lg">Novo RDO</CardTitle>
              <CardDescription className="text-xs sm:text-sm hidden sm:block">
                Criar relatório diário
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-foreground/30 transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group active:scale-[0.98]" onClick={() => navigate('/rdo-history')}>
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-purple-500 flex items-center justify-center text-white mb-2 sm:mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                <History className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <CardTitle className="text-sm sm:text-base md:text-lg">Histórico RDO</CardTitle>
              <CardDescription className="text-xs sm:text-sm hidden sm:block">
                Visualize e analise
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-foreground/30 transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group active:scale-[0.98]" onClick={() => navigate('/rdo-photos')}>
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-pink-500 flex items-center justify-center text-white mb-2 sm:mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                <Image className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <CardTitle className="text-sm sm:text-base md:text-lg">Fotos</CardTitle>
              <CardDescription className="text-xs sm:text-sm hidden sm:block">
                Validação de RDOs
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-foreground/30 transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group active:scale-[0.98]" onClick={() => navigate('/production-control')}>
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-secondary flex items-center justify-center text-secondary-foreground mb-2 sm:mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <CardTitle className="text-sm sm:text-base md:text-lg">Produção</CardTitle>
              <CardDescription className="text-xs sm:text-sm hidden sm:block">
                Controle e metas
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-foreground/30 transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group active:scale-[0.98]" onClick={() => navigate('/dashboard-360')}>
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-cyan-500 flex items-center justify-center text-white mb-2 sm:mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <CardTitle className="text-sm sm:text-base md:text-lg">360º</CardTitle>
              <CardDescription className="text-xs sm:text-sm hidden sm:block">
                Dashboard completo
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

            {/* Integrated Modules Section */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="h-6 sm:h-8 w-1 bg-gradient-to-b from-blue-500 to-purple-500" />
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold font-mono">Integracao entre Modulos</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {/* HydroNetwork Progress */}
                {hydroData && (
                  <Card className="border-purple-500/20 cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => navigate('/hydronetwork')}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-purple-500" />
                        HydroNetwork
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-purple-600">
                        {hydroData.totalTrechos} trechos
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {hydroData.totalPlanned.toFixed(1)} m planejados
                      </p>
                      {hydroData.hasSchedule && (
                        <p className="text-[10px] text-green-600 mt-1">Cronograma gerado</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Hub Noticias */}
                <Card className="border-orange-500/20 cursor-pointer hover:border-orange-500/50 transition-colors" onClick={() => navigate('/hub-noticias')}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Newspaper className="w-4 h-4 text-orange-500" />
                      Hub de Noticias
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {hubNoticias.length > 0 ? (
                      <div className="space-y-1.5">
                        {hubNoticias.slice(0, 3).map((n, i) => (
                          <p key={i} className="text-xs text-muted-foreground truncate leading-tight">
                            {n.titulo}
                          </p>
                        ))}
                        <p className="text-[10px] text-orange-500 mt-1">{hubNoticias.length}+ noticias</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma noticia carregada</p>
                    )}
                  </CardContent>
                </Card>

                {/* Licitacoes */}
                <Card className="border-blue-500/20 cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => navigate('/hub-noticias?tab=licitacoes')}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      Licitacoes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {hubLicitacoes.length > 0 ? (
                      <div className="space-y-1.5">
                        {hubLicitacoes.map((l, i) => (
                          <p key={i} className="text-xs text-muted-foreground truncate leading-tight">
                            {l.titulo}
                          </p>
                        ))}
                        <p className="text-[10px] text-blue-500 mt-1">{hubLicitacoes.length}+ licitacoes monitoradas</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma licitacao carregada</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Dashboard de Produção */}
          <TabsContent value="producao" className="space-y-6">
            {productionStats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Planejado</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">
                        {productionStats.totalPlanned.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {productionStats.totalTargets} metas definidas
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Executado</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-secondary">
                        {productionStats.totalExecuted.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {productionStats.servicesExecuted} serviços
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Taxa de Conclusão</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold flex items-center gap-2 ${
                        productionStats.completionRate >= 100 ? 'text-success' :
                        productionStats.completionRate >= 80 ? 'text-warning' : 'text-destructive'
                      }`}>
                        {productionStats.completionRate}%
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Últimos 7 dias
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Status</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {productionStats.completionRate >= 90 ? (
                          <>
                            <Target className="w-8 h-8 text-success" />
                            <div>
                              <p className="font-semibold text-success">Excelente</p>
                              <p className="text-xs text-muted-foreground">Acima da meta</p>
                            </div>
                          </>
                        ) : productionStats.completionRate >= 70 ? (
                          <>
                            <AlertCircle className="w-8 h-8 text-warning" />
                            <div>
                              <p className="font-semibold text-warning">Atenção</p>
                              <p className="text-xs text-muted-foreground">Próximo da meta</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-8 h-8 text-destructive" />
                            <div>
                              <p className="font-semibold text-destructive">Crítico</p>
                              <p className="text-xs text-muted-foreground">Abaixo da meta</p>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Acesso Rápido</CardTitle>
                    <CardDescription>Ferramentas de produção</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button onClick={() => navigate('/production-control')} className="h-auto py-4 flex-col gap-2">
                        <ClipboardList className="w-6 h-6" />
                        <span>Ver Controle Completo</span>
                      </Button>
                      <Button onClick={() => navigate('/rdo-new')} variant="outline" className="h-auto py-4 flex-col gap-2">
                        <Plus className="w-6 h-6" />
                        <span>Novo RDO</span>
                      </Button>
                      <Button onClick={() => navigate('/rdo-history')} variant="outline" className="h-auto py-4 flex-col gap-2">
                        <History className="w-6 h-6" />
                        <span>Histórico</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Carregando dados de produção...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Dashboard por Projeto */}
          <TabsContent value="projeto" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Selecione um Projeto</CardTitle>
                <CardDescription>Visualize estatísticas específicas de cada projeto</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedProject && projectStats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total de RDOs</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">
                        {projectStats.totalRDOs}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Relatórios registrados
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Serviços Executados</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-secondary">
                        {projectStats.totalServices}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total de execuções
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Pedidos de Material</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {projectStats.totalMaterials}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {projectStats.pendingMaterials} pendentes
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Fotos de Validação</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-pink-600">
                        {projectStats.totalPhotos}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Fotos registradas
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Acesso Rápido ao Projeto</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Button onClick={() => navigate('/rdo-new')} className="h-auto py-4 flex-col gap-2">
                        <Plus className="w-6 h-6" />
                        <span>Novo RDO</span>
                      </Button>
                      <Button onClick={() => navigate('/rdo-history')} variant="outline" className="h-auto py-4 flex-col gap-2">
                        <History className="w-6 h-6" />
                        <span>Ver RDOs</span>
                      </Button>
                      <Button onClick={() => navigate('/rdo-photos')} variant="outline" className="h-auto py-4 flex-col gap-2">
                        <Image className="w-6 h-6" />
                        <span>Ver Fotos</span>
                      </Button>
                      <Button onClick={() => navigate('/material-requests')} variant="outline" className="h-auto py-4 flex-col gap-2">
                        <Package className="w-6 h-6" />
                        <span>Ver Materiais</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Selecione um projeto para ver as estatísticas</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>


        {/* Recent Activity - Compact */}
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Atividades Recentes</CardTitle>
            <CardDescription className="text-xs">
              Suas últimas ações no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivities.length > 0 ? (
              <div className="space-y-3">
                {recentActivities.map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <div className="w-8 h-8 bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(activity.date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Nenhuma atividade recente</p>
                <p className="text-xs">Comece criando sua primeira obra</p>
              </div>
            )}
          </CardContent>
        </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
