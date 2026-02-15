import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  projectId: string;
  email: string;
  reportType: 'weekly' | 'monthly' | 'test';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }), 
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create client with anon key for auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }), 
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { projectId, email, reportType }: ReportRequest = await req.json();

    // SECURITY: Verify project ownership before allowing report generation
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('created_by_user_id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }), 
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (project.created_by_user_id !== user.id) {
      console.warn(`Unauthorized access attempt: User ${user.id} tried to access project ${projectId}`);
      return new Response(
        JSON.stringify({ error: 'Access denied - You do not own this project' }), 
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // Calculate date range based on report type
    const endDate = new Date();
    const startDate = new Date();
    
    if (reportType === 'weekly' || reportType === 'test') {
      startDate.setDate(endDate.getDate() - 7);
    } else if (reportType === 'monthly') {
      startDate.setMonth(endDate.getMonth() - 1);
    }

    // Fetch production data
    const { data: executedData } = await supabase
      .from('executed_services')
      .select(`
        *,
        daily_reports!inner (
          report_date,
          project_id,
          construction_sites (name)
        ),
        services_catalog (name, unit)
      `)
      .eq('daily_reports.project_id', projectId)
      .gte('daily_reports.report_date', startDate.toISOString().split('T')[0])
      .lte('daily_reports.report_date', endDate.toISOString().split('T')[0]);

    // Fetch targets
    const { data: targetsData } = await supabase
      .from('production_targets')
      .select(`
        *,
        service_fronts!inner (project_id),
        services_catalog (name, unit)
      `)
      .eq('service_fronts.project_id', projectId)
      .gte('target_date', startDate.toISOString().split('T')[0])
      .lte('target_date', endDate.toISOString().split('T')[0]);

    // Aggregate data
    const dataMap = new Map<string, any>();

    executedData?.forEach((item: any) => {
      const key = item.services_catalog.name;
      const existing = dataMap.get(key) || { service: item.services_catalog.name, actual: 0, planned: 0, unit: item.services_catalog.unit };
      existing.actual += Number(item.quantity);
      dataMap.set(key, existing);
    });

    targetsData?.forEach((item: any) => {
      const key = item.services_catalog.name;
      const existing = dataMap.get(key) || { service: item.services_catalog.name, actual: 0, planned: 0, unit: item.services_catalog.unit };
      existing.planned += Number(item.target_quantity);
      dataMap.set(key, existing);
    });

    const aggregatedData = Array.from(dataMap.values());
    const totalPlanned = aggregatedData.reduce((sum, item) => sum + item.planned, 0);
    const totalActual = aggregatedData.reduce((sum, item) => sum + item.actual, 0);
    const completionRate = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

    // Generate HTML report
    const reportHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            .summary { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .rate { font-size: 24px; font-weight: bold; color: ${completionRate >= 100 ? '#4CAF50' : completionRate >= 80 ? '#FFA500' : '#FF0000'}; }
          </style>
        </head>
        <body>
          <h1>Relatório de Produção - ${reportType === 'weekly' ? 'Semanal' : reportType === 'monthly' ? 'Mensal' : 'Teste'}</h1>
          <p><strong>Projeto:</strong> ${project?.name || 'N/A'}</p>
          <p><strong>Período:</strong> ${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}</p>
          
          <div class="summary">
            <h2>Resumo Executivo</h2>
            <p><strong>Total Planejado:</strong> ${totalPlanned.toFixed(2)}</p>
            <p><strong>Total Realizado:</strong> ${totalActual.toFixed(2)}</p>
            <p><strong>Taxa de Conclusão:</strong> <span class="rate">${completionRate.toFixed(1)}%</span></p>
            <p><strong>Serviços Monitorados:</strong> ${aggregatedData.length}</p>
          </div>

          <h2>Detalhamento por Serviço</h2>
          <table>
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Planejado</th>
                <th>Realizado</th>
                <th>Unidade</th>
                <th>% Conclusão</th>
              </tr>
            </thead>
            <tbody>
              ${aggregatedData.map(item => {
                const rate = item.planned > 0 ? (item.actual / item.planned) * 100 : 0;
                return `
                  <tr>
                    <td>${item.service}</td>
                    <td>${item.planned.toFixed(2)}</td>
                    <td>${item.actual.toFixed(2)}</td>
                    <td>${item.unit}</td>
                    <td style="color: ${rate >= 100 ? '#4CAF50' : rate >= 80 ? '#FFA500' : '#FF0000'}">${rate.toFixed(1)}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Este relatório foi gerado automaticamente pelo sistema ConstruData.
          </p>
        </body>
      </html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "ConstruData <onboarding@resend.dev>",
      to: [email],
      subject: `Relatório de Produção ${reportType === 'weekly' ? 'Semanal' : reportType === 'monthly' ? 'Mensal' : 'Teste'} - ${project?.name || 'Projeto'}`,
      html: reportHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-production-report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);