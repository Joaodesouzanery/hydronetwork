import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, DollarSign, Clock, AlertTriangle, 
  TrendingUp, Calendar, Building2, CheckCircle 
} from "lucide-react";
import { formatarMoeda } from "@/utils/cltValidation";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const RHDashboard = () => {
  const hoje = new Date();
  const inicioMes = startOfMonth(hoje).toISOString().split('T')[0];
  const fimMes = endOfMonth(hoje).toISOString().split('T')[0];

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh-funcionarios-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, ativo, salario_base")
        .eq("ativo", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: escalas = [] } = useQuery({
    queryKey: ["rh-escalas-mes", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escalas_clt")
        .select("*")
        .gte("data", inicioMes)
        .lte("data", fimMes);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: faltas = [] } = useQuery({
    queryKey: ["rh-faltas-mes", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faltas_funcionarios")
        .select("*")
        .gte("data", inicioMes)
        .lte("data", fimMes);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: validacoes = [] } = useQuery({
    queryKey: ["rh-validacoes-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("validacoes_clt")
        .select("*")
        .eq("resolvido", false);
      if (error) throw error;
      return data || [];
    },
  });

  // Cálculos
  const totalFuncionarios = funcionarios.length;
  const totalHorasTrabalhadas = escalas.reduce((acc, e) => acc + Number(e.horas_normais || 0) + Number(e.horas_extras || 0), 0);
  const totalHorasExtras = escalas.reduce((acc, e) => acc + Number(e.horas_extras || 0), 0);
  const custoTotalMes = escalas.reduce((acc, e) => acc + Number(e.custo_total || 0), 0);
  const totalFaltas = faltas.length;
  const alertasBloqueio = validacoes.filter(v => v.nivel === 'bloqueio').length;
  const alertasAlerta = validacoes.filter(v => v.nivel === 'alerta').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Cards de resumo - Mobile grid 2x2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Funcionários</span>
            <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{totalFuncionarios}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">ativos</p>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Custo MO</span>
            <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-lg sm:text-2xl font-bold truncate">{formatarMoeda(custoTotalMes)}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {format(hoje, "MMM/yy", { locale: ptBR })}
          </p>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Horas</span>
            <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{totalHorasTrabalhadas.toFixed(0)}h</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {totalHorasExtras.toFixed(0)}h extras
          </p>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Alertas CLT</span>
            <AlertTriangle className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {alertasBloqueio > 0 && (
              <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 py-0.5">{alertasBloqueio}</Badge>
            )}
            {alertasAlerta > 0 && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-[10px] sm:text-xs px-1.5 py-0.5">
                {alertasAlerta}
              </Badge>
            )}
            {alertasBloqueio === 0 && alertasAlerta === 0 && (
              <Badge variant="outline" className="text-green-600 text-[10px] sm:text-xs px-1.5 py-0.5">
                <CheckCircle className="h-3 w-3 mr-0.5" />
                OK
              </Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Escalas do Mês
          </h3>
          <div className="space-y-3">
            {[
              { label: "Total de escalas", value: escalas.length },
              { label: "Folgas programadas", value: escalas.filter(e => e.is_folga).length },
              { label: "Domingos/Feriados", value: escalas.filter(e => e.is_domingo || e.is_feriado).length },
              { label: "Faltas registradas", value: totalFaltas, className: "text-red-600" },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`font-medium ${item.className || ''}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            Indicadores CLT
          </h3>
          <div className="space-y-3">
            {[
              { label: "Média horas/func.", value: `${totalFuncionarios > 0 ? (totalHorasTrabalhadas / totalFuncionarios).toFixed(1) : 0}h` },
              { label: "% Horas extras", value: `${totalHorasTrabalhadas > 0 ? ((totalHorasExtras / totalHorasTrabalhadas) * 100).toFixed(1) : 0}%` },
              { label: "Custo médio/func.", value: formatarMoeda(totalFuncionarios > 0 ? custoTotalMes / totalFuncionarios : 0) },
              { label: "Absenteísmo", value: `${escalas.length > 0 ? ((totalFaltas / escalas.length) * 100).toFixed(1) : 0}%` },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Alertas pendentes */}
      {validacoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Pendências CLT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validacoes.slice(0, 5).map((v) => (
                <div 
                  key={v.id} 
                  className={`p-3 rounded-lg border ${
                    v.nivel === 'bloqueio' 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <p className="text-sm font-medium">{v.mensagem}</p>
                  <p className="text-xs text-muted-foreground mt-1">{v.tipo_validacao}</p>
                </div>
              ))}
              {validacoes.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{validacoes.length - 5} outras pendências
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
