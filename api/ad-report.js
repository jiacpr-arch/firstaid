// รายงานผลแอด FirstAid ส่งเข้า LINE ทุกเช้า (เรียกโดย Vercel cron — ดู vercel.json)
// ต้องตั้ง env: META_ACCESS_TOKEN (สิทธิ์ ads_read), LINE_CHANNEL_ACCESS_TOKEN,
// LINE_USER_ID และแนะนำ CRON_SECRET เพื่อกันคนนอกยิง endpoint นี้เอง

const AD_ACCOUNT = 'act_10153192786713173'
const AD_IDS = ['52556568346197', '52556568357197']
const AD_LABELS = { 52556568346197: 'Ad A (4 นาที)', 52556568357197: 'Ad B (เรียนฟรี)' }
const CAMPAIGN_START = '2026-06-11'
const GRAPH = 'https://graph.facebook.com/v23.0'

const num = (v) => (v == null || v === '' ? 0 : Number(v))
const baht = (v) => `฿${num(v).toFixed(2)}`

// เกณฑ์เดียวกับ CLAUDE.md: CPC <0.75/<=1.5, CTR >3/>=1.5, CPM <30/<=45
const cpcEmoji = (v) => (v < 0.75 ? '🟢' : v <= 1.5 ? '🟡' : '🔴')
const ctrEmoji = (v) => (v > 3 ? '🟢' : v >= 1.5 ? '🟡' : '🔴')
const cpmEmoji = (v) => (v < 30 ? '🟢' : v <= 45 ? '🟡' : '🔴')

async function fetchInsights(token, rangeParam) {
  const params = new URLSearchParams({
    level: 'ad',
    fields: 'ad_id,ad_name,spend,impressions,clicks,cpc,ctr,cpm,frequency',
    filtering: JSON.stringify([{ field: 'ad.id', operator: 'IN', value: AD_IDS }]),
    access_token: token,
    ...rangeParam,
  })
  const res = await fetch(`${GRAPH}/${AD_ACCOUNT}/insights?${params}`)
  const json = await res.json()
  if (json.error) throw new Error(`Meta API: ${json.error.message}`)
  return json.data || []
}

function buildMessage(yesterday, total) {
  const sum = (rows, f) => rows.reduce((a, r) => a + num(r[f]), 0)
  const ySpend = sum(yesterday, 'spend')
  const yClicks = sum(yesterday, 'clicks')

  const lines = ['📊 ผลแอด FirstAid เมื่อวาน']
  if (!yesterday.length || (ySpend === 0 && yClicks === 0)) {
    lines.push('ยังไม่มีการใช้จ่าย (แอดอาจยังอยู่ระหว่าง review หรือถูกปิดอยู่)')
  } else {
    lines.push(`💸 ใช้ไป ${baht(ySpend)} | 🖱️ ${yClicks} คลิก`)
    for (const r of yesterday) {
      const cpc = num(r.cpc)
      const ctr = num(r.ctr)
      const cpm = num(r.cpm)
      lines.push(
        `${AD_LABELS[r.ad_id] || r.ad_name}: CPC ${baht(cpc)} ${cpcEmoji(cpc)} | ` +
          `CTR ${ctr.toFixed(2)}% ${ctrEmoji(ctr)} | CPM ${baht(cpm)} ${cpmEmoji(cpm)}`
      )
    }
    const ranked = [...yesterday].filter((r) => num(r.clicks) > 0).sort((a, b) => num(a.cpc) - num(b.cpc))
    if (ranked.length === 2) lines.push(`🏆 ${AD_LABELS[ranked[0].ad_id]} ชนะ (CPC ถูกกว่า)`)
  }

  const tSpend = sum(total, 'spend')
  const tClicks = sum(total, 'clicks')
  const tCpc = tClicks > 0 ? tSpend / tClicks : 0
  lines.push(`📈 สะสมรวม: ${baht(tSpend)} | ${tClicks} คลิก | CPC เฉลี่ย ${baht(tCpc)} ${cpcEmoji(tCpc)}`)
  lines.push('พิมพ์ "เช็คผลแอด" ใน Claude Code เพื่อดูเชิงลึก/สั่งแก้')
  return lines.join('\n')
}

async function pushLine(channelToken, userId, text) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${channelToken}` },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
  })
  if (!res.ok) throw new Error(`LINE API ${res.status}: ${await res.text()}`)
}

export default async function handler(req, res) {
  const { CRON_SECRET, META_ACCESS_TOKEN, LINE_CHANNEL_ACCESS_TOKEN, LINE_USER_ID } = process.env

  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  const missing = ['META_ACCESS_TOKEN', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_USER_ID'].filter(
    (k) => !process.env[k]
  )
  if (missing.length) {
    return res.status(500).json({ ok: false, error: `missing env: ${missing.join(', ')}` })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const [yesterday, total] = await Promise.all([
      fetchInsights(META_ACCESS_TOKEN, { date_preset: 'yesterday' }),
      fetchInsights(META_ACCESS_TOKEN, {
        time_range: JSON.stringify({ since: CAMPAIGN_START, until: today }),
      }),
    ])
    const text = buildMessage(yesterday, total)
    await pushLine(LINE_CHANNEL_ACCESS_TOKEN, LINE_USER_ID, text)
    return res.status(200).json({ ok: true, sent: text })
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) })
  }
}
