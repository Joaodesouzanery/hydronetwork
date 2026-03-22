import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, AlertTriangle, CheckCircle, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { WeeklyReport } from '@/types/lean-constraints';
import { CONSTRAINT_TYPES, type ConstraintType } from '@/types/lean-constraints';

interface WeeklyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: WeeklyReport | null;
  projectName?: string;
}

export function WeeklyReportDialog({ open, onOpenChange, report, projectName = 'Projeto' }: WeeklyReportDialogProps) {
  if (!report) return null;

  const handleCopyText = () => {
    const text = [
      `📊 RELATÓRIO SEMANAL LEAN - ${projectName}`,
      `Período: ${report.weekStart} a ${report.weekEnd}`,
      '',
      '📈 INDICADORES:',
      `  Restrições Ativas: ${report.totalAtivas}`,
      `  Restrições Críticas: ${report.totalCriticas}`,
      `  Novas esta semana: ${report.novasSemana}`,
      `  Resolvidas esta semana: ${report.resolvidasSemana}`,
      `  Vencidas: ${report.vencidas}`,
      `  PPC: ${report.ppc}% | PPC Ajustado: ${report.ppcAdjusted}%`,
      '',
      '🔝 TOP TIPOS DE RESTRIÇÃO:',
      ...report.topConstraintTypes.map(t =>
        `  ${CONSTRAINT_TYPES[t.tipo as ConstraintType] || t.tipo}: ${t.count}`
      ),
      '',
      '📍 ÁREAS MAIS AFETADAS:',
      ...report.topAreas.map(a => `  ${a.areaName}: ${a.total} restrições`),
    ].join('\n');

    navigator.clipboard.writeText(text);
    toast.success('Relatório copiado para a área de transferência!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            Relatório Semanal Lean
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {projectName} — {report.weekStart} a {report.weekEnd}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-xs text-muted-foreground">Ativas</p>
                  <p className="text-xl font-bold">{report.totalAtivas}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Críticas</p>
                  <p className="text-xl font-bold text-destructive">{report.totalCriticas}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">Resolvidas (semana)</p>
                  <p className="text-xl font-bold text-success">{report.resolvidasSemana}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
                  <p className="text-xl font-bold text-destructive">{report.vencidas}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* PPC */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">PPC</span>
                <div className="flex gap-4">
                  <Badge variant="outline" className={report.ppc >= 75 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}>
                    PPC: {report.ppc}%
                  </Badge>
                  <Badge variant="outline" className={report.ppcAdjusted >= 75 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}>
                    Ajustado: {report.ppcAdjusted}%
                  </Badge>
                </div>
              </div>
              <div className="mt-2 h-2 bg-gray-200 overflow-hidden">
                <div
                  className={`h-full ${report.ppc >= 75 ? 'bg-success' : report.ppc >= 50 ? 'bg-warning' : 'bg-destructive'}`}
                  style={{ width: `${report.ppc}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Fluxo da semana */}
          <div className="flex items-center justify-center gap-6 p-3 bg-muted">
            <div className="text-center">
              <p className="text-2xl font-bold text-info">+{report.novasSemana}</p>
              <p className="text-xs text-muted-foreground">Novas</p>
            </div>
            <div className="text-3xl text-muted-foreground">→</div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">-{report.resolvidasSemana}</p>
              <p className="text-xs text-muted-foreground">Resolvidas</p>
            </div>
            <div className="text-3xl text-muted-foreground">=</div>
            <div className="text-center">
              <p className="text-2xl font-bold">{report.novasSemana - report.resolvidasSemana > 0 ? '+' : ''}{report.novasSemana - report.resolvidasSemana}</p>
              <p className="text-xs text-muted-foreground">Saldo</p>
            </div>
          </div>

          {/* Top tipos */}
          {report.topConstraintTypes.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Principais Tipos de Restrição</h4>
              <div className="space-y-1">
                {report.topConstraintTypes.map(t => (
                  <div key={t.tipo} className="flex items-center justify-between text-sm">
                    <span>{CONSTRAINT_TYPES[t.tipo as ConstraintType] || t.tipo}</span>
                    <Badge variant="secondary">{t.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top áreas */}
          {report.topAreas.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Áreas Mais Afetadas</h4>
              <div className="space-y-1">
                {report.topAreas.map(a => (
                  <div key={a.areaName} className="flex items-center justify-between text-sm">
                    <span>{a.areaName}</span>
                    <Badge variant="secondary">{a.total}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleCopyText}>
            <Download className="h-4 w-4 mr-1" /> Copiar Relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
