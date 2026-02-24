import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { ConstraintsByArea } from '@/types/lean-constraints';

interface CriticalAreasRankingProps {
  data: ConstraintsByArea[];
}

export function CriticalAreasRanking({ data }: CriticalAreasRankingProps) {
  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const ranked = data
    .filter(d => d.ativas + d.criticas > 0)
    .sort((a, b) => (b.criticas * 3 + b.ativas) - (a.criticas * 3 + a.ativas))
    .slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Áreas Mais Críticas</CardTitle>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma área com restrições ativas</p>
        ) : (
          <div className="space-y-4">
            {ranked.map((area, i) => (
              <div key={area.areaId} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {i + 1}. {area.areaName}
                  </span>
                  <div className="flex gap-1">
                    {area.criticas > 0 && (
                      <Badge variant="outline" className="bg-red-100 text-red-800 text-xs">
                        {area.criticas} crít.
                      </Badge>
                    )}
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">
                      {area.ativas} ativa{area.ativas !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
                <Progress
                  value={(area.total / maxTotal) * 100}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
