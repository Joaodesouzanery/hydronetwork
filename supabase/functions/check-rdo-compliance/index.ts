import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts'

interface ScheduleConfig {
  id: string;
  user_id: string;
  project_id: string | null;
  obra_id: string | null;
  frequencia: string;
  dias_semana: number[];
  intervalo_dias: number;
  alerta_hora_limite: string;
  alerta_apos_horas: number;
  escalacao_apos_dias: number;
  encarregado_user_id: string | null;
  encarregado_nome: string | null;
  supervisor_user_id: string | null;
  supervisor_nome: string | null;
}

function isExpectedDate(
  date: Date,
  config: ScheduleConfig,
  startDate: Date
): boolean {
  const dow = date.getDay();
  const daysSinceStart = Math.floor(
    (date.getTime() - startDate.getTime()) / 86400000
  );

  switch (config.frequencia) {
    case "diario":
      return true;
    case "dias_uteis":
      return dow >= 1 && dow <= 5;
    case "dia_sim_dia_nao":
      return daysSinceStart % 2 === 0;
    case "semanal":
      return (config.dias_semana || [1, 2, 3, 4, 5]).includes(dow);
    case "personalizado":
      return daysSinceStart % (config.intervalo_dias || 1) === 0;
    default:
      return true;
  }
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // This function can be called by a cron job (no auth needed)
    // or by an authenticated user to check their own compliance
    const authHeader = req.headers.get("Authorization");
    let requestingUserId: string | null = null;

    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      requestingUserId = user?.id || null;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active schedules (or just for the requesting user)
    let query = supabase
      .from("rdo_schedule_config")
      .select("*")
      .eq("ativo", true);

    if (requestingUserId) {
      query = query.or(
        `user_id.eq.${requestingUserId},encarregado_user_id.eq.${requestingUserId},supervisor_user_id.eq.${requestingUserId}`
      );
    }

    const { data: schedules, error: schedError } = await query;
    if (schedError) throw schedError;
    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma agenda de RDO configurada", checked: 0 }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lookbackDays = 7;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - lookbackDays);

    let totalChecked = 0;
    let alertsCreated = 0;
    let escalationsCreated = 0;

    for (const config of schedules as ScheduleConfig[]) {
      // Generate expected dates
      const expectedDates: string[] = [];
      const current = new Date(startDate);
      while (current <= today) {
        if (isExpectedDate(current, config, startDate)) {
          expectedDates.push(formatDate(current));
        }
        current.setDate(current.getDate() + 1);
      }

      // Fetch existing RDOs for this project/obra
      const rdoDates = new Set<string>();

      if (config.project_id) {
        // Check daily_reports
        const { data: reports } = await supabase
          .from("daily_reports")
          .select("report_date")
          .eq("project_id", config.project_id)
          .gte("report_date", formatDate(startDate))
          .lte("report_date", formatDate(today));

        if (reports) {
          for (const r of reports) {
            rdoDates.add(r.report_date);
          }
        }

        // Check hydro_rdos
        const { data: hydroRdos } = await supabase
          .from("hydro_rdos")
          .select("date")
          .eq("project_id", config.project_id)
          .gte("date", formatDate(startDate))
          .lte("date", formatDate(today));

        if (hydroRdos) {
          for (const r of hydroRdos) {
            rdoDates.add(r.date);
          }
        }
      }

      // Process each expected date
      let consecutiveMissing = 0;

      for (const expDate of expectedDates) {
        const hasRdo = rdoDates.has(expDate);
        const isPast = expDate < formatDate(today);
        const isToday = expDate === formatDate(today);

        let status: string;
        if (hasRdo) {
          status = "preenchido";
          consecutiveMissing = 0;
        } else if (isPast) {
          status = "atrasado";
          consecutiveMissing++;
        } else {
          status = "pendente";
        }

        // Upsert compliance log
        const { error: upsertError } = await supabase
          .from("rdo_compliance_log")
          .upsert(
            {
              schedule_id: config.id,
              data_esperada: expDate,
              status,
            },
            { onConflict: "schedule_id,data_esperada" }
          );

        if (upsertError) {
          console.error("Upsert error:", upsertError);
        }

        totalChecked++;

        // Send alert for overdue today
        if (isToday && !hasRdo) {
          // Check if alert already sent today
          const { data: existing } = await supabase
            .from("rdo_compliance_log")
            .select("alerta_enviado")
            .eq("schedule_id", config.id)
            .eq("data_esperada", expDate)
            .single();

          if (!existing?.alerta_enviado) {
            // Create alert for encarregado
            await supabase.from("alertas_historico").insert({
              user_id: config.encarregado_user_id || config.user_id,
              obra_id: config.obra_id,
              tipo_alerta: "rdo_pendente",
              mensagem: `RDO pendente para hoje (${expDate}). Preencha antes das ${config.alerta_hora_limite}.`,
              dados_extras: {
                schedule_id: config.id,
                data_esperada: expDate,
                tipo: "lembrete",
              },
            });

            await supabase
              .from("rdo_compliance_log")
              .update({
                alerta_enviado: true,
                alerta_enviado_em: new Date().toISOString(),
              })
              .eq("schedule_id", config.id)
              .eq("data_esperada", expDate);

            alertsCreated++;
          }
        }
      }

      // Check for escalation
      if (consecutiveMissing >= config.escalacao_apos_dias) {
        // Check if escalation already sent recently
        const { data: recentEscalation } = await supabase
          .from("rdo_compliance_log")
          .select("escalacao_enviada")
          .eq("schedule_id", config.id)
          .eq("escalacao_enviada", true)
          .gte("escalacao_enviada_em", formatDate(startDate))
          .limit(1);

        if (!recentEscalation || recentEscalation.length === 0) {
          // Send escalation to supervisor
          await supabase.from("alertas_historico").insert({
            user_id: config.supervisor_user_id || config.user_id,
            obra_id: config.obra_id,
            tipo_alerta: "rdo_ausente",
            mensagem: `ESCALACAO: ${consecutiveMissing} dias consecutivos sem RDO preenchido. Encarregado: ${config.encarregado_nome || "Nao definido"}. O avanço no planejamento está comprometido.`,
            dados_extras: {
              schedule_id: config.id,
              dias_sem_rdo: consecutiveMissing,
              encarregado: config.encarregado_nome,
              supervisor: config.supervisor_nome,
              tipo: "escalacao",
            },
          });

          // Mark escalation sent on recent missing dates
          await supabase
            .from("rdo_compliance_log")
            .update({
              escalacao_enviada: true,
              escalacao_enviada_em: new Date().toISOString(),
            })
            .eq("schedule_id", config.id)
            .in("status", ["atrasado", "pendente"])
            .eq("escalacao_enviada", false);

          escalationsCreated++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: totalChecked,
        schedules: schedules.length,
        alerts_created: alertsCreated,
        escalations_created: escalationsCreated,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
