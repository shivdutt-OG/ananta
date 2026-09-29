import { readFileSync, writeFileSync } from 'node:fs'

const mode = process.argv[2]
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  if (process.env.VERCEL === '1') {
    console.error('Missing Supabase environment variables on Vercel')
    process.exit(1)
  }
  console.log('No Supabase env vars locally, keeping src/content.json')
  process.exit(0)
}

const baseHeaders = { apikey: key, 'Content-Type': 'application/json' }
if (key.startsWith('eyJ')) baseHeaders.Authorization = `Bearer ${key}`

async function rest(path, options = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { ...baseHeaders, ...(options.headers || {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function setStatus(filter, status) {
  await rest(`content_versions?${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
  })
}

try {
  if (mode === 'fetch') {
    const rows = await rest(
      'content_versions?status=in.(pending,live)&order=version.desc&limit=1&select=version,content'
    )
    if (!rows.length) {
      console.log('No published versions yet, keeping seed src/content.json')
      process.exit(0)
    }
    const { version, content } = rows[0]
    if (!content || typeof content !== 'object' || !content.hero) {
      await setStatus(`version=eq.${version}`, 'failed')
      throw new Error(`Version ${version} failed the sanity check and was marked failed`)
    }
    writeFileSync('src/content.json', JSON.stringify({ ...content, version }, null, 2))
    writeFileSync('.built-version', String(version))
    console.log(`Snapshot v${version} written to src/content.json`)
  } else if (mode === 'mark') {
    let version
    try {
      version = Number(readFileSync('.built-version', 'utf8'))
    } catch {
      console.log('No snapshot was built, nothing to mark')
      process.exit(0)
    }
    await setStatus(`version=eq.${version}`, 'live')
    await setStatus(`status=eq.live&version=lt.${version}`, 'archived')
    await setStatus(`status=eq.pending&version=lt.${version}`, 'failed')
    console.log(`Version ${version} is now live`)
  }
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
