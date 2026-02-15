import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutDashboard, Star, Trash2, Download, Grid3X3, List } from 'lucide-react';
import { useCustomDashboard, DashboardWidget } from '@/hooks/useCustomDashboard';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardFilters } from '@/components/custom-dashboard/DashboardFilters';
import { KPIWidget } from '@/components/custom-dashboard/widgets/KPIWidget';
import { ProductionChartWidget } from '@/components/custom-dashboard/widgets/ProductionChartWidget';
import { ProductionTableWidget } from '@/components/custom-dashboard/widgets/ProductionTableWidget';
import { TeamPerformanceWidget } from '@/components/custom-dashboard/widgets/TeamPerformanceWidget';
import { AddWidgetDialog, WidgetConfig } from '@/components/custom-dashboard/AddWidgetDialog';
import { WidgetCard } from '@/components/custom-dashboard/WidgetCard';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function CustomDashboard() {
  const navigate = useNavigate();
  const [newDashboardName, setNewDashboardName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'default' | 'custom'>('default');
  const dashboardContentRef = useRef<HTMLDivElement>(null);

  const {
    dashboards,
    currentDashboard,
    setCurrentDashboard,
    widgets,
    globalFilters,
    loading: dashboardLoading,
    createDashboard,
    deleteDashboard,
    updateGlobalFilters,
    setAsDefault,
    addWidget,
    removeWidget,
  } = useCustomDashboard();

  const {
    productionData,
    kpiData,
    teamData,
    loading: dataLoading,
    refreshData,
    dateRange
  } = useDashboardData(globalFilters, globalFilters.projectIds);

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) return;
    await createDashboard(newDashboardName);
    setNewDashboardName('');
    setIsCreateDialogOpen(false);
  };

  const handleAddWidget = async (widgetConfig: WidgetConfig) => {
    if (!currentDashboard) return;
    
    const maxY = widgets.reduce((max, w) => Math.max(max, (w.position_y || 0) + (w.height || 1)), 0);
    
    await addWidget({
      dashboard_id: currentDashboard.id,
      widget_type: widgetConfig.widget_type,
      title: widgetConfig.title,
      config: widgetConfig.config,
      position_x: 0,
      position_y: maxY,
      width: widgetConfig.width,
      height: widgetConfig.height,
      data_source: widgetConfig.config.dataSource || null,
      filters: {}
    });
    
    setViewMode('custom');
  };

  const handleExportPDF = async () => {
    if (!dashboardContentRef.current) return;
    
    setIsExporting(true);
    toast.info("Gerando PDF...");
    
    try {
      const canvas = await html2canvas(dashboardContentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`dashboard_${currentDashboard?.name || 'personalizado'}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const loading = dashboardLoading || dataLoading;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6 overflow-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <LayoutDashboard className="h-6 w-6 text-primary" />
                Dashboard Personalizado
              </h1>
              <p className="text-muted-foreground">
                Monte seu próprio painel de controle
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Dashboard Selector */}
              {dashboards.length > 0 && (
                <Select
                  value={currentDashboard?.id || ''}
                  onValueChange={(id) => {
                    const dashboard = dashboards.find(d => d.id === id);
                    if (dashboard) setCurrentDashboard(dashboard);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione um dashboard" />
                  </SelectTrigger>
                  <SelectContent>
                    {dashboards.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          {d.is_default && <Star className="h-3 w-3 text-yellow-500" />}
                          {d.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Create Dashboard Button */}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Dashboard
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Dashboard</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Nome do Dashboard</Label>
                      <Input
                        value={newDashboardName}
                        onChange={(e) => setNewDashboardName(e.target.value)}
                        placeholder="Ex: Produção Semanal"
                      />
                    </div>
                    <Button onClick={handleCreateDashboard} className="w-full">
                      Criar Dashboard
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {currentDashboard && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddWidgetOpen(true)}
                  >
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    Adicionar Widget
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportPDF}
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? "Exportando..." : "PDF"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAsDefault(currentDashboard.id)}
                    title="Definir como padrão"
                  >
                    <Star className={currentDashboard.is_default ? "h-4 w-4 text-yellow-500 fill-yellow-500" : "h-4 w-4"} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => deleteDashboard(currentDashboard.id)}
                    title="Excluir dashboard"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Filters */}
          <DashboardFilters
            filters={globalFilters}
            onFiltersChange={updateGlobalFilters}
            onRefresh={refreshData}
            loading={loading}
          />

          {/* Dashboard Content */}
          <div ref={dashboardContentRef}>
          {!currentDashboard && dashboards.length === 0 ? (
            <Card className="p-12 text-center">
              <LayoutDashboard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Crie seu primeiro dashboard</h2>
              <p className="text-muted-foreground mb-4">
                Personalize sua visão de dados com widgets interativos
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Dashboard
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* View Mode Tabs */}
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'default' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('default')}
                >
                  <List className="h-4 w-4 mr-2" />
                  Visão Padrão
                </Button>
                <Button
                  variant={viewMode === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('custom')}
                >
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Widgets Personalizados
                  {widgets.length > 0 && (
                    <span className="ml-2 bg-primary-foreground text-primary px-1.5 py-0.5 rounded text-xs">
                      {widgets.length}
                    </span>
                  )}
                </Button>
              </div>

              {viewMode === 'custom' ? (
                /* Custom Widgets Grid */
                <div className="space-y-4">
                  {widgets.length === 0 ? (
                    <Card className="p-8 text-center border-dashed">
                      <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">Nenhum widget adicionado</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Adicione widgets para personalizar seu dashboard
                      </p>
                      <Button onClick={() => setIsAddWidgetOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Widget
                      </Button>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {widgets.map((widget) => (
                        <WidgetCard
                          key={widget.id}
                          widget={widget}
                          productionData={productionData}
                          kpiData={kpiData}
                          teamData={teamData}
                          dateRange={dateRange}
                          onRemove={() => removeWidget(widget.id)}
                          onConfigure={() => toast.info("Configuração em breve")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Default Tabs View */
                <Tabs defaultValue="overview" className="space-y-6">
                  <TabsList>
                    <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                    <TabsTrigger value="production">Produção</TabsTrigger>
                    <TabsTrigger value="team">Equipes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <KPIWidget
                        title="Produção Total"
                        value={kpiData?.total_production || 0}
                        subtitle="No período selecionado"
                        icon="production"
                        targetValue={kpiData?.total_planned}
                      />
                      <KPIWidget
                        title="Taxa de Conclusão"
                        value={kpiData?.completion_rate || 0}
                        format="percent"
                        icon="completion"
                        trend={kpiData?.completion_rate && kpiData.completion_rate >= 80 ? 'up' : 'down'}
                      />
                      <KPIWidget
                        title="Colaboradores Ativos"
                        value={kpiData?.active_employees || 0}
                        icon="employees"
                      />
                      <KPIWidget
                        title="Projetos Ativos"
                        value={kpiData?.active_projects || 0}
                        icon="projects"
                      />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="h-[400px]">
                        <ProductionChartWidget
                          title="Evolução da Produção"
                          data={productionData}
                          chartType="bar"
                        />
                      </div>
                      <div className="h-[400px]">
                        <TeamPerformanceWidget
                          title="Desempenho das Equipes"
                          data={teamData}
                          viewMode="chart"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="production" className="space-y-6">
                    <div className="h-[500px]">
                      <ProductionTableWidget
                        title="Quadro de Produção (Dias x Serviços)"
                        data={productionData}
                        groupBy="service"
                        dateRange={dateRange}
                      />
                    </div>
                    <div className="h-[400px]">
                      <ProductionChartWidget
                        title="Comparativo Planejado x Realizado"
                        data={productionData}
                        chartType="area"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="team" className="space-y-6">
                    <div className="h-[500px]">
                      <TeamPerformanceWidget
                        title="Desempenho Individual"
                        data={teamData}
                        viewMode="table"
                      />
                    </div>
                    <div className="h-[500px]">
                      <ProductionTableWidget
                        title="Produção por Equipe"
                        data={productionData}
                        groupBy="employee"
                        dateRange={dateRange}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}
          </div>
        </main>
      </div>

      {/* Add Widget Dialog */}
      <AddWidgetDialog
        open={isAddWidgetOpen}
        onOpenChange={setIsAddWidgetOpen}
        onAddWidget={handleAddWidget}
      />
    </SidebarProvider>
  );
}
