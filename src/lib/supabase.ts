import { supabase as baseSupabase } from "@/integrations/supabase/client";

// Re-export supabase client with relaxed typing for dynamic table queries
// The types.ts has been updated with the 6 missing hydro_* tables,
// but some older LPS tables still need full type regeneration.
// Once `supabase gen types typescript` is run, this cast can be removed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = baseSupabase as any;
