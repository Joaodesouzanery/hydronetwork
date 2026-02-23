import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as local from '@/lib/lpsLocalStorage';
import type {
  LpsConstraint,
  LpsWeeklyCommitment,
  LpsFiveWhys,
  ConstraintFilters,
} from '@/types/lean-constraints';
import {
  calculatePPCAdjusted,
  calculatePPCByWeek,
  aggregateConstraintsByArea,
  aggregateConstraintsByType,
  calculateResolutionTimes,
  calculateWeeklyEvolution,
} from '@/engine/lean-constraints';

function isSchemaError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '');
  return msg.includes('schema cache') || (msg.includes('relation') && msg.includes('does not exist'));
}

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export function useLeanConstraints(filters: ConstraintFilters) {
  const queryClient = useQueryClient();

  // Check once if LPS tables exist in Supabase
  const tableCheckQuery = useQuery({
    queryKey: ['lps-table-check'],
    queryFn: async () => {
      try {
        const { error } = await supabase
          .from('lps_constraints')
          .select('id')
          .limit(0);
        if (error && isSchemaError(error)) {
          return false;
        }
        return !error;
      } catch {
        return false;
      }
    },
    staleTime: 5 * 60_000, // cache result for 5 minutes
    retry: false,
  });

  const useSupabase = tableCheckQuery.data === true;
  const checkDone = tableCheckQuery.data !== undefined;

  // ── CONSTRAINTS QUERY ──
  const constraintsQuery = useQuery({
    queryKey: ['lps-constraints', filters, useSupabase],
    queryFn: async () => {
      if (!filters.projectId) return [];

      // localStorage mode
      if (!useSupabase) {
        return local.getConstraints(filters);
      }

      // Supabase mode
      const userId = await getCurrentUserId();
      if (!userId) return [];

      let query = supabase
        .from('lps_constraints')
        .select('*, service_fronts(id, name), employees(id, name), lps_five_whys(*)')
        .eq('project_id', filters.projectId)
        .order('data_identificacao', { ascending: false });

      if (filters.serviceFrontId) query = query.eq('service_front_id', filters.serviceFrontId);
      if (filters.status && filters.status !== 'todas') query = query.eq('status', filters.status);
      if (filters.tipo && filters.tipo !== 'todos') query = query.eq('tipo_restricao', filters.tipo);
      if (filters.impacto && filters.impacto !== 'todos') query = query.eq('impacto', filters.impacto);
      if (filters.responsavelId) query = query.eq('responsavel_id', filters.responsavelId);
      if (filters.dateFrom) query = query.gte('data_identificacao', filters.dateFrom);
      if (filters.dateTo) query = query.lte('data_identificacao', filters.dateTo);

      const { data, error } = await query;
      if (error) {
        if (isSchemaError(error)) return local.getConstraints(filters);
        throw error;
      }
      return (data ?? []) as LpsConstraint[];
    },
    enabled: !!filters.projectId && checkDone,
    retry: (count, err) => !isSchemaError(err) && count < 2,
  });

  // ── COMMITMENTS QUERY ──
  const commitmentsQuery = useQuery({
    queryKey: ['lps-commitments', filters.projectId, useSupabase],
    queryFn: async () => {
      if (!filters.projectId) return [];

      if (!useSupabase) {
        return local.getCommitments(filters.projectId);
      }

      const userId = await getCurrentUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('lps_weekly_commitments')
        .select('*, service_fronts(id, name), lps_constraints(id, descricao)')
        .eq('project_id', filters.projectId)
        .order('semana_inicio', { ascending: false });

      if (error) {
        if (isSchemaError(error)) return local.getCommitments(filters.projectId!);
        throw error;
      }
      return (data ?? []) as LpsWeeklyCommitment[];
    },
    enabled: !!filters.projectId && checkDone,
    retry: (count, err) => !isSchemaError(err) && count < 2,
  });

  const constraints = constraintsQuery.data ?? [];
  const commitments = commitmentsQuery.data ?? [];

  const ppcData = calculatePPCByWeek(commitments, constraints);
  const currentPPC = calculatePPCAdjusted(commitments, constraints);
  const constraintsByArea = aggregateConstraintsByArea(constraints);
  const constraintsByType = aggregateConstraintsByType(constraints);
  const resolutionTrend = calculateResolutionTimes(constraints);
  const weeklyEvolution = calculateWeeklyEvolution(constraints);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['lps-table-check'] });
    queryClient.invalidateQueries({ queryKey: ['lps-constraints'] });
    queryClient.invalidateQueries({ queryKey: ['lps-commitments'] });
  };

  // ── MUTATIONS ──

  const createConstraint = useMutation({
    mutationFn: async (data: Omit<LpsConstraint, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'employees' | 'projects' | 'lps_five_whys' | 'parent_constraint' | 'child_constraints'>) => {
      if (!useSupabase) return local.createConstraint(data);
      const { data: result, error } = await supabase.from('lps_constraints').insert([data]).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const updateConstraint = useMutation({
    mutationFn: async ({ id, ...data }: Partial<LpsConstraint> & { id: string }) => {
      if (!useSupabase) return local.updateConstraint(id, data);
      const { service_fronts, employees, projects, lps_five_whys, parent_constraint, child_constraints, ...cleanData } = data as any;
      const { data: result, error } = await supabase.from('lps_constraints').update(cleanData).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const deleteConstraint = useMutation({
    mutationFn: async (id: string) => {
      if (!useSupabase) { local.deleteConstraint(id); return; }
      const { error } = await supabase.from('lps_constraints').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const resolveConstraint = useMutation({
    mutationFn: async (id: string) => {
      if (!useSupabase) { local.resolveConstraint(id); return; }
      const { error } = await supabase.from('lps_constraints').update({
        status: 'resolvida',
        data_resolvida: new Date().toISOString().split('T')[0],
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const createCommitment = useMutation({
    mutationFn: async (data: Omit<LpsWeeklyCommitment, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'lps_constraints'>) => {
      if (!useSupabase) return local.createCommitment(data);
      const { data: result, error } = await supabase.from('lps_weekly_commitments').insert([data]).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const updateCommitment = useMutation({
    mutationFn: async ({ id, ...data }: Partial<LpsWeeklyCommitment> & { id: string }) => {
      if (!useSupabase) return local.updateCommitment(id, data);
      const { service_fronts, lps_constraints, ...cleanData } = data as any;
      const { data: result, error } = await supabase.from('lps_weekly_commitments').update(cleanData).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const createFiveWhys = useMutation({
    mutationFn: async (data: Omit<LpsFiveWhys, 'id' | 'created_at' | 'updated_at'>) => {
      if (!useSupabase) return local.createFiveWhys(data);
      const { data: result, error } = await supabase.from('lps_five_whys').insert([data]).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const updateFiveWhys = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status_acao: string }) => {
      if (!useSupabase) return local.updateFiveWhys(id, data);
      const { data: result, error } = await supabase.from('lps_five_whys').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  return {
    constraints,
    commitments,
    loading: constraintsQuery.isLoading || commitmentsQuery.isLoading,
    needsSetup: false, // never block the UI — localStorage always works
    usingLocalStorage: !useSupabase,
    ppcData,
    currentPPC,
    constraintsByArea,
    constraintsByType,
    resolutionTrend,
    weeklyEvolution,
    createConstraint,
    updateConstraint,
    deleteConstraint,
    resolveConstraint,
    createCommitment,
    updateCommitment,
    createFiveWhys,
    updateFiveWhys,
    refreshData: invalidateAll,
  };
}
