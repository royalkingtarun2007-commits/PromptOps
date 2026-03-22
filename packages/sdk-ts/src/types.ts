// ─────────────────────────────────────────────
//  PromptOps SDK — Types
// ─────────────────────────────────────────────

export type Environment = 'production' | 'staging' | 'development' | string

export type Provider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'mistral'
  | 'ollama'
  | 'custom'

export interface PromptOpsConfig {
  /** Your PromptOps API key */
  apiKey: string
  /** Base URL of your PromptOps server. Defaults to https://api.promptops.dev */
  baseUrl?: string
  /** Default environment to fetch prompts from. Defaults to 'production' */
  defaultEnv?: Environment
  /** Request timeout in milliseconds. Defaults to 5000 */
  timeout?: number
  /** Retry failed requests this many times. Defaults to 2 */
  retries?: number
}

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface PromptMetadata {
  /** Unique slug identifier for this prompt */
  slug: string
  /** Human-readable name */
  name: string
  /** Current version identifier e.g. "v12" or a commit-style hash */
  version: string
  /** Environment this version is promoted to */
  env: Environment
  /** Team / workspace this prompt belongs to */
  workspace: string
  /** ISO timestamp of when this version was approved */
  approvedAt: string
  /** Who approved this version */
  approvedBy: string
  /** Tags for filtering */
  tags: string[]
  /** Variable names this prompt expects */
  variables: string[]
  /** Provider this prompt was optimised for, if any */
  optimisedFor?: Provider
}

export interface RawPrompt {
  metadata: PromptMetadata
  /** The raw template string(s). Use {{variable}} syntax */
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
}

export interface GetPromptOptions {
  /** Which environment to fetch from. Defaults to client's defaultEnv */
  env?: Environment
  /** Pin to a specific version. Overrides env. */
  version?: string
  /** Skip cache and fetch fresh from server */
  fresh?: boolean
  /** Fallback messages to use if fetch fails */
  fallback?: PromptMessage[]
}

export interface CompileOptions {
  /** Variables to interpolate into the prompt template */
  variables?: Record<string, string | number | boolean>
  /** Trim whitespace from compiled content */
  trim?: boolean
}

export interface ABTestOptions {
  /** Name of the A/B experiment */
  experiment: string
  /** Unique stable ID for this user/session (used for consistent bucketing) */
  userId: string
}

export interface TestCase {
  /** Descriptive name for this test case */
  name: string
  /** Input variables to compile the prompt with */
  input: Record<string, string>
  /** Expected output (used for semantic similarity scoring) */
  expectedOutput: string
  /** Minimum similarity score to pass (0–1). Defaults to 0.85 */
  threshold?: number
}

export interface TestResult {
  testCase: string
  passed: boolean
  score: number
  threshold: number
  actualOutput?: string
  error?: string
}

export interface RunTestsOptions {
  /** LLM call function to use for testing */
  runner: (messages: PromptMessage[]) => Promise<string>
  /** Similarity scorer. Defaults to built-in cosine similarity */
  scorer?: (actual: string, expected: string) => Promise<number>
}

export interface PromptOpsError extends Error {
  code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'TIMEOUT' | 'NETWORK' | 'COMPILE' | 'UNKNOWN'
  status?: number
}