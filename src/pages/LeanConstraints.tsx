import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Shield, Plus, Loader2, FileBarChart, BarChart3 } from 'lucide-react';
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
import { DeadlineNotifications } from '@/components/lean-constraints/DeadlineNotifications';
import { ExportLeanData } from '@/components/lean-constraints/ExportLeanData';
import { ConstraintHistory, addHistoryEntry } from '@/components/lean-constraints/ConstraintHistory';
import { WeeklyReportDialog } from '@/components/lean-constraints/WeeklyReportDialog';
import { generateWeeklyReport } from '@/engine/lean-constraints';

type ConstraintPayload = Omit<LpsConstraint, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'employees' | 'projects' | 'lps_five_whys'>;

const LeanConstraints = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('Usuário');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [serviceFronts, setServiceFronts] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<ConstraintFilters>({ status: 'todas', tipo: 'todos', impacto: 'todos' });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<LpsConstraint | null>(null);
  const [fiveWhysConstraint, setFiveWhysConstraint] = useState<LpsConstraint | null>(null);
  const [historyConstraint, setHistoryConstraint] = useState<LpsConstraint | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);

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
      setUserName(session.session.user.email?.split('@')[0] || 'Usuário');

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

  const currentProjectName = projects.find(p => p.id === filters.projectId)?.name || 'Projeto';

  const handleCreate = (data: ConstraintPayload) => {
    createConstraint.mutate(data, {
      onSuccess: (result) => {
        toast.success('Restrição criada com sucesso');
        addHistoryEntry({
          constraintId: result?.id || '',
          action: 'created',
          userName,
        });
      },
      onError: (e: Error) => toast.error(`Erro: ${e.message}`),
    });
  };

  const handleUpdate = (data: ConstraintPayload) => {
    if (!editingConstraint) return;
    updateConstraint.mutate({ id: editingConstraint.id, ...data }, {
      onSuccess: () => {
        toast.success('Restrição atualizada');
        addHistoryEntry({
          constraintId: editingConstraint.id,
          action: 'updated',
          userName,
        });
        setEditingConstraint(null);
      },
      onError: (e: Error) => toast.error(`Erro: ${e.message}`),
    });
  };

  const confirmResolve = () => {
    if (!resolveTarget) return;
    resolveConstraint.mutate(resolveTarget, {
      onSuccess: () => {
        toast.success('Restrição resolvida');
        addHistoryEntry({
          constraintId: resolveTarget,
          action: 'resolved',
          userName,
        });
        setResolveTarget(null);
      },
      onError: (e: Error) => { toast.error(`Erro: ${e.message}`); setResolveTarget(null); },
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteConstraint.mutate(deleteTarget, {
      onSuccess: () => {
        toast.success('Restrição excluída');
        addHistoryEntry({
          constraintId: deleteTarget,
          action: 'deleted',
          userName,
        });
        setDeleteTarget(null);
      },
      onError: (e: Error) => { toast.error(`Erro: ${e.message}`); setDeleteTarget(null); },
    });
  };

  const weeklyReport = generateWeeklyReport(constraints, commitments);

  if (loading && !filters.projectId) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
            <p className="text-sm text-muted-foreground">Carregando restrições...</p>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Breadcrumb */}
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/">Início</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Lean / LPS</BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Restrições</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                    <Shield className="h-7 w-7 text-indigo-600" /> Restrições Lean
                  </h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Gestão de restrições com Last Planner System (LPS)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Select
                    value={filters.projectId || ''}
                    onValueChange={(v) => setFilters(prev => ({ ...prev, projectId: v }))}
                  >
                    <SelectTrigger className="w-[200px] md:w-[250px]">
                      <SelectValue placeholder="Selecione o projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ExportLeanData
                    constraints={constraints}
                    weeklyReport={weeklyReport}
                    projectName={currentProjectName}
                  />
                  <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
                    <FileBarChart className="h-4 w-4 mr-1" /> Relatório
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/lean-dashboard">
                      <BarChart3 className="h-4 w-4 mr-1" /> Dashboard
                    </Link>
                  </Button>
                  <Button onClick={() => { setEditingConstraint(null); setCreateOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Nova Restrição
                  </Button>
                </div>
              </div>

              {/* Deadline Notifications */}
              <DeadlineNotifications
                constraints={constraints}
                onGoToConstraint={(c) => {
                  setEditingConstraint(c);
                  setCreateOpen(true);
                }}
              />

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
                  <TabsTrigger value="lista">Lista ({constraints.length})</TabsTrigger>
                  <TabsTrigger value="mapa">Mapa</TabsTrigger>
                  <TabsTrigger value="compromissos">Compromissos Semanais</TabsTrigger>
                </TabsList>

                <TabsContent value="lista" className="mt-4">
                  <ConstraintTable
                    constraints={constraints}
                    loading={loading}
                    onEdit={(c) => { setEditingConstraint(c); setCreateOpen(true); }}
                    onResolve={(id) => setResolveTarget(id)}
                    onDelete={(id) => setDeleteTarget(id)}
                    onFiveWhys={(c) => setFiveWhysConstraint(c)}
                    onHistory={(c) => setHistoryConstraint(c)}
                    onReorder={(ids) => {
                      localStorage.setItem(`lean-priority-${filters.projectId}`, JSON.stringify(ids));
                      toast.success('Ordem de prioridade atualizada');
                    }}
                  />
                </TabsContent>

                <TabsContent value="mapa" className="mt-4">
                  <ConstraintMapLayer constraints={constraints} />
                </TabsContent>

                <TabsContent value="compromissos" className="mt-4 space-y-4">
                  <WeeklyCommitmentPanel
                    commitments={commitments}
                    onCreateCommitment={(data) => createCommitment.mutate(data, {
                      onSuccess: () => toast.success('Compromisso criado'),
                      onError: (e: Error) => toast.error(`Erro: ${e.message}`),
                    })}
                    onUpdateCommitment={(data) => updateCommitment.mutate(data, {
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

            {/* History Dialog */}
            {historyConstraint && (
              <ConstraintHistory
                open={!!historyConstraint}
                onOpenChange={(o) => { if (!o) setHistoryConstraint(null); }}
                constraintId={historyConstraint.id}
                constraintDescription={historyConstraint.descricao}
              />
            )}

            {/* Weekly Report Dialog */}
            <WeeklyReportDialog
              open={reportOpen}
              onOpenChange={setReportOpen}
              report={weeklyReport}
              projectName={currentProjectName}
            />

            {/* Resolve Confirmation */}
            <AlertDialog open={!!resolveTarget} onOpenChange={(o) => { if (!o) setResolveTarget(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Resolver Restrição</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja marcar esta restrição como resolvida? A data de resolução será registrada como hoje.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmResolve} className="bg-green-600 hover:bg-green-700">
                    Confirmar Resolução
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Restrição</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A restrição e todos os dados associados serão permanentemente removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                    Excluir Permanentemente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
};

export default LeanConstraints;
