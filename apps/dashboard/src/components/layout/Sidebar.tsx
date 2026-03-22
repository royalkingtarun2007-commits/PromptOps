'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, FlaskConical, Key, Settings, Zap } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { href: '/',             icon: LayoutDashboard, label: 'Overview' },
  { href: '/prompts',      icon: FileText,         label: 'Prompts' },
  { href: '/experiments',  icon: FlaskConical,     label: 'Experiments' },
  { href: '/settings',     icon: Key,              label: 'API Keys' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: '#0c0c0e',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
      }}
    >
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 28, height: 28,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #7c6af7, #a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={14} color="#fff" strokeWidth={2.5} />
        </div>
        <span style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: 16,
          color: '#f4f4f5',
          letterSpacing: '-0.02em',
        }}>
          PromptOps
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        <div style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px 8px' }}>
          Workspace
        </div>
        {nav.map(({ href, icon: Icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                marginBottom: 2,
                background: active ? 'rgba(124,106,247,0.12)' : 'transparent',
                color: active ? '#a78bfa' : '#71717a',
                fontSize: 14,
                fontWeight: active ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                {label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{
        padding: '12px 20px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            color: '#52525b', fontSize: 13, cursor: 'pointer',
          }}>
            <Settings size={14} />
            Settings
          </div>
        </Link>
      </div>
    </aside>
  )
}
