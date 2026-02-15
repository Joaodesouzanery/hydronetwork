import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, AlertCircle, Calendar, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Dashboard360 = () => {
  const navigate = useNavigate();

  const { data: projects } = useQuery({
    queryKey: ['projects-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*', { count: 'exact' });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: budgets } = useQuery({
    queryKey: ['budgets-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alertas_historico')
        .select('*')
        .is('justificado_em', null);
      if (error) throw error;
      return data || [];
    }
  });

  const activeProjects = projects?.filter(p => p.status === 'active').length || 0;
  const totalBudgets = budgets?.length || 0;
  const pendingAlerts = alerts?.length || 0;
  const totalRevenue = budgets?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard 360º</h1>
            <p className="text-muted-foreground">Visão completa do seu negócio</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projetos Ativos</p>
                <h3 className="text-3xl font-bold text-foreground mt-2">{activeProjects}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Orçamentos</p>
                <h3 className="text-3xl font-bold text-foreground mt-2">{totalBudgets}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertas Pendentes</p>
                <h3 className="text-3xl font-bold text-foreground mt-2">{pendingAlerts}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <h3 className="text-3xl font-bold text-foreground mt-2">
                  R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-accent" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Projetos Recentes</h3>
            <div className="space-y-3">
              {projects?.slice(0, 5).map(project => (
                <div key={project.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">{project.address}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {project.status}
                  </span>
                </div>
              ))}
              {!projects?.length && (
                <p className="text-muted-foreground text-center py-8">Nenhum projeto cadastrado</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Últimos Orçamentos</h3>
            <div className="space-y-3">
              {budgets?.slice(0, 5).map(budget => (
                <div key={budget.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{budget.name}</p>
                    <p className="text-sm text-muted-foreground">{budget.client_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      R$ {(budget.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      budget.status === 'approved' ? 'bg-green-100 text-green-800' : 
                      budget.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {budget.status}
                    </span>
                  </div>
                </div>
              ))}
              {!budgets?.length && (
                <p className="text-muted-foreground text-center py-8">Nenhum orçamento cadastrado</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard360;
