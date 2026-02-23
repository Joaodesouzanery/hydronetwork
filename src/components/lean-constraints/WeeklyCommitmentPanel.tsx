import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Check, X, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  COMMITMENT_STATUS_LABELS,
  type LpsWeeklyCommitment,
  type CommitmentStatus,
} from '@/types/lean-constraints';
import { getWeekRange } from '@/engine/lean-constraints';

type CommitmentPayload = Omit<LpsWeeklyCommitment, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'lps_constraints'>;

interface WeeklyCommitmentPanelProps {
  commitments: LpsWeeklyCommitment[];
  onCreateCommitment: (data: CommitmentPayload) => void;
  onUpdateCommitment: (data: Partial<LpsWeeklyCommitment> & { id: string }) => void;
  projectId: string;
  userId: string;
}

const STATUS_COLORS: Record<CommitmentStatus, string> = {
  planejado: 'bg-gray-100 text-gray-800',
  cumprido: 'bg-green-100 text-green-800',
  nao_cumprido: 'bg-red-100 text-red-800',
  parcial: 'bg-yellow-100 text-yellow-800',
};

export function WeeklyCommitmentPanel({
  commitments, onCreateCommitment, onUpdateCommitment, projectId, userId,
}: WeeklyCommitmentPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [qtdPlanejada, setQtdPlanejada] = useState('');
  const [unidade, setUnidade] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);

  const getOffsetDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  };

  const currentWeek = getWeekRange(getOffsetDate());
  const isCurrentWeek = weekOffset === 0;

  const handleCreate = () => {
    if (!descricao.trim()) return;
    onCreateCommitment({
      created_by_user_id: userId,
      project_id: projectId,
      service_front_id: null,
      service_id: null,
      semana_inicio: currentWeek.start,
      semana_fim: currentWeek.end,
      descricao_tarefa: descricao.trim(),
      quantidade_planejada: qtdPlanejada ? parseFloat(qtdPlanejada) : null,
      quantidade_executada: null,
      unidade: unidade || null,
      status: 'planejado',
      motivo_nao_cumprimento: null,
      constraint_id: null,
    });
    setDescricao('');
    setQtdPlanejada('');
    setUnidade('');
    setShowForm(false);
  };

  const handleStatusChange = (id: string, status: CommitmentStatus) => {
    onUpdateCommitment({ id, status });
  };

  const weekCommitments = commitments.filter(
    c => c.semana_inicio === currentWeek.start
  );

  const formatDateBR = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-600" />
            Compromissos Semanais
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {formatDateBR(currentWeek.start)} a {formatDateBR(currentWeek.end)}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>
              Hoje
            </Button>
          )}
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="flex gap-2 mb-4 p-3 bg-muted rounded-md">
            <Input
              placeholder="Descrição da tarefa..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Qtd"
              value={qtdPlanejada}
              onChange={(e) => setQtdPlanejada(e.target.value)}
              className="w-24"
            />
            <Input
              placeholder="Un."
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="w-20"
            />
            <Button size="sm" onClick={handleCreate} disabled={!descricao.trim()}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {weekCommitments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm">Nenhum compromisso para esta semana.</p>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar compromisso
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Planejado</TableHead>
                <TableHead>Executado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weekCommitments.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm">{c.descricao_tarefa}</TableCell>
                  <TableCell className="text-sm">
                    {c.quantidade_planejada != null ? `${c.quantidade_planejada} ${c.unidade || ''}` : '—'}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-20 h-8"
                      defaultValue={c.quantidade_executada ?? ''}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          onUpdateCommitment({ id: c.id, quantidade_executada: val });
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[c.status]}>
                      {COMMITMENT_STATUS_LABELS[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={c.status}
                      onValueChange={(v) => handleStatusChange(c.id, v as CommitmentStatus)}
                    >
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(COMMITMENT_STATUS_LABELS) as CommitmentStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{COMMITMENT_STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
