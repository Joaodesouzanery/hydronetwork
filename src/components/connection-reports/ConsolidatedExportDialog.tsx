import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileStack, Filter } from "lucide-react";
import { generateConsolidatedReportPDF } from "@/lib/connectionReportGenerator";
import { useToast } from "@/hooks/use-toast";

interface ConnectionReport {
  id: string;
  team_name: string;
  report_date: string;
  address: string;
  address_complement: string | null;
  client_name: string;
  water_meter_number: string;
  os_number: string;
  service_type: string;
  service_category: string | null;
  connection_type: string | null;
  observations: string | null;
  materials_used: any[] | null;
  photos_urls: string[];
  logo_url: string | null;
  project_id: string | null;
}

interface ExportFilters {
  includeTeamSummary: boolean;
  includeServiceSummary: boolean;
  includeDetailedList: boolean;
  includeMaterials: boolean;
  includeObservations: boolean;
  includePhotos: boolean;
  filterByTeam: string;
  filterByServiceType: string;
}

interface ConsolidatedExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: ConnectionReport[];
  availableDates: string[];
  reportsByDate: Record<string, ConnectionReport[]>;
}

export function ConsolidatedExportDialog({
  open,
  onOpenChange,
  reports,
  availableDates,
  reportsByDate,
}: ConsolidatedExportDialogProps) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [filters, setFilters] = useState<ExportFilters>({
    includeTeamSummary: true,
    includeServiceSummary: true,
    includeDetailedList: true,
    includeMaterials: true,
    includeObservations: true,
    includePhotos: false,
    filterByTeam: "",
    filterByServiceType: "",
  });
  const [isExporting, setIsExporting] = useState(false);

  // Lista de equipes únicas
  const uniqueTeams = useMemo(() => {
    const teams = new Set<string>();
    reports.forEach(r => teams.add(r.team_name));
    return Array.from(teams).sort();
  }, [reports]);

  // Lista de tipos de serviço únicos
  const uniqueServiceTypes = useMemo(() => {
    const types = new Set<string>();
    reports.forEach(r => types.add(r.service_type));
    return Array.from(types).sort();
  }, [reports]);

  // Relatórios filtrados para a data selecionada
  const filteredReports = useMemo(() => {
    if (!selectedDate || !reportsByDate[selectedDate]) return [];
    
    let result = reportsByDate[selectedDate];

    if (filters.filterByTeam) {
      result = result.filter(r => r.team_name === filters.filterByTeam);
    }

    if (filters.filterByServiceType) {
      result = result.filter(r => r.service_type === filters.filterByServiceType);
    }

    return result;
  }, [selectedDate, reportsByDate, filters.filterByTeam, filters.filterByServiceType]);

  const handleExport = async () => {
    if (!selectedDate || filteredReports.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione uma data com relatórios disponíveis.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      toast({
        title: "Gerando PDF...",
        description: `Consolidando ${filteredReports.length} relatório(s)...`,
      });

      await generateConsolidatedReportPDF(filteredReports, selectedDate, filters);

      toast({
        title: "Sucesso!",
        description: "Relatório consolidado exportado com sucesso.",
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar o relatório consolidado.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const toggleFilter = (key: keyof ExportFilters) => {
    if (typeof filters[key] === 'boolean') {
      setFilters(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5" />
            Exportar Relatório Consolidado
          </DialogTitle>
          <DialogDescription>
            Selecione a data e as informações que deseja incluir no relatório.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Seleção de Data */}
          <div className="space-y-2">
            <Label>Data do Relatório *</Label>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a data" />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map(date => (
                  <SelectItem key={date} value={date}>
                    {format(new Date(date), "dd/MM/yyyy (EEEE)", { locale: ptBR })} 
                    <Badge variant="secondary" className="ml-2">
                      {reportsByDate[date].length}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtros */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </Label>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Por Equipe</Label>
                <Select 
                  value={filters.filterByTeam || "all"} 
                  onValueChange={(v) => setFilters(prev => ({ ...prev, filterByTeam: v === "all" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Equipes</SelectItem>
                    {uniqueTeams.map(team => (
                      <SelectItem key={team} value={team}>{team}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Por Tipo de Serviço</Label>
                <Select 
                  value={filters.filterByServiceType || "all"} 
                  onValueChange={(v) => setFilters(prev => ({ ...prev, filterByServiceType: v === "all" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    {uniqueServiceTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedDate && (
              <div className="text-sm text-muted-foreground">
                {filteredReports.length} relatório(s) selecionado(s)
              </div>
            )}
          </div>

          {/* Conteúdo a incluir */}
          <div className="space-y-3">
            <Label>Informações a Incluir</Label>
            
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="teamSummary"
                  checked={filters.includeTeamSummary}
                  onCheckedChange={() => toggleFilter('includeTeamSummary')}
                />
                <Label htmlFor="teamSummary" className="font-normal cursor-pointer">
                  Resumo por Equipe
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="serviceSummary"
                  checked={filters.includeServiceSummary}
                  onCheckedChange={() => toggleFilter('includeServiceSummary')}
                />
                <Label htmlFor="serviceSummary" className="font-normal cursor-pointer">
                  Resumo de Serviços Consolidados (com soma)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="detailedList"
                  checked={filters.includeDetailedList}
                  onCheckedChange={() => toggleFilter('includeDetailedList')}
                />
                <Label htmlFor="detailedList" className="font-normal cursor-pointer">
                  Lista Detalhada de Serviços
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="materials"
                  checked={filters.includeMaterials}
                  onCheckedChange={() => toggleFilter('includeMaterials')}
                />
                <Label htmlFor="materials" className="font-normal cursor-pointer">
                  Materiais Utilizados
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="observations"
                  checked={filters.includeObservations}
                  onCheckedChange={() => toggleFilter('includeObservations')}
                />
                <Label htmlFor="observations" className="font-normal cursor-pointer">
                  Observações
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="photos"
                  checked={filters.includePhotos}
                  onCheckedChange={() => toggleFilter('includePhotos')}
                />
                <Label htmlFor="photos" className="font-normal cursor-pointer">
                  Fotos (aumenta tamanho do PDF)
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={!selectedDate || filteredReports.length === 0 || isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Gerando...' : 'Exportar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
