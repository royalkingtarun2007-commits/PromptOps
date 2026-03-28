'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const nav = [
  { href: '/',            label: 'Overview',    icon: OverviewIcon },
  { href: '/prompts',     label: 'Prompts',     icon: PromptsIcon },
  { href: '/experiments', label: 'Experiments', icon: ExperimentsIcon },
  { href: '/settings',    label: 'API Keys',    icon: KeyIcon },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  function logout() {
    localStorage.removeItem('promptops_key')
    localStorage.removeItem('promptops_workspace')
    router.push('/login')
  }

  const workspace = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('promptops_workspace') ?? '{}')
    : {}

  return (
    <aside style={{
      width: 230, minWidth: 230,
      background: '#030712',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{
        padding: '22px 24px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{
          fontFamily: 'Cormorant Garamond, Georgia, serif',
          fontWeight: 600,
          fontStyle: 'italic',
          fontSize: 20,
          letterSpacing: '0.06em',
          background: 'linear-gradient(135deg, #f9fafb, #a5b4fc)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 4,
        }}>
          PromptOps
        </div>
        {workspace.name && (
          <div style={{
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#374151',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {workspace.name}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        <div style={{
          fontSize: 10, color: '#1f2937',
          fontFamily: 'JetBrains Mono, monospace',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '0 10px 10px',
        }}>
          Navigation
        </div>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 12px',
                borderRadius: 9,
                marginBottom: 3,
                background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
                color: active ? '#a5b4fc' : '#4b5563',
                fontSize: 15,
                fontFamily: 'EB Garamond, Georgia, serif',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                <Icon active={active} />
                {label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{
        padding: '14px 12px 22px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <button onClick={logout} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '9px 12px',
          borderRadius: 9, border: 'none',
          background: 'transparent',
          color: '#374151',
          fontSize: 14,
          fontFamily: 'EB Garamond, Georgia, serif',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}>
          <LogoutIcon />
          Sign out
        </button>
      </div>
    </aside>
  )
}

const ic = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const }

function OverviewIcon({ active }: { active: boolean }) {
  return <svg {...ic} strokeWidth={active ? 2 : 1.5}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function PromptsIcon({ active }: { active: boolean }) {
  return <svg {...ic} strokeWidth={active ? 2 : 1.5}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function ExperimentsIcon({ active }: { active: boolean }) {
  return <svg {...ic} strokeWidth={active ? 2 : 1.5}><path d="M9 3h6M9 3v7l-4 8a1 1 0 00.9 1.5h12.2a1 1 0 00.9-1.5L15 10V3"/></svg>
}
function KeyIcon({ active }: { active: boolean }) {
  return <svg {...ic} strokeWidth={active ? 2 : 1.5}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
}
function LogoutIcon() {
  return <svg {...ic}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
