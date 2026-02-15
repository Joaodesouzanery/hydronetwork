import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface TeamData {
  employee_id: string;
  employee_name: string;
  role: string;
  total_production: number;
  days_worked: number;
  average_production: number;
}

interface TeamPerformanceWidgetProps {
  title: string;
  data: TeamData[];
  viewMode?: 'table' | 'chart';
  showAverage?: boolean;
}

export function TeamPerformanceWidget({
  title,
  data,
  viewMode = 'table',
  showAverage = true
}: TeamPerformanceWidgetProps) {
  // Sort by total production descending
  const sortedData = [...data].sort((a, b) => b.total_production - a.total_production);
  
  // Calculate team average
  const teamAverage = data.length > 0
    ? data.reduce((sum, d) => sum + d.average_production, 0) / data.length
    : 0;

  // Get max for progress calculation
  const maxProduction = Math.max(...data.map(d => d.total_production), 1);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPerformanceColor = (value: number, average: number) => {
    if (value >= average * 1.2) return 'text-green-500';
    if (value >= average * 0.8) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (viewMode === 'chart') {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-60px)]">
          {sortedData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Sem dados para o período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis 
                  type="category" 
                  dataKey="employee_name" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [
                    `${value.toFixed(1)} horas`,
                    'Total'
                  ]}
                />
                <Bar 
                  dataKey="total_production" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                />
                {showAverage && (
                  <Bar 
                    dataKey="average_production" 
                    fill="hsl(var(--muted-foreground))" 
                    radius={[0, 4, 4, 0]}
                    opacity={0.5}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {showAverage && (
            <Badge variant="secondary">
              Média: {teamAverage.toFixed(1)}h
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)] p-0">
        <ScrollArea className="h-full">
          <div className="p-4">
            {sortedData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground py-8">
                Sem dados para o período selecionado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Média</TableHead>
                    <TableHead className="w-[100px]">Desempenho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((employee, index) => (
                    <TableRow key={employee.employee_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(employee.employee_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{employee.employee_name}</p>
                            {index === 0 && (
                              <Badge variant="default" className="text-xs mt-1">
                                Top performer
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {employee.role || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {employee.days_worked}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {employee.total_production.toFixed(1)}h
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-medium",
                        getPerformanceColor(employee.average_production, teamAverage)
                      )}>
                        {employee.average_production.toFixed(1)}h
                      </TableCell>
                      <TableCell>
                        <Progress 
                          value={(employee.total_production / maxProduction) * 100}
                          className="h-2"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
