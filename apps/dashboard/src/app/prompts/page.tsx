'use client'

import { useEffect, useState } from 'react'
import { api, type Prompt } from '@/lib/api'

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ slug: '', name: '', description: '', tags: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchPrompts() }, [search])

  async function fetchPrompts() {
    setLoading(true)
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : ''
      const data = await api.get<{ prompts: Prompt[] }>(`/v1/prompts${q}`)
      setPrompts(data.prompts ?? [])
    } catch { setPrompts([]) }
    finally { setLoading(false) }
  }

  async function createPrompt() {
    if (!form.slug || !form.name) { setError('Slug and name are required.'); return }
    setCreating(true); setError('')
    try {
      await api.post('/v1/prompts', {
        slug: form.slug,
        name: form.name,
        description: form.description,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        messages: [{ role: 'user', content: 'Enter your prompt here...' }],
        variables: [],
      })
      setShowCreate(false)
      setForm({ slug: '', name: '', description: '', tags: '' })
      fetchPrompts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally { setCreating(false) }
  }

  return (
    <div style={page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40 }}>
        <div>
          <h1 style={heading}>Prompt Library</h1>
          <p style={sub}>Version, review, and deploy your prompts.</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>
          <PlusIcon /> New Prompt
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
          <SearchIcon />
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search prompts..."
          style={{ ...input, paddingLeft: 40 }}
        />
      </div>

      {/* Table */}
      <div style={table}>
        <div style={tableHead}>
          <span style={{ flex: 2 }}>Prompt</span>
          <span>Tags</span>
          <span>Versions</span>
          <span>Updated</span>
        </div>

        {loading ? (
          <div style={empty}>Loading...</div>
        ) : prompts.length === 0 ? (
          <div style={empty}>
            <DocIcon />
            <p style={{ marginTop: 12, color: '#374151' }}>No prompts yet. Create your first one.</p>
          </div>
        ) : prompts.map((p, i) => (
          <a key={p.id} href={`/prompts/${p.slug}`} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
              padding: '16px 22px',
              borderBottom: i < prompts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              alignItems: 'center', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={iconBox}>
                  <DocIcon color="#6366f1" />
                </div>
                <div>
                  <div style={{ fontSize: 15, color: '#f9fafb', fontFamily: 'EB Garamond, serif', fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{p.slug}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                {p.tags.slice(0, 2).map(tag => (
                  <span key={tag} style={tagStyle}>{tag}</span>
                ))}
              </div>
              <div style={{ fontSize: 14, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>
                {p.version_count ?? 0}
              </div>
              <div style={{ fontSize: 13, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
                {new Date(p.updated_at).toLocaleDateString()}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontStyle: 'italic', fontWeight: 600, color: '#f9fafb', marginBottom: 6 }}>New Prompt</h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>Create a versioned prompt. Add messages after creation.</p>

            {error && <div style={errorBox}>{error}</div>}

            {[
              { key: 'name', label: 'Name', placeholder: 'Summarise Email' },
              { key: 'slug', label: 'Slug', placeholder: 'summarise-email' },
              { key: 'description', label: 'Description', placeholder: 'Optional' },
              { key: 'tags', label: 'Tags', placeholder: 'email, summarisation' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{label}</label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={input}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowCreate(false)} style={btnGhost}>Cancel</button>
              <button onClick={createPrompt} disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}>
                {creating ? 'Creating...' : 'Create Prompt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const page: React.CSSProperties = { padding: '44px 52px', maxWidth: 1100, fontFamily: 'EB Garamond, Georgia, serif' }
const heading: React.CSSProperties = { fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 32, fontWeight: 600, fontStyle: 'italic', color: '#f9fafb', letterSpacing: '-0.03em', marginBottom: 6 }
const sub: React.CSSProperties = { color: '#4b5563', fontSize: 16 }
const input: React.CSSProperties = { width: '100%', padding: '10px 14px', background: '#0c1122', border: '1px solid #1f2937', borderRadius: 9, color: '#f9fafb', fontSize: 14, outline: 'none', fontFamily: 'EB Garamond, serif' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }
const table: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden', background: '#0c1122' }
const tableHead: React.CSSProperties = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 22px', background: '#0a0f1e', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }
const empty: React.CSSProperties = { padding: '64px 24px', textAlign: 'center', color: '#374151', fontSize: 15 }
const iconBox: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const tagStyle: React.CSSProperties = { padding: '2px 8px', background: 'rgba(99,102,241,0.08)', color: '#818cf8', borderRadius: 5, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
const modal: React.CSSProperties = { background: '#0c1122', border: '1px solid #1f2937', borderRadius: 16, padding: '32px 36px', width: 480 }
const errorBox: React.CSSProperties = { padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 16 }
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'EB Garamond, serif' }
const btnGhost: React.CSSProperties = { padding: '10px 18px', background: 'transparent', border: '1px solid #1f2937', borderRadius: 10, color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'EB Garamond, serif' }

function PlusIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function DocIcon({ color = '#374151' }: { color?: string }) { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> }
