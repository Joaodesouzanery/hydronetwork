import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, FileText, HelpCircle, ArrowLeft } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AddConnectionReportDialog } from "@/components/connection-reports/AddConnectionReportDialog";
import { ConnectionReportsTable } from "@/components/connection-reports/ConnectionReportsTable";
import { TutorialDialog } from "@/components/shared/TutorialDialog";

export default function ConnectionReports() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["connection-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connection_reports")
        .select("*")
        .order("report_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!session,
  });

  const tutorialSteps = [
    {
      title: "Criar Novo Relatório",
      description: "Clique no botão 'Novo Relatório' para criar um relatório de ligações. Preencha as informações da equipe, data, endereço e dados do cliente."
    },
    {
      title: "Adicionar Fotos",
      description: "Use o campo de upload para adicionar fotos relacionadas ao relatório de ligação. As fotos ficarão armazenadas e aparecerão no PDF exportado."
    },
    {
      title: "Preencher Informações",
      description: "Preencha todos os campos necessários: nome da equipe, data, endereço, nome do cliente, número do hidrômetro, número da OS, tipo de serviço e observações."
    },
    {
      title: "Exportar para PDF",
      description: "Após criar o relatório, use o botão de exportar na tabela para gerar um PDF completo incluindo todas as informações e fotos."
    }
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold mb-2">Relatório de Ligações</h1>
                <p className="text-muted-foreground">
                  Gerencie os relatórios de ligações de água
                </p>
              </div>
              <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowTutorial(true)}
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                Tutorial
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Relatório
              </Button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">Carregando relatórios...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum relatório de ligação encontrado
              </h3>
              <p className="text-muted-foreground mb-4">
                Comece criando seu primeiro relatório de ligação
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Relatório
              </Button>
            </div>
          ) : (
            <ConnectionReportsTable reports={reports} />
          )}

          <AddConnectionReportDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
          />

          <TutorialDialog
            open={showTutorial}
            onOpenChange={setShowTutorial}
            title="Como usar Relatório de Ligações"
            steps={tutorialSteps}
          />
        </main>
      </div>
    </SidebarProvider>
  );
}
