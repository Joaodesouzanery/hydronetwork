import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertCheck {
  type: 'producao_baixa' | 'funcionarios_ausentes' | 'clima_adverso' | 'atraso_cronograma';
  obra_id?: string;
  threshold?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify JWT token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role key for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Buscar apenas alertas do usuário autenticado
    const { data: alertsConfig, error: alertsError } = await supabase
      .from('alertas_config')
      .select('*')
      .eq('ativo', true)
      .eq('user_id', user.id);

    if (alertsError) {
      console.error('Error fetching alerts config:', alertsError);
      throw alertsError;
    }

    const notifications: any[] = [];

    for (const alert of alertsConfig || []) {
      let shouldTrigger = false;
      let message = '';

      // Verificar produção abaixo da meta
      if (alert.tipo_alerta === 'producao_baixa') {
        const { data: targets } = await supabase
          .from('production_targets')
          .select(`
            *,
            service_fronts (
              name,
              project_id
            )
          `)
          .lte('target_date', new Date().toISOString().split('T')[0]);

        if (targets) {
          for (const target of targets) {
            const { data: executed } = await supabase
              .from('executed_services')
              .select('quantity, daily_reports!inner(report_date, service_front_id)')
              .eq('service_id', target.service_id)
              .eq('daily_reports.service_front_id', target.service_front_id)
              .eq('daily_reports.report_date', target.target_date);

            const totalExecuted = executed?.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;
            
            if (totalExecuted < Number(target.target_quantity) * 0.8) {
              shouldTrigger = true;
              message = `Produção abaixo da meta em ${target.service_fronts?.name}: ${totalExecuted.toFixed(2)} de ${target.target_quantity} (meta: 80%)`;
            }
          }
        }
      }

      // Verificar status de pedidos de material
      if (alert.tipo_alerta === 'funcionarios_ausentes') {
        const { data: materialRequests } = await supabase
          .from('material_requests')
          .select('*, projects(name), service_fronts(name)')
          .eq('status', 'entregue')
          .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (materialRequests && materialRequests.length > 0) {
          shouldTrigger = true;
          message = `${materialRequests.length} pedido(s) de material foram entregues nas últimas 24h`;
        }
      }

      if (shouldTrigger) {
        notifications.push({
          alert_id: alert.id,
          obra_id: alert.obra_id,
          message,
          recipients: alert.destinatarios,
          type: alert.tipo_alerta
        });

        // Registrar no histórico
        await supabase
          .from('alertas_historico')
          .insert({
            alerta_config_id: alert.id,
            obra_id: alert.obra_id,
            mensagem: message
          });
      }
    }

    return new Response(
      JSON.stringify({ notifications, count: notifications.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error processing alerts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
