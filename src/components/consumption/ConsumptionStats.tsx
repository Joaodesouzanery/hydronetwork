import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets, Zap, Flame, TrendingUp } from "lucide-react";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConsumptionStatsProps {
  readings: any[];
}

export function ConsumptionStats({ readings }: ConsumptionStatsProps) {
  const calculateConsumption = (filterFn: (reading: any) => boolean) => {
    const filtered = readings.filter(filterFn);
    if (filtered.length < 2) return 0;

    const sorted = filtered.sort((a, b) => {
      const dateCompare = a.reading_date.localeCompare(b.reading_date);
      if (dateCompare !== 0) return dateCompare;
      return a.reading_time.localeCompare(b.reading_time);
    });

    return sorted[sorted.length - 1].meter_value - sorted[0].meter_value;
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { locale: ptBR }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const dailyConsumption = calculateConsumption((r) => r.reading_date === today);
  const weeklyConsumption = calculateConsumption((r) => r.reading_date >= weekStart);
  const monthlyConsumption = calculateConsumption((r) => r.reading_date >= monthStart);

  const stats = [
    {
      title: "Consumo Diário",
      value: dailyConsumption.toFixed(2),
      icon: Droplets,
      description: "Hoje",
    },
    {
      title: "Consumo Semanal",
      value: weeklyConsumption.toFixed(2),
      icon: TrendingUp,
      description: "Últimos 7 dias",
    },
    {
      title: "Consumo Mensal",
      value: monthlyConsumption.toFixed(2),
      icon: Zap,
      description: "Este mês",
    },
    {
      title: "Total de Leituras",
      value: readings.length.toString(),
      icon: Flame,
      description: "Últimos 30 dias",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
