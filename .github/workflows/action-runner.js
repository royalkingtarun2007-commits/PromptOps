// ─────────────────────────────────────────────
//  PromptOps GitHub Action
//  Runs prompt regression tests in CI.
//  Blocks PRs when prompts drift beyond threshold.
// ─────────────────────────────────────────────

const fs   = require('fs')
const path = require('path')
const https = require('https')

// ── Read inputs ───────────────────────────────

const API_KEY      = process.env.INPUT_API_KEY      || process.env.PROMPTOPS_KEY
const SUITE_PATH   = process.env.INPUT_SUITE        || './promptops.tests.json'
const THRESHOLD    = parseFloat(process.env.INPUT_THRESHOLD    || '0.85')
const BASE_URL     = (process.env.INPUT_BASE_URL    || 'https://api.promptops.dev').replace(/\/$/, '')
const FAIL_ON_DRIFT = (process.env.INPUT_FAIL_ON_DRIFT || 'true') === 'true'
const OPENAI_KEY   = process.env.INPUT_OPENAI_API_KEY || process.env.OPENAI_API_KEY
const MODEL        = process.env.INPUT_MODEL        || 'gpt-4o-mini'

// ── Helpers ───────────────────────────────────

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`)
  }
}

function log(msg)  { console.log(`\x1b[36m[PromptOps]\x1b[0m ${msg}`) }
function ok(msg)   { console.log(`\x1b[32m✓\x1b[0m ${msg}`) }
function fail(msg) { console.log(`\x1b[31m✗\x1b[0m ${msg}`) }
function warn(msg) { console.log(`\x1b[33m⚠\x1b[0m ${msg}`) }

async function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch { reject(new Error(`Failed to parse response: ${data}`)) }
      })
    })
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

// Jaccard similarity — works without any API key
function similarity(a, b) {
  const tokenise = s => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean))
  const setA = tokenise(a)
  const setB = tokenise(b)
  if (!setA.size && !setB.size) return 1
  if (!setA.size || !setB.size) return 0
  let intersection = 0
  setA.forEach(t => { if (setB.has(t)) intersection++ })
  return intersection / (setA.size + setB.size - intersection)
}

// Call LLM to get actual output for a test case
async function runWithLLM(messages) {
  if (!OPENAI_KEY) {
    warn('No OPENAI_API_KEY set — using mock output for scoring.')
    return messages.map(m => m.content).join(' ')
  }

  const url = new URL('https://api.openai.com/v1/chat/completions')
  const result = await fetchJSON(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 500 }),
  })

  return result.body?.choices?.[0]?.message?.content ?? ''
}

// ── Main ──────────────────────────────────────

async function run() {
  console.log('\n\x1b[1m\x1b[35m⚡ PromptOps Prompt CI\x1b[0m\n')

  // Validate inputs
  if (!API_KEY) {
    console.error('::error::PROMPTOPS_KEY is required. Add it as a secret and pass via api-key input.')
    process.exit(1)
  }

  // Load test suite
  const suitePath = path.resolve(process.cwd(), SUITE_PATH)
  if (!fs.existsSync(suitePath)) {
    console.error(`::error::Test suite not found at ${suitePath}`)
    console.error('Create a promptops.tests.json file. See docs for format.')
    process.exit(1)
  }

  let suite
  try {
    suite = JSON.parse(fs.readFileSync(suitePath, 'utf8'))
  } catch (err) {
    console.error(`::error::Invalid JSON in test suite: ${err.message}`)
    process.exit(1)
  }

  const cases = suite.tests || suite
  log(`Loaded ${cases.length} test case(s) from ${SUITE_PATH}`)
  log(`Threshold: ${THRESHOLD} | Fail on drift: ${FAIL_ON_DRIFT}\n`)

  const results = []
  let passed = 0
  let failed = 0

  for (const testCase of cases) {
    const { name, prompt: slug, input, expected_output, threshold } = testCase
    const caseThreshold = threshold ?? THRESHOLD

    process.stdout.write(`  Running: ${name} ... `)

    try {
      // Fetch prompt from PromptOps
      const promptUrl = new URL(`${BASE_URL}/v1/prompts/${slug}?env=production`)
      const promptRes = await fetchJSON(promptUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      if (promptRes.status === 404) {
        throw new Error(`Prompt "${slug}" not found in production environment`)
      }
      if (promptRes.status === 401) {
        throw new Error('Invalid API key')
      }

      const rawPrompt = promptRes.body

      // Compile the prompt with test inputs
      const messages = rawPrompt.messages.map(msg => ({
        role: msg.role,
        content: msg.content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) =>
          key in input ? String(input[key]) : `{{${key}}}`
        ).trim(),
      }))

      // Run through LLM
      const actualOutput = await runWithLLM(messages)

      // Score
      const score = similarity(actualOutput, expected_output)
      const pass  = score >= caseThreshold

      if (pass) {
        passed++
        ok(`${name} (score: ${score.toFixed(3)} ≥ ${caseThreshold})`)
      } else {
        failed++
        fail(`${name} (score: ${score.toFixed(3)} < ${caseThreshold})`)
        console.log(`    Expected: ${expected_output.slice(0, 80)}...`)
        console.log(`    Got:      ${actualOutput.slice(0, 80)}...`)
      }

      results.push({ name, slug, passed: pass, score, threshold: caseThreshold, actualOutput, expectedOutput: expected_output })

    } catch (err) {
      failed++
      fail(`${name} — ERROR: ${err.message}`)
      results.push({ name, slug, passed: false, score: 0, threshold: caseThreshold, error: err.message })
    }
  }

  // ── Summary ─────────────────────────────────

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`\x1b[1mResults: ${passed} passed, ${failed} failed, ${cases.length} total\x1b[0m`)
  console.log(`${'─'.repeat(50)}\n`)

  // Write JSON report
  const reportPath = path.join(process.env.RUNNER_TEMP || '/tmp', 'promptops-report.json')
  fs.writeFileSync(reportPath, JSON.stringify({ passed, failed, total: cases.length, results }, null, 2))
  log(`Report saved to ${reportPath}`)

  // Set outputs
  setOutput('passed', passed)
  setOutput('failed', failed)
  setOutput('total', cases.length)
  setOutput('report', reportPath)

  // Fail the workflow if drift detected
  if (FAIL_ON_DRIFT && failed > 0) {
    console.error(`\n::error::${failed} prompt test(s) failed. Merge blocked.`)
    process.exit(1)
  }

  log('All prompt tests passed ✓')
}

run().catch(err => {
  console.error(`::error::Unexpected error: ${err.message}`)
  process.exit(1)
})