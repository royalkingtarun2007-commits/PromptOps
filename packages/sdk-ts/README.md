# PromptOps TypeScript SDK

[![npm version](https://img.shields.io/npm/v/promptops.svg)](https://www.npmjs.com/package/promptops)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The official TypeScript/JavaScript SDK for [PromptOps](https://promptops.dev) — version control, A/B testing, and CI/CD for your LLM prompts.

## Install

```bash
npm install promptops
# or
pnpm add promptops
# or
yarn add promptops
```

## Quick start

```typescript
import { PromptOps } from 'promptops'

const client = new PromptOps({
  apiKey: process.env.PROMPTOPS_KEY,
})

// Fetch the production-approved prompt
const prompt = await client.get('summarise-email', { env: 'production' })

// Compile with your variables
const messages = prompt.compile({
  email: emailBody,
  tone: 'professional',
})

// Use with any provider — no lock-in
const result = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages,
})
```

## Core API

### `new PromptOps(config)`

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | **required** | Your PromptOps API key |
| `baseUrl` | `string` | `https://api.promptops.dev` | Your self-hosted server URL |
| `defaultEnv` | `string` | `'production'` | Environment to fetch prompts from |
| `timeout` | `number` | `5000` | Request timeout in ms |
| `retries` | `number` | `2` | Retry attempts on failure |

### `client.get(slug, options?)`

Fetches a prompt by its slug. Returns a `Prompt` object.

```typescript
const prompt = await client.get('my-prompt', {
  env: 'staging',          // which environment
  version: 'v12',          // pin to a specific version
  fresh: true,             // bypass cache
  fallback: [...messages], // use if server is unreachable
})
```

### `prompt.compile(variables)`

Interpolates `{{variable}}` placeholders and returns an array of messages ready for any LLM provider.

```typescript
const messages = prompt.compile({ name: 'Alice', topic: 'TypeScript' })
// → [{ role: 'system', content: '...' }, { role: 'user', content: '...' }]
```

### `client.ab(slug, options)`

A/B tests two versions of a prompt. Users are consistently routed to the same variant.

```typescript
const prompt = await client.ab('checkout-message', {
  experiment: 'checkout-copy-q1',
  userId: session.userId,
})
console.log(prompt.variant) // 'A' or 'B' — same user always gets same variant
const messages = prompt.compile({ cartTotal: '$49.99' })
```

### `prompt.test(cases, options)`

Run regression tests against a prompt. Ideal for CI pipelines.

```typescript
const results = await prompt.test(
  [
    {
      name: 'formal tone test',
      input: { email: sampleEmail, tone: 'formal' },
      expectedOutput: 'Three bullet point summary of the email',
      threshold: 0.80,
    },
  ],
  {
    runner: async (messages) => {
      const res = await openai.chat.completions.create({ model: 'gpt-4o', messages })
      return res.choices[0].message.content ?? ''
    },
  }
)

const failed = results.filter(r => !r.passed)
if (failed.length > 0) process.exit(1)
```

### `client.getMany(slugs)`

Fetch multiple prompts in parallel in a single call.

```typescript
const [welcome, summary, followUp] = await client.getMany([
  'welcome-email',
  'email-summary',
  'follow-up',
])
```

## Error handling

```typescript
import { PromptOps, PromptOpsNotFoundError, PromptOpsUnauthorizedError } from 'promptops'

try {
  const prompt = await client.get('my-prompt')
} catch (err) {
  if (err instanceof PromptOpsNotFoundError) {
    // Prompt doesn't exist or isn't promoted to this env
  }
  if (err instanceof PromptOpsUnauthorizedError) {
    // Invalid API key
  }
}
```

## Self-hosting

If you're running PromptOps on your own infrastructure:

```typescript
const client = new PromptOps({
  apiKey: process.env.PROMPTOPS_KEY,
  baseUrl: 'https://prompts.your-company.com',
})
```

## License

MIT