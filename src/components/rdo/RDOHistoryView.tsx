import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Filter, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EditRDODialog } from "./EditRDODialog";

interface RDOHistoryViewProps {
  projectId: string;
}

export const RDOHistoryView = ({ projectId }: RDOHistoryViewProps) => {
  const [rdos, setRdos] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("month");
  const [specificDate, setSpecificDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [deletingRdo, setDeletingRdo] = useState<any>(null);
  const [exportingRdo, setExportingRdo] = useState<any>(null);
  const [editingRdo, setEditingRdo] = useState<any>(null);
  const [consolidateServices, setConsolidateServices] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (rdo: any) => {
      if (rdo._source === 'rdos') {
        const { error } = await supabase
          .from('rdos')
          .delete()
          .eq('id', rdo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_reports')
          .delete()
          .eq('id', rdo.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      loadRDOs();
      toast.success("RDO deletado com sucesso!");
      setDeletingRdo(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao deletar RDO: " + error.message);
    },
  });

  useEffect(() => {
    if (projectId) {
      loadRDOs();
    }
  }, [projectId, selectedService, selectedPeriod, specificDate]);

  const loadRDOs = async () => {
    setIsLoading(true);
    try {
      const dateFilter = getDateFilter();
      
      // Buscar da tabela daily_reports (sistema novo)
      let dailyReportsQuery = supabase
        .from('daily_reports')
        .select(`
          *,
          construction_sites (name),
          service_fronts (name),
          executed_services (
            *,
            services_catalog (name, unit)
          ),
          justifications (reason)
        `)
        .eq('project_id', projectId);

      if (specificDate) {
        dailyReportsQuery = dailyReportsQuery.eq('report_date', specificDate);
      } else {
        dailyReportsQuery = dailyReportsQuery
          .gte('report_date', dateFilter.start)
          .lte('report_date', dateFilter.end);
      }
      
      dailyReportsQuery = dailyReportsQuery.order('report_date', { ascending: false });

      const { data: dailyReportsData, error: dailyReportsError } = await dailyReportsQuery;
      
      if (dailyReportsError) {
        console.error("Erro ao carregar daily_reports:", dailyReportsError);
      }

      // Buscar da tabela rdos (sistema antigo) relacionada com obras
      const { data: obrasData, error: obrasError } = await supabase
        .from('obras')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      let rdosData: any[] = [];
      if (obrasData && obrasData.length > 0) {
        let rdosQuery = supabase
          .from('rdos')
          .select('*')
          .in('obra_id', obrasData.map(o => o.id));

        if (specificDate) {
          rdosQuery = rdosQuery.eq('data', specificDate);
        } else {
          rdosQuery = rdosQuery
            .gte('data', dateFilter.start)
            .lte('data', dateFilter.end);
        }

        const { data: rdos, error: rdosError } = await rdosQuery.order('data', { ascending: false });
        
        if (rdosError) {
          console.error("Erro ao carregar rdos:", rdosError);
        } else if (rdos) {
          rdosData = rdos;
        }
      }

      // Consolidar dados
      const allRdos: any[] = [];
      
      // Adicionar daily_reports
      if (dailyReportsData) {
        allRdos.push(...dailyReportsData);
      }
      
      // Adicionar rdos (converter para formato compatível)
      if (rdosData && rdosData.length > 0) {
        const convertedRdos = rdosData.map(rdo => ({
          id: rdo.id,
          report_date: rdo.data,
          construction_sites: { name: rdo.localizacao_validada || 'Local não especificado' },
          service_fronts: { name: 'Frente não especificada' },
          executed_services: [],
          justifications: [],
          _source: 'rdos'
        }));
        allRdos.push(...convertedRdos);
      }

      console.log("Total de RDOs carregados:", allRdos.length);
      console.log("- Daily Reports:", dailyReportsData?.length || 0);
      console.log("- RDOs antigos:", rdosData.length);
      
      setRdos(allRdos);
      
      // Extract unique services
      const uniqueServices = new Set<string>();
      allRdos.forEach(rdo => {
        rdo.executed_services?.forEach((es: any) => {
          if (es.services_catalog) {
            uniqueServices.add(JSON.stringify({
              id: es.service_id,
              name: es.services_catalog.name
            }));
          }
        });
      });
      
      setServices(Array.from(uniqueServices).map(s => JSON.parse(s)));
      
      if (allRdos.length === 0) {
        toast.info("Nenhum RDO encontrado para o período selecionado");
      } else {
        toast.success(`${allRdos.length} RDO(s) carregado(s) com sucesso!`);
      }
    } catch (error: any) {
      console.error("Erro detalhado:", error);
      toast.error("Erro ao carregar histórico: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getDateFilter = () => {
    const end = new Date();
    let start = new Date();

    switch (selectedPeriod) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start.setMonth(end.getMonth() - 1);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const getFilteredData = () => {
    let filtered = rdos;

    if (selectedService !== 'all') {
      filtered = filtered.filter(rdo => 
        rdo.executed_services?.some((es: any) => es.service_id === selectedService)
      );
    }

    return filtered;
  };

  const getChartData = () => {
    const filtered = getFilteredData();
    const dataByDate = new Map();

    filtered.forEach(rdo => {
      // Parse date correctly to avoid timezone issues - use midday to avoid edge cases
      const date = new Date(rdo.report_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      rdo.executed_services?.forEach((es: any) => {
        if (selectedService === 'all' || es.service_id === selectedService) {
          const existing = dataByDate.get(date) || { date, quantity: 0 };
          existing.quantity += Number(es.quantity);
          dataByDate.set(date, existing);
        }
      });
    });

    return Array.from(dataByDate.values()).sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      const year = new Date().getFullYear();
      return new Date(`${year}-${monthA}-${dayA}`).getTime() - new Date(`${year}-${monthB}-${dayB}`).getTime();
    });
  };

  const getServiceDistribution = () => {
    const filtered = getFilteredData();
    const serviceMap = new Map();

    filtered.forEach(rdo => {
      rdo.executed_services?.forEach((es: any) => {
        const serviceName = es.services_catalog?.name || 'Desconhecido';
        const existing = serviceMap.get(serviceName) || { name: serviceName, quantity: 0, count: 0 };
        existing.quantity += Number(es.quantity);
        existing.count += 1;
        serviceMap.set(serviceName, existing);
      });
    });

    return Array.from(serviceMap.values());
  };

  const handleExportCSV = () => {
    const filtered = getFilteredData();
    let csvContent = "Data,Local,Frente,Serviço,Quantidade,Unidade,Equipamentos,Executado Por\n";

    filtered.forEach(rdo => {
      const formattedDate = new Date(rdo.report_date + 'T12:00:00').toLocaleDateString('pt-BR');
      rdo.executed_services?.forEach((es: any) => {
        csvContent += [
          formattedDate,
          rdo.construction_sites?.name || 'N/A',
          rdo.service_fronts?.name || 'N/A',
          es.services_catalog?.name || 'N/A',
          es.quantity,
          es.unit || 'N/A',
          es.equipment_used?.equipment || 'N/A',
          'Sistema'
        ].join(',') + '\n';
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_rdos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    toast.success("Histórico exportado em CSV com sucesso!");
  };

  const handleExportPDF = async () => {
    try {
      const filtered = getFilteredData();
      
      if (filtered.length === 0) {
        toast.error("Nenhum RDO para exportar");
        return;
      }
      
      const jsPDFModule = await import("jspdf");
      const autoTableModule: any = await import("jspdf-autotable");
      const jsPDFLocal = jsPDFModule.default;
      const autoTableFn = autoTableModule.default || (autoTableModule as any);

      const doc = new jsPDFLocal();
      
      doc.setFontSize(18);
      doc.text("Histórico de RDOs", 14, 22);
      
      doc.setFontSize(11);
      doc.text(`Data de Exportação: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
      doc.text(`Total de RDOs: ${filtered.length}`, 14, 36);

      const tableData: any[] = [];
      filtered.forEach(rdo => {
        const formattedDate = new Date(rdo.report_date + 'T12:00:00').toLocaleDateString('pt-BR');
        
        if (rdo.executed_services && rdo.executed_services.length > 0) {
          rdo.executed_services.forEach((es: any) => {
            tableData.push([
              formattedDate,
              rdo.construction_sites?.name || 'N/A',
              rdo.service_fronts?.name || 'N/A',
              es.services_catalog?.name || 'N/A',
              es.quantity || 0,
              es.unit || 'N/A'
            ]);
          });
        } else {
          tableData.push([
            formattedDate,
            rdo.construction_sites?.name || 'N/A',
            rdo.service_fronts?.name || 'N/A',
            'Nenhum serviço registrado',
            '-',
            '-'
          ]);
        }
      });

      autoTableFn(doc as any, {
        head: [['Data', 'Local', 'Frente', 'Serviço', 'Qtd', 'Un']],
        body: tableData,
        startY: 42,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      } as any);

      const fileName = `historico_rdos_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      toast.success("Histórico exportado em PDF com sucesso!");
      
    } catch (error: any) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar PDF: " + (error.message || "Erro desconhecido"));
    }
  };

  const handleExportSingleRDO = async (rdo: any) => {
    try {
      // Fetch complete RDO data with all relationships
      const { data: completeRDO, error: rdoError } = await supabase
        .from('daily_reports')
        .select(`
          *,
          project:projects!inner(name),
          construction_site:construction_sites!inner(name, address),
          service_front:service_fronts!inner(name),
          executed_services(
            quantity,
            unit,
            equipment_used,
            services_catalog(name),
            employees(name)
          )
        `)
        .eq('id', rdo.id)
        .single();

      if (rdoError) throw rdoError;

      // Fetch photos
      const { data: photos, error: photosError } = await supabase
        .from('rdo_validation_photos')
        .select('photo_url, uploaded_at')
        .eq('daily_report_id', rdo.id)
        .order('uploaded_at', { ascending: true });

      const photosWithSignedUrls = await Promise.all(
        (photos || []).map(async (photo: any) => {
          const rawPath: string = photo.photo_url || "";
          const path = rawPath.includes('rdo-photos/')
            ? rawPath.split('rdo-photos/')[1]
            : rawPath;

          let signedUrl = rawPath;
          try {
            const { data: signed } = await supabase.storage
              .from('rdo-photos')
              .createSignedUrl(path, 10 * 60);
            if (signed?.signedUrl) {
              signedUrl = signed.signedUrl;
            }
          } catch (error) {
            console.error('Erro ao gerar URL assinada para foto do PDF:', error);
          }

          return {
            ...photo,
            photo_url: signedUrl,
          };
        })
      );

      // Import the report generator
      const { generateRDOReportPDF } = await import('@/lib/rdoReportGenerator');
      
      // Generate PDF with all data
      await generateRDOReportPDF({
        ...completeRDO,
        photos: photosWithSignedUrls,
      }, consolidateServices);
      
      toast.success('RDO exportado em PDF com sucesso!');
      setExportingRdo(null);
      setConsolidateServices(false);
    } catch (error: any) {
      console.error('Erro ao exportar RDO em PDF:', error);
      toast.error('Erro ao exportar RDO em PDF: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const chartData = getChartData();
  const serviceData = getServiceDistribution();

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Específica</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => {
                    setSpecificDate(e.target.value);
                    if (e.target.value) setSelectedPeriod("");
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {specificDate && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSpecificDate("")}
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select 
                value={selectedPeriod} 
                onValueChange={(value) => {
                  setSelectedPeriod(value);
                  if (value) setSpecificDate("");
                }}
                disabled={!!specificDate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Última Semana</SelectItem>
                  <SelectItem value="month">Último Mês</SelectItem>
                  <SelectItem value="quarter">Último Trimestre</SelectItem>
                  <SelectItem value="year">Último Ano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Serviço</label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Serviços</SelectItem>
                  {services.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleExportCSV} variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button onClick={handleExportPDF} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardDescription>Total de RDOs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{getFilteredData().length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Serviços Executados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{serviceData.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Produzido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {serviceData.reduce((sum, s) => sum + s.quantity, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução da Produção</CardTitle>
          <CardDescription>Quantidade executada ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="quantity" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Quantidade"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Serviço</CardTitle>
          <CardDescription>Total executado de cada serviço</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serviceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantity" fill="hsl(var(--primary))" name="Quantidade" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* RDO List */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico Detalhado</CardTitle>
          <CardDescription>{getFilteredData().length} RDOs encontrados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {getFilteredData().map(rdo => (
              <Card key={rdo.id} className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-semibold text-lg">
                        {new Date(rdo.report_date + 'T12:00:00').toLocaleDateString('pt-BR', { 
                          weekday: 'short',
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Local: {rdo.construction_sites?.name} | Frente: {rdo.service_fronts?.name}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {/* Botão Editar - apenas para daily_reports (não para rdos antigos) */}
                      {rdo._source !== 'rdos' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingRdo(rdo)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExportingRdo(rdo)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeletingRdo(rdo)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {rdo.executed_services?.map((es: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm border-l-2 border-primary pl-3">
                        <span>{es.services_catalog?.name}</span>
                        <span className="font-semibold">{es.quantity} {es.unit}</span>
                      </div>
                    ))}
                  </div>

                  {rdo.justifications && rdo.justifications.length > 0 && (
                    <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                      <div className="text-sm font-medium text-destructive mb-1">Justificativas:</div>
                      {rdo.justifications.map((just: any, idx: number) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          • {just.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {getFilteredData().length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum RDO encontrado para os filtros selecionados
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingRdo} onOpenChange={() => setDeletingRdo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este RDO? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRdo && deleteMutation.mutate(deletingRdo)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export PDF Dialog */}
      <Dialog open={!!exportingRdo} onOpenChange={(open) => {
        if (!open) {
          setExportingRdo(null);
          setConsolidateServices(false);
        }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Exportar RDO para PDF</DialogTitle>
            <DialogDescription>Configure as opções de exportação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="consolidate-history" 
                checked={consolidateServices}
                onCheckedChange={(checked) => setConsolidateServices(checked === true)}
              />
              <Label 
                htmlFor="consolidate-history" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Consolidar serviços iguais
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao ativar esta opção, serviços com o mesmo nome e unidade serão somados e exibidos como um único item no PDF.
            </p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => {
                setExportingRdo(null);
                setConsolidateServices(false);
              }}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => exportingRdo && handleExportSingleRDO(exportingRdo)}>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit RDO Dialog */}
      <EditRDODialog
        rdo={editingRdo}
        open={!!editingRdo}
        onOpenChange={(open) => !open && setEditingRdo(null)}
        onSuccess={loadRDOs}
      />
    </div>
  );
};
