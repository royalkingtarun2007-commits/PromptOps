'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, FileText, GitBranch, Tag } from 'lucide-react'
import { api, type Prompt } from '@/lib/api'

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // New prompt form state
  const [form, setForm] = useState({ slug: '', name: '', description: '', tags: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPrompts()
  }, [search])

  async function fetchPrompts() {
    setLoading(true)
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : ''
      const data = await api.get<{ prompts: Prompt[] }>(`/v1/prompts${q}`)
      setPrompts(data.prompts ?? [])
    } catch {
      setPrompts([])
    } finally {
      setLoading(false)
    }
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
      setError(err instanceof Error ? err.message : 'Failed to create prompt')
    } finally {
      setCreating(false)
    }
  }

  const statusColor: Record<string, string> = {
    draft: '#71717a', in_review: '#fbbf24', approved: '#4ade80', rejected: '#f87171', archived: '#52525b',
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 12, color: '#7c6af7', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>// Prompts</p>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 700, color: '#f4f4f5', letterSpacing: '-0.03em' }}>
            Prompt Library
          </h1>
          <p style={{ color: '#71717a', fontSize: 15, marginTop: 6 }}>Version, review, and deploy your prompts.</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px',
          background: '#7c6af7', border: 'none', borderRadius: 10,
          color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer',
        }}>
          <Plus size={16} />
          New Prompt
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <Search size={15} color="#52525b" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search prompts..."
          style={{
            width: '100%', padding: '10px 14px 10px 38px',
            background: '#111113', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, color: '#f4f4f5', fontSize: 14, outline: 'none',
          }}
        />
      </div>

      {/* Table */}
      <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 140px 120px 100px 120px',
          padding: '10px 20px',
          background: '#0f0f11',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          <span>Prompt</span>
          <span>Tags</span>
          <span>Versions</span>
          <span>Status</span>
          <span>Updated</span>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#52525b', fontSize: 14 }}>Loading...</div>
        ) : prompts.length === 0 ? (
          <div style={{ padding: 64, textAlign: 'center' }}>
            <FileText size={32} color="#27272a" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#52525b', fontSize: 14 }}>No prompts found. Create your first one.</p>
          </div>
        ) : (
          prompts.map((p, i) => (
            <a key={p.id} href={`/prompts/${p.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 120px 100px 120px',
                padding: '14px 20px',
                borderBottom: i < prompts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(124,106,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={14} color="#7c6af7" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: '#f4f4f5', fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: '#52525b', fontFamily: 'DM Mono, monospace', marginTop: 1 }}>{p.slug}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {p.tags.slice(0, 2).map(tag => (
                    <span key={tag} style={{ padding: '2px 7px', background: 'rgba(124,106,247,0.08)', color: '#a78bfa', borderRadius: 5, fontSize: 11 }}>{tag}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#71717a', fontSize: 13 }}>
                  <GitBranch size={13} />
                  {p.version_count}
                </div>
                <div>
                  <span style={{ padding: '3px 8px', background: 'rgba(74,222,128,0.08)', color: '#4ade80', borderRadius: 6, fontSize: 11 }}>
                    active
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#52525b' }}>
                  {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </div>
            </a>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: '#111113',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 32,
            width: 480,
          }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, color: '#f4f4f5', marginBottom: 6 }}>New Prompt</h2>
            <p style={{ color: '#71717a', fontSize: 14, marginBottom: 24 }}>Create a new prompt. You can add versions and messages after.</p>

            {error && <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</div>}

            {[
              { key: 'name', label: 'Name', placeholder: 'Summarise Email' },
              { key: 'slug', label: 'Slug', placeholder: 'summarise-email' },
              { key: 'description', label: 'Description (optional)', placeholder: 'Summarises an email into 3 bullet points' },
              { key: 'tags', label: 'Tags (comma separated)', placeholder: 'email, summarisation' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>{label}</label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: '#18181b', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, color: '#f4f4f5', fontSize: 14, outline: 'none',
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#71717a', fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={createPrompt} disabled={creating} style={{ padding: '9px 18px', background: '#7c6af7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', opacity: creating ? 0.6 : 1 }}>
                {creating ? 'Creating...' : 'Create Prompt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
