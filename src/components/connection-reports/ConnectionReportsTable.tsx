import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Pencil, Trash2, FileStack, Settings2 } from "lucide-react";
import { generateConnectionReportPDF } from "@/lib/connectionReportGenerator";
import { useToast } from "@/hooks/use-toast";
import { EditConnectionReportDialog } from "./EditConnectionReportDialog";
import { ConsolidatedExportDialog } from "./ConsolidatedExportDialog";
import { supabase } from "@/lib/supabase";
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
  created_at: string;
}

interface ConnectionReportsTableProps {
  reports: ConnectionReport[];
}

export function ConnectionReportsTable({ reports }: ConnectionReportsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingReport, setEditingReport] = useState<ConnectionReport | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deletingReport, setDeletingReport] = useState<ConnectionReport | null>(null);
  const [showConsolidatedDialog, setShowConsolidatedDialog] = useState(false);

  // Agrupa relatórios por data
  const reportsByDate = useMemo(() => {
    const grouped: Record<string, ConnectionReport[]> = {};
    reports.forEach(report => {
      const date = report.report_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(report);
    });
    return grouped;
  }, [reports]);

  // Lista de datas disponíveis
  const availableDates = useMemo(() => {
    return Object.keys(reportsByDate).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
  }, [reportsByDate]);

  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from('connection_reports')
        .delete()
        .eq('id', reportId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-reports'] });
      toast({
        title: "Sucesso!",
        description: "Relatório deletado com sucesso.",
      });
      setDeletingReport(null);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao deletar relatório.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const handleExportPDF = async (report: ConnectionReport) => {
    try {
      toast({
        title: "Gerando PDF...",
        description: "Por favor, aguarde enquanto o relatório é gerado.",
      });

      await generateConnectionReportPDF(report);

      toast({
        title: "Sucesso!",
        description: "Relatório exportado com sucesso.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar o relatório PDF.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (report: ConnectionReport) => {
    setEditingReport(report);
    setShowEditDialog(true);
  };

  return (
    <div className="space-y-4">
      {/* Exportar Consolidado */}
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border">
        <FileStack className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">Exportar Relatório Consolidado</p>
          <p className="text-xs text-muted-foreground">Gere um PDF com filtros avançados para todos os relatórios de um dia</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => setShowConsolidatedDialog(true)}
        >
          <Settings2 className="h-4 w-4 mr-2" />
          Exportar com Filtros
        </Button>
      </div>

      <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Endereço</TableHead>
            <TableHead>Nº OS</TableHead>
            <TableHead>Tipo de Serviço</TableHead>
            <TableHead>Fotos</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell>
                {format(new Date(report.report_date), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </TableCell>
              <TableCell className="font-medium">{report.team_name}</TableCell>
              <TableCell>{report.client_name}</TableCell>
              <TableCell>
                {report.address}
                {report.address_complement && `, ${report.address_complement}`}
              </TableCell>
              <TableCell>{report.os_number}</TableCell>
              <TableCell>{report.service_type}</TableCell>
              <TableCell>
                {report.photos_urls?.length > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {report.photos_urls.length} foto(s)
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Sem fotos</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(report)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportPDF(report)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeletingReport(report)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <EditConnectionReportDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        report={editingReport}
      />

      <ConsolidatedExportDialog
        open={showConsolidatedDialog}
        onOpenChange={setShowConsolidatedDialog}
        reports={reports}
        availableDates={availableDates}
        reportsByDate={reportsByDate}
      />

      <AlertDialog open={!!deletingReport} onOpenChange={() => setDeletingReport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este relatório de ligação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingReport && deleteMutation.mutate(deletingReport.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
