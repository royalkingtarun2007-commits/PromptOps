// ─────────────────────────────────────────────
//  PromptOps SDK — Cache
//  In-memory LRU-style cache for fetched prompts.
//  Reduces latency for hot paths in production.
// ─────────────────────────────────────────────

import type { RawPrompt } from './types'

interface CacheEntry {
  prompt: RawPrompt
  expiresAt: number
}

export class PromptCache {
  private store = new Map<string, CacheEntry>()
  /** Cache TTL in milliseconds. Default: 5 minutes */
  private ttl: number

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttl = ttlMs
  }

  key(slug: string, env: string, version?: string): string {
    return version ? `${slug}::${version}` : `${slug}::env:${env}`
  }

  get(slug: string, env: string, version?: string): RawPrompt | null {
    const entry = this.store.get(this.key(slug, env, version))
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(this.key(slug, env, version))
      return null
    }
    return entry.prompt
  }

  set(slug: string, env: string, prompt: RawPrompt, version?: string): void {
    this.store.set(this.key(slug, env, version), {
      prompt,
      expiresAt: Date.now() + this.ttl,
    })
  }

  invalidate(slug: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(`${slug}::`)) {
        this.store.delete(key)
      }
    }
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}