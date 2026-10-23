import { supabase } from '../config/supabaseClient'

// The learner's JIA student card at the Hub (learning_hub.people via public.jia_profile — firstaid is
// on the Hub's own Supabase project, so this is the learner's own session). The Hub prints its central
// certificate in the card's name and won't issue one while the card has none, so the theory
// certificate form reads it and writes the confirmed name back before asking for the certificate.

// { name, nameLocked } — never throws; null when there is no session or the Hub can't answer.
export async function readHubCard() {
  try {
    if (!supabase) return null
    const { data, error } = await supabase.rpc('jia_profile', { action: 'state', payload: {} })
    if (error || !data) return null
    return { name: (data.name || '').trim(), nameLocked: !!data.nameLocked, phone: data.phone || null, birthdate: data.birthdate || null }
  } catch {
    return null
  }
}

const hubPhone = (v) => {
  const digits = String(v || '').replace(/\D/g, '')
  return /^0[0-9]{8,9}$/.test(digits) ? digits : null
}

// Puts `name` on the card unless an instructor already locked it. 'save' sets phone and birthdate to
// exactly what is sent, so the card's own values are passed back unchanged (phone only filled in when
// the card has none). Throws the Hub's message on refusal.
export async function saveHubCardName(name, phone) {
  const card = await readHubCard()
  if (!card) throw new Error('เชื่อมต่อบัญชี JIA ไม่สำเร็จ กรุณาลองใหม่')
  if (card.nameLocked) return card.name
  const { error } = await supabase.rpc('jia_profile', {
    action: 'save',
    payload: { name: name.trim(), phone: hubPhone(card.phone) || hubPhone(phone), birthdate: card.birthdate },
  })
  if (error) throw new Error(error.message || 'บันทึกชื่อบนบัตรนักเรียน JIA ไม่สำเร็จ')
  return name.trim()
}
