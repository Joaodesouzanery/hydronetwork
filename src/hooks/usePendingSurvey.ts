import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePendingSurvey() {
  return useQuery({
    queryKey: ["pending-survey-dispatch"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("survey_dispatches")
        .select("id, dispatched_at, expires_at")
        .eq("user_id", user.id)
        .is("responded_at", null)
        .eq("is_dismissed", false)
        .gte("expires_at", new Date().toISOString())
        .order("dispatched_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching pending survey:", error);
        return null;
      }

      return data;
    },
    refetchInterval: 60000, // Check every minute
    staleTime: 30000,
  });
}
