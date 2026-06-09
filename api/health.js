export default function handler(_req, res) {
  res.status(200).json({ ok: true, app: 'firstaid', ts: new Date().toISOString() })
}
