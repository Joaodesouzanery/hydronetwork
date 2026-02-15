import { supabase as baseSupabase } from "@/integrations/supabase/client";

// Temporary wrapper to bypass type checking issues until Supabase types are regenerated
export const supabase = baseSupabase as any;
