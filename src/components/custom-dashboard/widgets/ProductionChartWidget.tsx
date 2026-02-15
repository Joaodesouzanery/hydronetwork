import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { format, parseISO, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProductionData {
  date: string;
  service_name: string;
  planned: number;
  actual: number;
  unit: string;
}

interface ProductionChartWidgetProps {
  title: string;
  data: ProductionData[];
  chartType?: 'bar' | 'line' | 'area';
  showControls?: boolean;
}

// Generate distinct colors for services
const SERVICE_COLORS = [
  'hsl(142, 76%, 36%)', // green
  'hsl(217, 91%, 60%)', // blue  
  'hsl(262, 83%, 58%)', // purple
  'hsl(25, 95%, 53%)',  // orange
  'hsl(340, 82%, 52%)', // pink
  'hsl(174, 84%, 32%)', // teal
  'hsl(43, 96%, 56%)',  // yellow
  'hsl(0, 72%, 51%)',   // red
  'hsl(199, 89%, 48%)', // cyan
  'hsl(292, 84%, 61%)', // magenta
];

export function ProductionChartWidget({
  title,
  data,
  chartType: initialChartType = 'bar',
  showControls = true
}: ProductionChartWidgetProps) {
  const [chartType, setChartType] = useState(initialChartType);
  const [showByService, setShowByService] = useState(true);

  // Get unique services and assign colors
  const serviceColorMap = useMemo(() => {
    const services = [...new Set(data.map(d => d.service_name))];
    const colorMap: Record<string, string> = {};
    services.forEach((service, idx) => {
      colorMap[service] = SERVICE_COLORS[idx % SERVICE_COLORS.length];
    });
    return colorMap;
  }, [data]);

  const services = useMemo(() => Object.keys(serviceColorMap), [serviceColorMap]);

  // Aggregate data by date with service breakdown
  const aggregatedData = useMemo(() => {
    const dateMap = new Map<string, any>();
    
    data.forEach(item => {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, {
          date: item.date,
          dateFormatted: format(parseISO(item.date), 'dd/MM', { locale: ptBR }),
          dayName: format(parseISO(item.date), 'EEE', { locale: ptBR }),
          isWeekend: isWeekend(parseISO(item.date)),
          planned: 0,
          actual: 0,
        });
      }
      
      const entry = dateMap.get(item.date);
      entry.planned += item.planned;
      entry.actual += item.actual;
      
      // Add service-specific actual values
      const serviceKey = `actual_${item.service_name}`;
      entry[serviceKey] = (entry[serviceKey] || 0) + item.actual;
    });
    
    const result = Array.from(dateMap.values());
    result.sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate completion rate
    result.forEach(item => {
      item.completionRate = item.planned > 0 ? (item.actual / item.planned) * 100 : 0;
    });
    
    return result;
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const dataPoint = payload[0]?.payload;
    if (!dataPoint) return null;
    
    const completionRate = dataPoint.planned > 0 ? ((dataPoint.actual / dataPoint.planned) * 100).toFixed(1) : 0;
    
    return (
      <div className="bg-popover border rounded-lg p-3 shadow-lg max-w-xs">
        <p className="font-medium mb-2">{dataPoint.dayName}, {dataPoint.dateFormatted}</p>
        <div className="space-y-1 text-sm">
          <p className="text-blue-500">Planejado Total: {dataPoint.planned.toLocaleString('pt-BR')}</p>
          <p className="text-green-500 font-medium">Realizado Total: {dataPoint.actual.toLocaleString('pt-BR')}</p>
          
          {showByService && services.length > 0 && (
            <div className="mt-2 pt-2 border-t space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Realizado por Serviço:</p>
              {services.map(service => {
                const value = dataPoint[`actual_${service}`] || 0;
                if (value === 0) return null;
                return (
                  <div key={service} className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: serviceColorMap[service] }}
                    />
                    <span className="text-xs truncate flex-1">{service}:</span>
                    <span className="text-xs font-medium">{value.toLocaleString('pt-BR')}</span>
                  </div>
                );
              })}
            </div>
          )}
          
          <p className={`font-medium mt-2 ${
            Number(completionRate) >= 100 ? 'text-green-500' : 
            Number(completionRate) >= 80 ? 'text-yellow-500' : 'text-red-500'
          }`}>
            Taxa: {completionRate}%
          </p>
        </div>
        {dataPoint.isWeekend && (
          <p className="text-xs text-muted-foreground mt-2 italic">Fim de semana</p>
        )}
      </div>
    );
  };

  const renderChart = () => {
    const chartProps = {
      data: aggregatedData,
      margin: { top: 10, right: 10, left: 0, bottom: 0 }
    };

    // Generate service bars/lines for "Realizado" breakdown
    const renderServiceBars = () => {
      if (!showByService) {
        return (
          <Bar 
            dataKey="actual" 
            fill="hsl(var(--success))" 
            name="Realizado" 
            radius={[4, 4, 0, 0]}
            stackId="actual"
          />
        );
      }
      
      return services.map((service, idx) => (
        <Bar 
          key={service}
          dataKey={`actual_${service}`}
          fill={serviceColorMap[service]}
          name={service}
          radius={idx === services.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          stackId="actual"
        />
      ));
    };

    const renderServiceLines = () => {
      if (!showByService) {
        return (
          <Line 
            type="monotone" 
            dataKey="actual" 
            stroke="hsl(var(--success))" 
            strokeWidth={2}
            name="Realizado"
            dot={{ fill: 'hsl(var(--success))' }}
          />
        );
      }
      
      return services.map(service => (
        <Line 
          key={service}
          type="monotone" 
          dataKey={`actual_${service}`}
          stroke={serviceColorMap[service]}
          strokeWidth={2}
          name={service}
          dot={{ fill: serviceColorMap[service] }}
        />
      ));
    };

    const renderServiceAreas = () => {
      if (!showByService) {
        return (
          <Area 
            type="monotone" 
            dataKey="actual" 
            stroke="hsl(var(--success))" 
            fill="hsl(var(--success) / 0.2)"
            name="Realizado"
            stackId="actual"
          />
        );
      }
      
      return services.map(service => (
        <Area 
          key={service}
          type="monotone" 
          dataKey={`actual_${service}`}
          stroke={serviceColorMap[service]}
          fill={`${serviceColorMap[service]}33`}
          name={service}
          stackId="actual"
        />
      ));
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="dateFormatted" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line 
              type="monotone" 
              dataKey="planned" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Planejado"
              dot={{ fill: 'hsl(var(--primary))' }}
            />
            {renderServiceLines()}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="dateFormatted" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Area 
              type="monotone" 
              dataKey="planned" 
              stroke="hsl(var(--primary))" 
              fill="hsl(var(--primary) / 0.2)"
              name="Planejado"
            />
            {renderServiceAreas()}
          </AreaChart>
        );

      default:
        return (
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="dateFormatted" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar 
              dataKey="planned" 
              fill="hsl(var(--primary))" 
              name="Planejado" 
              radius={[4, 4, 0, 0]}
            />
            {renderServiceBars()}
          </BarChart>
        );
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {showControls && (
          <div className="flex gap-2">
            <Select 
              value={showByService ? 'service' : 'total'} 
              onValueChange={(v) => setShowByService(v === 'service')}
            >
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Por Serviço</SelectItem>
                <SelectItem value="total">Total</SelectItem>
              </SelectContent>
            </Select>
            <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barras</SelectItem>
                <SelectItem value="line">Linha</SelectItem>
                <SelectItem value="area">Área</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        {aggregatedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Sem dados para o período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
