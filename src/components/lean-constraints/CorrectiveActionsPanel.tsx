import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ClipboardCheck, AlertTriangle } from 'lucide-react';
import type { LpsConstraint, LpsFiveWhys } from '@/types/lean-constraints';

interface CorrectiveActionsPanelProps {
  constraints: LpsConstraint[];
  onUpdateFiveWhys: (data: { id: string; status_acao: string }) => void;
}

const STATUS_ACAO_LABELS: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-800' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800' },
};

export function CorrectiveActionsPanel({ constraints, onUpdateFiveWhys }: CorrectiveActionsPanelProps) {
  const actions: (LpsFiveWhys & { constraint_descricao: string; constraint_status: string })[] = [];

  for (const c of constraints) {
    if (c.lps_five_whys) {
      for (const fw of c.lps_five_whys) {
        actions.push({
          ...fw,
          constraint_descricao: c.descricao,
          constraint_status: c.status,
        });
      }
    }
  }

  const pendingActions = actions.filter(a => a.status_acao !== 'concluida' && a.status_acao !== 'cancelada');
  const completedActions = actions.filter(a => a.status_acao === 'concluida' || a.status_acao === 'cancelada');

  const isOverdue = (prazo: string | null) => {
    if (!prazo) return false;
    return new Date(prazo) < new Date();
  };

  const formatDateBR = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-indigo-600" />
          Ações Corretivas
          {pendingActions.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pendingActions.length} pendente{pendingActions.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm">Nenhuma ação corretiva registrada.</p>
            <p className="text-xs">Crie análises 5 Porquês para gerar ações corretivas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingActions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-amber-700">Ações Pendentes</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação Corretiva</TableHead>
                      <TableHead>Causa Raiz</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingActions.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{a.acao_corretiva}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[250px]">{a.constraint_descricao}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {a.causa_raiz}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.responsavel_acao || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className={isOverdue(a.prazo_acao) ? 'text-red-600 font-semibold' : ''}>
                            {formatDateBR(a.prazo_acao)}
                            {isOverdue(a.prazo_acao) && (
                              <AlertTriangle className="inline h-3 w-3 ml-1" />
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={a.status_acao}
                            onValueChange={(v) => onUpdateFiveWhys({ id: a.id, status_acao: v })}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_ACAO_LABELS).map(([key, val]) => (
                                <SelectItem key={key} value={key}>{val.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {completedActions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-green-700">Ações Concluídas / Canceladas ({completedActions.length})</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação Corretiva</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedActions.map((a) => (
                      <TableRow key={a.id} className="opacity-60">
                        <TableCell className="text-sm">{a.acao_corretiva}</TableCell>
                        <TableCell className="text-sm">{a.responsavel_acao || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_ACAO_LABELS[a.status_acao]?.color || ''}>
                            {STATUS_ACAO_LABELS[a.status_acao]?.label || a.status_acao}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
