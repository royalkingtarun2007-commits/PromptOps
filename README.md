# ⚡ PromptOps — Git for Prompts

**Version control, A/B testing, PR-style reviews, and CI/CD for your LLM prompts.**  
Works with every model. Self-host in 60 seconds. Open source, MIT licensed.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/promptops.svg)](https://www.npmjs.com/package/promptops)
[![PyPI version](https://img.shields.io/pypi/v/promptops.svg)](https://pypi.org/project/promptops/)

---

## The Problem

Your code is versioned, reviewed, and tested.  
Your prompts — the most critical part of your AI product — are **hardcoded strings**.

```
my-project/
├── src/
│   └── summarise.ts   ← versioned, reviewed, tested ✅
└── prompts/
    └── summarise.txt  ← sticky note in a drawer ❌
```

PromptOps fixes this by treating prompts as **first-class engineering artifacts**.

---

## Features

| Feature | Description |
|---|---|
| 🔀 **Version control** | Full history with semantic diffs. Branch, rollback, audit trail. |
| 👥 **PR-style reviews** | PMs write prompts. Engineers review. Approvals gate production. |
| ⚖️ **A/B testing** | Split traffic between versions. Auto-promote winners. |
| 🧪 **Prompt CI** | GitHub Action blocks merges when prompts drift. |
| 🔌 **Provider agnostic** | OpenAI, Anthropic, Gemini, Mistral, Ollama. One SDK. |
| 🏠 **Self-hostable** | `docker compose up`. Your data stays on your infra. |

---

## Quickstart

### 1. Start the server

```bash
git clone https://github.com/your-username/promptops
cd promptops
docker compose up
```

### 2. Install the SDK

```bash
# TypeScript / JavaScript
npm install promptops

# Python
pip install promptops
```

### 3. Use in your code

**TypeScript:**
```typescript
import { PromptOps } from 'promptops'

const client = new PromptOps({ apiKey: process.env.PROMPTOPS_KEY })

const prompt = await client.get('summarise-email', { env: 'production' })
const messages = prompt.compile({ email: emailBody, tone: 'professional' })

// Works with any provider
const result = await openai.chat.completions.create({ model: 'gpt-4o', messages })
```

**Python:**
```python
from promptops import PromptOps

client = PromptOps(api_key=os.environ["PROMPTOPS_KEY"])

prompt = client.get("summarise-email", env="production")
messages = prompt.compile(email=email_body, tone="professional")

# Works with any provider
result = anthropic.messages.create(model="claude-opus-4-5", messages=messages)
```

---

## A/B Testing

```typescript
// Same user always gets the same variant
const prompt = await client.ab('checkout-message', {
  experiment: 'checkout-copy-q1',
  userId: session.userId,
})
console.log(prompt.variant) // 'A' or 'B'
const messages = prompt.compile({ cartTotal: '$49.99' })
```

Impressions are tracked automatically. Declare a winner from the dashboard — no deploy needed.

---

## Prompt CI — Block Bad Changes

Add to any repo in `.github/workflows/prompt-tests.yml`:

```yaml
name: Prompt Regression Tests
on:
  pull_request:
    paths: ['prompts/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-username/promptops@v1
        with:
          api-key: ${{ secrets.PROMPTOPS_KEY }}
          suite: ./promptops.tests.json
          threshold: 0.85
          fail-on-drift: true
```

Create `promptops.tests.json`:
```json
{
  "tests": [
    {
      "name": "Summarises email correctly",
      "prompt": "summarise-email",
      "input": { "email": "Q3 revenue up 12%...", "tone": "professional" },
      "expected_output": "Revenue increased 12% in Q3",
      "threshold": 0.80
    }
  ]
}
```

If a prompt change breaks expected outputs — **the PR is blocked.**

---

## How Versioning Works

```
summarise-email
├── v1  draft         ← you just wrote it
├── v2  in_review     ← submitted for approval
├── v3  approved      ← reviewed and approved
└── v4  production ✦  ← live, served by the SDK
```

Promote any approved version to any environment:
```bash
# Via the dashboard, or via API:
POST /v1/prompts/summarise-email/promote
{ "version_id": "...", "environment": "production" }
```

---

## Dashboard

The web dashboard gives your whole team visibility:

- **Overview** — prompt health, active experiments, recent activity
- **Prompt Library** — all prompts, versions, statuses
- **Review Workflow** — submit, approve, or reject versions
- **Experiments** — A/B test results with live impression counts
- **API Keys** — manage access for your team

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Clients                                │
│  TypeScript SDK · Python SDK · CI Action│
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  REST API  (Node.js + Express)          │
│  Auth · Versioning · A/B · Webhooks     │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  PostgreSQL                             │
│  Prompts · Versions · Experiments       │
└─────────────────────────────────────────┘
```

---

## Repo Structure

```
promptops/
├── packages/
│   ├── sdk-ts/        TypeScript SDK (npm: promptops)
│   └── sdk-py/        Python SDK (PyPI: promptops)
├── apps/
│   ├── api/           REST API server (Node.js + Express)
│   └── dashboard/     Web dashboard (Next.js)
├── .github/
│   └── workflows/     GitHub Action for Prompt CI
├── docker-compose.yml Self-host everything in one command
└── index.html         Landing page
```

---

## Self-Hosting

Everything runs via Docker Compose:

```bash
git clone https://github.com/your-username/promptops
cd promptops
cp apps/api/.env.example apps/api/.env
docker compose up
```

- API: `http://localhost:3001`
- Dashboard: `http://localhost:3000`
- Database: PostgreSQL on port `5432`

---

## vs. LangSmith / Langfuse

| | LangSmith | Langfuse | **PromptOps** |
|---|---|---|---|
| Framework agnostic | ❌ | Partial | ✅ |
| PR-style reviews | ❌ | ❌ | ✅ |
| A/B testing | ❌ | ❌ | ✅ |
| Prompt CI / GitHub Action | ❌ | ❌ | ✅ |
| Non-engineer UI | ❌ | ❌ | ✅ |
| Open source + self-host | Partial | ✅ | ✅ |

---

## Contributing

PRs are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

```bash
# Run SDK tests
cd packages/sdk-ts && npm test
cd packages/sdk-py && pytest

# Run API in dev mode
cd apps/api && npm run dev

# Run dashboard in dev mode
cd apps/dashboard && npm run dev
```

---

## License

MIT © PromptOps Contributors