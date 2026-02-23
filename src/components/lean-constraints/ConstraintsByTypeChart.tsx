import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { CONSTRAINT_TYPES, type ConstraintType } from '@/types/lean-constraints';

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316',
];

interface ConstraintsByTypeChartProps {
  data: { tipo: ConstraintType; count: number }[];
}

export function ConstraintsByTypeChart({ data }: ConstraintsByTypeChartProps) {
  const chartData = data.map((d) => ({
    name: CONSTRAINT_TYPES[d.tipo],
    value: d.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Restrições por Tipo</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
