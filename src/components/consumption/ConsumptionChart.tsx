import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConsumptionChartProps {
  readings: any[];
}

export function ConsumptionChart({ readings }: ConsumptionChartProps) {
  // Calculate daily consumption (difference between readings)
  const dailyConsumption = readings.reduce((acc: any[], reading, index) => {
    if (index === readings.length - 1) return acc;

    const currentDate = reading.reading_date;
    const sameDay = readings.filter((r) => r.reading_date === currentDate);

    if (sameDay.length >= 2) {
      const sortedReadings = sameDay.sort((a, b) => 
        a.reading_time.localeCompare(b.reading_time)
      );
      
      const firstReading = sortedReadings[0].meter_value;
      const lastReading = sortedReadings[sortedReadings.length - 1].meter_value;
      const consumption = lastReading - firstReading;

      const existing = acc.find((item) => item.date === currentDate);
      if (!existing && consumption >= 0) {
        acc.push({
          date: currentDate,
          consumption: consumption,
          displayDate: format(parseISO(currentDate), "dd/MM", { locale: ptBR }),
        });
      }
    }

    return acc;
  }, []);

  const sortedData = dailyConsumption.sort((a, b) => a.date.localeCompare(b.date));

  const chartConfig = {
    consumption: {
      label: "Consumo",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumo Diário</CardTitle>
        <CardDescription>
          Consumo calculado com base nas leituras registradas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sortedData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sortedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="consumption"
                  name="Consumo"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            Registre leituras em diferentes horários para visualizar o consumo diário
          </div>
        )}
      </CardContent>
    </Card>
  );
}
