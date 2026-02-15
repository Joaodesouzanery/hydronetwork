import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { 
  Target, TrendingUp, Clock, CheckCircle, XCircle, DollarSign
} from "lucide-react";
import { format, differenceInDays, parseISO, subMonths, startOfMonth, endOfMonth, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#EF4444"];

export const CRMReports = () => {
  const { data: stages = [] } = useQuery({
    queryKey: ["crm-pipeline-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipeline_stages")
        .select("*")
        .order("position");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["crm-deals-all-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["crm-activities-all-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_activities")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stageHistory = [] } = useQuery({
    queryKey: ["crm-stage-history-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deal_stage_history")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Relatório: Pipeline por estágio
  const pipelineByStage = useMemo(() => {
    const openDeals = deals.filter(d => d.status === "open");
    return stages.map(stage => ({
      name: stage.name,
      color: stage.color,
      count: openDeals.filter(d => d.stage_id === stage.id).length,
      value: openDeals
        .filter(d => d.stage_id === stage.id)
        .reduce((sum, d) => sum + Number(d.estimated_value || 0), 0),
    }));
  }, [stages, deals]);

  // Relatório: Valor total em aberto
  const totalOpenValue = useMemo(() => {
    return deals
      .filter(d => d.status === "open")
      .reduce((sum, d) => sum + Number(d.estimated_value || 0), 0);
  }, [deals]);

  // Relatório: Taxa de conversão por estágio
  const conversionRates = useMemo(() => {
    const results: { from: string; to: string; rate: number }[] = [];
    
    for (let i = 0; i < stages.length - 1; i++) {
      const fromStage = stages[i];
      const toStage = stages[i + 1];
      
      const movedFrom = stageHistory.filter(h => h.from_stage_id === fromStage.id).length;
      const movedTo = stageHistory.filter(h => 
        h.from_stage_id === fromStage.id && h.to_stage_id === toStage.id
      ).length;
      
      const rate = movedFrom > 0 ? (movedTo / movedFrom) * 100 : 0;
      
      results.push({
        from: fromStage.name,
        to: toStage.name,
        rate: Math.round(rate),
      });
    }
    
    return results;
  }, [stages, stageHistory]);

  // Relatório: Oportunidades ganhas vs perdidas (últimos 6 meses)
  const wonVsLostByMonth = useMemo(() => {
    const months: { month: string; won: number; lost: number; wonValue: number; lostValue: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, "MMM/yy", { locale: ptBR });
      
      const wonDeals = deals.filter(d => {
        if (d.status !== "won" || !d.closed_at) return false;
        const closedDate = parseISO(d.closed_at);
        return isAfter(closedDate, monthStart) && isBefore(closedDate, monthEnd);
      });
      
      const lostDeals = deals.filter(d => {
        if (d.status !== "lost" || !d.closed_at) return false;
        const closedDate = parseISO(d.closed_at);
        return isAfter(closedDate, monthStart) && isBefore(closedDate, monthEnd);
      });
      
      months.push({
        month: monthLabel,
        won: wonDeals.length,
        lost: lostDeals.length,
        wonValue: wonDeals.reduce((sum, d) => sum + Number(d.estimated_value || 0), 0),
        lostValue: lostDeals.reduce((sum, d) => sum + Number(d.estimated_value || 0), 0),
      });
    }
    
    return months;
  }, [deals]);

  // Relatório: Atividades por tipo
  const activitiesByType = useMemo(() => {
    const types = ["task", "call", "meeting", "followup", "note"];
    const labels: Record<string, string> = {
      task: "Tarefas",
      call: "Ligações",
      meeting: "Reuniões",
      followup: "Follow-ups",
      note: "Notas",
    };
    
    return types.map((type, i) => ({
      name: labels[type],
      value: activities.filter(a => a.activity_type === type).length,
      color: COLORS[i],
    }));
  }, [activities]);

  // Relatório: Atividades pendentes vs concluídas
  const activitiesStatus = useMemo(() => {
    const pending = activities.filter(a => a.status === "pending").length;
    const completed = activities.filter(a => a.status === "completed").length;
    const cancelled = activities.filter(a => a.status === "cancelled").length;
    
    return [
      { name: "Pendentes", value: pending, color: "#F59E0B" },
      { name: "Concluídas", value: completed, color: "#10B981" },
      { name: "Canceladas", value: cancelled, color: "#6B7280" },
    ];
  }, [activities]);

  // Relatório: Tempo médio por estágio
  const avgTimeByStage = useMemo(() => {
    const results: { stage: string; avgDays: number }[] = [];
    
    stages.forEach(stage => {
      const stageEntries = stageHistory.filter(h => h.to_stage_id === stage.id);
      const stageExits = stageHistory.filter(h => h.from_stage_id === stage.id);
      
      const durations: number[] = [];
      
      stageEntries.forEach(entry => {
        const exit = stageExits.find(e => 
          e.deal_id === entry.deal_id && 
          new Date(e.created_at) > new Date(entry.created_at)
        );
        
        if (exit) {
          const days = differenceInDays(
            parseISO(exit.created_at),
            parseISO(entry.created_at)
          );
          durations.push(days);
        }
      });
      
      const avgDays = durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
      
      results.push({
        stage: stage.name,
        avgDays,
      });
    });
    
    return results;
  }, [stages, stageHistory]);

  // Totais
  const wonDeals = deals.filter(d => d.status === "won");
  const lostDeals = deals.filter(d => d.status === "lost");
  const totalWonValue = wonDeals.reduce((sum, d) => sum + Number(d.estimated_value || 0), 0);
  const overallConversion = deals.filter(d => d.status !== "open").length > 0
    ? ((wonDeals.length / deals.filter(d => d.status !== "open").length) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor em Aberto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalOpenValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {deals.filter(d => d.status === "open").length} oportunidades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Ganho Total</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalWonValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {wonDeals.length} oportunidades ganhas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallConversion}%</div>
            <p className="text-xs text-muted-foreground">
              {wonDeals.length} ganhas / {lostDeals.length} perdidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atividades</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activities.length}</div>
            <p className="text-xs text-muted-foreground">
              {activities.filter(a => a.status === "pending").length} pendentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline por estágio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Pipeline por Estágio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineByStage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === "value" 
                      ? `R$ ${value.toLocaleString("pt-BR")}` 
                      : value,
                    name === "value" ? "Valor" : "Quantidade"
                  ]}
                />
                <Bar dataKey="count" fill="#6366F1" name="Quantidade" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ganhas vs Perdidas por mês */}
        <Card>
          <CardHeader>
            <CardTitle>Ganhas vs Perdidas (Últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={wonVsLostByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="won" stroke="#10B981" name="Ganhas" strokeWidth={2} />
                <Line type="monotone" dataKey="lost" stroke="#EF4444" name="Perdidas" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Atividades por tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Atividades por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={activitiesByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={false}
                  >
                    {activitiesByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, "Quantidade"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center lg:flex-col lg:min-w-[120px]">
                {activitiesByType.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: entry.color }} 
                    />
                    <span className="whitespace-nowrap">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status das atividades */}
        <Card>
          <CardHeader>
            <CardTitle>Status das Atividades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={activitiesStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={false}
                  >
                    {activitiesStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, "Quantidade"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center lg:flex-col lg:min-w-[120px]">
                {activitiesStatus.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: entry.color }} 
                    />
                    <span className="whitespace-nowrap">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabelas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Taxa de conversão entre estágios */}
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Conversão por Estágio</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>De</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversionRates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Sem dados suficientes
                    </TableCell>
                  </TableRow>
                ) : (
                  conversionRates.map((rate, i) => (
                    <TableRow key={i}>
                      <TableCell>{rate.from}</TableCell>
                      <TableCell>{rate.to}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={rate.rate >= 50 ? "default" : "secondary"}>
                          {rate.rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Tempo médio por estágio */}
        <Card>
          <CardHeader>
            <CardTitle>Tempo Médio por Estágio</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estágio</TableHead>
                  <TableHead className="text-right">Dias (média)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {avgTimeByStage.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{item.stage}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">
                        {item.avgDays} dias
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
