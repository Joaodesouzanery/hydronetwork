import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Download, 
  Filter, 
  Clock, 
  FileText, 
  Camera, 
  Video, 
  AlertTriangle,
  ClipboardCheck,
  Package,
  Warehouse,
  Wrench,
  QrCode,
  Phone,
  Users,
  Bell,
  Calendar,
  User,
  MapPin,
  Image
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExportProjectDialog } from "@/components/project-history/ExportProjectDialog";
import { TimelineItem } from "@/components/project-history/TimelineItem";

interface TimelineRecord {
  id: string;
  type: 'rdo' | 'occurrence' | 'checklist' | 'material_request' | 'inventory' | 'maintenance' | 'qrcode' | 'connection_report' | 'labor' | 'alert' | 'photo';
  date: Date;
  title: string;
  description?: string;
  user?: string;
  location?: string;
  hasPhoto?: boolean;
  hasVideo?: boolean;
  hasDocument?: boolean;
  metadata?: Record<string, any>;
}

const recordTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  rdo: { label: 'RDO', icon: FileText, color: 'bg-blue-500' },
  occurrence: { label: 'Ocorrência', icon: AlertTriangle, color: 'bg-red-500' },
  checklist: { label: 'Checklist', icon: ClipboardCheck, color: 'bg-green-500' },
  material_request: { label: 'Pedido de Material', icon: Package, color: 'bg-purple-500' },
  inventory: { label: 'Movimentação Estoque', icon: Warehouse, color: 'bg-yellow-500' },
  maintenance: { label: 'Manutenção', icon: Wrench, color: 'bg-orange-500' },
  qrcode: { label: 'Registro QR Code', icon: QrCode, color: 'bg-cyan-500' },
  connection_report: { label: 'Relatório de Ligação', icon: Phone, color: 'bg-indigo-500' },
  labor: { label: 'Apontamento de Horas', icon: Users, color: 'bg-pink-500' },
  alert: { label: 'Alerta', icon: Bell, color: 'bg-amber-500' },
  photo: { label: 'Foto/Vídeo', icon: Camera, color: 'bg-teal-500' },
};

export default function ProjectHistory() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineRecord[]>([]);
  const [filteredTimeline, setFilteredTimeline] = useState<TimelineRecord[]>([]);
  const [serviceFronts, setServiceFronts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedFront, setSelectedFront] = useState("");
  const [selectedResponsible, setSelectedResponsible] = useState("");
  const [onlyWithEvidence, setOnlyWithEvidence] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  useEffect(() => {
    applyFilters();
  }, [timeline, startDate, endDate, selectedTypes, selectedFront, selectedResponsible, onlyWithEvidence]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      
      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch service fronts
      const { data: frontsData } = await supabase
        .from('service_fronts')
        .select('*')
        .eq('project_id', projectId);
      setServiceFronts(frontsData || []);

      // Fetch employees
      const { data: employeesData } = await supabase
        .from('employees')
        .select('*')
        .eq('project_id', projectId);
      setEmployees(employeesData || []);

      // Fetch all timeline data
      await fetchTimelineData();
      
    } catch (error) {
      console.error('Error fetching project data:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do projeto.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTimelineData = async () => {
    const records: TimelineRecord[] = [];

    // Fetch RDOs
    const { data: rdos } = await supabase
      .from('daily_reports')
      .select('*, construction_sites(name), service_fronts(name)')
      .eq('project_id', projectId);
    
    rdos?.forEach(rdo => {
      records.push({
        id: rdo.id,
        type: 'rdo',
        date: new Date(rdo.report_date),
        title: `RDO - ${format(parseISO(rdo.report_date), 'dd/MM/yyyy', { locale: ptBR })}`,
        description: rdo.general_observations || 'Relatório diário registrado',
        location: rdo.service_fronts?.name || rdo.construction_sites?.name,
        hasPhoto: false,
        metadata: rdo
      });
    });

    // Fetch Occurrences
    const { data: occurrences } = await supabase
      .from('occurrences')
      .select('*')
      .eq('project_id', projectId);
    
    occurrences?.forEach(occ => {
      records.push({
        id: occ.id,
        type: 'occurrence',
        date: new Date(occ.created_at),
        title: `Ocorrência: ${occ.occurrence_type}`,
        description: occ.description,
        hasPhoto: occ.photos_urls && occ.photos_urls.length > 0,
        metadata: occ
      });
    });

    // Fetch Checklists
    const { data: checklists } = await supabase
      .from('checklists')
      .select('*, checklist_items(*)')
      .eq('project_id', projectId);
    
    checklists?.forEach(check => {
      const completed = check.checklist_items?.filter((i: any) => i.status === 'completed').length || 0;
      const total = check.checklist_items?.length || 0;
      records.push({
        id: check.id,
        type: 'checklist',
        date: new Date(check.created_at),
        title: check.name,
        description: `${completed}/${total} itens concluídos`,
        metadata: check
      });
    });

    // Fetch Material Requests
    const { data: materialRequests } = await supabase
      .from('material_requests')
      .select('*, service_fronts(name)')
      .eq('project_id', projectId);
    
    materialRequests?.forEach(req => {
      records.push({
        id: req.id,
        type: 'material_request',
        date: new Date(req.request_date),
        title: `Pedido: ${req.material_name}`,
        description: `${req.quantity} ${req.unit} - Status: ${req.status}`,
        location: req.service_fronts?.name,
        metadata: req
      });
    });

    // Fetch Inventory Movements
    const { data: inventoryMovements } = await supabase
      .from('inventory_movements')
      .select('*, inventory(material_name, project_id)')
      .order('created_at', { ascending: false });
    
    const projectInventory = inventoryMovements?.filter(m => m.inventory?.project_id === projectId) || [];
    projectInventory.forEach(mov => {
      records.push({
        id: mov.id,
        type: 'inventory',
        date: new Date(mov.created_at),
        title: `${mov.movement_type === 'entrada' ? 'Entrada' : 'Saída'}: ${mov.inventory?.material_name}`,
        description: `Quantidade: ${mov.quantity} - ${mov.reason || 'Sem observação'}`,
        metadata: mov
      });
    });

    // Fetch Maintenance Tasks
    const { data: maintenanceTasks } = await supabase
      .from('maintenance_tasks')
      .select('*, assets_catalog(name)')
      .eq('project_id', projectId);
    
    maintenanceTasks?.forEach(task => {
      records.push({
        id: task.id,
        type: 'maintenance',
        date: new Date(task.created_at),
        title: task.title,
        description: task.description || `Status: ${task.status}`,
        location: task.assets_catalog?.name,
        metadata: task
      });
    });

    // Fetch Connection Reports
    const { data: connectionReports } = await supabase
      .from('connection_reports')
      .select('*')
      .eq('project_id', projectId);
    
    connectionReports?.forEach(report => {
      records.push({
        id: report.id,
        type: 'connection_report',
        date: new Date(report.report_date),
        title: `Ligação OS: ${report.os_number}`,
        description: `${report.service_type} - ${report.client_name}`,
        location: report.address,
        hasPhoto: report.photos_urls && report.photos_urls.length > 0,
        metadata: report
      });
    });

    // Fetch Labor Tracking
    const { data: laborTracking } = await supabase
      .from('labor_tracking')
      .select('*')
      .eq('project_id', projectId);
    
    laborTracking?.forEach(labor => {
      records.push({
        id: labor.id,
        type: 'labor',
        date: new Date(labor.work_date),
        title: `Apontamento: ${labor.worker_name}`,
        description: `${labor.category} - ${labor.hours_worked || 0}h trabalhadas`,
        user: labor.worker_name,
        metadata: labor
      });
    });

    // Fetch Maintenance Requests (via QR Code)
    const { data: qrCodes } = await supabase
      .from('maintenance_qr_codes')
      .select('*, maintenance_requests(*)')
      .eq('project_id', projectId);
    
    qrCodes?.forEach(qr => {
      qr.maintenance_requests?.forEach((req: any) => {
        records.push({
          id: req.id,
          type: 'qrcode',
          date: new Date(req.created_at),
          title: `Solicitação via QR: ${qr.location_name}`,
          description: req.issue_description,
          location: qr.location_name,
          hasPhoto: req.photos_urls && req.photos_urls.length > 0,
          user: req.requester_name,
          metadata: { ...req, qr_code: qr }
        });
      });
    });

    // Sort by date descending
    records.sort((a, b) => b.date.getTime() - a.date.getTime());
    setTimeline(records);
    setFilteredTimeline(records);
  };

  const applyFilters = () => {
    let filtered = [...timeline];

    if (startDate) {
      filtered = filtered.filter(r => r.date >= new Date(startDate));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => r.date <= end);
    }
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(r => selectedTypes.includes(r.type));
    }
    if (onlyWithEvidence) {
      filtered = filtered.filter(r => r.hasPhoto || r.hasVideo || r.hasDocument);
    }

    setFilteredTimeline(filtered);
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedTypes([]);
    setSelectedFront("");
    setSelectedResponsible("");
    setOnlyWithEvidence(false);
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <main className="flex-1 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <Skeleton className="h-12 w-64" />
              <Skeleton className="h-96 w-full" />
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">Histórico da Obra</h1>
                  <p className="text-muted-foreground">{project?.name}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filtros
                </Button>
                <Button onClick={() => setExportDialogOpen(true)} className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar Obra
                </Button>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Filtros</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Data Inicial</Label>
                      <Input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Final</Label>
                      <Input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Frente de Serviço</Label>
                      <Select value={selectedFront} onValueChange={(val) => setSelectedFront(val === "all" ? "" : val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {serviceFronts.map(front => (
                            <SelectItem key={front.id} value={front.id}>{front.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Responsável</Label>
                      <Select value={selectedResponsible} onValueChange={(val) => setSelectedResponsible(val === "all" ? "" : val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Registro</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(recordTypeConfig).map(([key, config]) => (
                        <Badge
                          key={key}
                          variant={selectedTypes.includes(key) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleType(key)}
                        >
                          <config.icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="evidence" 
                        checked={onlyWithEvidence}
                        onCheckedChange={(checked) => setOnlyWithEvidence(checked as boolean)}
                      />
                      <Label htmlFor="evidence" className="cursor-pointer">
                        Somente registros com evidência (foto/vídeo/documento)
                      </Label>
                    </div>
                    <Button variant="ghost" onClick={clearFilters}>
                      Limpar Filtros
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{filteredTimeline.length}</p>
                      <p className="text-sm text-muted-foreground">Registros</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">
                        {filteredTimeline.filter(r => r.hasPhoto).length}
                      </p>
                      <p className="text-sm text-muted-foreground">Com Fotos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">
                        {filteredTimeline.filter(r => r.type === 'occurrence').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Ocorrências</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">
                        {filteredTimeline.filter(r => r.type === 'rdo').length}
                      </p>
                      <p className="text-sm text-muted-foreground">RDOs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Linha do Tempo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  {filteredTimeline.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum registro encontrado para os filtros selecionados.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredTimeline.map((record, index) => (
                        <TimelineItem 
                          key={record.id} 
                          record={record} 
                          config={recordTypeConfig[record.type]}
                          isLast={index === filteredTimeline.length - 1}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <ExportProjectDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        projectId={projectId!}
        projectName={project?.name || ''}
        timeline={timeline}
      />
    </SidebarProvider>
  );
}
