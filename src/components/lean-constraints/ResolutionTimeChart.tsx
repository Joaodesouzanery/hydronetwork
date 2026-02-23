import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface ResolutionTimeChartProps {
  data: { weekLabel: string; avgDays: number }[];
}

export function ResolutionTimeChart({ data }: ResolutionTimeChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tempo Médio de Resolução (dias)</CardTitle>
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
              <Tooltip formatter={(v: number) => [`${v} dias`, 'Tempo Médio']} />
              <Line
                type="monotone"
                dataKey="avgDays"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Dias"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
