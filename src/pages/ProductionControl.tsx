import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, TrendingUp, Target, AlertCircle, Download, Mail, Eye, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { ProductionChart } from "@/components/production/ProductionChart";
import { ServiceComparisonChart } from "@/components/production/ServiceComparisonChart";
import { AddTargetDialog } from "@/components/production/AddTargetDialog";
import { AddConstructionSiteDialog } from "@/components/rdo/AddConstructionSiteDialog";
import { ReportConfigDialog } from "@/components/production/ReportConfigDialog";
import { ConsolidatedReportsView } from "@/components/production/ConsolidatedReportsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";

interface ProductionData {
  service_name: string;
  planned: number;
  actual: number;
  unit: string;
  date: string;
  construction_site?: string;
  employee_name?: string;
  employee_role?: string;
}

const ProductionControl = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [projects, setProjects] = useState<any[]>([]);
  const [constructionSites, setConstructionSites] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedSites, setSelectedSites] = useState<string[]>(["all"]);
  const [reportType, setReportType] = useState<string>("weekly");
  const [referenceDate, setReferenceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>(["all"]);
  const [dateRange, setDateRange] = useState<"daily" | "day" | "week" | "month" | "quarter">("week");
  
  // Data
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalPlanned: 0,
    totalActual: 0,
    completionRate: 0,
    servicesCount: 0
  });

  // Dialogs
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showSiteDialog, setShowSiteDialog] = useState(false);

  useEffect(() => {
    checkAuth();
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadConstructionSites();
      loadServices();
      loadProductionData();
    }
  }, [selectedProject, selectedSites, dateRange, reportType, referenceDate, selectedServices]);

  const loadServices = async () => {
    const { data } = await supabase
      .from('services_catalog')
      .select('*')
      .order('name', { ascending: true });
    
    if (data) setServices(data);
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
    setIsLoading(false);
  };

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

  const loadConstructionSites = async () => {
    const { data } = await supabase
      .from('construction_sites')
      .select('*')
      .eq('project_id', selectedProject)
      .order('created_at', { ascending: false });
    
    if (data) setConstructionSites(data);
  };

  const loadProductionData = async () => {
    if (!selectedProject) return;

    const dateFilter = getDateFilter();
    
    // Load executed services from RDOs
    let query = supabase
      .from('executed_services')
      .select(`
        *,
        daily_reports!inner (
          report_date,
          project_id,
          construction_sites (name)
        ),
        services_catalog (name, unit),
        employee:employees (name, role)
      `)
      .eq('daily_reports.project_id', selectedProject)
      .gte('daily_reports.report_date', dateFilter.start)
      .lte('daily_reports.report_date', dateFilter.end);

    const { data: executedData } = await query;

    // Load production targets
    const { data: targetsData } = await supabase
      .from('production_targets')
      .select(`
        *,
        service_fronts!inner (project_id),
        services_catalog (name, unit)
      `)
      .eq('service_fronts.project_id', selectedProject)
      .gte('target_date', dateFilter.start)
      .lte('target_date', dateFilter.end);

    // Process and combine data
    const dataMap = new Map<string, ProductionData>();

    // Add executed services
    executedData?.forEach(item => {
      const key = `${item.services_catalog.name}-${item.daily_reports.report_date}`;
      const existing = dataMap.get(key) || {
        service_name: item.services_catalog.name,
        planned: 0,
        actual: 0,
        unit: item.services_catalog.unit,
        date: item.daily_reports.report_date,
        construction_site: item.daily_reports.construction_sites?.name,
        employee_name: item.employee?.name,
        employee_role: item.employee?.role
      };
      
      existing.actual += Number(item.quantity);
      dataMap.set(key, existing);
    });

    // Add targets
    targetsData?.forEach(item => {
      const key = `${item.services_catalog.name}-${item.target_date}`;
      const existing = dataMap.get(key) || {
        service_name: item.services_catalog.name,
        planned: 0,
        actual: 0,
        unit: item.services_catalog.unit,
        date: item.target_date
      };
      
      existing.planned += Number(item.target_quantity);
      dataMap.set(key, existing);
    });

    let production = Array.from(dataMap.values());

    // Filter by construction site if selected
    if (!selectedSites.includes('all')) {
      const selectedSiteNames = constructionSites
        .filter(s => selectedSites.includes(s.id))
        .map(s => s.name);
      production = production.filter(p => selectedSiteNames.includes(p.construction_site || ''));
    }

    // Calculate summary stats
    const totalPlanned = production.reduce((sum, item) => sum + item.planned, 0);
    const totalActual = production.reduce((sum, item) => sum + item.actual, 0);
    const completionRate = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
    const servicesCount = new Set(production.map(p => p.service_name)).size;

    setSummaryStats({
      totalPlanned,
      totalActual,
      completionRate,
      servicesCount
    });

    setProductionData(production);
  };

  const getDateFilter = () => {
    const end = new Date();
    let start = new Date();

    switch (dateRange) {
      case 'daily':
        start = new Date(end);
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);
        break;
      case 'day':
        start = new Date(end);
        break;
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      default:
        start.setDate(end.getDate() - 7);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const handleExportReport = async () => {
    toast.info("Gerando relatório...");
    
    try {
      const csvContent = generateCSVReport(productionData);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_producao_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar relatório");
    }
  };

  const generateCSVReport = (data: ProductionData[]) => {
    const headers = ['Data', 'Serviço', 'Planejado', 'Realizado', 'Unidade', 'Local', 'Funcionário'];
    const rows = data.map(item => [
      item.date,
      item.service_name,
      item.planned.toFixed(2),
      item.actual.toFixed(2),
      item.unit,
      item.construction_site || 'N/A',
      item.employee_name || 'N/A'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <Building2 className="w-6 h-6 mr-2" />
              <span className="font-bold">ConstruData</span>
            </Button>
            <h1 className="text-xl font-semibold">Controle de Produção</h1>
            </div>
            <div className="flex gap-2">
              <PageTutorialButton pageKey="production-control" />
              <Button variant="outline" onClick={() => setShowReportDialog(true)}>
                <Mail className="w-4 h-4 mr-2" />
                Relatórios Automáticos
              </Button>
              <Button variant="outline" onClick={handleExportReport}>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters - New Layout */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            {/* Row 1: Tipo de Relatório, Data de Referência, Exportar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Relatório</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Relatório Diário</SelectItem>
                    <SelectItem value="weekly">Relatório Semanal</SelectItem>
                    <SelectItem value="monthly">Relatório Mensal</SelectItem>
                    <SelectItem value="quarterly">Relatório Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Data de Referência</Label>
                <Input 
                  type="date" 
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button onClick={handleExportReport} className="w-full bg-primary hover:bg-primary/90">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Relatório
                </Button>
              </div>
            </div>

            {/* Row 2: Serviços */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">Serviços</Label>
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedServices.includes('all')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedServices(['all']);
                        } else {
                          setSelectedServices([]);
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">Todos os serviços</span>
                  </label>
                  {services.map(service => (
                    <label key={service.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedServices(prev => {
                              const filtered = prev.filter(id => id !== 'all');
                              return [...filtered, service.id];
                            });
                          } else {
                            const newSelected = selectedServices.filter(id => id !== service.id);
                            setSelectedServices(newSelected.length === 0 ? ['all'] : newSelected);
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{service.name} ({service.unit})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-end">
                <Button onClick={() => setShowTargetDialog(true)} className="w-full" variant="outline">
                  <Target className="w-4 h-4 mr-2" />
                  Adicionar Planejado
                </Button>
              </div>
            </div>

            {/* Row 3: Projeto, Locais, Período */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Projeto</Label>
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
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Locais da Obra</Label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowSiteDialog(true)}
                    disabled={!selectedProject}
                    className="h-auto p-0 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Novo
                  </Button>
                </div>
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSites.includes('all')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSites(['all']);
                        } else {
                          setSelectedSites([]);
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">Todos os locais</span>
                  </label>
                  {constructionSites.map(site => (
                    <label key={site.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSites.includes(site.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSites(prev => {
                              const filtered = prev.filter(id => id !== 'all');
                              return [...filtered, site.id];
                            });
                          } else {
                            const newSelected = selectedSites.filter(id => id !== site.id);
                            setSelectedSites(newSelected.length === 0 ? ['all'] : newSelected);
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{site.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Período</Label>
                <Select value={dateRange} onValueChange={(value) => setDateRange(value as "daily" | "day" | "week" | "month" | "quarter")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="day">Hoje</SelectItem>
                    <SelectItem value="week">Última Semana</SelectItem>
                    <SelectItem value="month">Último Mês</SelectItem>
                    <SelectItem value="quarter">Último Trimestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Planejado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {summaryStats.totalPlanned.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Realizado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">
                {summaryStats.totalActual.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Taxa de Conclusão</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-bold ${
                  summaryStats.completionRate >= 100 ? 'text-green-600' : 
                  summaryStats.completionRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {summaryStats.completionRate.toFixed(1)}%
                </div>
                <TrendingUp className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Serviços Monitorados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryStats.servicesCount}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="charts" className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="charts">Gráficos de Produção</TabsTrigger>
            <TabsTrigger value="reports">Relatórios Consolidados</TabsTrigger>
          </TabsList>

          <TabsContent value="charts">
            {productionData.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum dado encontrado</h3>
                  <p className="text-muted-foreground mb-4">
                    Não há dados de produção para o período selecionado
                  </p>
                  <Button onClick={() => setShowTargetDialog(true)}>
                    <Target className="w-4 h-4 mr-2" />
                    Adicionar Planejado
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Production Timeline Chart */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Realizado x Planejado - Evolução Temporal</CardTitle>
                    <CardDescription>
                      Acompanhamento da produção ao longo do tempo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProductionChart data={productionData} />
                  </CardContent>
                </Card>

                {/* Service Comparison Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Comparação por Serviço</CardTitle>
                    <CardDescription>
                      Performance de cada serviço em relação ao planejado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ServiceComparisonChart data={productionData} />
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="reports">
            <ConsolidatedReportsView projectId={selectedProject} />
          </TabsContent>
        </Tabs>
      </main>

      <AddTargetDialog
        open={showTargetDialog}
        onOpenChange={setShowTargetDialog}
        projectId={selectedProject}
        onSuccess={() => {
          loadProductionData();
          setShowTargetDialog(false);
        }}
      />

      <ReportConfigDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        projectId={selectedProject}
      />

      <AddConstructionSiteDialog
        open={showSiteDialog}
        onOpenChange={setShowSiteDialog}
        projectId={selectedProject}
        onSuccess={() => {
          loadConstructionSites();
          setShowSiteDialog(false);
        }}
      />
    </div>
  );
};

export default ProductionControl;