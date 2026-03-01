/**
 * LeanDashboardContent — Embeddable analytics dashboard for Lean constraints.
 * Can be used standalone (in LeanDashboard page) or embedded (in LPSModule tab).
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BarChart3 } from 'lucide-react';
import { useLeanConstraints } from '@/hooks/useLeanConstraints';
import type { ConstraintFilters } from '@/types/lean-constraints';
import { LeanKPICards } from '@/components/lean-constraints/LeanKPICards';
import { ConstraintFiltersBar } from '@/components/lean-constraints/ConstraintFiltersBar';
import { ConstraintsByTypeChart } from '@/components/lean-constraints/ConstraintsByTypeChart';
import { ConstraintsByAreaChart } from '@/components/lean-constraints/ConstraintsByAreaChart';
import { ResolutionTimeChart } from '@/components/lean-constraints/ResolutionTimeChart';
import { WeeklyEvolutionChart } from '@/components/lean-constraints/WeeklyEvolutionChart';
import { CriticalAreasRanking } from '@/components/lean-constraints/CriticalAreasRanking';
import { PPCCalculator } from '@/components/lean-constraints/PPCCalculator';
import { DeadlineNotifications } from '@/components/lean-constraints/DeadlineNotifications';
import { ExportLeanData } from '@/components/lean-constraints/ExportLeanData';
import { generateWeeklyReport } from '@/engine/lean-constraints';

export function LeanDashboardContent() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [serviceFronts, setServiceFronts] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<ConstraintFilters>({ status: 'todas', tipo: 'todos', impacto: 'todos' });

  const {
    constraints, commitments, loading, currentPPC, ppcData,
    constraintsByArea, constraintsByType, resolutionTrend, weeklyEvolution,
  } = useLeanConstraints(filters);

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) { navigate('/auth'); return; }

      const { data: projs } = await supabase
        .from('projects')
        .select('id, name')
        .in('status', ['active', 'paused'])
        .order('name');
      if (projs) {
        setProjects(projs);
        if (projs.length > 0 && !filters.projectId) {
          setFilters(prev => ({ ...prev, projectId: projs[0].id }));
        }
      }
    };
    init();
  }, [navigate]);

  useEffect(() => {
    if (!filters.projectId) return;
    const loadFronts = async () => {
      const { data } = await supabase
        .from('service_fronts')
        .select('id, name')
        .eq('project_id', filters.projectId!)
        .order('name');
      setServiceFronts(data ?? []);
    };
    loadFronts();
  }, [filters.projectId]);

  const currentProjectName = projects.find(p => p.id === filters.projectId)?.name || 'Projeto';
  const weeklyReport = generateWeeklyReport(constraints, commitments);

  if (loading && !filters.projectId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
        <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" /> Dashboard Analítico
          </h2>
          <p className="text-muted-foreground text-sm">
            Visão analítica das restrições por área, tipo e evolução temporal
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={filters.projectId || ''}
            onValueChange={(v) => setFilters(prev => ({ ...prev, projectId: v }))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione o projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExportLeanData constraints={constraints} weeklyReport={weeklyReport} projectName={currentProjectName} />
        </div>
      </div>

      <DeadlineNotifications constraints={constraints} />
      <LeanKPICards constraints={constraints} currentPPC={currentPPC} />
      <ConstraintFiltersBar filters={filters} onFiltersChange={setFilters} serviceFronts={serviceFronts} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConstraintsByTypeChart data={constraintsByType} />
        <ConstraintsByAreaChart data={constraintsByArea} />
        <ResolutionTimeChart data={resolutionTrend} />
        <WeeklyEvolutionChart data={weeklyEvolution} />
        <CriticalAreasRanking data={constraintsByArea} />
        <PPCCalculator ppcData={ppcData} currentPPC={currentPPC} />
      </div>
    </div>
  );
}
