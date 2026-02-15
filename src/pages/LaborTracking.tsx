import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { AddLaborTrackingDialog } from "@/components/labor/AddLaborTrackingDialog";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function LaborTracking() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: laborRecords, isLoading } = useQuery({
    queryKey: ["labor_tracking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labor_tracking")
        .select(`
          *,
          projects(name),
          employees(name)
        `)
        .order("work_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });

  const stats = {
    totalWorkers: laborRecords?.length || 0,
    totalHours: laborRecords?.reduce((sum, record) => sum + (record.hours_worked || 0), 0) || 0,
    totalCost: laborRecords?.reduce((sum, record) => sum + (record.total_cost || 0), 0) || 0,
  };

  const getCategoryBadge = (category: string) => {
    const labels: Record<string, string> = {
      pedreiro: "Pedreiro",
      servente: "Servente",
      operador: "Operador",
      eletricista: "Eletricista",
      encanador: "Encanador",
      pintor: "Pintor",
      carpinteiro: "Carpinteiro",
      outro: "Outro",
    };

    return <Badge variant="outline">{labels[category] || category}</Badge>;
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
              <h1 className="text-3xl font-bold">Apontamento de Mão de Obra</h1>
              <p className="text-muted-foreground">
                Controle de horas trabalhadas e custos de mão de obra
              </p>
            </div>
            <div className="flex gap-2">
              <PageTutorialButton pageKey="labor-tracking" />
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Apontamento
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Trabalhadores
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalWorkers}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Horas
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalHours.toFixed(2)}h
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Custo Total
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {stats.totalCost.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Apontamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Trabalhador</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Custo/Hora</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laborRecords?.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {new Date(record.work_date).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>{record.worker_name}</TableCell>
                      <TableCell>{getCategoryBadge(record.category)}</TableCell>
                      <TableCell>
                        {record.projects?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {record.entry_time} - {record.exit_time || "Em andamento"}
                      </TableCell>
                      <TableCell>
                        {record.hours_worked ? `${record.hours_worked}h` : "-"}
                      </TableCell>
                      <TableCell>
                        {record.hourly_rate
                          ? `R$ ${Number(record.hourly_rate).toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {record.total_cost
                          ? `R$ ${Number(record.total_cost).toFixed(2)}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!laborRecords || laborRecords.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  Nenhum apontamento registrado ainda.
                </div>
              )}
            </CardContent>
          </Card>

          <AddLaborTrackingDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
          />
        </main>
      </div>
    </SidebarProvider>
  );
}
