import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Settings, Trash2, Maximize2 } from "lucide-react";
import { KPIWidget } from "./widgets/KPIWidget";
import { ProductionChartWidget } from "./widgets/ProductionChartWidget";
import { TeamPerformanceWidget } from "./widgets/TeamPerformanceWidget";
import { ProductionTableWidget } from "./widgets/ProductionTableWidget";
import { DashboardWidget } from "@/hooks/useCustomDashboard";

interface WidgetCardProps {
  widget: DashboardWidget;
  productionData: any[];
  kpiData: any;
  teamData: any[];
  dateRange: { start: string; end: string };
  onRemove: () => void;
  onConfigure: () => void;
}

export function WidgetCard({ 
  widget, 
  productionData, 
  kpiData, 
  teamData, 
  dateRange,
  onRemove,
  onConfigure 
}: WidgetCardProps) {
  const renderWidget = () => {
    const config = widget.config || {};
    
    switch (widget.widget_type) {
      case 'kpi':
        return (
          <KPIWidget
            title={widget.title}
            value={kpiData?.total_production || 0}
            subtitle="No período"
            icon="production"
          />
        );
      case 'bar_chart':
      case 'pie_chart':
      case 'production_trend':
        return (
          <ProductionChartWidget
            title={widget.title}
            data={productionData}
            chartType={config.chartType || 'bar'}
          />
        );
      case 'table':
      case 'service_comparison':
        return (
          <ProductionTableWidget
            title={widget.title}
            data={productionData}
            groupBy="service"
            dateRange={dateRange}
          />
        );
      case 'team_performance':
        return (
          <TeamPerformanceWidget
            title={widget.title}
            data={teamData}
            viewMode="chart"
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Widget não configurado
          </div>
        );
    }
  };

  const getWidgetSize = () => {
    const w = widget.width || 1;
    const h = widget.height || 1;
    
    return {
      gridColumn: `span ${Math.min(w, 2)}`,
      minHeight: h === 1 ? '150px' : h === 2 ? '300px' : '450px'
    };
  };

  return (
    <Card 
      className="relative group overflow-hidden"
      style={getWidgetSize()}
    >
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onConfigure}>
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRemove} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="h-full">
        {renderWidget()}
      </div>
    </Card>
  );
}