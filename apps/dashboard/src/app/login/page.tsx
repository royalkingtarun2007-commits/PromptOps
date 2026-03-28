'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Eye, EyeOff, AlertCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdKey, setCreatedKey] = useState('')

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    workspaceName: '',
    workspaceSlug: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    // Auto generate workspace slug from name
    if (field === 'workspaceName') {
      setForm(f => ({
        ...f,
        workspaceName: value,
        workspaceSlug: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      }))
    }
  }

  async function submit() {
    setError('')
    setLoading(true)

    try {
      const endpoint = mode === 'register' ? '/v1/auth/register' : '/v1/auth/login'
      const body = mode === 'register'
  ? { 
      email: form.email, 
      password: form.password, 
      name: form.name, 
      workspaceName: form.workspaceName,   // must be camelCase
      workspaceSlug: form.workspaceSlug    // must be camelCase
    }
  : { email: form.email, password: form.password }

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? 'Something went wrong.')
        return
      }

      // Save API key and redirect
      localStorage.setItem('promptops_key', data.apiKey)
      localStorage.setItem('promptops_workspace', JSON.stringify(data.workspace))

      if (mode === 'register') {
        setCreatedKey(data.apiKey)
      } else {
        router.push('/')
      }
    } catch {
      setError('Could not connect to server. Make sure PromptOps API is running.')
    } finally {
      setLoading(false)
    }
  }

  // Show key after register
  if (createdKey) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 440, background: '#111113', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 36 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(74,222,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Zap size={20} color="#4ade80" />
          </div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#f4f4f5', marginBottom: 8 }}>
            Workspace created!
          </h2>
          <p style={{ fontSize: 14, color: '#71717a', marginBottom: 24, lineHeight: 1.6 }}>
            Your API key has been generated. <strong style={{ color: '#f87171' }}>Copy it now</strong> — it will not be shown again.
          </p>

          <div style={{ background: '#18181b', border: '1px solid rgba(124,106,247,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: '#52525b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your API Key</div>
            <code style={{ fontSize: 12, color: '#a78bfa', fontFamily: 'DM Mono, monospace', wordBreak: 'break-all', lineHeight: 1.6 }}>
              {createdKey}
            </code>
          </div>

          <button
            onClick={() => { navigator.clipboard.writeText(createdKey) }}
            style={{ width: '100%', padding: '10px', background: 'rgba(124,106,247,0.1)', border: '1px solid rgba(124,106,247,0.2)', borderRadius: 8, color: '#a78bfa', fontSize: 14, cursor: 'pointer', marginBottom: 12 }}
          >
            Copy to clipboard
          </button>

          <button
            onClick={() => router.push('/')}
            style={{ width: '100%', padding: '10px', background: '#7c6af7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c6af7, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: '#f4f4f5', letterSpacing: '-0.02em' }}>PromptOps</span>
          </div>
          <p style={{ fontSize: 14, color: '#52525b' }}>Git for Prompts</p>
        </div>

        {/* Card */}
        <div style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 32 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: '#18181b', borderRadius: 10, padding: 4, marginBottom: 28 }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                style={{
                  flex: 1, padding: '8px', borderRadius: 7, border: 'none',
                  background: mode === m ? '#27272a' : 'transparent',
                  color: mode === m ? '#f4f4f5' : '#52525b',
                  fontSize: 14, fontWeight: mode === m ? 500 : 400,
                  cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, marginBottom: 20 }}>
              <AlertCircle size={14} color="#f87171" />
              <span style={{ fontSize: 13, color: '#f87171' }}>{error}</span>
            </div>
          )}

          {/* Register-only fields */}
          {mode === 'register' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>Your name</label>
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Tarun Dev"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>Workspace name</label>
                <input
                  value={form.workspaceName}
                  onChange={e => set('workspaceName', e.target.value)}
                  placeholder="Acme Corp"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>Workspace slug</label>
                <input
                  value={form.workspaceSlug}
                  onChange={e => set('workspaceSlug', e.target.value)}
                  placeholder="acme-corp"
                  style={{ ...inputStyle, fontFamily: 'DM Mono, monospace', fontSize: 13 }}
                />
              </div>
            </>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="you@company.com"
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <button
                onClick={() => setShowPassword(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#52525b' }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={submit}
            disabled={loading}
            style={{
              width: '100%', padding: '11px',
              background: loading ? '#4a3f8f' : '#7c6af7',
              border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 15, fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create workspace'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#3f3f46', marginTop: 20 }}>
          Open source · Self-hosted · MIT License
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#18181b',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#f4f4f5',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'DM Sans, sans-serif',
}
