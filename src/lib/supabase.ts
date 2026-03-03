import { supabase as baseSupabase } from "@/integrations/supabase/client";

// Re-export supabase client with relaxed typing for dynamic table queries
// TODO: Regenerate Supabase types to remove this workaround
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = baseSupabase as any;
