import { useEffect, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import seed from './content.json'
import './admin.css'

type AnyObj = any
type Path = (string | number)[]

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabase = url && anon ? createClient(url, anon) : null

function setIn(obj: AnyObj, path: Path, value: unknown): AnyObj {
  if (path.length === 0) return value
  const [head, ...rest] = path
  const copy: AnyObj = Array.isArray(obj) ? [...obj] : { ...(obj ?? {}) }
  copy[head] = setIn(obj?.[head], rest, value)
  return copy
}

function Field({ label, value, onChange, long }: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  long?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {long ? (
        <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

function Panel({ sb }: { sb: SupabaseClient }) {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [password, setPassword] = useState('')
  const [content, setContent] = useState<AnyObj>(null)
  const [msg, setMsg] = useState('')
  const [versions, setVersions] = useState<AnyObj[]>([])

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null)
      setReady(true)
    })
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [sb])

  useEffect(() => {
    if (!token) return
    ;(async () => {
      const { data, error } = await sb.from('content_draft').select('content').eq('id', 1).single()
      if (error) {
        setMsg('Could not load draft: ' + error.message)
        return
      }
      const c = data?.content
      setContent(c && c.hero ? c : seed)
      loadVersions()
    })()
  }, [token])

  async function loadVersions() {
    const { data } = await sb
      .from('content_versions')
      .select('version,status,published_at')
      .order('version', { ascending: false })
      .limit(5)
    setVersions(data ?? [])
  }

  async function login() {
    setMsg('')
    const { error } = await sb.auth.signInWithPassword({ email: loginEmail, password })
    if (error) setMsg(error.message)
  }

  async function saveDraft(): Promise<boolean> {
    const { error } = await sb
      .from('content_draft')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (error) {
      setMsg('Save failed: ' + error.message)
      return false
    }
    setMsg('Draft saved')
    return true
  }

  async function publish() {
    if (!(await saveDraft())) return
    setMsg('Publishing...')
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const details = body.details ? ': ' + body.details.join(', ') : ''
      setMsg((body.error ?? 'Publish failed') + details)
      return
    }
    setMsg('Version ' + body.version + ' is building. It goes live in about a minute.')
    loadVersions()
  }

  if (!ready) return <div className="admin">Loading...</div>

  if (!token) {
    return (
      <div className="admin">
        <h1>Admin sign in</h1>
        <Field label="Email" value={loginEmail} onChange={setLoginEmail} />
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="primary" onClick={login}>Sign in</button>
        {msg && <div className="msg">{msg}</div>}
      </div>
    )
  }

  if (!content) return <div className="admin">{msg || 'Loading draft...'}</div>

  const c = content
  const set = (path: Path, v: unknown) => setContent((prev: AnyObj) => setIn(prev, path, v))

  return (
    <div className="admin">
      <h1>Ananta admin</h1>
      {msg && <div className="msg">{msg}</div>}

      <h2>Hero</h2>
      <Field label="Badge" value={c.hero?.badge} onChange={(v) => set(['hero', 'badge'], v)} />
      <Field label="Heading" value={c.hero?.title} onChange={(v) => set(['hero', 'title'], v)} />
      <Field label="Subheading" long value={c.hero?.subtitle} onChange={(v) => set(['hero', 'subtitle'], v)} />
      <Field label="Primary button text" value={c.hero?.primaryCta?.text} onChange={(v) => set(['hero', 'primaryCta', 'text'], v)} />
      <Field label="Primary button link" value={c.hero?.primaryCta?.url} onChange={(v) => set(['hero', 'primaryCta', 'url'], v)} />
      <Field label="Secondary button text" value={c.hero?.secondaryCta?.text} onChange={(v) => set(['hero', 'secondaryCta', 'text'], v)} />
      <Field label="Secondary button link" value={c.hero?.secondaryCta?.url} onChange={(v) => set(['hero', 'secondaryCta', 'url'], v)} />

      <h2>Navigation</h2>
      {(c.nav ?? []).map((n: AnyObj, i: number) => (
        <div className="box" key={i}>
          <Field label="Label" value={n.label} onChange={(v) => set(['nav', i, 'label'], v)} />
          <Field label="Link" value={n.href} onChange={(v) => set(['nav', i, 'href'], v)} />
          <button className="danger" onClick={() => set(['nav'], c.nav.filter((_: AnyObj, k: number) => k !== i))}>Remove</button>
        </div>
      ))}
      <button onClick={() => set(['nav'], [...(c.nav ?? []), { label: 'New link', href: '#' }])}>Add link</button>

      <h2>Events</h2>
      <Field label="Section heading" value={c.events?.heading} onChange={(v) => set(['events', 'heading'], v)} />
      <Field label="Empty message" value={c.events?.emptyText} onChange={(v) => set(['events', 'emptyText'], v)} />
      {(c.events?.items ?? []).map((e: AnyObj, i: number) => (
        <div className="box" key={e.id ?? i}>
          <Field label="Name" value={e.name} onChange={(v) => set(['events', 'items', i, 'name'], v)} />
          <Field label="Category" value={e.category} onChange={(v) => set(['events', 'items', i, 'category'], v)} />
          <Field label="Description" long value={e.description} onChange={(v) => set(['events', 'items', i, 'description'], v)} />
          <Field label="Date" value={e.date} onChange={(v) => set(['events', 'items', i, 'date'], v)} />
          <Field label="Time" value={e.time} onChange={(v) => set(['events', 'items', i, 'time'], v)} />
          <Field label="Venue" value={e.venue} onChange={(v) => set(['events', 'items', i, 'venue'], v)} />
          <Field label="Registration link" value={e.registerUrl} onChange={(v) => set(['events', 'items', i, 'registerUrl'], v)} />
          <button className="danger" onClick={() => set(['events', 'items'], c.events.items.filter((_: AnyObj, k: number) => k !== i))}>Delete event</button>
        </div>
      ))}
      <button
        onClick={() =>
          set(['events', 'items'], [
            ...(c.events?.items ?? []),
            { id: String(Date.now()), name: 'New event', category: '', description: '', date: '', time: '', venue: '', registerUrl: '#' },
          ])
        }
      >
        Add event
      </button>

      <h2>Footer</h2>
      <Field label="Heading" value={c.footer?.heading} onChange={(v) => set(['footer', 'heading'], v)} />
      <Field label="Email" value={c.footer?.email} onChange={(v) => set(['footer', 'email'], v)} />
      <Field label="Copyright text" value={c.footer?.copyright} onChange={(v) => set(['footer', 'copyright'], v)} />

      <h2>Recent versions</h2>
      <ul className="versions">
        {versions.map((v) => (
          <li key={v.version}>v{v.version} · {v.status}</li>
        ))}
      </ul>
      <button onClick={loadVersions}>Refresh status</button>

      <div className="bar">
        <button onClick={saveDraft}>Save draft</button>
        <button className="primary" onClick={publish}>Publish</button>
        <button onClick={() => sb.auth.signOut()}>Sign out</button>
      </div>
    </div>
  )
}

export default function Admin() {
  if (!supabase) return <div className="admin">Missing Supabase settings for this build.</div>
  return <Panel sb={supabase} />
}
