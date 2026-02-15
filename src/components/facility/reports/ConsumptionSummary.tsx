import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets, Zap, Flame } from "lucide-react";

interface ConsumptionSummaryProps {
  consumption: any[];
}

export function ConsumptionSummary({ consumption }: ConsumptionSummaryProps) {
  const calculateConsumption = (meterType: string) => {
    const filtered = consumption.filter((r) => r.meter_type === meterType);
    if (filtered.length < 2) return 0;

    const sorted = filtered.sort((a, b) => {
      const dateCompare = a.reading_date.localeCompare(b.reading_date);
      if (dateCompare !== 0) return dateCompare;
      return a.reading_time.localeCompare(b.reading_time);
    });

    return sorted[sorted.length - 1].meter_value - sorted[0].meter_value;
  };

  const waterConsumption = calculateConsumption("water");
  const energyConsumption = calculateConsumption("energy");
  const gasConsumption = calculateConsumption("gas");

  const consumptionData = [
    {
      type: "Água",
      value: waterConsumption,
      unit: "m³",
      icon: Droplets,
      color: "text-blue-500",
    },
    {
      type: "Energia",
      value: energyConsumption,
      unit: "kWh",
      icon: Zap,
      color: "text-yellow-500",
    },
    {
      type: "Gás",
      value: gasConsumption,
      unit: "m³",
      icon: Flame,
      color: "text-orange-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumo de Recursos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {consumptionData.map((item) => (
            <div key={item.type} className="flex items-center gap-4 p-4 border rounded-lg">
              <item.icon className={`h-10 w-10 ${item.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{item.type}</p>
                <p className="text-2xl font-bold">
                  {item.value.toFixed(2)} {item.unit}
                </p>
              </div>
            </div>
          ))}
        </div>

        {consumption.length === 0 && (
          <p className="text-center text-muted-foreground mt-4">
            Nenhuma leitura de consumo registrada no período
          </p>
        )}
      </CardContent>
    </Card>
  );
}
