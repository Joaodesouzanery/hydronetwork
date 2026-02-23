import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Plus, Loader2 } from 'lucide-react';
import { useLeanConstraints } from '@/hooks/useLeanConstraints';
import type { ConstraintFilters, LpsConstraint } from '@/types/lean-constraints';
import { LeanKPICards } from '@/components/lean-constraints/LeanKPICards';
import { ConstraintFiltersBar } from '@/components/lean-constraints/ConstraintFiltersBar';
import { ConstraintTable } from '@/components/lean-constraints/ConstraintTable';
import { CreateConstraintDialog } from '@/components/lean-constraints/CreateConstraintDialog';
import { FiveWhysDialog } from '@/components/lean-constraints/FiveWhysDialog';
import { WeeklyCommitmentPanel } from '@/components/lean-constraints/WeeklyCommitmentPanel';
import { PPCCalculator } from '@/components/lean-constraints/PPCCalculator';
import { ConstraintMapLayer } from '@/components/lean-constraints/ConstraintMapLayer';

const LeanConstraints = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [serviceFronts, setServiceFronts] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<ConstraintFilters>({ status: 'todas', tipo: 'todos', impacto: 'todos' });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<LpsConstraint | null>(null);
  const [fiveWhysConstraint, setFiveWhysConstraint] = useState<LpsConstraint | null>(null);

  const {
    constraints, commitments, loading, currentPPC, ppcData,
    createConstraint, updateConstraint, deleteConstraint, resolveConstraint,
    createCommitment, updateCommitment, createFiveWhys,
  } = useLeanConstraints(filters);

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) { navigate('/auth'); return; }
      setUserId(session.session.user.id);

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
    const loadRelated = async () => {
      const [frontsRes, empsRes] = await Promise.all([
        supabase.from('service_fronts').select('id, name').eq('project_id', filters.projectId!).order('name'),
        supabase.from('employees').select('id, name').order('name'),
      ]);
      setServiceFronts(frontsRes.data ?? []);
      setEmployees(empsRes.data ?? []);
    };
    loadRelated();
  }, [filters.projectId]);

  const handleCreate = (data: Record<string, unknown>) => {
    createConstraint.mutate(data as any, {
      onSuccess: () => toast.success('Restrição criada com sucesso'),
      onError: (e: Error) => toast.error(`Erro: ${e.message}`),
    });
  };

  const handleUpdate = (data: Record<string, unknown>) => {
    if (!editingConstraint) return;
    updateConstraint.mutate({ id: editingConstraint.id, ...data } as any, {
      onSuccess: () => { toast.success('Restrição atualizada'); setEditingConstraint(null); },
      onError: (e: Error) => toast.error(`Erro: ${e.message}`),
    });
  };

  const handleResolve = (id: string) => {
    resolveConstraint.mutate(id, {
      onSuccess: () => toast.success('Restrição resolvida'),
      onError: (e: Error) => toast.error(`Erro: ${e.message}`),
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta restrição?')) return;
    deleteConstraint.mutate(id, {
      onSuccess: () => toast.success('Restrição excluída'),
      onError: (e: Error) => toast.error(`Erro: ${e.message}`),
    });
  };

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
                  <Shield className="h-8 w-8 text-indigo-600" /> Restrições Lean
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gestão de restrições com Last Planner System (LPS)
                </p>
              </div>
              <div className="flex gap-3 items-center">
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
                <Button onClick={() => { setEditingConstraint(null); setCreateOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Nova Restrição
                </Button>
              </div>
            </div>

            {/* KPI Cards */}
            <LeanKPICards constraints={constraints} currentPPC={currentPPC} />

            {/* Filters */}
            <ConstraintFiltersBar
              filters={filters}
              onFiltersChange={setFilters}
              serviceFronts={serviceFronts}
            />

            {/* Tabs */}
            <Tabs defaultValue="lista">
              <TabsList>
                <TabsTrigger value="lista">Lista</TabsTrigger>
                <TabsTrigger value="mapa">Mapa</TabsTrigger>
                <TabsTrigger value="compromissos">Compromissos Semanais</TabsTrigger>
              </TabsList>

              <TabsContent value="lista" className="mt-4">
                <ConstraintTable
                  constraints={constraints}
                  onEdit={(c) => { setEditingConstraint(c); setCreateOpen(true); }}
                  onResolve={handleResolve}
                  onDelete={handleDelete}
                  onFiveWhys={(c) => setFiveWhysConstraint(c)}
                />
              </TabsContent>

              <TabsContent value="mapa" className="mt-4">
                <ConstraintMapLayer constraints={constraints} />
              </TabsContent>

              <TabsContent value="compromissos" className="mt-4 space-y-4">
                <WeeklyCommitmentPanel
                  commitments={commitments}
                  onCreateCommitment={(data) => createCommitment.mutate(data as any, {
                    onSuccess: () => toast.success('Compromisso criado'),
                    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
                  })}
                  onUpdateCommitment={(data) => updateCommitment.mutate(data as any, {
                    onSuccess: () => toast.success('Compromisso atualizado'),
                    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
                  })}
                  projectId={filters.projectId || ''}
                  userId={userId}
                />
                <PPCCalculator ppcData={ppcData} currentPPC={currentPPC} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Create/Edit Dialog */}
          <CreateConstraintDialog
            open={createOpen}
            onOpenChange={(o) => { setCreateOpen(o); if (!o) setEditingConstraint(null); }}
            onSubmit={editingConstraint ? handleUpdate : handleCreate}
            editingConstraint={editingConstraint}
            serviceFronts={serviceFronts}
            employees={employees}
            projectId={filters.projectId || ''}
            userId={userId}
          />

          {/* Five Whys Dialog */}
          {fiveWhysConstraint && (
            <FiveWhysDialog
              open={!!fiveWhysConstraint}
              onOpenChange={(o) => { if (!o) setFiveWhysConstraint(null); }}
              constraint={fiveWhysConstraint}
              existingAnalysis={fiveWhysConstraint.lps_five_whys?.[0]}
              onSubmit={(data) => createFiveWhys.mutate(data, {
                onSuccess: () => { toast.success('Análise salva'); setFiveWhysConstraint(null); },
                onError: (e: Error) => toast.error(`Erro: ${e.message}`),
              })}
              userId={userId}
            />
          )}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default LeanConstraints;
