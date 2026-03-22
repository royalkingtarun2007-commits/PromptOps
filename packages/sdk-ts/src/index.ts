// ─────────────────────────────────────────────
//  PromptOps SDK — Public API
//  Everything a developer needs, in one import.
// ─────────────────────────────────────────────

export { PromptOps } from './client.js'
export { Prompt } from './prompt.js'
export {
  PromptOpsError,
  PromptOpsNotFoundError,
  PromptOpsUnauthorizedError,
  PromptOpsTimeoutError,
  PromptOpsNetworkError,
  PromptOpsCompileError,
} from './errors.js'

export type {
  PromptOpsConfig,
  PromptMessage,
  PromptMetadata,
  RawPrompt,
  GetPromptOptions,
  CompileOptions,
  ABTestOptions,
  TestCase,
  TestResult,
  RunTestsOptions,
  Environment,
  Provider,
} from './types.js'

// Convenience: allow initialising with env var automatically
export function createClient(overrides: Partial<import('./types.js').PromptOpsConfig> = {}) {
  const apiKey =
    overrides.apiKey ??
    (typeof process !== 'undefined' ? process.env['PROMPTOPS_KEY'] : undefined)

  if (!apiKey) {
    throw new Error(
      '[PromptOps] No API key found. ' +
      'Set PROMPTOPS_KEY in your environment or pass apiKey to createClient().'
    )
  }

  return new (require('./client.js').PromptOps)({ ...overrides, apiKey })
}