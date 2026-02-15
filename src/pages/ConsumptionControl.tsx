import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, FileDown, HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddReadingDialog } from "@/components/consumption/AddReadingDialog";
import { ConsumptionChart } from "@/components/consumption/ConsumptionChart";
import { ReadingsTable } from "@/components/consumption/ReadingsTable";
import { ConsumptionStats } from "@/components/consumption/ConsumptionStats";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { toast } from "sonner";
import { TutorialDialog } from "@/components/shared/TutorialDialog";

export default function ConsumptionControl() {
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTutorial, setShowTutorial] = useState(false);

  const tutorialSteps = [
    {
      title: "Adicionar Nova Leitura",
      description: 'Clique em "Nova Leitura" e preencha os campos: data, horário (8h, 14h, 18h ou 20h), tipo de medidor (água, energia ou gás), valor lido e localização.',
    },
    {
      title: "Visualizar Consumo",
      description: 'Use a aba "Gráficos" para ver o consumo em formato visual. Os gráficos mostram a evolução diária do consumo de cada recurso.',
    },
    {
      title: "Editar Leituras",
      description: 'Na aba "Leituras", clique no ícone de edição para corrigir valores registrados anteriormente.',
    },
    {
      title: "Exportar Relatórios",
      description: 'Clique em "Exportar PDF" para gerar um relatório completo com todas as leituras do período selecionado.',
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

  const { data: readings, refetch } = useQuery({
    queryKey: ["consumption-readings", selectedDate],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const startDate = format(subDays(selectedDate, 30), "yyyy-MM-dd");
      const endDate = format(selectedDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("consumption_readings")
        .select(`
          *,
          projects (name)
        `)
        .gte("reading_date", startDate)
        .lte("reading_date", endDate)
        .order("reading_date", { ascending: false })
        .order("reading_time", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const exportToPDF = () => {
    try {
      if (!readings || readings.length === 0) {
        toast.error("Não há leituras para exportar");
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(18);
      doc.text("Relatório de Controle de Consumo", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.text(format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), pageWidth / 2, 28, { align: "center" });

      // Table data
      const tableData = readings.map((reading: any) => [
        format(new Date(reading.reading_date), "dd/MM/yyyy"),
        reading.reading_time,
        reading.meter_type === "water" ? "Água" : reading.meter_type === "energy" ? "Energia" : "Gás",
        reading.meter_value.toString(),
        reading.location || "-",
        reading.projects?.name || "-",
      ]);

      (doc as any).autoTable({
        startY: 35,
        head: [["Data", "Hora", "Tipo", "Valor", "Local", "Projeto"]],
        body: tableData,
        theme: "grid",
      });

      doc.save(`controle-consumo-${format(selectedDate, "yyyy-MM-dd")}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao exportar PDF: " + (error.message || "Erro desconhecido"));
      console.error(error);
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
                  <h1 className="text-3xl font-bold">Controle de Consumo</h1>
                  <p className="text-muted-foreground">
                    Registre leituras e acompanhe o consumo diário
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowTutorial(true)}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Tutorial
                </Button>
                <Button variant="outline" onClick={exportToPDF}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Leitura
                </Button>
              </div>
            </div>

            <ConsumptionStats readings={readings || []} />

            <Tabs defaultValue="charts" className="space-y-4">
              <TabsList>
                <TabsTrigger value="charts">Gráficos</TabsTrigger>
                <TabsTrigger value="readings">Leituras</TabsTrigger>
              </TabsList>

              <TabsContent value="charts" className="space-y-4">
                <ConsumptionChart readings={readings || []} />
              </TabsContent>

              <TabsContent value="readings">
                <ReadingsTable readings={readings || []} onUpdate={refetch} />
              </TabsContent>
            </Tabs>

            <AddReadingDialog
              open={isAddDialogOpen}
              onOpenChange={setIsAddDialogOpen}
              projects={projects || []}
              onSuccess={refetch}
            />

            <TutorialDialog
              open={showTutorial}
              onOpenChange={setShowTutorial}
              title="Tutorial - Controle de Consumo"
              steps={tutorialSteps}
            />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
