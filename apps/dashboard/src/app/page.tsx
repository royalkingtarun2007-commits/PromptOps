'use client'

import { useEffect, useState } from 'react'
import { FileText, FlaskConical, GitBranch, CheckCircle } from 'lucide-react'
import { api, type Prompt, type Experiment } from '@/lib/api'

export default function OverviewPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<{ prompts: Prompt[] }>('/v1/prompts'),
      api.get<{ experiments: Experiment[] }>('/v1/experiments'),
    ]).then(([p, e]) => {
      setPrompts(p.prompts ?? [])
      setExperiments(e.experiments ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const stats = [
    { label: 'Total Prompts',      value: prompts.length,                                     icon: FileText,     color: '#7c6af7' },
    { label: 'Active Experiments', value: experiments.filter(e => e.status === 'running').length, icon: FlaskConical, color: '#4ade80' },
    { label: 'Total Versions',     value: prompts.reduce((a, p) => a + (p.version_count ?? 0), 0), icon: GitBranch,    color: '#60a5fa' },
    { label: 'Approved',           value: 0,                                                   icon: CheckCircle,  color: '#fbbf24' },
  ]

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 12, color: '#7c6af7', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          // Overview
        </p>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 700, color: '#f4f4f5', letterSpacing: '-0.03em', marginBottom: 6 }}>
          Good morning
        </h1>
        <p style={{ color: '#71717a', fontSize: 15 }}>
          Your prompt workspace at a glance.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{
            padding: '20px 24px',
            background: '#111113',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#71717a' }}>{label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} color={color} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#f4f4f5' }}>
              {loading ? '—' : value}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Prompts */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 600, color: '#f4f4f5' }}>Recent prompts</h2>
          <a href="/prompts" style={{ fontSize: 13, color: '#7c6af7', textDecoration: 'none' }}>View all →</a>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#52525b', fontSize: 14 }}>Loading...</div>
          ) : prompts.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#52525b', fontSize: 14 }}>
              No prompts yet. Create your first prompt to get started.
            </div>
          ) : (
            prompts.slice(0, 5).map((p, i) => (
              <a key={p.id} href={`/prompts/${p.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderBottom: i < Math.min(prompts.length, 5) - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: 'transparent',
                  transition: 'background 0.15s',
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,106,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={14} color="#7c6af7" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, color: '#f4f4f5', fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#52525b', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>{p.slug}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {p.tags.slice(0, 2).map(tag => (
                      <span key={tag} style={{ padding: '3px 8px', background: 'rgba(124,106,247,0.1)', color: '#a78bfa', borderRadius: 6, fontSize: 11, fontFamily: 'DM Mono, monospace' }}>
                        {tag}
                      </span>
                    ))}
                    <span style={{ fontSize: 12, color: '#52525b' }}>{p.version_count} versions</span>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </div>

      {/* Active Experiments */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 600, color: '#f4f4f5' }}>Active experiments</h2>
          <a href="/experiments" style={{ fontSize: 13, color: '#7c6af7', textDecoration: 'none' }}>View all →</a>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#52525b', fontSize: 14 }}>Loading...</div>
          ) : experiments.filter(e => e.status === 'running').length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#52525b', fontSize: 14 }}>
              No active experiments. Start an A/B test from a prompt page.
            </div>
          ) : (
            experiments.filter(e => e.status === 'running').map((exp, i, arr) => (
              <div key={exp.id} style={{
                padding: '16px 20px',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 14, color: '#f4f4f5', fontWeight: 500 }}>{exp.name}</span>
                    <span style={{ marginLeft: 10, padding: '2px 8px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', borderRadius: 6, fontSize: 11 }}>running</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#52525b' }}>{Number(exp.impressions_a) + Number(exp.impressions_b)} impressions</span>
                </div>
                {/* A/B bar */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#71717a', minWidth: 16 }}>A</span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${exp.traffic_split}%`, background: '#7c6af7', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#71717a', minWidth: 16 }}>B</span>
                  <span style={{ fontSize: 12, color: '#52525b' }}>{exp.traffic_split}/{100 - exp.traffic_split}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
