'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Copy, Eye, EyeOff, Key } from 'lucide-react'
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
    alert('API key saved to browser storage.')
  }

  async function createKey() {
    if (!newKeyName) return
    setCreating(true)
    try {
      const data = await api.post<{ key: string } & ApiKey>('/v1/api-keys', { name: newKeyName })
      setCreatedKey(data.key)
      fetchKeys()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create key')
    } finally { setCreating(false) }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    await api.delete(`/v1/api-keys/${id}`)
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 800 }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 12, color: '#7c6af7', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>// Settings</p>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 700, color: '#f4f4f5', letterSpacing: '-0.03em' }}>API Keys</h1>
        <p style={{ color: '#71717a', fontSize: 15, marginTop: 6 }}>Manage API keys for your workspace.</p>
      </div>

      {/* Active key input */}
      <div style={{ padding: 24, background: '#111113', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 600, color: '#f4f4f5', marginBottom: 4 }}>Active API Key</h2>
        <p style={{ fontSize: 13, color: '#71717a', marginBottom: 16 }}>This key is used by the dashboard to make API calls. Stored in your browser only.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="po_live_..."
              style={{ width: '100%', padding: '9px 40px 9px 12px', background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f4f4f5', fontSize: 14, outline: 'none', fontFamily: 'DM Mono, monospace' }}
            />
            <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#52525b' }}>
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button onClick={saveKey} style={{ padding: '9px 18px', background: '#7c6af7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Save
          </button>
        </div>
      </div>

      {/* Keys list */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 600, color: '#f4f4f5' }}>All Keys</h2>
        <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(124,106,247,0.1)', border: '1px solid rgba(124,106,247,0.2)', borderRadius: 8, color: '#a78bfa', fontSize: 13, cursor: 'pointer' }}>
          <Plus size={14} /> New Key
        </button>
      </div>

      <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#52525b', fontSize: 14 }}>Loading...</div>
        ) : keys.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Key size={28} color="#27272a" style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ color: '#52525b', fontSize: 14 }}>No API keys yet. Create one to get started.</p>
          </div>
        ) : keys.map((key, i) => (
          <div key={key.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: i < keys.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,106,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={13} color="#7c6af7" />
              </div>
              <div>
                <div style={{ fontSize: 14, color: '#f4f4f5', fontWeight: 500 }}>{key.name}</div>
                <div style={{ fontSize: 12, color: '#52525b', fontFamily: 'DM Mono, monospace', marginTop: 1 }}>{key.key_prefix}...</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 12, color: '#52525b' }}>
                {key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}` : 'Never used'}
              </span>
              <button onClick={() => revokeKey(key.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 4, display: 'flex', alignItems: 'center' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create key modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, width: 420 }}>
            {createdKey ? (
              <>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>Key Created!</h2>
                <p style={{ fontSize: 13, color: '#71717a', marginBottom: 16 }}>Copy this key now. It will <strong style={{ color: '#f4f4f5' }}>not</strong> be shown again.</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 20 }}>
                  <code style={{ flex: 1, fontSize: 12, color: '#a78bfa', fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' }}>{createdKey}</code>
                  <button onClick={() => navigator.clipboard.writeText(createdKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', flexShrink: 0 }}>
                    <Copy size={14} />
                  </button>
                </div>
                <button onClick={() => { setShowCreate(false); setCreatedKey(null); setNewKeyName('') }} style={{ width: '100%', padding: '10px', background: '#7c6af7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  Done
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: '#f4f4f5', marginBottom: 20 }}>Create API Key</h2>
                <label style={{ display: 'block', fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>Key Name</label>
                <input
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Production Key"
                  style={{ width: '100%', padding: '9px 12px', background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f4f4f5', fontSize: 14, outline: 'none', marginBottom: 20 }}
                />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#71717a', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={createKey} disabled={creating} style={{ padding: '9px 18px', background: '#7c6af7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', opacity: creating ? 0.6 : 1 }}>
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
