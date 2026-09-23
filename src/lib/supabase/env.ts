export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False until the Supabase keys are added to .env.local. */
export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey);
