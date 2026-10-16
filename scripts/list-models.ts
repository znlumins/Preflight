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

import { listProviderModels, type ProviderId } from '../lib/ai/provider';

const ALL_PROVIDERS: ProviderId[] = ['google', 'anthropic', 'openai', 'openrouter', 'groq'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

async function inspect(provider: ProviderId, apiKey?: string) {
  const models = await listProviderModels(provider, apiKey);
  if (models.length === 0) {
    console.log(`${provider} — tidak ada key atau tidak ada model yang terdeteksi.\n`);
    return;
  }

  console.log(`${provider} — ${models.length} model text terdeteksi & didukung:\n`);
  for (const m of models) {
    const ctx = m.contextWindow ? `${m.contextWindow.toLocaleString()} ctx` : '';
    console.log(`  ${m.id.padEnd(46)} ${ctx.padStart(12)}  ${m.name ?? ''}`);
  }
  console.log('');
}

async function main() {
  const targetProvider = arg('provider') as ProviderId | undefined;
  const targetKey = arg('key');

  if (targetProvider) {
    await inspect(targetProvider, targetKey);
    return;
  }

  for (const p of ALL_PROVIDERS) {
    await inspect(p);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
