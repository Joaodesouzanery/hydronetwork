import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Calendar, TrendingUp, Package, Users } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Label } from "@/components/ui/label";

interface ConsolidatedReportsViewProps {
  projectId: string;
  isDemoMode?: boolean;
}

interface ReportData {
  date: string;
  services: { name: string; quantity: number; unit: string; }[];
  totalQuantity: number;
  constructionSite: string;
}

interface ServiceCatalog {
  id: string;
  name: string;
  unit: string;
}

export const ConsolidatedReportsView = ({ projectId, isDemoMode = false }: ConsolidatedReportsViewProps) => {
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>(["all"]);
  const [summary, setSummary] = useState({
    totalServices: 0,
    totalQuantity: 0,
    uniqueServices: 0,
    rdosCount: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (projectId) {
      loadReportData();
    }
  }, [projectId, reportType, selectedDate, selectedServices]);

  const loadServices = async () => {
    const { data } = await supabase
      .from('services_catalog')
      .select('id, name, unit')
      .order('name', { ascending: true });
    
    if (data) setServices(data);
  };

  const loadReportData = async () => {
    if (isDemoMode) {
      loadDemoData();
      return;
    }

    setIsLoading(true);
    try {
      const dateRange = getDateRange();
      
      const { data: rdoData, error } = await supabase
        .from('daily_reports')
        .select(`
          *,
          construction_sites (name),
          executed_services (
            *,
            services_catalog (id, name, unit)
          )
        `)
        .eq('project_id', projectId)
        .gte('report_date', dateRange.start)
        .lte('report_date', dateRange.end)
        .order('report_date', { ascending: false });

      if (error) throw error;

      // Process data with service filter
      const processed = processReportData(rdoData || []);
      setReportData(processed);
      calculateSummary(processed);
      
    } catch (error: any) {
      toast.error("Erro ao carregar relatório: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDemoData = () => {
    const demoData: ReportData[] = [
      {
        date: new Date().toISOString().split('T')[0],
        services: [
          { name: "Escavação", quantity: 45, unit: "m³" },
          { name: "Concretagem", quantity: 28, unit: "m³" }
        ],
        totalQuantity: 73,
        constructionSite: "Canteiro Principal"
      },
      {
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        services: [
          { name: "Alvenaria", quantity: 120, unit: "m²" },
          { name: "Reboco", quantity: 85, unit: "m²" }
        ],
        totalQuantity: 205,
        constructionSite: "Bloco A"
      }
    ];
    
    setReportData(demoData);
    calculateSummary(demoData);
  };

  const processReportData = (rdos: any[]): ReportData[] => {
    const dataMap = new Map<string, ReportData>();

    rdos.forEach(rdo => {
      const date = rdo.report_date;
      const existing = dataMap.get(date) || {
        date,
        services: [],
        totalQuantity: 0,
        constructionSite: rdo.construction_sites?.name || 'N/A'
      };

      rdo.executed_services?.forEach((es: any) => {
        // Filter by selected services
        if (!selectedServices.includes('all') && !selectedServices.includes(es.services_catalog?.id)) {
          return;
        }

        existing.services.push({
          name: es.services_catalog?.name || 'Desconhecido',
          quantity: Number(es.quantity),
          unit: es.unit
        });
        existing.totalQuantity += Number(es.quantity);
      });

      // Only add to map if there are services after filtering
      if (existing.services.length > 0) {
        dataMap.set(date, existing);
      }
    });

    return Array.from(dataMap.values());
  };

  const calculateSummary = (data: ReportData[]) => {
    const allServices = data.flatMap(d => d.services);
    const uniqueServiceNames = new Set(allServices.map(s => s.name));
    
    setSummary({
      totalServices: allServices.length,
      totalQuantity: data.reduce((sum, d) => sum + d.totalQuantity, 0),
      uniqueServices: uniqueServiceNames.size,
      rdosCount: data.length
    });
  };

  const getDateRange = () => {
    const end = new Date(selectedDate);
    let start = new Date(selectedDate);

    switch (reportType) {
      case 'daily':
        // Same day
        break;
      case 'weekly':
        start.setDate(end.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(end.getMonth() - 1);
        break;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const handleExportReport = () => {
    const reportTitle = `Relatório ${reportType === 'daily' ? 'Diário' : reportType === 'weekly' ? 'Semanal' : 'Mensal'}`;
    const dateRange = getDateRange();
    
    let csvContent = `${reportTitle}\n`;
    csvContent += `Período: ${new Date(dateRange.start).toLocaleDateString('pt-BR')} até ${new Date(dateRange.end).toLocaleDateString('pt-BR')}\n\n`;
    csvContent += `RESUMO EXECUTIVO\n`;
    csvContent += `Total de RDOs,${summary.rdosCount}\n`;
    csvContent += `Serviços Únicos,${summary.uniqueServices}\n`;
    csvContent += `Total de Serviços Executados,${summary.totalServices}\n`;
    csvContent += `Quantidade Total Produzida,${summary.totalQuantity.toFixed(2)}\n\n`;
    csvContent += `DETALHAMENTO POR DATA\n`;
    csvContent += `Data,Local,Serviço,Quantidade,Unidade\n`;

    reportData.forEach(day => {
      day.services.forEach(service => {
        csvContent += `${new Date(day.date).toLocaleDateString('pt-BR')},${day.constructionSite},${service.name},${service.quantity},${service.unit}\n`;
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${reportType}_${selectedDate}.csv`;
    a.click();

    toast.success("Relatório exportado com sucesso!");
  };

  const getChartData = () => {
    return reportData.map(day => ({
      date: new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      quantidade: day.totalQuantity
    }));
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          {/* Row 1: Tipo de Relatório, Data de Referência, Exportar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Relatório Diário</SelectItem>
                  <SelectItem value="weekly">Relatório Semanal</SelectItem>
                  <SelectItem value="monthly">Relatório Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Data de Referência</Label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleExportReport} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Exportar Relatório
              </Button>
            </div>
          </div>

          {/* Row 2: Serviços */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Serviços</Label>
            <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-2 bg-background">
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
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total de RDOs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{summary.rdosCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Serviços Únicos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">{summary.uniqueServices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total de Serviços
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.totalServices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Quantidade Total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{summary.totalQuantity.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Produção ao Longo do Período</CardTitle>
          <CardDescription>
            {reportType === 'daily' ? 'Produção do dia' : 
             reportType === 'weekly' ? 'Últimos 7 dias' : 
             'Últimos 30 dias'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getChartData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantidade" fill="hsl(var(--primary))" name="Quantidade Produzida" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Report */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento do Relatório</CardTitle>
          <CardDescription>
            Consolidado de {reportData.length} dia(s) de produção
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reportData.map((day, idx) => (
              <Card key={idx} className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-semibold text-lg">
                        {new Date(day.date).toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Local: {day.constructionSite}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {day.totalQuantity.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total Produzido
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {day.services.map((service, sIdx) => (
                      <div key={sIdx} className="flex justify-between items-center p-3 bg-background rounded-md border">
                        <span className="font-medium">{service.name}</span>
                        <span className="text-primary font-semibold">
                          {service.quantity} {service.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {reportData.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum dado encontrado para o período selecionado
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};