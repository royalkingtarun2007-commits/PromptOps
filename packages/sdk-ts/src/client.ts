// ─────────────────────────────────────────────
//  PromptOps SDK — Client
//  The main entry point developers use.
// ─────────────────────────────────────────────

import type {
  PromptOpsConfig,
  GetPromptOptions,
  ABTestOptions,
  RawPrompt,
  Environment,
} from './types'

import { Prompt } from './prompt'
import { PromptCache } from './cache'
import {
  PromptOpsError,
  PromptOpsNotFoundError,
  PromptOpsUnauthorizedError,
  PromptOpsTimeoutError,
  PromptOpsNetworkError,
} from './errors'

const DEFAULT_BASE_URL = 'https://api.promptops.dev'
const DEFAULT_TIMEOUT  = 5_000
const DEFAULT_RETRIES  = 2
const DEFAULT_ENV      = 'production'

export class PromptOps {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly defaultEnv: Environment
  private readonly timeout: number
  private readonly retries: number
  private readonly cache: PromptCache

  constructor(config: PromptOpsConfig) {
    if (!config.apiKey) {
      throw new PromptOpsError(
        'apiKey is required. Pass it directly or set the PROMPTOPS_KEY environment variable.',
        'UNAUTHORIZED'
      )
    }

    this.apiKey     = config.apiKey
    this.baseUrl    = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.defaultEnv = config.defaultEnv ?? DEFAULT_ENV
    this.timeout    = config.timeout ?? DEFAULT_TIMEOUT
    this.retries    = config.retries ?? DEFAULT_RETRIES
    this.cache      = new PromptCache()
  }

  // ── Public API ──────────────────────────────

  /**
   * Fetch a prompt by its slug.
   *
   * @example
   * const prompt = await client.get('summarise-email', { env: 'production' })
   * const messages = prompt.compile({ email: body })
   */
  async get(slug: string, options: GetPromptOptions = {}): Promise<Prompt> {
    const env     = options.env ?? this.defaultEnv
    const version = options.version

    // Try cache first (unless fresh is requested)
    if (!options.fresh) {
      const cached = this.cache.get(slug, env, version)
      if (cached) return new Prompt(cached)
    }

    try {
      const raw = await this.fetchWithRetry(slug, env, version)
      this.cache.set(slug, env, raw, version)
      return new Prompt(raw)
    } catch (err) {
      // If we have a fallback, use it silently on network errors
      if (options.fallback && err instanceof PromptOpsNetworkError) {
        console.warn(`[PromptOps] Network error fetching "${slug}", using fallback.`)
        return new Prompt({
          metadata: {
            slug,
            name: slug,
            version: 'fallback',
            env,
            workspace: 'unknown',
            approvedAt: new Date().toISOString(),
            approvedBy: 'system',
            tags: [],
            variables: [],
          },
          messages: options.fallback,
        })
      }
      throw err
    }
  }

  /**
   * Fetch multiple prompts in a single request. Much faster than calling get() in a loop.
   *
   * @example
   * const [welcome, summary] = await client.getMany(['welcome-email', 'summary'])
   */
  async getMany(slugs: string[], options: Omit<GetPromptOptions, 'version' | 'fallback'> = {}): Promise<Prompt[]> {
    return Promise.all(slugs.map(slug => this.get(slug, options)))
  }

  /**
   * A/B test two prompt versions against each other.
   * Routes the user to version A or B based on a stable hash of their userId.
   * The assignment is consistent — the same user always gets the same variant.
   *
   * @example
   * const prompt = await client.ab('checkout-message', {
   *   experiment: 'checkout-copy-test',
   *   userId: session.userId,
   * })
   */
  async ab(slug: string, options: ABTestOptions): Promise<Prompt & { variant: 'A' | 'B' }> {
    const variant = this.bucket(options.userId, options.experiment)
    const env = `ab:${options.experiment}:${variant}` as Environment
    const prompt = await this.get(slug, { env })

    // Record the impression for analytics
    void this.trackImpression(slug, options.experiment, variant, options.userId)

    return Object.assign(prompt, { variant })
  }

  /**
   * Invalidate the local cache for a specific prompt slug.
   * Useful after pushing a new version from your dashboard.
   */
  invalidateCache(slug: string): void {
    this.cache.invalidate(slug)
  }

  /**
   * Clear the entire local prompt cache.
   */
  clearCache(): void {
    this.cache.clear()
  }

  // ── Private ──────────────────────────────────

  private async fetchWithRetry(
    slug: string,
    env: string,
    version?: string,
    attempt = 0
  ): Promise<RawPrompt> {
    const url = version
      ? `${this.baseUrl}/v1/prompts/${slug}/versions/${version}`
      : `${this.baseUrl}/v1/prompts/${slug}?env=${encodeURIComponent(env)}`

    let response: Response

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeout)

      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-PromptOps-SDK': 'ts/0.1.0',
        },
        signal: controller.signal,
      })

      clearTimeout(timer)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new PromptOpsTimeoutError(this.timeout)
      }

      if (attempt < this.retries) {
        // Exponential backoff: 200ms, 400ms, 800ms...
        await sleep(200 * Math.pow(2, attempt))
        return this.fetchWithRetry(slug, env, version, attempt + 1)
      }

      throw new PromptOpsNetworkError(err)
    }

    if (response.status === 401 || response.status === 403) {
      throw new PromptOpsUnauthorizedError()
    }

    if (response.status === 404) {
      throw new PromptOpsNotFoundError(slug, env)
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new PromptOpsError(
        `Server returned ${response.status}: ${body}`,
        'UNKNOWN',
        response.status
      )
    }

    const data = await response.json() as RawPrompt
    return data
  }

  /** Stable deterministic A/B bucketing — same user always gets same variant */
  private bucket(userId: string, experiment: string): 'A' | 'B' {
    const str = `${experiment}:${userId}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash) % 2 === 0 ? 'A' : 'B'
  }

  /** Fire-and-forget impression tracking for A/B analytics */
  private async trackImpression(
    slug: string,
    experiment: string,
    variant: 'A' | 'B',
    userId: string
  ): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/v1/experiments/${experiment}/impressions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug, variant, userId, timestamp: Date.now() }),
      })
    } catch {
      // Silently swallow — analytics should never break the main flow
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}