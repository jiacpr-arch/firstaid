// In-memory stand-in for the Supabase admin client, just enough query-builder for the unit
// tests (select/insert/delete with eq filters, order, limit, single/maybeSingle).
// Test helper only — not imported by any handler.
export function fakeDb(seed = {}, { uniqueCols = {} } = {}) {
  const tables = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]))
  let nextId = 1

  function from(name) {
    const rows = (tables[name] ||= [])
    const st = { filters: [], op: 'select', payload: null, order: null, limit: null }

    const run = () => {
      const match = (r) => st.filters.every(([c, v]) => r[c] === v)
      if (st.op === 'insert') {
        for (const col of uniqueCols[name] || []) {
          if (st.payload[col] != null && rows.some((r) => r[col] === st.payload[col])) {
            return { data: null, error: { code: '23505', message: `duplicate ${col}` } }
          }
        }
        const row = { id: `id-${nextId++}`, ...st.payload }
        rows.push(row)
        return { data: [row], error: null }
      }
      if (st.op === 'update') {
        for (const r of rows) if (match(r)) Object.assign(r, st.payload)
        return { data: null, error: null }
      }
      if (st.op === 'delete') {
        for (let i = rows.length - 1; i >= 0; i -= 1) if (match(rows[i])) rows.splice(i, 1)
        return { data: null, error: null }
      }
      let out = rows.filter(match)
      if (st.order) out = [...out].sort((a, b) => String(a[st.order]).localeCompare(String(b[st.order])))
      if (st.limit != null) out = out.slice(0, st.limit)
      return { data: out, error: null }
    }

    const b = {
      select: () => b,
      insert: (row) => { st.op = 'insert'; st.payload = row; return b },
      update: (patch) => { st.op = 'update'; st.payload = patch; return b },
      delete: () => { st.op = 'delete'; return b },
      eq: (c, v) => { st.filters.push([c, v]); return b },
      order: (c) => { st.order = c; return b },
      limit: (n) => { st.limit = n; return b },
      single: async () => {
        const r = run()
        if (r.error) return r
        return { data: r.data?.[0] ?? null, error: r.data?.[0] ? null : { message: 'no row' } }
      },
      maybeSingle: async () => {
        const r = run()
        return r.error ? r : { data: r.data?.[0] ?? null, error: null }
      },
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    }
    return b
  }

  return { from, tables, auth: { getUser: async () => ({ data: { user: null }, error: new Error('no auth') }) } }
}
