import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfigRequest {
  email: string;
  frequency: "daily" | "weekly" | "monthly";
  enabled: boolean;
  tables: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, frequency, enabled, tables }: ConfigRequest = await req.json();

    // Validate input
    if (!email || !frequency) {
      return new Response(
        JSON.stringify({ error: "Email and frequency are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to manage configurations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store the configuration in a backup_schedules table
    // First check if user already has a configuration
    const { data: existing } = await supabase
      .from("backup_schedules")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from("backup_schedules")
        .update({
          email,
          frequency,
          enabled,
          tables,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from("backup_schedules")
        .insert({
          user_id: user.id,
          email,
          frequency,
          enabled,
          tables,
        });

      if (insertError) throw insertError;
    }

    console.log(`Backup schedule ${enabled ? "enabled" : "disabled"} for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: enabled
          ? `Backup automático configurado para ${email} (${frequency})`
          : "Backup automático desativado",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in configure-backup-schedule:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
