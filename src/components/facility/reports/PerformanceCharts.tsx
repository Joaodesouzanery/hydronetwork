import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface PerformanceChartsProps {
  tasks: any[];
}

export function PerformanceCharts({ tasks }: PerformanceChartsProps) {
  const statusData = [
    { name: "Concluídas", value: tasks.filter((t) => t.status === "concluída").length, color: "#22c55e" },
    { name: "Em Processo", value: tasks.filter((t) => t.status === "em_processo").length, color: "#3b82f6" },
    { name: "Pendentes", value: tasks.filter((t) => t.status === "pendente").length, color: "#eab308" },
    { name: "Em Verificação", value: tasks.filter((t) => t.status === "em_verificacao").length, color: "#a855f7" },
  ];

  const typeData = [
    { name: "Preventiva", value: tasks.filter((t) => t.task_type === "preventiva").length },
    { name: "Corretiva", value: tasks.filter((t) => t.task_type === "corretiva").length },
  ];

  const chartConfig = {
    value: {
      label: "Quantidade",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Status das Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tarefas por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
