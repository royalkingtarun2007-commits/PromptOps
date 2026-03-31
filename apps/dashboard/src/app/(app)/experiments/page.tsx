'use client'

import { useEffect, useState } from 'react'
import { api, type Experiment } from '@/lib/api'

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ experiments: Experiment[] }>('/v1/experiments')
      .then(d => setExperiments(d.experiments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function declareWinner(slug: string, winner: 'A' | 'B') {
    try {
      await api.post(`/v1/experiments/${slug}/winner`, { winner })
      setExperiments(prev => prev.map(e => e.slug === slug ? { ...e, winner, status: 'completed' } : e))
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed') }
  }

  return (
    <div style={page}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={heading}>A/B Experiments</h1>
        <p style={sub}>Compare prompt versions on real traffic. Declare a winner when ready.</p>
      </div>

      {loading ? (
        <div style={empty}>Loading...</div>
      ) : experiments.length === 0 ? (
        <div style={{ ...empty, flexDirection: 'column' as const, display: 'flex', alignItems: 'center', padding: '80px 24px' }}>
          <FlaskIcon />
          <p style={{ color: '#374151', fontSize: 16, marginTop: 16, fontFamily: 'EB Garamond, serif' }}>No experiments yet.</p>
          <p style={{ color: '#1f2937', fontSize: 13, marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>Start one via the API using client.ab()</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {experiments.map(exp => {
            const total = Number(exp.impressions_a) + Number(exp.impressions_b)
            const pctA = total > 0 ? Math.round((Number(exp.impressions_a) / total) * 100) : 50
            const pctB = 100 - pctA

            return (
              <div key={exp.id} style={card}>
                {/* Top accent */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: exp.status === 'running' ? 'linear-gradient(90deg,transparent,#6366f1,transparent)' : 'transparent' }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: '#f9fafb' }}>{exp.name}</span>
                      <span style={{
                        padding: '2px 9px', borderRadius: 6, fontSize: 10,
                        fontFamily: 'JetBrains Mono, monospace',
                        background: exp.status === 'running' ? 'rgba(16,185,129,0.1)' : 'rgba(75,85,99,0.1)',
                        color: exp.status === 'running' ? '#10b981' : '#6b7280',
                        textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                      }}>
                        {exp.status}
                      </span>
                      {exp.winner && (
                        <span style={{ padding: '2px 9px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: 6, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                          Variant {exp.winner} won
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>{exp.slug}</span>
                  </div>
                  <span style={{ fontSize: 13, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>{total.toLocaleString()} impressions</span>
                </div>

                {/* A/B bars */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  {(['A', 'B'] as const).map(variant => {
                    const count = variant === 'A' ? Number(exp.impressions_a) : Number(exp.impressions_b)
                    const pct = variant === 'A' ? pctA : pctB
                    const isWinner = exp.winner === variant
                    return (
                      <div key={variant} style={{
                        padding: '16px 18px',
                        background: isWinner ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isWinner ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: 11,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: isWinner ? '#a5b4fc' : '#f9fafb' }}>Variant {variant}</span>
                          <span style={{ fontSize: 12, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>{count.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: isWinner ? 'linear-gradient(90deg,#6366f1,#8b5cf6)' : '#1f2937', borderRadius: 2, transition: 'width 0.6s ease' }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>{pct}% of traffic</span>
                      </div>
                    )
                  })}
                </div>

                {exp.status === 'running' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>Declare winner:</span>
                    {(['A', 'B'] as const).map(v => (
                      <button key={v} onClick={() => declareWinner(exp.slug, v)} style={{
                        padding: '7px 16px',
                        background: 'rgba(99,102,241,0.08)',
                        border: '1px solid rgba(99,102,241,0.18)',
                        borderRadius: 8, color: '#818cf8',
                        fontSize: 13, cursor: 'pointer',
                        fontFamily: 'EB Garamond, serif',
                      }}>
                        Variant {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const page: React.CSSProperties = { padding: '44px 52px', maxWidth: 1100, fontFamily: 'EB Garamond, Georgia, serif' }
const heading: React.CSSProperties = { fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 600, fontStyle: 'italic', color: '#f9fafb', letterSpacing: '-0.03em', marginBottom: 6 }
const sub: React.CSSProperties = { color: '#4b5563', fontSize: 16 }
const empty: React.CSSProperties = { textAlign: 'center', color: '#374151', fontSize: 15, padding: '48px 24px' }
const card: React.CSSProperties = { padding: '24px 26px', background: '#0c1122', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, position: 'relative', overflow: 'hidden' }
function FlaskIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round"><path d="M9 3h6M9 3v7l-4 8a1 1 0 00.9 1.5h12.2a1 1 0 00.9-1.5L15 10V3"/></svg> }
