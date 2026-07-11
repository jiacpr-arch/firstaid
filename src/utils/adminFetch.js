import { supabase } from '../config/supabaseClient'

// fetch() ที่แนบ token ของแอดมิน (Supabase session) — ใช้เรียก API ที่ผ่าน
// requireAdmin จากหน้าแอดมินทุกหน้า
export async function adminFetch(url, opts = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  })
}
