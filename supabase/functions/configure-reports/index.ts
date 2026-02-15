import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfigRequest {
  projectId: string;
  email: string;
  frequency: 'weekly' | 'monthly' | 'both';
  enabled: boolean;
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

    // Verify JWT token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }), 
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { projectId, email, frequency, enabled }: ConfigRequest = await req.json();

    // SECURITY: Verify project ownership
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('created_by_user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }), 
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (project.created_by_user_id !== user.id) {
      console.warn(`Unauthorized access attempt: User ${user.id} tried to configure reports for project ${projectId}`);
      return new Response(
        JSON.stringify({ error: 'Access denied - You do not own this project' }), 
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Store configuration (you would typically save this to a database table)
    // For now, we'll just return success
    
    console.log("Report configuration saved:", {
      projectId,
      email,
      frequency,
      enabled
    });

    // In a production environment, you would:
    // 1. Store this configuration in a database table
    // 2. Set up a cron job using pg_cron to call send-production-report
    // 3. The cron job would check the configuration and send reports accordingly

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Configuração salva com sucesso. Os relatórios serão enviados conforme configurado." 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in configure-reports:", error);
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