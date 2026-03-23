'use client'

import { useEffect, useState } from 'react'
import { api, type Prompt, type Experiment } from '@/lib/api'

export default function OverviewPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [workspace, setWorkspace] = useState<{ name: string }>({ name: '' })

  useEffect(() => {
    const ws = JSON.parse(localStorage.getItem('promptops_workspace') ?? '{}')
    setWorkspace(ws)

    Promise.all([
      api.get<{ prompts: Prompt[] }>('/v1/prompts'),
      api.get<{ experiments: Experiment[] }>('/v1/experiments'),
    ]).then(([p, e]) => {
      setPrompts(p.prompts ?? [])
      setExperiments(e.experiments ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const stats = [
    { label: 'Total Prompts', value: prompts.length, accent: '#6366f1' },
    { label: 'Active Experiments', value: experiments.filter(e => e.status === 'running').length, accent: '#10b981' },
    { label: 'Total Versions', value: prompts.reduce((a, p) => a + (p.version_count ?? 0), 0), accent: '#f59e0b' },
    { label: 'In Review', value: 0, accent: '#8b5cf6' },
  ]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{ padding: '44px 52px', maxWidth: 1100, fontFamily: 'Georgia, serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 2, height: 20, background: 'linear-gradient(180deg, #6366f1, #8b5cf6)', borderRadius: 2 }} />
          <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace' }}>
            {workspace.name || 'Workspace'}
          </span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.04em', marginBottom: 6, lineHeight: 1.1 }}>
          {greeting}
        </h1>
        <p style={{ color: '#475569', fontSize: 16, fontWeight: 400 }}>
          Here is your prompt workspace at a glance.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 44 }}>
        {stats.map(({ label, value, accent }) => (
          <div key={label} style={{
            padding: '24px',
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 14,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 14, fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {loading ? '—' : value}
            </div>
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Recent Prompts */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>Recent prompts</h2>
            <a href="/prompts" style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none', fontFamily: 'ui-monospace, monospace' }}>View all</a>
          </div>
          <div style={{ border: '1px solid #1e293b', borderRadius: 14, overflow: 'hidden', background: '#0f172a' }}>
            {loading ? (
              <div style={emptyStyle}>Loading...</div>
            ) : prompts.length === 0 ? (
              <div style={emptyStyle}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <DocIcon />
                </div>
                No prompts yet. Create your first prompt.
              </div>
            ) : prompts.slice(0, 5).map((p, i) => (
              <a key={p.id} href={`/prompts/${p.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderBottom: i < Math.min(prompts.length, 5) - 1 ? '1px solid #1e293b' : 'none',
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <DocIcon />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, color: '#f8fafc', fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#334155', fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>{p.slug}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {p.tags.slice(0, 1).map(tag => (
                      <span key={tag} style={tagStyle}>{tag}</span>
                    ))}
                    <span style={{ fontSize: 12, color: '#334155', fontFamily: 'ui-monospace, monospace' }}>v{p.version_count}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Experiments */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>Active experiments</h2>
            <a href="/experiments" style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none', fontFamily: 'ui-monospace, monospace' }}>View all</a>
          </div>
          <div style={{ border: '1px solid #1e293b', borderRadius: 14, overflow: 'hidden', background: '#0f172a' }}>
            {loading ? (
              <div style={emptyStyle}>Loading...</div>
            ) : experiments.filter(e => e.status === 'running').length === 0 ? (
              <div style={emptyStyle}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <FlaskIcon />
                </div>
                No active experiments running.
              </div>
            ) : experiments.filter(e => e.status === 'running').map((exp, i, arr) => (
              <div key={exp.id} style={{ padding: '16px 18px', borderBottom: i < arr.length - 1 ? '1px solid #1e293b' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, color: '#f8fafc', fontWeight: 600 }}>{exp.name}</div>
                    <span style={{ fontSize: 11, color: '#10b981', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>RUNNING</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#334155', fontFamily: 'ui-monospace, monospace' }}>
                    {Number(exp.impressions_a) + Number(exp.impressions_b)} impressions
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#475569', fontFamily: 'ui-monospace, monospace', minWidth: 12 }}>A</span>
                  <div style={{ flex: 1, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${exp.traffic_split}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#475569', fontFamily: 'ui-monospace, monospace', minWidth: 12 }}>B</span>
                  <span style={{ fontSize: 11, color: '#334155', fontFamily: 'ui-monospace, monospace' }}>{exp.traffic_split}/{100 - exp.traffic_split}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const DocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
)
const FlaskIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round"><path d="M9 3h6M9 3v7l-4 8a1 1 0 00.9 1.5h12.2a1 1 0 00.9-1.5L15 10V3"/></svg>
)

const emptyStyle: React.CSSProperties = { padding: '48px 24px', textAlign: 'center', color: '#334155', fontSize: 14, fontFamily: 'Georgia, serif' }
const tagStyle: React.CSSProperties = { padding: '2px 8px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: 5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }
