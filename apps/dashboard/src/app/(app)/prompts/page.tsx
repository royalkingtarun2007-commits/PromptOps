'use client'

import { useEffect, useState } from 'react'
import { api, type Prompt } from '@/lib/api'

interface Message { role: 'system' | 'user' | 'assistant'; content: string }

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<1 | 2>(1)

  const [form, setForm] = useState({ slug: '', name: '', description: '', tags: '' })
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: '' },
    { role: 'user', content: '' },
  ])
  const [variables, setVariables] = useState('')

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

  function resetModal() {
    setShowCreate(false)
    setStep(1)
    setForm({ slug: '', name: '', description: '', tags: '' })
    setMessages([{ role: 'system', content: '' }, { role: 'user', content: '' }])
    setVariables('')
    setError('')
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function createPrompt() {
    const filledMessages = messages.filter(m => m.content.trim())
    if (!filledMessages.length) { setError('Add at least one message with content.'); return }

    setCreating(true); setError('')
    try {
      const vars = variables.split(',').map(v => v.trim()).filter(Boolean)
      await api.post('/v1/prompts', {
        slug: form.slug,
        name: form.name,
        description: form.description || undefined,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        messages: filledMessages,
        variables: vars,
      })
      resetModal()
      fetchPrompts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prompt')
    } finally { setCreating(false) }
  }

  function updateMessage(i: number, field: keyof Message, value: string) {
    const updated = [...messages]
    updated[i] = { ...updated[i]!, [field]: value } as Message
    setMessages(updated)
  }

  // Auto-detect variables from message content
  function detectVariables() {
    const all = messages.map(m => m.content).join(' ')
    const matches = Array.from(all.matchAll(/\{\{\s*([\w]+)\s*\}\}/g))
    const found = Array.from(new Set(matches.map(m => m[1])))
    if (found.length) setVariables(found.join(', '))
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
          style={{ ...inputStyle, paddingLeft: 40 }}
        />
      </div>

      {/* Table */}
      <div style={tableWrap}>
        <div style={tableHead}>
          <span style={{ gridColumn: 'span 2' }}>Prompt</span>
          <span>Tags</span>
          <span>Versions</span>
          <span>Updated</span>
        </div>

        {loading ? (
          <div style={emptyStyle}>Loading...</div>
        ) : prompts.length === 0 ? (
          <div style={{ ...emptyStyle, flexDirection: 'column' as const, display: 'flex', alignItems: 'center', padding: '64px 24px' }}>
            <DocIcon size={28} color="#1f2937" />
            <p style={{ marginTop: 14, color: '#374151', fontFamily: 'EB Garamond, serif', fontSize: 16 }}>No prompts yet.</p>
            <p style={{ color: '#1f2937', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>Create your first prompt to get started.</p>
          </div>
        ) : prompts.map((p, i) => (
          <a key={p.id} href={`/prompts/${p.slug}`} style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 1fr 80px 100px',
                padding: '14px 22px',
                borderBottom: i < prompts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                alignItems: 'center', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DocIcon size={14} color="#6366f1" />
              </div>
              <div style={{ paddingLeft: 12 }}>
                <div style={{ fontSize: 15, color: '#f9fafb', fontFamily: 'EB Garamond, serif', fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{p.slug}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                {p.tags.slice(0, 2).map(tag => (
                  <span key={tag} style={tagStyle}>{tag}</span>
                ))}
              </div>
              <div style={{ fontSize: 13, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>
                {p.version_count ?? 0}
              </div>
              <div style={{ fontSize: 12, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
                {new Date(p.updated_at).toLocaleDateString()}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: step === 2 ? 640 : 480 }}>

            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              {([1, 2] as const).map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: step >= s ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#1f2937',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                    color: step >= s ? '#fff' : '#374151',
                  }}>{s}</div>
                  <span style={{ fontSize: 13, color: step === s ? '#f9fafb' : '#374151', fontFamily: 'EB Garamond, serif' }}>
                    {s === 1 ? 'Details' : 'Messages'}
                  </span>
                  {s === 1 && <div style={{ width: 32, height: 1, background: '#1f2937', marginLeft: 4 }} />}
                </div>
              ))}
            </div>

            {step === 1 ? (
              <>
                <h2 style={modalHeading}>New Prompt</h2>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>Give your prompt a name and identifier.</p>

                {error && <div style={errorBox}>{error}</div>}

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
                    placeholder="Summarise Email"
                    style={inputStyle}
                    autoFocus
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Slug</label>
                  <input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    placeholder="summarise-email"
                    style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
                  />
                  <div style={{ fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: 5 }}>
                    Used in code: client.get('{form.slug || 'your-slug'}')
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Description (optional)</label>
                  <input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What does this prompt do?"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Tags (comma separated)</label>
                  <input
                    value={form.tags}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                    placeholder="email, summarisation"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={resetModal} style={btnGhost}>Cancel</button>
                  <button
                    onClick={() => {
                      if (!form.name || !form.slug) { setError('Name and slug are required.'); return }
                      setError(''); setStep(2)
                    }}
                    style={btnPrimary}
                  >
                    Next — Write messages
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={modalHeading}>Write messages</h2>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                  This becomes version v1. Use {`{{variable}}`} for dynamic values.
                </p>

                {error && <div style={errorBox}>{error}</div>}

                {messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 16, border: '1px solid #1f2937', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#0a0f1e', borderBottom: '1px solid #1f2937' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['system', 'user', 'assistant'] as const).map(role => (
                          <button key={role} onClick={() => updateMessage(i, 'role', role)} style={{
                            padding: '3px 10px', borderRadius: 5, border: 'none',
                            background: msg.role === role ? 'rgba(99,102,241,0.15)' : 'transparent',
                            color: msg.role === role ? '#a5b4fc' : '#4b5563',
                            fontSize: 11, cursor: 'pointer',
                            fontFamily: 'JetBrains Mono, monospace',
                            textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                          }}>
                            {role}
                          </button>
                        ))}
                      </div>
                      {messages.length > 1 && (
                        <button onClick={() => setMessages(messages.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                      )}
                    </div>
                    <textarea
                      value={msg.content}
                      onChange={e => updateMessage(i, 'content', e.target.value)}
                      onBlur={detectVariables}
                      placeholder={msg.role === 'system' ? 'You are a helpful assistant. Respond in a {{tone}} tone.' : 'Summarise this email:\n\n{{email}}'}
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, lineHeight: 1.7, borderRadius: 0, border: 'none' }}
                    />
                  </div>
                ))}

                <button
                  onClick={() => setMessages([...messages, { role: 'user', content: '' }])}
                  style={{ ...btnGhost, marginBottom: 20, fontSize: 13 }}
                >
                  + Add message
                </button>

                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>
                    Variables
                    <span onClick={detectVariables} style={{ marginLeft: 8, color: '#6366f1', cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
                      (auto-detect)
                    </span>
                  </label>
                  <input
                    value={variables}
                    onChange={e => setVariables(e.target.value)}
                    placeholder="email, tone"
                    style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setStep(1); setError('') }} style={btnGhost}>Back</button>
                  <button onClick={createPrompt} disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}>
                    {creating ? 'Creating...' : 'Create prompt'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const page: React.CSSProperties = { padding: '44px 52px', maxWidth: 1100, fontFamily: 'EB Garamond, Georgia, serif' }
const heading: React.CSSProperties = { fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 600, fontStyle: 'italic', color: '#f9fafb', letterSpacing: '-0.03em', marginBottom: 6 }
const sub: React.CSSProperties = { color: '#4b5563', fontSize: 16 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', background: '#0a0f1e', border: '1px solid #1f2937', borderRadius: 9, color: '#f9fafb', fontSize: 14, outline: 'none', fontFamily: 'EB Garamond, serif' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, color: '#6b7280', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const tableWrap: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, overflow: 'hidden', background: '#0c1122' }
const tableHead: React.CSSProperties = { display: 'grid', gridTemplateColumns: '36px 1fr 1fr 80px 100px', padding: '10px 22px', background: '#0a0f1e', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10, color: '#374151', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const emptyStyle: React.CSSProperties = { textAlign: 'center', color: '#374151', fontSize: 14 }
const tagStyle: React.CSSProperties = { padding: '2px 8px', background: 'rgba(99,102,241,0.08)', color: '#818cf8', borderRadius: 5, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
const modal: React.CSSProperties = { background: '#0c1122', border: '1px solid #1f2937', borderRadius: 16, padding: '32px 36px', width: '90%' }
const modalHeading: React.CSSProperties = { fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontStyle: 'italic', fontWeight: 600, color: '#f9fafb', marginBottom: 6 }
const errorBox: React.CSSProperties = { padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, color: '#fca5a5', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'EB Garamond, serif' }
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'transparent', border: '1px solid #1f2937', borderRadius: 9, color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'EB Garamond, serif' }

function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function DocIcon({ size = 15, color = '#374151' }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> }
