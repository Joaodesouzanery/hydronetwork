import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
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

const LeanDashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [serviceFronts, setServiceFronts] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<ConstraintFilters>({ status: 'todas', tipo: 'todos', impacto: 'todos' });

  const {
    constraints, loading, currentPPC, ppcData,
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

  if (loading && !filters.projectId) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-8 w-8 text-indigo-600" /> Dashboard LPS
                </h1>
                <p className="text-muted-foreground mt-1">
                  Visão analítica das restrições por área, tipo e evolução temporal
                </p>
              </div>
              <Select
                value={filters.projectId || ''}
                onValueChange={(v) => setFilters(prev => ({ ...prev, projectId: v }))}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* KPI Cards */}
            <LeanKPICards constraints={constraints} currentPPC={currentPPC} />

            {/* Filters */}
            <ConstraintFiltersBar
              filters={filters}
              onFiltersChange={setFilters}
              serviceFronts={serviceFronts}
            />

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
        </main>
      </div>
    </SidebarProvider>
  );
};

export default LeanDashboard;
