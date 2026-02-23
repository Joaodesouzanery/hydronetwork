import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RotateCcw, Calendar } from 'lucide-react';
import {
  CONSTRAINT_TYPES,
  STATUS_LABELS,
  IMPACT_LABELS,
  PERIOD_PRESETS,
  type ConstraintFilters,
  type ConstraintType,
  type ConstraintStatus,
  type ImpactLevel,
} from '@/types/lean-constraints';

interface ServiceFront {
  id: string;
  name: string;
}

interface ConstraintFiltersBarProps {
  filters: ConstraintFilters;
  onFiltersChange: (filters: ConstraintFilters) => void;
  serviceFronts: ServiceFront[];
}

export function ConstraintFiltersBar({ filters, onFiltersChange, serviceFronts }: ConstraintFiltersBarProps) {
  const update = (partial: Partial<ConstraintFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const reset = () => {
    onFiltersChange({
      projectId: filters.projectId,
      status: 'todas',
      tipo: 'todos',
      impacto: 'todos',
    });
  };

  const applyPeriodPreset = (days: number) => {
    if (days === 0) {
      update({ dateFrom: undefined, dateTo: undefined });
      return;
    }
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    update({
      dateFrom: from.toISOString().split('T')[0],
      dateTo: today.toISOString().split('T')[0],
    });
  };

  return (
    <div className="space-y-3">
      {/* Period presets */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <div className="flex gap-1">
          {PERIOD_PRESETS.map((preset) => (
            <Button
              key={preset.days}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyPeriodPreset(preset.days)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Main filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Frente</label>
          <Select
            value={filters.serviceFrontId || 'todas'}
            onValueChange={(v) => update({ serviceFrontId: v === 'todas' ? undefined : v })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas as frentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as frentes</SelectItem>
              {serviceFronts.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select
            value={filters.status || 'todas'}
            onValueChange={(v) => update({ status: v as ConstraintStatus | 'todas' })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos</SelectItem>
              {(Object.keys(STATUS_LABELS) as ConstraintStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select
            value={filters.tipo || 'todos'}
            onValueChange={(v) => update({ tipo: v as ConstraintType | 'todos' })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {(Object.keys(CONSTRAINT_TYPES) as ConstraintType[]).map((t) => (
                <SelectItem key={t} value={t}>{CONSTRAINT_TYPES[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Impacto</label>
          <Select
            value={filters.impacto || 'todos'}
            onValueChange={(v) => update({ impacto: v as ImpactLevel | 'todos' })}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {(Object.keys(IMPACT_LABELS) as ImpactLevel[]).map((i) => (
                <SelectItem key={i} value={i}>{IMPACT_LABELS[i]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">De</label>
          <Input
            type="date"
            className="w-[150px]"
            value={filters.dateFrom || ''}
            onChange={(e) => update({ dateFrom: e.target.value || undefined })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Até</label>
          <Input
            type="date"
            className="w-[150px]"
            value={filters.dateTo || ''}
            onChange={(e) => update({ dateTo: e.target.value || undefined })}
          />
        </div>

        <Button variant="ghost" size="icon" onClick={reset} title="Limpar filtros">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
