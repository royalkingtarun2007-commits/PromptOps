'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, type PromptVersion } from '@/lib/api'

const statusConfig = {
  draft:     { label: 'Draft',     color: '#4b5563', bg: 'rgba(75,85,99,0.1)' },
  in_review: { label: 'In Review', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  approved:  { label: 'Approved',  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  rejected:  { label: 'Rejected',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  archived:  { label: 'Archived',  color: '#374151', bg: 'rgba(55,65,81,0.1)' },
}

export default function PromptDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PromptVersion | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { fetchVersions() }, [slug])

  async function fetchVersions() {
    try {
      const data = await api.get<{ versions: PromptVersion[] }>(`/v1/prompts/${slug}/versions`)
      setVersions(data.versions ?? [])
      if (data.versions?.length) setSelected(data.versions[0] ?? null)
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
      alert(`Promoted to ${env}`)
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed') }
    finally { setActionLoading(false) }
  }

  return (
    <div style={page}>
      <a href="/prompts" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4b5563', fontSize: 14, textDecoration: 'none', marginBottom: 28, fontFamily: 'EB Garamond, serif' }}>
        <BackIcon /> Back to prompts
      </a>

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 12, color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, letterSpacing: '0.06em' }}>{slug}</div>
        <h1 style={heading}>{slug}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>

        {/* Version list */}
        <div>
          <div style={sectionLabel}>Versions</div>
          <div style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden', background: '#0c1122' }}>
            {loading ? (
              <div style={empty}>Loading...</div>
            ) : versions.length === 0 ? (
              <div style={empty}>No versions yet.</div>
            ) : versions.map((v, i) => {
              const cfg = statusConfig[v.status] ?? statusConfig.draft
              const active = selected?.id === v.id
              return (
                <div key={v.id} onClick={() => setSelected(v)} style={{
                  padding: '13px 16px',
                  borderBottom: i < versions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: active ? 'rgba(99,102,241,0.07)' : 'transparent',
                  borderLeft: `2px solid ${active ? '#6366f1' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: active ? '#a5b4fc' : '#f9fafb' }}>{v.version}</span>
                    <span style={{ padding: '2px 7px', background: cfg.bg, color: cfg.color, borderRadius: 5, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>{new Date(v.created_at).toLocaleDateString()}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Version detail */}
        {selected && (
          <div style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, overflow: 'hidden', background: '#0c1122' }}>
            {/* Header */}
            <div style={{ padding: '16px 22px', background: '#0a0f1e', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#a5b4fc' }}>{selected.version}</span>
                <span style={{
                  padding: '3px 9px',
                  background: (statusConfig[selected.status] ?? statusConfig.draft).bg,
                  color: (statusConfig[selected.status] ?? statusConfig.draft).color,
                  borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {(statusConfig[selected.status] ?? statusConfig.draft).label}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {selected.status === 'draft' && (
                  <button onClick={() => updateStatus(selected.id, 'in_review')} disabled={actionLoading} style={btnAmber}>
                    Submit for Review
                  </button>
                )}
                {selected.status === 'in_review' && (
                  <>
                    <button onClick={() => updateStatus(selected.id, 'rejected')} disabled={actionLoading} style={btnRed}>Reject</button>
                    <button onClick={() => updateStatus(selected.id, 'approved')} disabled={actionLoading} style={btnGreen}>Approve</button>
                  </>
                )}
                {selected.status === 'approved' && (
                  <button onClick={() => promote(selected.id, 'production')} disabled={actionLoading} style={btnPrimary}>
                    Promote to Production
                  </button>
                )}
              </div>
            </div>

            {/* Meta */}
            {(selected.approved_by || selected.variables.length > 0) && (
              <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 32 }}>
                {selected.approved_by && (
                  <div>
                    <div style={metaLabel}>Approved by</div>
                    <div style={metaValue}>{selected.approved_by}</div>
                  </div>
                )}
                {selected.variables.length > 0 && (
                  <div>
                    <div style={metaLabel}>Variables</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {selected.variables.map(v => (
                        <span key={v} style={{ padding: '2px 8px', background: 'rgba(96,165,250,0.08)', color: '#60a5fa', borderRadius: 5, fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{`{{${v}}}`}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Review notes */}
            {selected.review_notes && (
              <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(245,158,11,0.03)' }}>
                <div style={metaLabel}>Review notes</div>
                <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 4, lineHeight: 1.6, fontFamily: 'EB Garamond, serif' }}>{selected.review_notes}</div>
              </div>
            )}

            <div style={{ padding: '40px 22px', textAlign: 'center', color: '#374151', fontSize: 15, fontFamily: 'EB Garamond, serif' }}>
              Version {selected.version} — edit messages via the API or CLI.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const page: React.CSSProperties = { padding: '44px 52px', maxWidth: 1100, fontFamily: 'EB Garamond, Georgia, serif' }
const heading: React.CSSProperties = { fontFamily: 'Cormorant Garamond, serif', fontSize: 30, fontWeight: 600, fontStyle: 'italic', color: '#f9fafb', letterSpacing: '-0.03em' }
const sectionLabel: React.CSSProperties = { fontSize: 10, color: '#374151', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 10 }
const empty: React.CSSProperties = { padding: '32px', textAlign: 'center', color: '#374151', fontSize: 14 }
const metaLabel: React.CSSProperties = { fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }
const metaValue: React.CSSProperties = { fontSize: 14, color: '#9ca3af', fontFamily: 'EB Garamond, serif' }
const btnBase = { padding: '7px 14px', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'EB Garamond, serif' }
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 600 }
const btnAmber: React.CSSProperties = { ...btnBase, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }
const btnGreen: React.CSSProperties = { ...btnBase, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }
const btnRed: React.CSSProperties = { ...btnBase, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }
function BackIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg> }
