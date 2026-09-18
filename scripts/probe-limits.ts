import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

/**
 * Reads the rate-limit headers a provider returns on a real call.
 *
 * Request-per-day is the limit everyone publishes, but it is not always the one
 * that binds. Groq's free tier caps *output tokens per minute* at a level well
 * below what a single planning call needs, which no RPD table would have shown.
 * Check headers before assuming a provider is usable.
 *
 *   npx tsx scripts/probe-limits.ts
 */

async function probeGroq(model: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return console.log('groq: no key set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    }),
  });

  console.log(`\n  ${model}  (HTTP ${res.status})`);
  const interesting = [...res.headers.entries()]
    .filter(([k]) => k.startsWith('x-ratelimit') || k.startsWith('retry-after'))
    .sort();
  if (!interesting.length) {
    console.log('    no rate-limit headers returned');
    console.log('    ' + (await res.text()).slice(0, 300));
    return;
  }
  for (const [k, v] of interesting) console.log(`    ${k.padEnd(34)} ${v}`);
}

async function main() {
  console.log('groq rate limits, as reported by the API:');
  for (const m of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']) {
    await probeGroq(m);
  }
  console.log('');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
