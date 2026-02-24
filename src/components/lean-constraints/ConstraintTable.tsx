import { useState, useCallback, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConstraintStatusBadge, ImpactBadge } from './ConstraintStatusBadge';
import { DeadlineIndicator } from './DeadlineIndicator';
import { CONSTRAINT_TYPES, type LpsConstraint } from '@/types/lean-constraints';
import {
  CheckCircle, Edit, Trash2, Search, ArrowUpDown, GripVertical, History,
  Loader2, Shield, ChevronLeft, ChevronRight,
} from 'lucide-react';

interface ConstraintTableProps {
  constraints: LpsConstraint[];
  loading?: boolean;
  onEdit: (constraint: LpsConstraint) => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onFiveWhys: (constraint: LpsConstraint) => void;
  onHistory?: (constraint: LpsConstraint) => void;
  onReorder?: (reorderedIds: string[]) => void;
}

type SortField = 'data_identificacao' | 'tipo_restricao' | 'status' | 'impacto' | 'prazo';

const PAGE_SIZE = 15;

export function ConstraintTable({ constraints, loading, onEdit, onResolve, onDelete, onFiveWhys, onHistory, onReorder }: ConstraintTableProps) {
  const [sortField, setSortField] = useState<SortField>('data_identificacao');
  const [sortAsc, setSortAsc] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  const getDeadlineSortValue = (c: LpsConstraint): string => {
    if (c.status === 'resolvida') return '9999-12-31';
    if (!c.data_prevista_resolucao) return '9999-12-30';
    return c.data_prevista_resolucao;
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return constraints;
    const term = searchTerm.toLowerCase();
    return constraints.filter(c =>
      c.descricao?.toLowerCase().includes(term) ||
      CONSTRAINT_TYPES[c.tipo_restricao]?.toLowerCase().includes(term) ||
      c.service_fronts?.name?.toLowerCase().includes(term) ||
      (c.employees?.name || c.responsavel_nome || '').toLowerCase().includes(term) ||
      c.notas?.toLowerCase().includes(term)
    );
  }, [constraints, searchTerm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
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
  }, [filtered, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm">Carregando restrições...</p>
      </div>
    );
  }

  if (constraints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <div className="h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center">
          <Shield className="h-8 w-8 text-indigo-400" />
        </div>
        <p className="font-medium text-foreground">Nenhuma restrição cadastrada</p>
        <p className="text-sm">Crie uma nova restrição para começar a gerenciar o LPS do projeto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, tipo, responsável..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
        {searchTerm && (
          <span className="text-sm text-muted-foreground">
            {filtered.length} de {constraints.length} restrições
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <Search className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm">Nenhuma restrição encontrada para &ldquo;{searchTerm}&rdquo;</p>
          <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>Limpar busca</Button>
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {onReorder && <TableHead className="w-8" />}
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('data_identificacao')}>
                    <div className="flex items-center gap-1">Data <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('tipo_restricao')}>
                    <div className="flex items-center gap-1">Tipo <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Frente</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('impacto')}>
                    <div className="flex items-center gap-1">Impacto <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('prazo')}>
                    <div className="flex items-center gap-1">Prazo <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((c) => (
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
                    <TableCell className="whitespace-nowrap text-sm">{c.data_identificacao}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{CONSTRAINT_TYPES[c.tipo_restricao]}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm" title={c.descricao}>{c.descricao}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{c.service_fronts?.name || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {c.employees?.name || c.responsavel_nome || '—'}
                    </TableCell>
                    <TableCell><ConstraintStatusBadge status={c.status} /></TableCell>
                    <TableCell><ImpactBadge impact={c.impacto} /></TableCell>
                    <TableCell><DeadlineIndicator constraint={c} /></TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        {c.status !== 'resolvida' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onResolve(c.id)} title="Resolver">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onFiveWhys(c)} title="5 Porquês">
                          <Search className="h-4 w-4 text-purple-600" />
                        </Button>
                        {onHistory && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onHistory(c)} title="Histórico">
                            <History className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(c.id)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} de {sorted.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((page, idx, arr) => (
                    <span key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="px-1 text-muted-foreground text-sm">...</span>
                      )}
                      <Button
                        variant={page === currentPage ? 'default' : 'outline'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    </span>
                  ))}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
