import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Check, X } from 'lucide-react';
import {
  COMMITMENT_STATUS_LABELS,
  type LpsWeeklyCommitment,
  type CommitmentStatus,
} from '@/types/lean-constraints';
import { getWeekRange } from '@/engine/lean-constraints';

interface WeeklyCommitmentPanelProps {
  commitments: LpsWeeklyCommitment[];
  onCreateCommitment: (data: Record<string, unknown>) => void;
  onUpdateCommitment: (data: { id: string } & Record<string, unknown>) => void;
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

  const currentWeek = getWeekRange(new Date());

  const handleCreate = () => {
    if (!descricao.trim()) return;
    onCreateCommitment({
      created_by_user_id: userId,
      project_id: projectId,
      semana_inicio: currentWeek.start,
      semana_fim: currentWeek.end,
      descricao_tarefa: descricao.trim(),
      quantidade_planejada: qtdPlanejada ? parseFloat(qtdPlanejada) : null,
      unidade: unidade || null,
      status: 'planejado',
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          Compromissos Semanais ({currentWeek.start} a {currentWeek.end})
        </CardTitle>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
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
          <p className="text-muted-foreground text-center py-6">
            Nenhum compromisso para esta semana.
          </p>
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
                  <TableCell>{c.descricao_tarefa}</TableCell>
                  <TableCell>
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
