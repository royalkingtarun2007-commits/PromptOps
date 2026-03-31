'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'

type Status = 'draft' | 'in_review' | 'approved' | 'rejected' | 'archived'
type Tab = 'editor' | 'diff' | 'test'

interface Message { role: 'system' | 'user' | 'assistant'; content: string }

interface Version {
  id: string
  version: string
  status: Status
  variables: string[]
  messages: Message[]
  review_notes?: string
  created_by?: string
  approved_by?: string
  approved_at?: string
  created_at: string
}

const statusCfg: Record<Status, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#4b5563', bg: 'rgba(75,85,99,0.1)' },
  in_review: { label: 'In Review', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  approved:  { label: 'Approved',  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  rejected:  { label: 'Rejected',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  archived:  { label: 'Archived',  color: '#374151', bg: 'rgba(55,65,81,0.1)' },
}

export default function PromptDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Version | null>(null)
  const [tab, setTab] = useState<Tab>('editor')
  const [actionLoading, setActionLoading] = useState(false)

  // Editor state
  const [editMessages, setEditMessages] = useState<Message[]>([])
  const [editVars, setEditVars] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Test state
  const [testVars, setTestVars] = useState<Record<string, string>>({})
  const [testApiKey, setTestApiKey] = useState('')
  const [testModel, setTestModel] = useState('gpt-4o-mini')
  const [testRunning, setTestRunning] = useState(false)
  const [testOutput, setTestOutput] = useState('')
  const [testError, setTestError] = useState('')

  useEffect(() => { fetchVersions() }, [slug])

  useEffect(() => {
    if (selected) {
      setEditMessages(selected.messages ?? [{ role: 'user', content: '' }])
      setEditVars(selected.variables.join(', '))
      setTestVars(Object.fromEntries(selected.variables.map(v => [v, ''])))
      setTestOutput('')
      setTestError('')
    }
  }, [selected])

  useEffect(() => {
    const stored = localStorage.getItem('promptops_key')
    if (stored) setTestApiKey(stored)
  }, [])

  async function fetchVersions() {
    try {
      const data = await api.get<{ versions: Version[] }>(`/v1/prompts/${slug}/versions`)
      const vs = data.versions ?? []
      setVersions(vs)
      if (vs.length) setSelected(vs[0] ?? null)
    } catch { setVersions([]) }
    finally { setLoading(false) }
  }

  async function updateStatus(versionId: string, status: string) {
    setActionLoading(true)
    try {
      await api.patch(`/v1/prompts/${slug}/versions/${versionId}/status`, { status })
      fetchVersions()
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed') }
    finally { setActionLoading(false) }
  }

  async function promote(versionId: string, env: string) {
    setActionLoading(true)
    try {
      await api.post(`/v1/prompts/${slug}/promote`, { version_id: versionId, environment: env })
      setSaveMsg(`Promoted to ${env} successfully`)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed') }
    finally { setActionLoading(false) }
  }

  async function saveNewVersion() {
    setSaving(true); setSaveMsg('')
    try {
      const variables = editVars.split(',').map(v => v.trim()).filter(Boolean)
      await api.post(`/v1/prompts/${slug}/versions`, {
        messages: editMessages,
        variables,
        review_notes: '',
      })
      setSaveMsg('New version created as draft')
      setTimeout(() => setSaveMsg(''), 3000)
      fetchVersions()
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function runTest() {
    if (!testApiKey) { setTestError('Enter an OpenAI API key to run tests.'); return }
    setTestRunning(true); setTestOutput(''); setTestError('')

    try {
      // Compile messages with test variables
      const compiled = editMessages.map(m => ({
        role: m.role,
        content: m.content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => testVars[k] ?? `{{${k}}}`),
      }))

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testApiKey}`,
        },
        body: JSON.stringify({ model: testModel, messages: compiled, max_tokens: 600 }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? 'OpenAI error')
      setTestOutput(data.choices?.[0]?.message?.content ?? 'No output')
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Test failed')
    } finally { setTestRunning(false) }
  }

  // Diff computation
  function computeDiff(a: string, b: string): { type: 'same' | 'add' | 'remove'; text: string }[] {
    const aLines = a.split('\n')
    const bLines = b.split('\n')
    const result: { type: 'same' | 'add' | 'remove'; text: string }[] = []
    const maxLen = Math.max(aLines.length, bLines.length)
    for (let i = 0; i < maxLen; i++) {
      const aLine = aLines[i]
      const bLine = bLines[i]
      if (aLine === bLine) {
        result.push({ type: 'same', text: aLine ?? '' })
      } else {
        if (aLine !== undefined) result.push({ type: 'remove', text: aLine })
        if (bLine !== undefined) result.push({ type: 'add', text: bLine })
      }
    }
    return result
  }

  const prevVersion = selected ? versions.find((v, i) => versions[i - 1]?.id === selected.id) ?? null : null

  return (
    <div style={pageStyle}>
      <a href="/prompts" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4b5563', fontSize: 14, textDecoration: 'none', marginBottom: 28, fontFamily: 'EB Garamond, serif' }}>
        <BackIcon /> Back to prompts
      </a>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{slug}</div>
        <h1 style={heading}>{slug}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>

        {/* Version list */}
        <div>
          <div style={sectionLabel}>Versions</div>
          <div style={versionList}>
            {loading ? (
              <div style={emptyStyle}>Loading...</div>
            ) : versions.length === 0 ? (
              <div style={emptyStyle}>No versions yet.</div>
            ) : versions.map((v, i) => {
              const cfg = statusCfg[v.status] ?? statusCfg.draft
              const active = selected?.id === v.id
              return (
                <div key={v.id} onClick={() => setSelected(v)} style={{
                  padding: '12px 14px',
                  borderBottom: i < versions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: active ? 'rgba(99,102,241,0.07)' : 'transparent',
                  borderLeft: `2px solid ${active ? '#6366f1' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: active ? '#a5b4fc' : '#f9fafb' }}>{v.version}</span>
                    <span style={{ padding: '2px 6px', background: cfg.bg, color: cfg.color, borderRadius: 4, fontSize: 9, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>{new Date(v.created_at).toLocaleDateString()}</div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          {selected && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.status === 'draft' && (
                <button onClick={() => updateStatus(selected.id, 'in_review')} disabled={actionLoading} style={btnAmber}>
                  Submit for Review
                </button>
              )}
              {selected.status === 'in_review' && (
                <>
                  <button onClick={() => updateStatus(selected.id, 'approved')} disabled={actionLoading} style={btnGreen}>Approve</button>
                  <button onClick={() => updateStatus(selected.id, 'rejected')} disabled={actionLoading} style={btnRed}>Reject</button>
                </>
              )}
              {selected.status === 'approved' && (
                <>
                  <button onClick={() => promote(selected.id, 'production')} disabled={actionLoading} style={btnPrimary}>Promote to Production</button>
                  <button onClick={() => promote(selected.id, 'staging')} disabled={actionLoading} style={btnGhost}>Promote to Staging</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Main panel */}
        {selected && (
          <div>
            {/* Version header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#a5b4fc' }}>{selected.version}</span>
                <span style={{ padding: '3px 8px', background: (statusCfg[selected.status] ?? statusCfg.draft).bg, color: (statusCfg[selected.status] ?? statusCfg.draft).color, borderRadius: 5, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {(statusCfg[selected.status] ?? statusCfg.draft).label}
                </span>
                {saveMsg && <span style={{ fontSize: 12, color: '#10b981', fontFamily: 'JetBrains Mono, monospace' }}>{saveMsg}</span>}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', background: '#0a0f1e', borderRadius: 10, padding: 3, border: '1px solid #1f2937' }}>
                {([['editor', 'Editor'], ['diff', 'Diff'], ['test', 'Test']] as [Tab, string][]).map(([t, label]) => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    padding: '6px 16px', borderRadius: 7, border: 'none',
                    background: tab === t ? '#1f2937' : 'transparent',
                    color: tab === t ? '#f9fafb' : '#4b5563',
                    fontSize: 13, cursor: 'pointer',
                    fontFamily: 'EB Garamond, serif',
                    transition: 'all 0.15s',
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── EDITOR TAB ── */}
            {tab === 'editor' && (
              <div style={panel}>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Variables (comma separated)</label>
                  <input
                    value={editVars}
                    onChange={e => setEditVars(e.target.value)}
                    placeholder="email, tone, name"
                    style={inputStyle}
                  />
                  <div style={{ fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>
                    Use {`{{variable}}`} syntax in messages below
                  </div>
                </div>

                {editMessages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['system', 'user', 'assistant'] as const).map(role => (
                          <button key={role} onClick={() => {
                            const updated = [...editMessages]
                            updated[i] = { ...updated[i]!, role }
                            setEditMessages(updated)
                          }} style={{
                            padding: '3px 10px', borderRadius: 6, border: 'none',
                            background: msg.role === role ? 'rgba(99,102,241,0.15)' : 'transparent',
                            color: msg.role === role ? '#a5b4fc' : '#4b5563',
                            fontSize: 11, cursor: 'pointer',
                            fontFamily: 'JetBrains Mono, monospace',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            {role}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setEditMessages(editMessages.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', fontSize: 16, padding: '0 4px' }}>×</button>
                    </div>
                    <textarea
                      value={msg.content}
                      onChange={e => {
                        const updated = [...editMessages]
                        updated[i] = { ...updated[i]!, content: e.target.value }
                        setEditMessages(updated)
                      }}
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, lineHeight: 1.7 }}
                    />
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                  <button onClick={() => setEditMessages([...editMessages, { role: 'user', content: '' }])} style={btnGhost}>
                    + Add message
                  </button>
                  <button onClick={saveNewVersion} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving...' : 'Save as new version'}
                  </button>
                </div>
              </div>
            )}

            {/* ── DIFF TAB ── */}
            {tab === 'diff' && (
              <div style={panel}>
                {!prevVersion ? (
                  <div style={{ textAlign: 'center', padding: '48px 24px', color: '#374151', fontFamily: 'EB Garamond, serif', fontSize: 15 }}>
                    No previous version to compare against. This is the first version.
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                      <div style={{ flex: 1, padding: '8px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 8 }}>
                        <span style={{ fontSize: 11, color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Previous — {prevVersion.version}</span>
                      </div>
                      <div style={{ flex: 1, padding: '8px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: 8 }}>
                        <span style={{ fontSize: 11, color: '#10b981', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current — {selected.version}</span>
                      </div>
                    </div>

                    {selected.messages.map((msg, i) => {
                      const prevMsg = prevVersion.messages[i]
                      const prevContent = prevMsg?.content ?? ''
                      const currContent = msg.content
                      const diff = computeDiff(prevContent, currContent)
                      const hasChanges = diff.some(d => d.type !== 'same')

                      return (
                        <div key={i} style={{ marginBottom: 16, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ padding: '8px 14px', background: '#0a0f1e', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>{msg.role}</span>
                            {!hasChanges && <span style={{ fontSize: 10, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>no changes</span>}
                          </div>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, lineHeight: 1.7 }}>
                            {diff.map((line, j) => (
                              <div key={j} style={{
                                padding: '2px 16px',
                                background: line.type === 'add' ? 'rgba(16,185,129,0.08)' : line.type === 'remove' ? 'rgba(239,68,68,0.08)' : 'transparent',
                                color: line.type === 'add' ? '#6ee7b7' : line.type === 'remove' ? '#fca5a5' : '#6b7280',
                                borderLeft: `2px solid ${line.type === 'add' ? '#10b981' : line.type === 'remove' ? '#ef4444' : 'transparent'}`,
                              }}>
                                <span style={{ marginRight: 12, opacity: 0.5, userSelect: 'none' }}>
                                  {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                                </span>
                                {line.text || ' '}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {/* Variables diff */}
                    {JSON.stringify(selected.variables) !== JSON.stringify(prevVersion.variables) && (
                      <div style={{ marginTop: 12 }}>
                        <div style={sectionLabel}>Variables changed</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {prevVersion.variables.filter(v => !selected.variables.includes(v)).map(v => (
                            <span key={v} style={{ padding: '3px 10px', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', borderRadius: 5, fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>− {v}</span>
                          ))}
                          {selected.variables.filter(v => !prevVersion.variables.includes(v)).map(v => (
                            <span key={v} style={{ padding: '3px 10px', background: 'rgba(16,185,129,0.08)', color: '#6ee7b7', borderRadius: 5, fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>+ {v}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── TEST TAB ── */}
            {tab === 'test' && (
              <div style={panel}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>OpenAI API key</label>
                    <input
                      type="password"
                      value={testApiKey}
                      onChange={e => setTestApiKey(e.target.value)}
                      placeholder="sk-..."
                      style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Model</label>
                    <select value={testModel} onChange={e => setTestModel(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>
                </div>

                {selected.variables.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={sectionLabel}>Test variables</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      {selected.variables.map(v => (
                        <div key={v}>
                          <label style={labelStyle}>{`{{${v}}}`}</label>
                          <input
                            value={testVars[v] ?? ''}
                            onChange={e => setTestVars(prev => ({ ...prev, [v]: e.target.value }))}
                            placeholder={`Value for ${v}`}
                            style={inputStyle}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={runTest} disabled={testRunning} style={{ ...btnPrimary, marginBottom: 20, opacity: testRunning ? 0.6 : 1 }}>
                  {testRunning ? (
                    <><SpinnerIcon /> Running...</>
                  ) : (
                    <><PlayIcon /> Run test</>
                  )}
                </button>

                {testError && (
                  <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, color: '#fca5a5', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>
                    {testError}
                  </div>
                )}

                {testOutput && (
                  <div>
                    <div style={sectionLabel}>Output</div>
                    <div style={{ padding: '16px 18px', background: '#0a0f1e', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, color: '#d1fae5', fontSize: 14, fontFamily: 'EB Garamond, serif', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>
                      {testOutput}
                    </div>
                  </div>
                )}

                {!testOutput && !testError && !testRunning && (
                  <div style={{ textAlign: 'center', padding: '32px 24px', color: '#374151', fontSize: 14, fontFamily: 'EB Garamond, serif' }}>
                    Fill in the variables above and click Run test to see the output.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = { padding: '44px 52px', maxWidth: 1200, fontFamily: 'EB Garamond, Georgia, serif' }
const heading: React.CSSProperties = { fontFamily: 'Cormorant Garamond, serif', fontSize: 30, fontWeight: 600, fontStyle: 'italic', color: '#f9fafb', letterSpacing: '-0.03em' }
const sectionLabel: React.CSSProperties = { fontSize: 10, color: '#374151', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 10 }
const versionList: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden', background: '#0c1122' }
const emptyStyle: React.CSSProperties = { padding: '24px', textAlign: 'center', color: '#374151', fontSize: 14 }
const panel: React.CSSProperties = { background: '#0c1122', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '24px' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', background: '#0a0f1e', border: '1px solid #1f2937', borderRadius: 9, color: '#f9fafb', fontSize: 14, outline: 'none', fontFamily: 'EB Garamond, serif' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }
const btnBase: React.CSSProperties = { width: '100%', padding: '9px 14px', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'EB Garamond, serif', textAlign: 'left' as const }
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'EB Garamond, serif' }
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'transparent', border: '1px solid #1f2937', borderRadius: 9, color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'EB Garamond, serif' }
const btnAmber: React.CSSProperties = { ...btnBase, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', color: '#f59e0b' }
const btnGreen: React.CSSProperties = { ...btnBase, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10b981' }
const btnRed: React.CSSProperties = { ...btnBase, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }

function BackIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg> }
function PlayIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> }
function SpinnerIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> }
