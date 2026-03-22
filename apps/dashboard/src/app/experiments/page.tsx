'use client'

import { useEffect, useState } from 'react'
import { FlaskConical, Trophy } from 'lucide-react'
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    }
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 12, color: '#7c6af7', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>// Experiments</p>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 700, color: '#f4f4f5', letterSpacing: '-0.03em' }}>A/B Tests</h1>
        <p style={{ color: '#71717a', fontSize: 15, marginTop: 6 }}>Compare prompt versions on real traffic. Declare a winner when ready.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#52525b', padding: 64 }}>Loading...</div>
      ) : experiments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <FlaskConical size={36} color="#27272a" style={{ margin: '0 auto 14px', display: 'block' }} />
          <p style={{ color: '#52525b', fontSize: 15 }}>No experiments yet.</p>
          <p style={{ color: '#3f3f46', fontSize: 13, marginTop: 4 }}>Start an A/B test via the API using client.ab()</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {experiments.map(exp => {
            const totalImpressions = Number(exp.impressions_a) + Number(exp.impressions_b)
            const pctA = totalImpressions > 0 ? Math.round((Number(exp.impressions_a) / totalImpressions) * 100) : 50
            const pctB = 100 - pctA

            return (
              <div key={exp.id} style={{
                padding: 24,
                background: '#111113',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#f4f4f5', fontFamily: 'Syne, sans-serif' }}>{exp.name}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 11,
                        background: exp.status === 'running' ? 'rgba(74,222,128,0.1)' : 'rgba(113,113,122,0.1)',
                        color: exp.status === 'running' ? '#4ade80' : '#71717a',
                      }}>
                        {exp.status}
                      </span>
                      {exp.winner && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderRadius: 6, fontSize: 11 }}>
                          <Trophy size={10} /> Variant {exp.winner} won
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: '#52525b', fontFamily: 'DM Mono, monospace' }}>{exp.slug}</span>
                  </div>
                  <span style={{ fontSize: 13, color: '#71717a' }}>{totalImpressions.toLocaleString()} impressions</span>
                </div>

                {/* A/B Bars */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  {(['A', 'B'] as const).map(variant => {
                    const count = variant === 'A' ? Number(exp.impressions_a) : Number(exp.impressions_b)
                    const pct = variant === 'A' ? pctA : pctB
                    const isWinner = exp.winner === variant
                    return (
                      <div key={variant} style={{
                        padding: '14px 16px',
                        background: isWinner ? 'rgba(124,106,247,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isWinner ? 'rgba(124,106,247,0.25)' : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: 10,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: isWinner ? '#a78bfa' : '#f4f4f5' }}>Variant {variant}</span>
                          <span style={{ fontSize: 13, color: '#71717a' }}>{count.toLocaleString()} impressions</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: isWinner ? '#7c6af7' : '#3f3f46', borderRadius: 3, transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#71717a' }}>{pct}% of traffic</span>
                      </div>
                    )
                  })}
                </div>

                {/* Declare winner buttons */}
                {exp.status === 'running' && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 13, color: '#52525b', marginRight: 4, alignSelf: 'center' }}>Declare winner:</span>
                    {(['A', 'B'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => declareWinner(exp.slug, v)}
                        style={{
                          padding: '7px 16px',
                          background: 'rgba(124,106,247,0.1)',
                          border: '1px solid rgba(124,106,247,0.2)',
                          borderRadius: 8, color: '#a78bfa', fontSize: 13, cursor: 'pointer',
                        }}
                      >
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
