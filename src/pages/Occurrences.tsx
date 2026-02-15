import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertCircle, Clock, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { AddOccurrenceDialog } from "@/components/occurrences/AddOccurrenceDialog";
import { OccurrenceDetailsDialog } from "@/components/occurrences/OccurrenceDetailsDialog";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";

export default function Occurrences() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: occurrences, isLoading } = useQuery({
    queryKey: ["occurrences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select(`
          *,
          projects(name),
          employees(name),
          daily_reports(report_date)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "resolvida") {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("occurrences")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      aberta: { variant: "destructive", icon: AlertCircle, label: "Aberta" },
      em_analise: { variant: "secondary", icon: Clock, label: "Em Análise" },
      resolvida: { variant: "default", icon: CheckCircle2, label: "Resolvida" },
    };

    const config = variants[status] || variants.aberta;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      erro_execucao: "Erro de Execução",
      atraso: "Atraso",
      material_inadequado: "Material Inadequado",
      falha_seguranca: "Falha de Segurança",
      reprovacao_checklist: "Reprovação de Checklist",
    };

    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 p-6">
            <div className="text-center">Carregando...</div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Ocorrências</h1>
              <p className="text-muted-foreground">
                Registro e acompanhamento de problemas identificados
              </p>
            </div>
            <div className="flex gap-2">
              <PageTutorialButton pageKey="occurrences" />
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Ocorrência
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {occurrences?.map((occurrence) => (
              <Card
                key={occurrence.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedOccurrence(occurrence)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-lg">
                        {occurrence.description.substring(0, 100)}
                        {occurrence.description.length > 100 && "..."}
                      </CardTitle>
                      <div className="flex gap-2">
                        {getStatusBadge(occurrence.status)}
                        {getTypeBadge(occurrence.occurrence_type)}
                      </div>
                    </div>
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-sm">
                    {occurrence.projects && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">Projeto:</span> {occurrence.projects.name}
                      </p>
                    )}
                    {occurrence.employees && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">Responsável:</span>{" "}
                        {occurrence.employees.name}
                      </p>
                    )}
                    {occurrence.correction_deadline && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">Prazo:</span>{" "}
                        {new Date(occurrence.correction_deadline).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {occurrence.photos_urls && occurrence.photos_urls.length > 0 && (
                      <p className="text-muted-foreground">
                        📷 {occurrence.photos_urls.length} foto(s) anexada(s)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {!occurrences || occurrences.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma ocorrência registrada ainda.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <AddOccurrenceDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
          />

          {selectedOccurrence && (
            <OccurrenceDetailsDialog
              occurrence={selectedOccurrence}
              open={!!selectedOccurrence}
              onOpenChange={(open) => !open && setSelectedOccurrence(null)}
              onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
            />
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
