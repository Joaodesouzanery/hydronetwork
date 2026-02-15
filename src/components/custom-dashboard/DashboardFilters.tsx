import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, Filter, RefreshCw, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { GlobalFilters } from '@/hooks/useCustomDashboard';
import { cn } from '@/lib/utils';

interface DashboardFiltersProps {
  filters: GlobalFilters;
  onFiltersChange: (filters: GlobalFilters) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export function DashboardFilters({ filters, onFiltersChange, onRefresh, loading }: DashboardFiltersProps) {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [serviceFronts, setServiceFronts] = useState<Array<{ id: string; name: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [constructionSites, setConstructionSites] = useState<Array<{ id: string; name: string }>>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [projectsRes, serviceFrontsRes, employeesRes, sitesRes] = await Promise.all([
      supabase.from('projects').select('id, name').eq('created_by_user_id', user.id),
      supabase.from('service_fronts').select('id, name, projects!inner(created_by_user_id)')
        .eq('projects.created_by_user_id', user.id),
      supabase.from('employees').select('id, name').eq('created_by_user_id', user.id),
      supabase.from('construction_sites').select('id, name, projects!inner(created_by_user_id)')
        .eq('projects.created_by_user_id', user.id)
    ]);

    setProjects(projectsRes.data || []);
    setServiceFronts(serviceFrontsRes.data || []);
    setEmployees(employeesRes.data || []);
    setConstructionSites(sitesRes.data || []);
  };

  const handlePeriodChange = (period: GlobalFilters['period']) => {
    onFiltersChange({ ...filters, period });
  };

  const handleDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (date) {
      onFiltersChange({
        ...filters,
        period: 'custom',
        [type === 'start' ? 'startDate' : 'endDate']: format(date, 'yyyy-MM-dd')
      });
    }
  };

  const handleMultiSelectChange = (key: keyof GlobalFilters, value: string, checked: boolean) => {
    const currentValues = (filters[key] as string[]) || [];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    onFiltersChange({ ...filters, [key]: newValues });
  };

  const clearFilter = (key: keyof GlobalFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const activeFiltersCount = [
    filters.projectIds?.length ? 1 : 0,
    filters.serviceFrontIds?.length ? 1 : 0,
    filters.employeeIds?.length ? 1 : 0,
    filters.constructionSiteIds?.length ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Período:</span>
            <Select value={filters.period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          {filters.period === 'custom' && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {filters.startDate 
                      ? format(new Date(filters.startDate), 'dd/MM/yyyy', { locale: ptBR })
                      : 'Data inicial'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate ? new Date(filters.startDate) : undefined}
                    onSelect={(date) => handleDateChange('start', date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {filters.endDate 
                      ? format(new Date(filters.endDate), 'dd/MM/yyyy', { locale: ptBR })
                      : 'Data final'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate ? new Date(filters.endDate) : undefined}
                    onSelect={(date) => handleDateChange('end', date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Advanced Filters Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="gap-2 ml-auto"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Projects Filter */}
            <FilterMultiSelect
              label="Projetos"
              items={projects}
              selectedIds={filters.projectIds || []}
              onSelectionChange={(id, checked) => handleMultiSelectChange('projectIds', id, checked)}
              onClear={() => clearFilter('projectIds')}
            />

            {/* Service Fronts Filter */}
            <FilterMultiSelect
              label="Frentes de Serviço"
              items={serviceFronts}
              selectedIds={filters.serviceFrontIds || []}
              onSelectionChange={(id, checked) => handleMultiSelectChange('serviceFrontIds', id, checked)}
              onClear={() => clearFilter('serviceFrontIds')}
            />

            {/* Employees Filter */}
            <FilterMultiSelect
              label="Equipes/Encarregados"
              items={employees}
              selectedIds={filters.employeeIds || []}
              onSelectionChange={(id, checked) => handleMultiSelectChange('employeeIds', id, checked)}
              onClear={() => clearFilter('employeeIds')}
            />

            {/* Construction Sites Filter */}
            <FilterMultiSelect
              label="Canteiros de Obra"
              items={constructionSites}
              selectedIds={filters.constructionSiteIds || []}
              onSelectionChange={(id, checked) => handleMultiSelectChange('constructionSiteIds', id, checked)}
              onClear={() => clearFilter('constructionSiteIds')}
            />
          </div>
        )}

        {/* Active Filters Tags */}
        {activeFiltersCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {filters.projectIds?.map(id => {
              const project = projects.find(p => p.id === id);
              return project && (
                <Badge key={id} variant="secondary" className="gap-1">
                  {project.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleMultiSelectChange('projectIds', id, false)}
                  />
                </Badge>
              );
            })}
            {filters.employeeIds?.map(id => {
              const employee = employees.find(e => e.id === id);
              return employee && (
                <Badge key={id} variant="secondary" className="gap-1">
                  {employee.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleMultiSelectChange('employeeIds', id, false)}
                  />
                </Badge>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FilterMultiSelectProps {
  label: string;
  items: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onSelectionChange: (id: string, checked: boolean) => void;
  onClear: () => void;
}

function FilterMultiSelect({ label, items, selectedIds, onSelectionChange, onClear }: FilterMultiSelectProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {selectedIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-xs">
            Limpar
          </Button>
        )}
      </div>
      <ScrollArea className="h-32 rounded-md border p-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum item disponível</p>
        ) : (
          items.map(item => (
            <div key={item.id} className="flex items-center gap-2 py-1">
              <Checkbox
                id={`filter-${item.id}`}
                checked={selectedIds.includes(item.id)}
                onCheckedChange={(checked) => onSelectionChange(item.id, !!checked)}
              />
              <label htmlFor={`filter-${item.id}`} className="text-sm cursor-pointer truncate">
                {item.name}
              </label>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
