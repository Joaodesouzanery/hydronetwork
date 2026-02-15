import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isWeekend, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProductionData {
  date: string;
  service_name: string;
  planned: number;
  actual: number;
  unit: string;
  employee_name?: string;
  service_front_name?: string;
}

interface ProductionTableWidgetProps {
  title: string;
  data: ProductionData[];
  groupBy?: 'service' | 'employee' | 'service_front' | 'date';
  showTotals?: boolean;
  dateRange?: { start: string; end: string };
}

export function ProductionTableWidget({
  title,
  data,
  groupBy = 'date',
  showTotals = true,
  dateRange
}: ProductionTableWidgetProps) {
  // Generate all dates in range
  const getDatesInRange = () => {
    if (!dateRange) return [];
    const start = parseISO(dateRange.start);
    const end = parseISO(dateRange.end);
    return eachDayOfInterval({ start, end });
  };

  const dates = getDatesInRange();

  // Get unique groups
  const getGroups = () => {
    switch (groupBy) {
      case 'employee':
        return [...new Set(data.map(d => d.employee_name || 'Sem equipe'))];
      case 'service_front':
        return [...new Set(data.map(d => d.service_front_name || 'Sem frente'))];
      case 'service':
        return [...new Set(data.map(d => d.service_name))];
      default:
        return [...new Set(data.map(d => d.date))];
    }
  };

  const groups = getGroups();

  // Get value for a specific cell
  const getCellValue = (group: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const matchingData = data.filter(d => {
      const matchesDate = d.date === dateStr;
      switch (groupBy) {
        case 'employee':
          return matchesDate && (d.employee_name || 'Sem equipe') === group;
        case 'service_front':
          return matchesDate && (d.service_front_name || 'Sem frente') === group;
        case 'service':
          return matchesDate && d.service_name === group;
        default:
          return matchesDate;
      }
    });

    const actual = matchingData.reduce((sum, d) => sum + d.actual, 0);
    const planned = matchingData.reduce((sum, d) => sum + d.planned, 0);
    
    return { actual, planned };
  };

  // Calculate row totals
  const getRowTotal = (group: string) => {
    const matchingData = data.filter(d => {
      switch (groupBy) {
        case 'employee':
          return (d.employee_name || 'Sem equipe') === group;
        case 'service_front':
          return (d.service_front_name || 'Sem frente') === group;
        case 'service':
          return d.service_name === group;
        default:
          return true;
      }
    });

    return {
      actual: matchingData.reduce((sum, d) => sum + d.actual, 0),
      planned: matchingData.reduce((sum, d) => sum + d.planned, 0)
    };
  };

  // Calculate column totals
  const getColumnTotal = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const matchingData = data.filter(d => d.date === dateStr);
    
    return {
      actual: matchingData.reduce((sum, d) => sum + d.actual, 0),
      planned: matchingData.reduce((sum, d) => sum + d.planned, 0)
    };
  };

  // Grand total
  const grandTotal = {
    actual: data.reduce((sum, d) => sum + d.actual, 0),
    planned: data.reduce((sum, d) => sum + d.planned, 0)
  };

  const getCompletionColor = (actual: number, planned: number) => {
    if (planned === 0) return '';
    const rate = (actual / planned) * 100;
    if (rate >= 100) return 'bg-green-500/10 text-green-600';
    if (rate >= 80) return 'bg-yellow-500/10 text-yellow-600';
    return 'bg-red-500/10 text-red-600';
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)] p-0">
        <ScrollArea className="h-full">
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">
                    {groupBy === 'employee' ? 'Equipe/Encarregado' :
                     groupBy === 'service_front' ? 'Frente de Serviço' :
                     groupBy === 'service' ? 'Serviço' : 'Item'}
                  </TableHead>
                  {dates.map(date => (
                    <TableHead 
                      key={date.toISOString()}
                      className={cn(
                        "text-center min-w-[80px]",
                        isWeekend(date) && "bg-muted/50"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          {format(date, 'EEE', { locale: ptBR })}
                        </span>
                        <span>{format(date, 'dd/MM')}</span>
                      </div>
                    </TableHead>
                  ))}
                  {showTotals && (
                    <TableHead className="text-center min-w-[100px] bg-muted/30 font-bold">
                      Total
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map(group => {
                  const rowTotal = getRowTotal(group);
                  return (
                    <TableRow key={group}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        {group}
                      </TableCell>
                      {dates.map(date => {
                        const { actual, planned } = getCellValue(group, date);
                        return (
                          <TableCell 
                            key={date.toISOString()}
                            className={cn(
                              "text-center",
                              isWeekend(date) && "bg-muted/50",
                              actual > 0 && getCompletionColor(actual, planned)
                            )}
                          >
                            {actual > 0 ? (
                              <div className="flex flex-col">
                                <span className="font-medium">{actual.toLocaleString('pt-BR')}</span>
                                {planned > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    /{planned.toLocaleString('pt-BR')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                      {showTotals && (
                        <TableCell className={cn(
                          "text-center bg-muted/30 font-bold",
                          getCompletionColor(rowTotal.actual, rowTotal.planned)
                        )}>
                          <div className="flex flex-col">
                            <span>{rowTotal.actual.toLocaleString('pt-BR')}</span>
                            {rowTotal.planned > 0 && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {((rowTotal.actual / rowTotal.planned) * 100).toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {/* Totals Row */}
                {showTotals && (
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell className="sticky left-0 bg-muted/30 z-10">
                      Total
                    </TableCell>
                    {dates.map(date => {
                      const { actual, planned } = getColumnTotal(date);
                      return (
                        <TableCell 
                          key={date.toISOString()}
                          className={cn(
                            "text-center",
                            isWeekend(date) && "bg-muted/50"
                          )}
                        >
                          <div className="flex flex-col">
                            <span>{actual.toLocaleString('pt-BR')}</span>
                            {planned > 0 && (
                              <span className="text-xs text-muted-foreground">
                                /{planned.toLocaleString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className={cn(
                      "text-center bg-primary/10",
                      getCompletionColor(grandTotal.actual, grandTotal.planned)
                    )}>
                      <div className="flex flex-col">
                        <span className="text-lg">{grandTotal.actual.toLocaleString('pt-BR')}</span>
                        {grandTotal.planned > 0 && (
                          <Badge className="mt-1">
                            {((grandTotal.actual / grandTotal.planned) * 100).toFixed(0)}% da meta
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
