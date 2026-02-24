import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface WeeklyEvolutionChartProps {
  data: { weekLabel: string; novas: number; resolvidas: number; ativas: number }[];
}

export function WeeklyEvolutionChart({ data }: WeeklyEvolutionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Evolução Semanal de Restrições</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="weekLabel" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="novas" stroke="#3b82f6" strokeWidth={2} name="Novas" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="resolvidas" stroke="#22c55e" strokeWidth={2} name="Resolvidas" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="ativas" stroke="#ef4444" strokeWidth={2} name="Ativas (acum.)" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
