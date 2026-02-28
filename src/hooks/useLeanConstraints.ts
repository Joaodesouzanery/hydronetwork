import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useLeanConstraints(filters: ConstraintFilters) {
  const queryClient = useQueryClient();

  const constraintsQuery = useQuery({
    queryKey: ['lps-constraints', filters],
    queryFn: () => {
      if (!filters.projectId) return [];
      return local.getConstraints(filters);
    },
    enabled: !!filters.projectId,
  });

  const commitmentsQuery = useQuery({
    queryKey: ['lps-commitments', filters.projectId],
    queryFn: () => {
      if (!filters.projectId) return [];
      return local.getCommitments(filters.projectId);
    },
    enabled: !!filters.projectId,
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
    queryClient.invalidateQueries({ queryKey: ['lps-constraints'] });
    queryClient.invalidateQueries({ queryKey: ['lps-commitments'] });
  };

  const createConstraint = useMutation({
    mutationFn: async (data: Omit<LpsConstraint, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'employees' | 'projects' | 'lps_five_whys' | 'parent_constraint' | 'child_constraints'>) => {
      return local.createConstraint(data);
    },
    onSuccess: invalidateAll,
  });

  const updateConstraint = useMutation({
    mutationFn: async ({ id, ...data }: Partial<LpsConstraint> & { id: string }) => {
      return local.updateConstraint(id, data);
    },
    onSuccess: invalidateAll,
  });

  const deleteConstraint = useMutation({
    mutationFn: async (id: string) => {
      local.deleteConstraint(id);
    },
    onSuccess: invalidateAll,
  });

  const resolveConstraint = useMutation({
    mutationFn: async (id: string) => {
      local.resolveConstraint(id);
    },
    onSuccess: invalidateAll,
  });

  const createCommitment = useMutation({
    mutationFn: async (data: Omit<LpsWeeklyCommitment, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'lps_constraints'>) => {
      return local.createCommitment(data);
    },
    onSuccess: invalidateAll,
  });

  const updateCommitment = useMutation({
    mutationFn: async ({ id, ...data }: Partial<LpsWeeklyCommitment> & { id: string }) => {
      return local.updateCommitment(id, data);
    },
    onSuccess: invalidateAll,
  });

  const createFiveWhys = useMutation({
    mutationFn: async (data: Omit<LpsFiveWhys, 'id' | 'created_at' | 'updated_at'>) => {
      return local.createFiveWhys(data);
    },
    onSuccess: invalidateAll,
  });

  const updateFiveWhys = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status_acao: string }) => {
      return local.updateFiveWhys(id, data);
    },
    onSuccess: invalidateAll,
  });

  return {
    constraints,
    commitments,
    loading: constraintsQuery.isLoading || commitmentsQuery.isLoading,
    needsSetup: false,
    usingLocalStorage: local.isUsingLocalStorage(),
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
