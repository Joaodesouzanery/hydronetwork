import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Target, DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const CRMDashboard = () => {
  const { data: contacts = [] } = useQuery({
    queryKey: ["crm-contacts-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select("id, status, is_archived");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["crm-accounts-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_accounts")
        .select("id, is_archived");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["crm-deals-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("id, status, estimated_value, stage_id, created_at, closed_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["crm-activities-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_activities")
        .select("id, status, due_date, activity_type");
      if (error) throw error;
      return data || [];
    },
  });

  const activeContacts = contacts.filter(c => c.status === "active" && !c.is_archived).length;
  const activeAccounts = accounts.filter(a => !a.is_archived).length;
  const openDeals = deals.filter(d => d.status === "open");
  const wonDeals = deals.filter(d => d.status === "won");
  const lostDeals = deals.filter(d => d.status === "lost");

  const totalOpenValue = openDeals.reduce((sum, d) => sum + Number(d.estimated_value || 0), 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + Number(d.estimated_value || 0), 0);

  const pendingActivities = activities.filter(a => a.status === "pending");
  const overdueActivities = pendingActivities.filter(a => {
    if (!a.due_date) return false;
    return isBefore(parseISO(a.due_date), new Date());
  });

  const thisMonthStart = startOfMonth(new Date());
  const thisMonthEnd = endOfMonth(new Date());
  const wonThisMonth = wonDeals.filter(d => {
    if (!d.closed_at) return false;
    const closedDate = parseISO(d.closed_at);
    return isAfter(closedDate, thisMonthStart) && isBefore(closedDate, thisMonthEnd);
  });
  const closedThisMonth = deals.filter(d => {
    if (d.status === "open" || !d.closed_at) return false;
    const closedDate = parseISO(d.closed_at);
    return isAfter(closedDate, thisMonthStart) && isBefore(closedDate, thisMonthEnd);
  });

  const conversionRate = closedThisMonth.length > 0 
    ? ((wonThisMonth.length / closedThisMonth.length) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Contatos Ativos</span>
            <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{activeContacts}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {contacts.length} total
          </p>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Empresas</span>
            <Building2 className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{activeAccounts}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {accounts.length} registradas
          </p>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Oportunidades</span>
            <Target className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{openDeals.length}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
            R$ {totalOpenValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </p>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Valor Ganho</span>
            <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-green-600 truncate">
            R$ {totalWonValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {wonDeals.length} ganhas
          </p>
        </Card>
      </div>

      {/* Métricas secundárias */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Conversão</span>
            <TrendingUp className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{conversionRate}%</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {format(new Date(), "MMM", { locale: ptBR })}
          </p>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Pendentes</span>
            <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{pendingActivities.length}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {overdueActivities.length} atrasadas
          </p>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Ganhas</span>
            <CheckCircle className="h-4 w-4 text-green-600 hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-green-600">{wonDeals.length}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {wonThisMonth.length} este mês
          </p>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Perdidas</span>
            <AlertCircle className="h-4 w-4 text-red-600 hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-red-600">{lostDeals.length}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            Total
          </p>
        </Card>
      </div>

      {/* Métricas secundárias */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Este mês ({format(new Date(), "MMMM", { locale: ptBR })})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atividades Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingActivities.length}</div>
            <p className="text-xs text-muted-foreground">
              {overdueActivities.length} atrasadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades Ganhas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{wonDeals.length}</div>
            <p className="text-xs text-muted-foreground">
              {wonThisMonth.length} este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades Perdidas</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lostDeals.length}</div>
            <p className="text-xs text-muted-foreground">
              Total histórico
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Atividades atrasadas */}
      {overdueActivities.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Atividades Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">
              Você tem {overdueActivities.length} atividade(s) atrasada(s). 
              Acesse a aba "Atividades" para gerenciá-las.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
