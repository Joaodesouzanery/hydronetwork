import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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

/** Delay helper */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Tries a Supabase query with automatic retry on schema cache errors.
 * PostgREST schema cache can take up to 60s to refresh after table creation.
 * We retry up to 2 times with a 4-second delay between attempts.
 */
async function withSchemaRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  maxRetries = 2,
  retryDelay = 4000,
): Promise<{ data: T | null; error: any }> {
  let lastResult = await queryFn();

  if (!lastResult.error || !isSchemaError(lastResult.error)) {
    return lastResult;
  }

  // Schema cache error: retry with delay
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await delay(retryDelay);
    lastResult = await queryFn();
    if (!lastResult.error || !isSchemaError(lastResult.error)) {
      return lastResult;
    }
  }

  return lastResult;
}

export function useLeanConstraints(filters: ConstraintFilters) {
  const queryClient = useQueryClient();

  // Lightweight check to see if the LPS tables exist
  const tableCheckQuery = useQuery({
    queryKey: ['lps-table-check'],
    queryFn: async () => {
      const { error } = await supabase
        .from('lps_constraints')
        .select('id')
        .limit(0);
      if (error && isSchemaError(error)) {
        return { exists: false };
      }
      return { exists: true };
    },
    staleTime: 60_000, // cache for 1 minute
    retry: false,
  });

  const tablesExist = tableCheckQuery.data?.exists ?? true; // assume true until proven otherwise

  const constraintsQuery = useQuery({
    queryKey: ['lps-constraints', filters],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      if (!userId || !filters.projectId) return [];

      const buildQuery = () => {
        let query = supabase
          .from('lps_constraints')
          .select('*, service_fronts(id, name), employees(id, name), lps_five_whys(*)')
          .eq('project_id', filters.projectId)
          .order('data_identificacao', { ascending: false });

        if (filters.serviceFrontId) {
          query = query.eq('service_front_id', filters.serviceFrontId);
        }
        if (filters.status && filters.status !== 'todas') {
          query = query.eq('status', filters.status);
        }
        if (filters.tipo && filters.tipo !== 'todos') {
          query = query.eq('tipo_restricao', filters.tipo);
        }
        if (filters.impacto && filters.impacto !== 'todos') {
          query = query.eq('impacto', filters.impacto);
        }
        if (filters.responsavelId) {
          query = query.eq('responsavel_id', filters.responsavelId);
        }
        if (filters.dateFrom) {
          query = query.gte('data_identificacao', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('data_identificacao', filters.dateTo);
        }
        return query;
      };

      const { data, error } = await withSchemaRetry(() => buildQuery());

      if (error) {
        if (isSchemaError(error)) {
          // Tables don't exist yet — return empty array, flag handled via needsSetup
          return [] as LpsConstraint[];
        }
        throw error;
      }
      return (data ?? []) as LpsConstraint[];
    },
    enabled: !!filters.projectId && tablesExist,
    retry: (failureCount, error) => {
      if (isSchemaError(error)) return false;
      return failureCount < 2;
    },
  });

  const commitmentsQuery = useQuery({
    queryKey: ['lps-commitments', filters.projectId],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      if (!userId || !filters.projectId) return [];

      const { data, error } = await withSchemaRetry(() =>
        supabase
          .from('lps_weekly_commitments')
          .select('*, service_fronts(id, name), lps_constraints(id, descricao)')
          .eq('project_id', filters.projectId)
          .order('semana_inicio', { ascending: false })
      );

      if (error) {
        if (isSchemaError(error)) return [];
        throw error;
      }
      return (data ?? []) as LpsWeeklyCommitment[];
    },
    enabled: !!filters.projectId && tablesExist,
    retry: (failureCount, error) => {
      if (isSchemaError(error)) return false;
      return failureCount < 2;
    },
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

  const createConstraint = useMutation({
    mutationFn: async (data: Omit<LpsConstraint, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'employees' | 'projects' | 'lps_five_whys' | 'parent_constraint' | 'child_constraints'>) => {
      const { data: result, error } = await supabase
        .from('lps_constraints')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const updateConstraint = useMutation({
    mutationFn: async ({ id, ...data }: Partial<LpsConstraint> & { id: string }) => {
      const { service_fronts, employees, projects, lps_five_whys, parent_constraint, child_constraints, ...cleanData } = data as any;
      const { data: result, error } = await supabase
        .from('lps_constraints')
        .update(cleanData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const deleteConstraint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lps_constraints')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const resolveConstraint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lps_constraints')
        .update({
          status: 'resolvida',
          data_resolvida: new Date().toISOString().split('T')[0],
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const createCommitment = useMutation({
    mutationFn: async (data: Omit<LpsWeeklyCommitment, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'lps_constraints'>) => {
      const { data: result, error } = await supabase
        .from('lps_weekly_commitments')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const updateCommitment = useMutation({
    mutationFn: async ({ id, ...data }: Partial<LpsWeeklyCommitment> & { id: string }) => {
      const { service_fronts, lps_constraints, ...cleanData } = data as any;
      const { data: result, error } = await supabase
        .from('lps_weekly_commitments')
        .update(cleanData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const createFiveWhys = useMutation({
    mutationFn: async (data: Omit<LpsFiveWhys, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await supabase
        .from('lps_five_whys')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const updateFiveWhys = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status_acao: string }) => {
      const { data: result, error } = await supabase
        .from('lps_five_whys')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: invalidateAll,
  });

  const needsSetup = !tablesExist;

  return {
    constraints,
    commitments,
    loading: constraintsQuery.isLoading || commitmentsQuery.isLoading,
    needsSetup,
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
