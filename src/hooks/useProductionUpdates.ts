import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const useProductionUpdates = () => {
  useEffect(() => {
    // Monitorar novos serviços executados
    const channel = supabase
      .channel('production-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'executed_services'
        },
        async (payload) => {
          const service = payload.new;
          
          // Buscar informações do serviço e meta
          const { data: serviceData } = await supabase
            .from('services_catalog')
            .select('name, unit')
            .eq('id', service.service_id)
            .single();

          if (serviceData) {
            toast.success('Nova produção registrada', {
              description: `${service.quantity} ${serviceData.unit} de ${serviceData.name}`,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    // Monitorar RDOs finalizados
    const rdoChannel = supabase
      .channel('rdo-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'daily_reports'
        },
        async (payload) => {
          const rdo = payload.new;
          
          // Buscar informações do projeto
          const { data: projectData } = await supabase
            .from('projects')
            .select('name')
            .eq('id', rdo.project_id)
            .single();

          if (projectData) {
            toast.info('RDO registrado', {
              description: `${projectData.name} - ${new Date(rdo.report_date + 'T12:00:00').toLocaleDateString('pt-BR')}`,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(rdoChannel);
    };
  }, []);
};
