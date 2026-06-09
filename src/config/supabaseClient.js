import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// Allow the app to run without Supabase configured — offline-first features
// still work via Dexie. Server sync simply no-ops when the client is null.
export const supabase = url && anon ? createClient(url, anon) : null

export const isSupabaseConfigured = !!supabase
