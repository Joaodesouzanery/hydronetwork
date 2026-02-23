import { useState, useCallback } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ConstraintStatusBadge, ImpactBadge } from './ConstraintStatusBadge';
import { DeadlineIndicator } from './DeadlineIndicator';
import { CONSTRAINT_TYPES, type LpsConstraint } from '@/types/lean-constraints';
import { CheckCircle, Edit, Trash2, Search, ArrowUpDown, GripVertical, History } from 'lucide-react';

interface ConstraintTableProps {
  constraints: LpsConstraint[];
  onEdit: (constraint: LpsConstraint) => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onFiveWhys: (constraint: LpsConstraint) => void;
  onHistory?: (constraint: LpsConstraint) => void;
  onReorder?: (reorderedIds: string[]) => void;
}

type SortField = 'data_identificacao' | 'tipo_restricao' | 'status' | 'impacto' | 'prazo';

export function ConstraintTable({ constraints, onEdit, onResolve, onDelete, onFiveWhys, onHistory, onReorder }: ConstraintTableProps) {
  const [sortField, setSortField] = useState<SortField>('data_identificacao');
  const [sortAsc, setSortAsc] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getDeadlineSortValue = (c: LpsConstraint): string => {
    if (c.status === 'resolvida') return '9999-12-31';
    if (!c.data_prevista_resolucao) return '9999-12-30';
    return c.data_prevista_resolucao;
  };

  const sorted = [...constraints].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortField === 'prazo') {
      const va = getDeadlineSortValue(a);
      const vb = getDeadlineSortValue(b);
      return va < vb ? -dir : va > vb ? dir : 0;
    }
    const va = a[sortField] ?? '';
    const vb = b[sortField] ?? '';
    return va < vb ? -dir : va > vb ? dir : 0;
  });

  const handleDragStart = useCallback((id: string) => setDraggedId(id), []);
  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  }, []);
  const handleDrop = useCallback((targetId: string) => {
    if (!draggedId || draggedId === targetId || !onReorder) return;
    const ids = sorted.map(c => c.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    onReorder(ids);
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, sorted, onReorder]);
  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  if (constraints.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma restrição encontrada. Crie uma nova restrição para começar.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {onReorder && <TableHead className="w-8" />}
            <TableHead className="cursor-pointer" onClick={() => handleSort('data_identificacao')}>
              <div className="flex items-center gap-1">Data <ArrowUpDown className="h-3 w-3" /></div>
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort('tipo_restricao')}>
              <div className="flex items-center gap-1">Tipo <ArrowUpDown className="h-3 w-3" /></div>
            </TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Frente</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
              <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort('impacto')}>
              <div className="flex items-center gap-1">Impacto <ArrowUpDown className="h-3 w-3" /></div>
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort('prazo')}>
              <div className="flex items-center gap-1">Prazo <ArrowUpDown className="h-3 w-3" /></div>
            </TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((c) => (
            <TableRow
              key={c.id}
              draggable={!!onReorder}
              onDragStart={() => handleDragStart(c.id)}
              onDragOver={(e) => handleDragOver(e, c.id)}
              onDrop={() => handleDrop(c.id)}
              onDragEnd={handleDragEnd}
              className={`${draggedId === c.id ? 'opacity-50' : ''} ${dragOverId === c.id ? 'border-t-2 border-indigo-500' : ''}`}
            >
              {onReorder && (
                <TableCell className="cursor-grab px-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              )}
              <TableCell className="whitespace-nowrap">{c.data_identificacao}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{CONSTRAINT_TYPES[c.tipo_restricao]}</TableCell>
              <TableCell className="max-w-[250px] truncate" title={c.descricao}>{c.descricao}</TableCell>
              <TableCell className="whitespace-nowrap">{c.service_fronts?.name || '—'}</TableCell>
              <TableCell className="whitespace-nowrap">
                {c.employees?.name || c.responsavel_nome || '—'}
              </TableCell>
              <TableCell><ConstraintStatusBadge status={c.status} /></TableCell>
              <TableCell><ImpactBadge impact={c.impacto} /></TableCell>
              <TableCell><DeadlineIndicator constraint={c} /></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {c.status !== 'resolvida' && (
                    <Button variant="ghost" size="icon" onClick={() => onResolve(c.id)} title="Resolver">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => onEdit(c)} title="Editar">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onFiveWhys(c)} title="5 Porquês">
                    <Search className="h-4 w-4 text-purple-600" />
                  </Button>
                  {onHistory && (
                    <Button variant="ghost" size="icon" onClick={() => onHistory(c)} title="Histórico">
                      <History className="h-4 w-4 text-blue-600" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => onDelete(c.id)} title="Excluir">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
