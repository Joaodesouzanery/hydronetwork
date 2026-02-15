import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowLeft, HelpCircle } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ReportFilters } from "@/components/facility/reports/ReportFilters";
import { TasksSummary } from "@/components/facility/reports/TasksSummary";
import { MaterialsSummary } from "@/components/facility/reports/MaterialsSummary";
import { ConsumptionSummary } from "@/components/facility/reports/ConsumptionSummary";
import { PerformanceCharts } from "@/components/facility/reports/PerformanceCharts";
import { generateFacilityReport } from "@/lib/reportGenerator";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TutorialDialog } from "@/components/shared/TutorialDialog";

export default function FacilityReports() {
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [reportPeriod, setReportPeriod] = useState<"daily" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const tutorialSteps = [
    {
      title: "Selecionar Projeto",
      description: "Primeiro, escolha o projeto para o qual deseja gerar o relatório. Os dados serão filtrados automaticamente.",
    },
    {
      title: "Escolher Período",
      description: 'Selecione se deseja um relatório "Diário" ou "Mensal", e escolha a data correspondente.',
    },
    {
      title: "Visualizar Dados",
      description: "O sistema mostrará automaticamente resumos de tarefas, materiais, consumo e gráficos de desempenho.",
    },
    {
      title: "Exportar Relatório",
      description: 'Clique em "Exportar PDF" para gerar um documento completo com todos os dados consolidados do período selecionado.',
    },
  ];

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("created_by_user_id", userData.user.id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const dateRange = reportPeriod === "daily" 
    ? { start: startOfDay(selectedDate), end: endOfDay(selectedDate) }
    : { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["facility-report", selectedProject, reportPeriod, selectedDate],
    queryFn: async () => {
      if (!selectedProject) return null;

      const startDate = format(dateRange.start, "yyyy-MM-dd HH:mm:ss");
      const endDate = format(dateRange.end, "yyyy-MM-dd HH:mm:ss");

      // Fetch tasks
      const { data: tasks, error: tasksError } = await supabase
        .from("maintenance_tasks")
        .select(`
          *,
          task_checklist_items (*),
          task_photos (*)
        `)
        .eq("project_id", selectedProject)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (tasksError) throw tasksError;

      // Fetch material requests
      const { data: materialRequests, error: requestsError } = await supabase
        .from("material_requests")
        .select("*")
        .eq("project_id", selectedProject)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (requestsError) throw requestsError;

      // Fetch inventory movements
      const { data: movements, error: movementsError } = await supabase
        .from("inventory_movements")
        .select(`
          *,
          inventory (
            material_name,
            unit
          )
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (movementsError) throw movementsError;

      // Fetch consumption readings
      const { data: consumption, error: consumptionError } = await supabase
        .from("consumption_readings")
        .select("*")
        .eq("project_id", selectedProject)
        .gte("reading_date", format(dateRange.start, "yyyy-MM-dd"))
        .lte("reading_date", format(dateRange.end, "yyyy-MM-dd"));

      if (consumptionError) throw consumptionError;

      return {
        tasks: tasks || [],
        materialRequests: materialRequests || [],
        movements: movements || [],
        consumption: consumption || [],
      };
    },
    enabled: !!selectedProject,
  });

  const handleGeneratePDF = async () => {
    if (!reportData || !selectedProject) {
      toast.error("Selecione um projeto e aguarde o carregamento dos dados");
      return;
    }

    try {
      setIsGenerating(true);
      const project = projects?.find(p => p.id === selectedProject);
      await generateFacilityReport(reportData, {
        projectName: project?.name || "Projeto",
        period: reportPeriod,
        date: selectedDate,
      });
      toast.success("Relatório gerado com sucesso!");
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast.error("Erro ao gerar relatório");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1">
          <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Relatórios de Gestão Predial</h1>
                  <p className="text-muted-foreground">
                    Relatórios automáticos consolidados
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowTutorial(true)}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Tutorial
                </Button>
                <Button 
                  onClick={handleGeneratePDF}
                  disabled={!selectedProject || isLoading || isGenerating}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isGenerating ? "Gerando..." : "Exportar PDF"}
                </Button>
              </div>
            </div>

            <ReportFilters
              projects={projects || []}
              selectedProject={selectedProject}
              onProjectChange={setSelectedProject}
              reportPeriod={reportPeriod}
              onPeriodChange={setReportPeriod}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />

            {!selectedProject ? (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Selecione um projeto para visualizar o relatório
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Carregando dados...</p>
                </CardContent>
              </Card>
            ) : reportData ? (
              <div className="space-y-6">
                <TasksSummary tasks={reportData.tasks} />
                <MaterialsSummary
                  requests={reportData.materialRequests}
                  movements={reportData.movements}
                />
                <ConsumptionSummary consumption={reportData.consumption} />
                <PerformanceCharts tasks={reportData.tasks} />
              </div>
            ) : null}

            <TutorialDialog
              open={showTutorial}
              onOpenChange={setShowTutorial}
              title="Tutorial - Relatórios de Gestão Predial"
              steps={tutorialSteps}
            />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
