import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Shield, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import type { LpsConstraint, PPCResult } from '@/types/lean-constraints';
import { getOverdueConstraints } from '@/engine/lean-constraints';

interface LeanKPICardsProps {
  constraints: LpsConstraint[];
  currentPPC: PPCResult | null;
}

export function LeanKPICards({ constraints, currentPPC }: LeanKPICardsProps) {
  const total = constraints.length;
  const ativas = constraints.filter(c => c.status === 'ativa').length;
  const criticas = constraints.filter(c => c.status === 'critica').length;
  const resolvidas = constraints.filter(c => c.status === 'resolvida').length;
  const vencidas = getOverdueConstraints(constraints).length;

  const avgResolutionDays = (() => {
    const resolved = constraints.filter(c => c.status === 'resolvida' && c.data_resolvida);
    if (resolved.length === 0) return 0;
    const totalDays = resolved.reduce((sum, c) => {
      const days = Math.round(
        (new Date(c.data_resolvida!).getTime() - new Date(c.data_identificacao).getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + Math.max(0, days);
    }, 0);
    return Math.round(totalDays / resolved.length);
  })();

  const cards = [
    { title: 'Total Restrições', value: total, icon: Shield, color: 'text-blue-600' },
    { title: 'Ativas', value: ativas, icon: AlertTriangle, color: 'text-yellow-600' },
    { title: 'Críticas', value: criticas, icon: AlertTriangle, color: 'text-red-600' },
    { title: 'Vencidas', value: vencidas, icon: AlertCircle, color: vencidas > 0 ? 'text-red-600 animate-pulse' : 'text-gray-400' },
    { title: 'Resolvidas', value: resolvidas, icon: CheckCircle, color: 'text-green-600' },
    { title: 'PPC (%)', value: currentPPC ? `${currentPPC.ppc}%` : '—', icon: TrendingUp, color: 'text-purple-600' },
    { title: 'Tempo Médio (dias)', value: avgResolutionDays || '—', icon: Clock, color: 'text-orange-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
