import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { ConstraintsByArea } from '@/types/lean-constraints';

interface ConstraintsByAreaChartProps {
  data: ConstraintsByArea[];
}

export function ConstraintsByAreaChart({ data }: ConstraintsByAreaChartProps) {
  const chartData = data.slice(0, 10).map((d) => ({
    name: d.areaName.length > 15 ? d.areaName.slice(0, 15) + '...' : d.areaName,
    ativas: d.ativas,
    criticas: d.criticas,
    resolvidas: d.resolvidas,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Restrições por Área</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip />
              <Legend />
              <Bar dataKey="criticas" stackId="a" fill="#ef4444" name="Críticas" />
              <Bar dataKey="ativas" stackId="a" fill="#f59e0b" name="Ativas" />
              <Bar dataKey="resolvidas" stackId="a" fill="#22c55e" name="Resolvidas" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
