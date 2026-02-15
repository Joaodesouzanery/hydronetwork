import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ProductionData {
  service_name: string;
  planned: number;
  actual: number;
  unit: string;
  date: string;
}

interface ProductionChartProps {
  data: ProductionData[];
}

export const ProductionChart = ({ data }: ProductionChartProps) => {
  // Aggregate data by date
  const aggregatedData = data.reduce((acc, item) => {
    const existing = acc.find(d => d.date === item.date);
    if (existing) {
      existing.planned += item.planned;
      existing.actual += item.actual;
    } else {
      acc.push({
        date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        planned: item.planned,
        actual: item.actual
      });
    }
    return acc;
  }, [] as { date: string; planned: number; actual: number }[]);

  // Sort by date
  aggregatedData.sort((a, b) => {
    const dateA = a.date.split('/').reverse().join('');
    const dateB = b.date.split('/').reverse().join('');
    return dateA.localeCompare(dateB);
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={aggregatedData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="planned" 
          stroke="hsl(var(--primary))" 
          strokeWidth={2}
          name="Planejado"
          dot={{ fill: 'hsl(var(--primary))' }}
        />
        <Line 
          type="monotone" 
          dataKey="actual" 
          stroke="hsl(var(--secondary))" 
          strokeWidth={2}
          name="Realizado"
          dot={{ fill: 'hsl(var(--secondary))' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};