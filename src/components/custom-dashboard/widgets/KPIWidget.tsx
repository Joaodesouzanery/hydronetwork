import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, Briefcase, Package, AlertTriangle, Target, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPIWidgetProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: 'production' | 'employees' | 'projects' | 'materials' | 'occurrences' | 'target' | 'completion';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  format?: 'number' | 'percent' | 'currency';
  targetValue?: number;
  className?: string;
}

const iconMap = {
  production: Target,
  employees: Users,
  projects: Briefcase,
  materials: Package,
  occurrences: AlertTriangle,
  target: Target,
  completion: CheckCircle
};

const iconColors = {
  production: 'text-blue-500 bg-blue-500/10',
  employees: 'text-green-500 bg-green-500/10',
  projects: 'text-purple-500 bg-purple-500/10',
  materials: 'text-orange-500 bg-orange-500/10',
  occurrences: 'text-red-500 bg-red-500/10',
  target: 'text-cyan-500 bg-cyan-500/10',
  completion: 'text-emerald-500 bg-emerald-500/10'
};

export function KPIWidget({
  title,
  value,
  subtitle,
  icon = 'production',
  trend,
  trendValue,
  format = 'number',
  targetValue,
  className
}: KPIWidgetProps) {
  const Icon = iconMap[icon];

  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'percent':
        return `${val.toFixed(1)}%`;
      case 'currency':
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      default:
        return val.toLocaleString('pt-BR');
    }
  };

  const getCompletionColor = () => {
    if (!targetValue || typeof value !== 'number') return '';
    const percentage = (value / targetValue) * 100;
    if (percentage >= 100) return 'text-green-500';
    if (percentage >= 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("p-2 rounded-lg", iconColors[icon])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className={cn("text-2xl font-bold", getCompletionColor())}>
              {formatValue(value)}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
            {targetValue && typeof value === 'number' && (
              <p className="text-xs text-muted-foreground mt-1">
                Meta: {formatValue(targetValue)} ({((value / targetValue) * 100).toFixed(0)}%)
              </p>
            )}
          </div>
          {trend && trendValue && (
            <div className={cn(
              "flex items-center gap-1 text-sm",
              trend === 'up' && "text-green-500",
              trend === 'down' && "text-red-500",
              trend === 'neutral' && "text-muted-foreground"
            )}>
              {trend === 'up' && <TrendingUp className="h-4 w-4" />}
              {trend === 'down' && <TrendingDown className="h-4 w-4" />}
              {trendValue}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
