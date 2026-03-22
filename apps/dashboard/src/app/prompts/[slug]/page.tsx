'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { GitBranch, CheckCircle, Clock, XCircle, Plus, ArrowLeft } from 'lucide-react'
import { api, type PromptVersion } from '@/lib/api'

const statusConfig = {
  draft:     { label: 'Draft',     color: '#71717a', bg: 'rgba(113,113,122,0.1)',  icon: Clock },
  in_review: { label: 'In Review', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   icon: Clock },
  approved:  { label: 'Approved',  color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   icon: CheckCircle },
  rejected:  { label: 'Rejected',  color: '#f87171', bg: 'rgba(248,113,113,0.1)',  icon: XCircle },
  archived:  { label: 'Archived',  color: '#52525b', bg: 'rgba(82,82,91,0.1)',     icon: Clock },
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
    } catch {
      setVersions([])
    } finally { setLoading(false) }
  }

  async function updateStatus(versionId: string, status: string) {
    setActionLoading(true)
    try {
      await api.patch(`/v1/prompts/${slug}/versions/${versionId}/status`, { status })
      fetchVersions()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status')
    } finally { setActionLoading(false) }
  }

  async function promote(versionId: string, environment: string) {
    setActionLoading(true)
    try {
      await api.post(`/v1/prompts/${slug}/promote`, { version_id: versionId, environment })
      alert(`Promoted to ${environment} successfully!`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to promote')
    } finally { setActionLoading(false) }
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100 }}>
      {/* Back */}
      <a href="/prompts" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#71717a', fontSize: 13, textDecoration: 'none', marginBottom: 24 }}>
        <ArrowLeft size={14} /> Back to prompts
      </a>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 12, color: '#7c6af7', fontFamily: 'DM Mono, monospace', marginBottom: 6 }}>{slug}</p>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 700, color: '#f4f4f5', letterSpacing: '-0.03em' }}>
            {slug}
          </h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24 }}>

        {/* Version List */}
        <div>
          <div style={{ fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Versions
          </div>
          <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#52525b', fontSize: 13 }}>Loading...</div>
            ) : versions.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#52525b', fontSize: 13 }}>No versions yet.</div>
            ) : versions.map((v, i) => {
              const cfg = statusConfig[v.status] ?? statusConfig.draft
              const Icon = cfg.icon
              const isSelected = selected?.id === v.id
              return (
                <div
                  key={v.id}
                  onClick={() => setSelected(v)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: i < versions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: isSelected ? 'rgba(124,106,247,0.08)' : 'transparent',
                    cursor: 'pointer',
                    borderLeft: isSelected ? '2px solid #7c6af7' : '2px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <GitBranch size={13} color={isSelected ? '#7c6af7' : '#52525b'} />
                      <span style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: isSelected ? '#a78bfa' : '#f4f4f5' }}>
                        {v.version}
                      </span>
                    </div>
                    <span style={{ padding: '2px 6px', background: cfg.bg, color: cfg.color, borderRadius: 4, fontSize: 10 }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>
                    {new Date(v.created_at).toLocaleDateString()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Version Detail */}
        {selected && (
          <div>
            <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Version header */}
              <div style={{
                padding: '16px 20px',
                background: '#0f0f11',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#a78bfa' }}>{selected.version}</span>
                  <span style={{
                    padding: '3px 8px',
                    background: (statusConfig[selected.status] ?? statusConfig.draft).bg,
                    color: (statusConfig[selected.status] ?? statusConfig.draft).color,
                    borderRadius: 6, fontSize: 11,
                  }}>
                    {(statusConfig[selected.status] ?? statusConfig.draft).label}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {selected.status === 'draft' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'in_review')}
                      disabled={actionLoading}
                      style={{ padding: '7px 14px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, color: '#fbbf24', fontSize: 13, cursor: 'pointer' }}
                    >
                      Submit for Review
                    </button>
                  )}
                  {selected.status === 'in_review' && (
                    <>
                      <button
                        onClick={() => updateStatus(selected.id, 'rejected')}
                        disabled={actionLoading}
                        style={{ padding: '7px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13, cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => updateStatus(selected.id, 'approved')}
                        disabled={actionLoading}
                        style={{ padding: '7px 14px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, color: '#4ade80', fontSize: 13, cursor: 'pointer' }}
                      >
                        Approve
                      </button>
                    </>
                  )}
                  {selected.status === 'approved' && (
                    <button
                      onClick={() => promote(selected.id, 'production')}
                      disabled={actionLoading}
                      style={{ padding: '7px 14px', background: '#7c6af7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                    >
                      Promote to Production
                    </button>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 32 }}>
                {selected.approved_by && (
                  <div>
                    <div style={{ fontSize: 11, color: '#52525b', marginBottom: 3 }}>Approved by</div>
                    <div style={{ fontSize: 13, color: '#a1a1aa' }}>{selected.approved_by}</div>
                  </div>
                )}
                {selected.variables.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#52525b', marginBottom: 3 }}>Variables</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {selected.variables.map(v => (
                        <span key={v} style={{ padding: '2px 7px', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderRadius: 5, fontSize: 12, fontFamily: 'DM Mono, monospace' }}>
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Review notes */}
              {selected.review_notes && (
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(251,191,36,0.04)' }}>
                  <div style={{ fontSize: 11, color: '#52525b', marginBottom: 4 }}>Review notes</div>
                  <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>{selected.review_notes}</div>
                </div>
              )}

              {/* Empty state for no messages */}
              <div style={{ padding: 32, textAlign: 'center', color: '#52525b', fontSize: 14 }}>
                <GitBranch size={24} style={{ margin: '0 auto 10px', display: 'block', color: '#27272a' }} />
                Version {selected.version} — edit messages in your code editor or via the API.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
