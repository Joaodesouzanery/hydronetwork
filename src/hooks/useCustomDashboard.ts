import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  widget_type: string;
  title: string;
  config: Record<string, any>;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  data_source: string | null;
  filters: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DashboardConfig {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  global_filters: Record<string, any>;
  layout: any[];
  created_at: string;
  updated_at: string;
  widgets?: DashboardWidget[];
}

export interface GlobalFilters {
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate?: string;
  endDate?: string;
  projectIds?: string[];
  serviceFrontIds?: string[];
  employeeIds?: string[];
  constructionSiteIds?: string[];
}

export function useCustomDashboard() {
  const [dashboards, setDashboards] = useState<DashboardConfig[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<DashboardConfig | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({
    period: 'weekly'
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDashboards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('dashboard_configs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDashboards(data || []);

      // Set default dashboard
      const defaultDashboard = data?.find(d => d.is_default) || data?.[0];
      if (defaultDashboard && !currentDashboard) {
        setCurrentDashboard(defaultDashboard);
        setGlobalFilters(defaultDashboard.global_filters as GlobalFilters || { period: 'weekly' });
      }
    } catch (error: any) {
      console.error('Error fetching dashboards:', error);
    } finally {
      setLoading(false);
    }
  }, [currentDashboard]);

  const fetchWidgets = useCallback(async (dashboardId: string) => {
    try {
      const { data, error } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .order('position_y', { ascending: true })
        .order('position_x', { ascending: true });

      if (error) throw error;
      setWidgets(data || []);
    } catch (error: any) {
      console.error('Error fetching widgets:', error);
    }
  }, []);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  useEffect(() => {
    if (currentDashboard) {
      fetchWidgets(currentDashboard.id);
    }
  }, [currentDashboard, fetchWidgets]);

  const createDashboard = async (name: string, description?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('dashboard_configs')
        .insert({
          user_id: user.id,
          name,
          description,
          is_default: dashboards.length === 0,
          global_filters: { period: 'weekly' }
        })
        .select()
        .single();

      if (error) throw error;

      setDashboards(prev => [data, ...prev]);
      setCurrentDashboard(data);
      toast({
        title: 'Dashboard criado',
        description: `O dashboard "${name}" foi criado com sucesso.`
      });
      return data;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar dashboard',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateDashboard = async (id: string, updates: Partial<DashboardConfig>) => {
    try {
      const { error } = await supabase
        .from('dashboard_configs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setDashboards(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
      if (currentDashboard?.id === id) {
        setCurrentDashboard(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar dashboard',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  const deleteDashboard = async (id: string) => {
    try {
      const { error } = await supabase
        .from('dashboard_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setDashboards(prev => prev.filter(d => d.id !== id));
      if (currentDashboard?.id === id) {
        setCurrentDashboard(dashboards.find(d => d.id !== id) || null);
      }
      toast({
        title: 'Dashboard excluído',
        description: 'O dashboard foi excluído com sucesso.'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir dashboard',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  const addWidget = async (widget: Omit<DashboardWidget, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('dashboard_widgets')
        .insert(widget)
        .select()
        .single();

      if (error) throw error;

      setWidgets(prev => [...prev, data]);
      toast({
        title: 'Widget adicionado',
        description: `O widget "${widget.title}" foi adicionado ao dashboard.`
      });
      return data;
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar widget',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateWidget = async (id: string, updates: Partial<DashboardWidget>) => {
    try {
      const { error } = await supabase
        .from('dashboard_widgets')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar widget',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  const removeWidget = async (id: string) => {
    try {
      const { error } = await supabase
        .from('dashboard_widgets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWidgets(prev => prev.filter(w => w.id !== id));
      toast({
        title: 'Widget removido',
        description: 'O widget foi removido do dashboard.'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover widget',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateGlobalFilters = async (filters: GlobalFilters) => {
    setGlobalFilters(filters);
    if (currentDashboard) {
      await updateDashboard(currentDashboard.id, { global_filters: filters as any });
    }
  };

  const setAsDefault = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Remove default from all dashboards
      await supabase
        .from('dashboard_configs')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set new default
      await supabase
        .from('dashboard_configs')
        .update({ is_default: true })
        .eq('id', id);

      setDashboards(prev => prev.map(d => ({
        ...d,
        is_default: d.id === id
      })));

      toast({
        title: 'Dashboard padrão definido',
        description: 'Este dashboard será exibido ao abrir a página.'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao definir dashboard padrão',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return {
    dashboards,
    currentDashboard,
    setCurrentDashboard,
    widgets,
    globalFilters,
    loading,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    addWidget,
    updateWidget,
    removeWidget,
    updateGlobalFilters,
    setAsDefault,
    refreshDashboards: fetchDashboards,
    refreshWidgets: () => currentDashboard && fetchWidgets(currentDashboard.id)
  };
}
