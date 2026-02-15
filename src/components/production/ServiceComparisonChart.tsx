import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface ProductionData {
  service_name: string;
  planned: number;
  actual: number;
  unit: string;
  date: string;
}

interface ServiceComparisonChartProps {
  data: ProductionData[];
}

export const ServiceComparisonChart = ({ data }: ServiceComparisonChartProps) => {
  // Aggregate data by service
  const aggregatedData = data.reduce((acc, item) => {
    const existing = acc.find(d => d.service === item.service_name);
    if (existing) {
      existing.planned += item.planned;
      existing.actual += item.actual;
    } else {
      acc.push({
        service: item.service_name,
        planned: item.planned,
        actual: item.actual,
        unit: item.unit
      });
    }
    return acc;
  }, [] as { service: string; planned: number; actual: number; unit: string }[]);

  // Calculate completion rate for each service
  const chartData = aggregatedData.map(item => ({
    ...item,
    completionRate: item.planned > 0 ? (item.actual / item.planned) * 100 : 0
  }));

  const getBarColor = (rate: number) => {
    if (rate >= 100) return 'hsl(var(--chart-1))'; // Green
    if (rate >= 80) return 'hsl(var(--chart-2))'; // Yellow
    return 'hsl(var(--chart-3))'; // Red
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          type="number"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          dataKey="service" 
          type="category" 
          width={150}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
          formatter={(value: any, name: string) => {
            if (name === 'completionRate') {
              return [`${value.toFixed(1)}%`, 'Taxa de Conclusão'];
            }
            return [value.toFixed(2), name === 'planned' ? 'Planejado' : 'Realizado'];
          }}
        />
        <Legend />
        <Bar dataKey="planned" fill="hsl(var(--primary))" name="Planejado" />
        <Bar dataKey="actual" name="Realizado">
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.completionRate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};