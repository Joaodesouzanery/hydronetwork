import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const useAlertNotifications = () => {
  useEffect(() => {
    // Subscrever a mudanças na tabela de histórico de alertas
    const channel = supabase
      .channel('alerts-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alertas_historico'
        },
        (payload) => {
          const alert = payload.new;
          toast.warning(alert.mensagem, {
            description: `Alerta registrado em ${new Date(alert.enviado_em).toLocaleString('pt-BR')}`,
            duration: 8000,
          });
        }
      )
      .subscribe();

    // Subscrever a mudanças no status de pedidos de material
    const materialChannel = supabase
      .channel('material-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'material_requests'
        },
        (payload) => {
          const oldStatus = payload.old.status;
          const newStatus = payload.new.status;
          
          if (oldStatus !== newStatus) {
            const statusMessages: Record<string, string> = {
              'aprovado': '✅ Pedido de material aprovado',
              'em_separacao': '📦 Material em separação',
              'entregue': '✓ Material entregue',
              'cancelado': '❌ Pedido cancelado'
            };
            
            const message = statusMessages[newStatus] || 'Status do pedido atualizado';
            
            toast.info(message, {
              description: `Material: ${payload.new.material_name}`,
              duration: 6000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(materialChannel);
    };
  }, []);
};
