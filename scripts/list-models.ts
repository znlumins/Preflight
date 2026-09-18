import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

/**
 * Lists the text models the current key can actually call.
 *
 * The fallback chain in `provider.ts` is only as good as its model ids, and
 * Google retires them without warning — the second spike run died on a model
 * that had been withdrawn for new users. Run this before editing that chain.
 *
 *   npx tsx scripts/list-models.ts
 */

type Model = {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
};

const NOT_TEXT = /image|tts|audio|live|transcribe|robotics|computer|embedding|guard|whisper|prompt-guard|compound/;

async function google() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return console.log('google: no key set\n');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`,
  );
  if (!res.ok) return console.log(`google: ${res.status} ${await res.text()}\n`);

  const { models } = (await res.json()) as { models: Model[] };
  const usable = models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({ id: m.name.replace('models/', ''), limit: m.inputTokenLimit ?? 0 }))
    .filter((m) => /^gemini-(\d|flash|pro)/.test(m.id) && !NOT_TEXT.test(m.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log(`google — ${usable.length} text models callable:\n`);
  for (const m of usable) {
    console.log(`  ${m.id.padEnd(42)} ${m.limit.toLocaleString().padStart(11)} ctx`);
  }
  console.log('');
}

async function groq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return console.log('groq: no key set\n');

  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return console.log(`groq: ${res.status} ${await res.text()}\n`);

  const { data } = (await res.json()) as {
    data: { id: string; context_window?: number; active?: boolean }[];
  };
  const usable = data
    .filter((m) => m.active !== false && !NOT_TEXT.test(m.id))
    .map((m) => ({ id: m.id, limit: m.context_window ?? 0 }))
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log(`groq — ${usable.length} text models callable:\n`);
  for (const m of usable) {
    console.log(`  ${m.id.padEnd(42)} ${m.limit.toLocaleString().padStart(11)} ctx`);
  }
  console.log('');
}

async function main() {
  await google();
  await groq();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
