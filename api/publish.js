const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY, DEPLOY_HOOK_URL } = process.env

function serviceHeaders() {
  const h = { apikey: SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }
  if (SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  return h
}

function validate(c) {
  const errors = []
  if (!c || typeof c !== 'object') return ['Content is empty']
  if (!c.hero || typeof c.hero.title !== 'string' || !c.hero.title.trim()) errors.push('Hero title is required')
  if (!Array.isArray(c.nav)) errors.push('Navigation must be a list')
  if (!c.events || !Array.isArray(c.events.items)) errors.push('Events list is missing')
  if (!c.footer || typeof c.footer.email !== 'string') errors.push('Footer email is required')
  return errors
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Not signed in' })

    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (!who.ok) return res.status(401).json({ error: 'Invalid session' })
    const user = await who.json()

    const draftRes = await fetch(`${SUPABASE_URL}/rest/v1/content_draft?id=eq.1&select=content`, {
      headers: serviceHeaders(),
    })
    const draftRows = await draftRes.json()
    const content = draftRows?.[0]?.content

    const errors = validate(content)
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors })

    const lastRes = await fetch(
      `${SUPABASE_URL}/rest/v1/content_versions?select=version&order=version.desc&limit=1`,
      { headers: serviceHeaders() }
    )
    const last = await lastRes.json()
    const version = (last?.[0]?.version || 0) + 1

    const insert = await fetch(`${SUPABASE_URL}/rest/v1/content_versions`, {
      method: 'POST',
      headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ version, content, status: 'pending', published_by: user.id }),
    })
    if (!insert.ok) return res.status(500).json({ error: 'Could not save the new version' })

    const hook = await fetch(DEPLOY_HOOK_URL, { method: 'POST' })
    if (!hook.ok) {
      return res.status(502).json({ error: `Version ${version} saved but the deploy could not start` })
    }

    return res.status(200).json({ version, status: 'building' })
  } catch (err) {
    return res.status(500).json({ error: 'Publish failed' })
  }
}
