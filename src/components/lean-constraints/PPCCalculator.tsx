import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import type { PPCResult } from '@/types/lean-constraints';

interface PPCCalculatorProps {
  ppcData: PPCResult[];
  currentPPC: PPCResult | null;
}

export function PPCCalculator({ ppcData, currentPPC }: PPCCalculatorProps) {
  const chartData = ppcData.map((p) => ({
    semana: `${p.weekStart.slice(5)}`,
    ppc: p.ppc,
    ppcAjustado: p.ppcAdjusted,
    total: p.totalCommitments,
    cumpridos: p.completed,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          PPC - Percentual de Planos Concluídos
          {currentPPC && (
            <div className="flex gap-4 text-sm font-normal">
              <span>PPC: <strong className={currentPPC.ppc >= 75 ? 'text-green-600' : 'text-red-600'}>
                {currentPPC.ppc}%
              </strong></span>
              <span>PPC Ajustado: <strong className={currentPPC.ppcAdjusted >= 75 ? 'text-green-600' : 'text-red-600'}>
                {currentPPC.ppcAdjusted}%
              </strong></span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Adicione compromissos semanais para ver o PPC.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semana" />
              <YAxis domain={[0, 100]} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value}%`,
                  name === 'ppc' ? 'PPC' : 'PPC Ajustado',
                ]}
              />
              <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="5 5" label="Meta 75%" />
              <Bar dataKey="ppc" fill="#6366f1" name="PPC" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ppcAjustado" fill="#a78bfa" name="PPC Ajustado" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
