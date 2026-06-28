import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const useSupabase = import.meta.env.VITE_USE_SUPABASE !== "false";

export const isSupabaseConfigured = Boolean(useSupabase && supabaseUrl && supabaseAnonKey);
export const STARTT_EMERGENCY_MODE = import.meta.env.VITE_STARTT_EMERGENCY_MODE === "true";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
      },
    })
  : null;
