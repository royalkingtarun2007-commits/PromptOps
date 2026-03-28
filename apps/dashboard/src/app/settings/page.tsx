'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at?: string
  expires_at?: string
  created_at: string
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('promptops_key')
    if (stored) setApiKeyInput(stored)
    fetchKeys()
  }, [])

  async function fetchKeys() {
    try {
      const data = await api.get<{ apiKeys: ApiKey[] }>('/v1/api-keys')
      setKeys(data.apiKeys ?? [])
    } catch { setKeys([]) }
    finally { setLoading(false) }
  }

  function saveKey() {
    localStorage.setItem('promptops_key', apiKeyInput)
    alert('API key saved.')
  }

  async function createKey() {
    if (!newKeyName) return
    setCreating(true)
    try {
      const data = await api.post<{ key: string } & ApiKey>('/v1/api-keys', { name: newKeyName })
      setCreatedKey(data.key)
      fetchKeys()
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed') }
    finally { setCreating(false) }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    await api.delete(`/v1/api-keys/${id}`)
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  function copyCreatedKey() {
    if (!createdKey) return
    navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={page}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={heading}>API Keys</h1>
        <p style={sub}>Manage access keys for your workspace.</p>
      </div>

      {/* Active key */}
      <div style={card}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,#6366f1,transparent)' }} />
        <h2 style={cardHeading}>Active key</h2>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 18 }}>Used by the dashboard to make API calls. Stored in your browser only.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="po_live_..."
              style={{ ...input, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, paddingRight: 40 }}
            />
            <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }}>
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <button onClick={saveKey} style={btnPrimary}>Save</button>
        </div>
      </div>

      {/* Keys list */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: '#f9fafb' }}>All keys</h2>
        <button onClick={() => setShowCreate(true)} style={btnGhost}>
          <PlusIcon /> New Key
        </button>
      </div>

      <div style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, overflow: 'hidden', background: '#0c1122' }}>
        {loading ? (
          <div style={empty}>Loading...</div>
        ) : keys.length === 0 ? (
          <div style={{ ...empty, flexDirection: 'column' as const, display: 'flex', alignItems: 'center' }}>
            <KeyIcon />
            <p style={{ marginTop: 12, color: '#374151', fontFamily: 'EB Garamond, serif' }}>No API keys yet.</p>
          </div>
        ) : keys.map((key, i) => (
          <div key={key.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '15px 22px',
            borderBottom: i < keys.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KeyIcon small />
              </div>
              <div>
                <div style={{ fontSize: 15, color: '#f9fafb', fontFamily: 'EB Garamond, serif', fontWeight: 600 }}>{key.name}</div>
                <div style={{ fontSize: 12, color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{key.key_prefix}...</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ fontSize: 12, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
                {key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}` : 'Never used'}
              </span>
              <button onClick={() => revokeKey(key.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: 4 }}>
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={overlay}>
          <div style={modal}>
            {createdKey ? (
              <>
                <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontStyle: 'italic', fontWeight: 600, color: '#10b981', marginBottom: 8 }}>Key created</h2>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>Copy this key now. It will not be shown again.</p>
                <div style={{ background: '#0a0f1e', border: '1px solid #1f2937', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>API Key</div>
                  <code style={{ fontSize: 12, color: '#a5b4fc', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' as const, lineHeight: 1.7 }}>{createdKey}</code>
                </div>
                <button onClick={copyCreatedKey} style={{ ...btnGhost, width: '100%', justifyContent: 'center', marginBottom: 10 }}>
                  {copied ? 'Copied' : 'Copy to clipboard'}
                </button>
                <button onClick={() => { setShowCreate(false); setCreatedKey(null); setNewKeyName('') }} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>
                  Done
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontStyle: 'italic', fontWeight: 600, color: '#f9fafb', marginBottom: 20 }}>Create API key</h2>
                <label style={labelStyle}>Key name</label>
                <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Production Key" style={{ ...input, marginBottom: 20 }} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowCreate(false)} style={btnGhostSm}>Cancel</button>
                  <button onClick={createKey} disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}>
                    {creating ? 'Creating...' : 'Create Key'}
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

const page: React.CSSProperties = { padding: '44px 52px', maxWidth: 800, fontFamily: 'EB Garamond, Georgia, serif' }
const heading: React.CSSProperties = { fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 600, fontStyle: 'italic', color: '#f9fafb', letterSpacing: '-0.03em', marginBottom: 6 }
const sub: React.CSSProperties = { color: '#4b5563', fontSize: 16 }
const card: React.CSSProperties = { padding: '24px 26px', background: '#0c1122', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 32, position: 'relative', overflow: 'hidden' }
const cardHeading: React.CSSProperties = { fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: '#f9fafb', marginBottom: 6 }
const input: React.CSSProperties = { width: '100%', padding: '10px 14px', background: '#0a0f1e', border: '1px solid #1f2937', borderRadius: 9, color: '#f9fafb', fontSize: 14, outline: 'none', fontFamily: 'EB Garamond, serif' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }
const empty: React.CSSProperties = { padding: '48px 24px', textAlign: 'center', color: '#374151', fontSize: 14 }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
const modal: React.CSSProperties = { background: '#0c1122', border: '1px solid #1f2937', borderRadius: 16, padding: '32px 36px', width: 440 }
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'EB Garamond, serif' }
const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'transparent', border: '1px solid #1f2937', borderRadius: 9, color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'EB Garamond, serif' }
const btnGhostSm: React.CSSProperties = { padding: '9px 16px', background: 'transparent', border: '1px solid #1f2937', borderRadius: 9, color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'EB Garamond, serif' }

function PlusIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function KeyIcon({ small }: { small?: boolean }) { return <svg width={small ? 14 : 24} height={small ? 14 : 24} viewBox="0 0 24 24" fill="none" stroke={small ? '#6366f1' : '#1f2937'} strokeWidth="1.8" strokeLinecap="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg> }
function EyeIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function EyeOffIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> }
