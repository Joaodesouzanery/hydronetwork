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
          const tipoAlerta = alert.tipo_alerta || '';

          if (tipoAlerta === 'rdo_ausente') {
            toast.error(alert.mensagem, {
              description: 'RDO ausente - escalado ao superior',
              duration: 15000,
            });
          } else if (tipoAlerta === 'rdo_pendente') {
            toast.warning(alert.mensagem, {
              description: 'Preencha o RDO antes do prazo',
              duration: 10000,
            });
          } else {
            toast.warning(alert.mensagem, {
              description: `Alerta registrado em ${new Date(alert.enviado_em || alert.created_at).toLocaleString('pt-BR')}`,
              duration: 8000,
            });
          }
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
