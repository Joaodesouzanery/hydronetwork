import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { GlobalFilters } from './useCustomDashboard';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface ProductionData {
  date: string;
  service_name: string;
  planned: number;
  actual: number;
  unit: string;
  employee_name?: string;
  service_front_name?: string;
}

interface KPIData {
  total_production: number;
  total_planned: number;
  completion_rate: number;
  active_employees: number;
  active_projects: number;
  material_requests_pending: number;
  occurrences_open: number;
}

interface TeamData {
  employee_id: string;
  employee_name: string;
  role: string;
  total_production: number;
  days_worked: number;
  average_production: number;
}

interface MaterialData {
  material_name: string;
  total_quantity: number;
  unit: string;
  service_front_name: string;
}

export function useDashboardData(filters: GlobalFilters, projectIds?: string[]) {
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [teamData, setTeamData] = useState<TeamData[]>([]);
  const [materialData, setMaterialData] = useState<MaterialData[]>([]);
  const [loading, setLoading] = useState(true);

  const getDateRange = useCallback(() => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date = today;

    switch (filters.period) {
      case 'daily':
        startDate = today;
        break;
      case 'weekly':
        startDate = startOfWeek(today, { weekStartsOn: 1 });
        endDate = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case 'monthly':
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case 'custom':
        startDate = filters.startDate ? new Date(filters.startDate) : subDays(today, 7);
        endDate = filters.endDate ? new Date(filters.endDate) : today;
        break;
      default:
        startDate = subDays(today, 7);
    }

    return {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd')
    };
  }, [filters]);

  const fetchProductionData = useCallback(async () => {
    try {
      const { start, end } = getDateRange();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch executed services with related data
      let query = supabase
        .from('executed_services')
        .select(`
          id,
          quantity,
          unit,
          created_at,
          service_id,
          employee_id,
          daily_report_id,
          services_catalog (id, name),
          employees (id, name),
          daily_reports (
            id,
            report_date,
            service_front_id,
            project_id,
            service_fronts (id, name),
            projects (id, name, created_by_user_id)
          )
        `)
        .gte('daily_reports.report_date', start)
        .lte('daily_reports.report_date', end);

      if (projectIds && projectIds.length > 0) {
        query = query.in('daily_reports.project_id', projectIds);
      }

      const { data: execServices, error } = await query;
      
      if (error) {
        console.error('Error fetching production data:', error);
        return;
      }

      // Fetch production targets
      const { data: targets } = await supabase
        .from('production_targets')
        .select(`
          id,
          target_quantity,
          target_date,
          service_id,
          employee_id,
          service_front_id,
          services_catalog (id, name)
        `)
        .gte('target_date', start)
        .lte('target_date', end);

      // Map the data
      const productionMap = new Map<string, ProductionData>();

      execServices?.forEach((service: any) => {
        if (!service.daily_reports?.projects?.created_by_user_id) return;
        if (service.daily_reports.projects.created_by_user_id !== user.id) return;

        const date = service.daily_reports?.report_date;
        const serviceName = service.services_catalog?.name || 'Serviço';
        const key = `${date}-${serviceName}`;

        const existing = productionMap.get(key) || {
          date,
          service_name: serviceName,
          planned: 0,
          actual: 0,
          unit: service.unit || 'un',
          employee_name: service.employees?.name,
          service_front_name: service.daily_reports?.service_fronts?.name
        };

        existing.actual += Number(service.quantity) || 0;
        productionMap.set(key, existing);
      });

      targets?.forEach((target: any) => {
        const serviceName = target.services_catalog?.name || 'Serviço';
        const key = `${target.target_date}-${serviceName}`;

        const existing = productionMap.get(key);
        if (existing) {
          existing.planned += Number(target.target_quantity) || 0;
        } else {
          productionMap.set(key, {
            date: target.target_date,
            service_name: serviceName,
            planned: Number(target.target_quantity) || 0,
            actual: 0,
            unit: 'un'
          });
        }
      });

      setProductionData(Array.from(productionMap.values()));
    } catch (error) {
      console.error('Error fetching production data:', error);
    }
  }, [getDateRange, projectIds]);

  const fetchKPIData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { start, end } = getDateRange();

      // Fetch projects count
      const { count: projectCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('created_by_user_id', user.id)
        .eq('status', 'active');

      // Fetch employees count
      const { count: employeeCount } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('created_by_user_id', user.id)
        .eq('status', 'active');

      // Fetch pending material requests
      const { count: pendingRequests } = await supabase
        .from('material_requests')
        .select('*, projects!inner(created_by_user_id)', { count: 'exact', head: true })
        .eq('projects.created_by_user_id', user.id)
        .eq('status', 'pendente');

      // Fetch open occurrences
      const { count: openOccurrences } = await supabase
        .from('occurrences')
        .select('*, projects!inner(created_by_user_id)', { count: 'exact', head: true })
        .eq('projects.created_by_user_id', user.id)
        .eq('status', 'aberta');

      // Calculate production totals
      let totalProduction = 0;
      let totalPlanned = 0;

      productionData.forEach(item => {
        totalProduction += item.actual;
        totalPlanned += item.planned;
      });

      setKpiData({
        total_production: totalProduction,
        total_planned: totalPlanned,
        completion_rate: totalPlanned > 0 ? (totalProduction / totalPlanned) * 100 : 0,
        active_employees: employeeCount || 0,
        active_projects: projectCount || 0,
        material_requests_pending: pendingRequests || 0,
        occurrences_open: openOccurrences || 0
      });
    } catch (error) {
      console.error('Error fetching KPI data:', error);
    }
  }, [getDateRange, productionData]);

  const fetchTeamData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { start, end } = getDateRange();

      const { data: laborData, error } = await supabase
        .from('labor_tracking')
        .select(`
          *,
          projects!inner(id, name, created_by_user_id),
          employees (id, name, role)
        `)
        .eq('projects.created_by_user_id', user.id)
        .gte('work_date', start)
        .lte('work_date', end);

      if (error) throw error;

      // Aggregate by employee
      const employeeMap = new Map<string, TeamData>();

      laborData?.forEach((record: any) => {
        const employeeId = record.employee_id || record.id;
        const existing = employeeMap.get(employeeId) || {
          employee_id: employeeId,
          employee_name: record.employees?.name || record.worker_name,
          role: record.employees?.role || record.category,
          total_production: 0,
          days_worked: 0,
          average_production: 0
        };

        existing.days_worked += 1;
        existing.total_production += Number(record.hours_worked) || 0;
        employeeMap.set(employeeId, existing);
      });

      // Calculate averages
      const teamDataArray = Array.from(employeeMap.values()).map(emp => ({
        ...emp,
        average_production: emp.days_worked > 0 ? emp.total_production / emp.days_worked : 0
      }));

      setTeamData(teamDataArray);
    } catch (error) {
      console.error('Error fetching team data:', error);
    }
  }, [getDateRange]);

  const fetchMaterialData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { start, end } = getDateRange();

      const { data: materials, error } = await supabase
        .from('material_control')
        .select(`
          *,
          projects!inner(id, name, created_by_user_id),
          service_fronts (id, name)
        `)
        .eq('projects.created_by_user_id', user.id)
        .gte('usage_date', start)
        .lte('usage_date', end);

      if (error) throw error;

      // Aggregate by material
      const materialMap = new Map<string, MaterialData>();

      materials?.forEach((record: any) => {
        const key = `${record.material_name}-${record.service_fronts?.id || 'geral'}`;
        const existing = materialMap.get(key) || {
          material_name: record.material_name,
          total_quantity: 0,
          unit: record.unit,
          service_front_name: record.service_fronts?.name || 'Geral'
        };

        existing.total_quantity += Number(record.quantity_used) || 0;
        materialMap.set(key, existing);
      });

      setMaterialData(Array.from(materialMap.values()));
    } catch (error) {
      console.error('Error fetching material data:', error);
    }
  }, [getDateRange]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProductionData(),
        fetchTeamData(),
        fetchMaterialData()
      ]);
      await fetchKPIData();
    } finally {
      setLoading(false);
    }
  }, [fetchProductionData, fetchTeamData, fetchMaterialData, fetchKPIData]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    productionData,
    kpiData,
    teamData,
    materialData,
    loading,
    refreshData,
    dateRange: getDateRange()
  };
}
