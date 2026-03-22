const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const key = typeof window !== 'undefined' ? localStorage.getItem('promptops_key') : null
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// ── Types matching the API ─────────────────────

export interface Prompt {
  id: string
  slug: string
  name: string
  description?: string
  tags: string[]
  version_count: number
  created_at: string
  updated_at: string
}

export interface PromptVersion {
  id: string
  version: string
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'archived'
  variables: string[]
  review_notes?: string
  created_by?: string
  approved_by?: string
  approved_at?: string
  created_at: string
}

export interface Experiment {
  id: string
  slug: string
  name: string
  status: 'running' | 'paused' | 'completed'
  traffic_split: number
  winner?: 'A' | 'B'
  impressions_a: number
  impressions_b: number
  created_at: string
}