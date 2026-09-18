import { config as loadEnv } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pipeline } from '../lib/ai/pipeline';
import { renderPlan } from '../lib/ai/render';
import type { CallMetric } from '../lib/ai/meter';
import type { ProviderId } from '../lib/ai/provider';
import type { Language } from '../lib/ai/schemas';

// Match Next.js precedence: .env.local wins, .env is the fallback.
loadEnv({ path: ['.env.local', '.env'], quiet: true });

/**
 * Spike harness.
 *
 * Runs one full plan end to end and reports what it actually cost, because the
 * whole free-tier architecture is a bet on these numbers. Nothing else gets
 * built until this prints something we can live with.
 *
 *   npm run spike
 *   npm run spike -- --provider groq --lang en --idea "a tool that ..."
 */

const IDEA_DEFAULT =
  'Aplikasi pencatat keuangan pribadi untuk freelancer Indonesia. ' +
  'Bisa catat pemasukan per klien, pisahkan uang pajak otomatis, ' +
  'dan ingatkan invoice yang belum dibayar.';

const CONTEXT_DEFAULT =
  'Solo developer, pengalaman menengah, budget infrastruktur Rp 0, ' +
  'target rilis 6 minggu, web dulu (mobile nanti).';

/** Pinned answers for --no-interview, so prompt A/Bs vary only by the prompt. */
const FIXED_ANSWERS = [
  { questionId: 'tax-calculation', answer: 'PPh Final UMKM 0,5% dari omzet bruto' },
  { questionId: 'reminder-channel', answer: 'Email' },
  { questionId: 'bank-integration', answer: 'Tidak, input manual saja' },
  { questionId: 'data-storage', answer: 'Database hosted gratis (Supabase/Neon)' },
  { questionId: 'client-management', answer: 'Ya, daftar klien terpisah' },
];

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/**
 * Free-tier ceilings, per tier, roughly, as of the analysis. Verify before
 * trusting — these move.
 *
 * Quotas are per model, not per account, so the binding constraint is whichever
 * tier runs out first. One plan spends 1 deep call and N-1 fast calls, so it is
 * almost always the fast tier that caps you.
 */
const FREE_TIER = {
  google: {
    label: 'Gemini free',
    fast: { name: 'flash-lite', rpd: 500, rpm: 15 },
    deep: { name: 'flash', rpd: 20, rpm: 10 },
    // Flash-Lite allows ~250k TPM, far above what one plan needs per minute.
    otpm: 250_000,
  },
  groq: {
    label: 'Groq free',
    fast: { name: 'gpt-oss-120b', rpd: 1000, rpm: 30 },
    deep: { name: 'gpt-oss-120b', rpd: 1000, rpm: 30 },
    // Measured from x-ratelimit headers: 8k TPM total, 1k OUTPUT tokens/minute.
    // This, not RPD, is what actually caps throughput here.
    otpm: 1_000,
  },
} as const;

const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
const num = (n: number, w = 8) => n.toLocaleString('en-US').padStart(w);

function table(calls: CallMetric[]) {
  console.log(
    `\n  ${pad('STAGE', 18)} ${pad('STATUS', 7)} ${'IN'.padStart(8)} ${'OUT'.padStart(
      8,
    )} ${'CACHED'.padStart(8)} ${'TOTAL'.padStart(9)} ${'TIME'.padStart(8)}`,
  );
  console.log('  ' + '-'.repeat(70));
  for (const c of calls) {
    console.log(
      `  ${pad(c.stage, 18)} ${pad(c.ok ? 'ok' : 'FAIL', 7)} ${num(c.inputTokens)} ${num(
        c.outputTokens,
      )} ${num(c.cachedInputTokens)} ${num(c.totalTokens, 9)} ${(
        (c.ms / 1000).toFixed(1) + 's'
      ).padStart(8)}`,
    );
    if (!c.ok) console.log(`  ${' '.repeat(18)} ${c.error}`);
  }
}

async function main() {
  const provider = arg('provider', 'google') as ProviderId;
  const language = arg('lang', 'id') as Language;
  const idea = arg('idea', IDEA_DEFAULT);
  const context = arg('context', CONTEXT_DEFAULT);

  console.log('\n=== PREFLIGHT SPIKE ===');
  console.log(`provider : ${provider}`);
  console.log(`language : ${language}`);
  console.log(`idea     : ${idea.slice(0, 80)}${idea.length > 80 ? '...' : ''}`);

  const singleTier = process.argv.includes('--single-tier');
  if (singleTier) console.log('mode     : single-tier (semua tahap di model fast)');
  const pipeline = new Pipeline({ provider }, { singleTier });
  const started = Date.now();

  // Comparing two runs is only meaningful when their inputs match. Stage 1
  // generates different questions each time and the auto-answers follow, so
  // --no-interview pins a fixed answer set when A/B-ing a prompt change.
  const skipInterview = process.argv.includes('--no-interview');

  let questionnaire = { questions: [] as Awaited<ReturnType<typeof pipeline.questions>>['questions'] };
  let answers = FIXED_ANSWERS;

  if (skipInterview) {
    console.log('\n[1/5] questions ... dilewati (--no-interview, pakai jawaban tetap)');
  } else {
    console.log('\n[1/5] questions ...');
    questionnaire = await pipeline.questions({ idea, language, context });
    console.log(`      ${questionnaire.questions.length} pertanyaan`);
    for (const q of questionnaire.questions) {
      console.log(`      - ${q.question}`);
    }
    // Answer with the first option, so the spike runs without a human in the loop.
    answers = questionnaire.questions.map((q) => ({
      questionId: q.id,
      answer: q.options[0]?.label ?? 'tidak ada preferensi khusus',
    }));
  }

  console.log('\n[2/5] prd ...');
  const prd = await pipeline.prd({ idea, language, context, answers });
  console.log(`      "${prd.title}" — ${prd.mvpScope.length} item MVP, ${prd.nonGoals.length} non-goal`);
  console.log(`      stack: ${prd.techStack.frontend} / ${prd.techStack.backend} / ${prd.techStack.database}`);

  console.log('\n[3/5] features ...');
  const features = await pipeline.features(prd, language);
  const subCount = features.features.reduce((n, f) => n + f.subfeatures.length, 0);
  console.log(`      ${features.features.length} fitur, ${subCount} subfitur`);

  console.log('\n[4/5] specs ...');
  const specs = await pipeline.specs(prd, features, language);
  console.log(`      ${specs.specs.length} spec (dari ${features.features.length} fitur)`);
  if (specs.specs.length !== features.features.length) {
    console.log('      ! jumlah spec tidak cocok — schema drift, perlu retry logic');
  }

  console.log('\n[5/5] tasks ...');
  const tasks = await pipeline.tasks(prd, features, specs, language);
  console.log(`      ${tasks.tasks.length} task`);

  const wall = Date.now() - started;
  const t = pipeline.meter.totals;

  table(pipeline.meter.calls);

  // Structural checks. The first spike shipped a plan with exactly one task per
  // subfeature and nobody noticed until the markdown was read by hand.
  console.log('\n=== CEK STRUKTUR ===');
  const featureIds = new Set(features.features.map((f) => f.id));
  const subIds = new Set(features.features.flatMap((f) => f.subfeatures.map((s) => s.id)));
  const tasksPerSub = tasks.tasks.length / Math.max(subIds.size, 1);
  const orphanTasks = tasks.tasks.filter(
    (t2) => !featureIds.has(t2.featureId) || !subIds.has(t2.subfeatureId),
  );
  const dupIds = tasks.tasks.length - new Set(tasks.tasks.map((t2) => t2.id)).size;
  const emptySubs = features.features.filter((f) => f.subfeatures.length < 3).length;
  const untouched = [...subIds].filter((id) => !tasks.tasks.some((t2) => t2.subfeatureId === id));
  const shortPrompts = tasks.tasks.filter((t2) => t2.agentPrompt.length < 200).length;

  const check = (ok: boolean, label: string) => console.log(`  ${ok ? 'ok  ' : 'WARN'} ${label}`);
  if (!skipInterview) check(questionnaire.questions.length === 5, `pertanyaan: ${questionnaire.questions.length} (target 5)`);
  check(emptySubs === 0, `fitur dengan <3 subfitur: ${emptySubs}`);
  check(specs.specs.length === features.features.length, `spec cocok: ${specs.specs.length}/${features.features.length}`);
  check(tasksPerSub >= 2, `task per subfitur: ${tasksPerSub.toFixed(1)} (target >= 2)`);
  check(untouched.length === 0, `subfitur tanpa task: ${untouched.length}`);
  check(orphanTasks.length === 0, `task dengan id fitur/subfitur ngawur: ${orphanTasks.length}`);
  check(dupIds === 0, `task id duplikat: ${dupIds}`);
  check(shortPrompts === 0, `agent prompt < 200 char: ${shortPrompts}/${tasks.tasks.length}`);
  const promptLens = tasks.tasks.map((t2) => t2.agentPrompt.length);
  console.log(
    `  info agent prompt: min ${Math.min(...promptLens)}, rata2 ${Math.round(promptLens.reduce((a, b) => a + b, 0) / promptLens.length)}`,
  );
  const enTitles = tasks.tasks.filter((t2) => /^(Add|Build|Create|Implement|Setup|Configure|Write|Update|Remove) /.test(t2.title)).length;
  if (language === 'id') check(enTitles === 0, `judul task berbahasa Inggris: ${enTitles}/${tasks.tasks.length}`);

  console.log('\n=== BIAYA SATU PLAN ===');
  console.log(`  requests        : ${t.requests}${t.failed ? ` (${t.failed} gagal)` : ''}`);
  console.log(`  input tokens    : ${t.inputTokens.toLocaleString()}`);
  console.log(`  output tokens   : ${t.outputTokens.toLocaleString()}`);
  console.log(`  cached input    : ${t.cachedInputTokens.toLocaleString()}`);
  console.log(`  total tokens    : ${t.totalTokens.toLocaleString()}`);
  console.log(`  wall clock      : ${(wall / 1000).toFixed(1)}s`);
  console.log(`  model time      : ${(t.ms / 1000).toFixed(1)}s (paralel di stage spec & task)`);

  // Attribute each call to the tier that requested it, so the quota maths uses
  // the right ceiling per model — and stays correct when a call falls back to a
  // different model mid-run.
  const deepCalls = pipeline.meter.calls.filter((c) => c.tier === 'deep').length;
  const fastCalls = t.requests - deepCalls;

  const tier = FREE_TIER[provider];
  const perDay = (calls: number, rpd: number) => (calls ? Math.floor(rpd / calls) : Infinity);
  const byFast = perDay(fastCalls, tier.fast.rpd);
  const byDeep = perDay(deepCalls, tier.deep.rpd);
  const plansPerDay = Math.min(byFast, byDeep);
  const binding = byFast <= byDeep ? tier.fast.name : tier.deep.name;

  console.log('\n=== EKSTRAPOLASI KUOTA GRATIS ===');
  console.log(`  ${tier.label}`);
  console.log(
    `  fast (${tier.fast.name}): ${fastCalls} call/plan vs ~${tier.fast.rpd} req/hari -> ${byFast} plan/hari`,
  );
  console.log(
    `  deep (${tier.deep.name}): ${deepCalls} call/plan vs ~${tier.deep.rpd} req/hari -> ${byDeep} plan/hari`,
  );
  console.log(`  batas mengikat: ${binding}`);
  console.log(`  -> ${plansPerDay} plan/hari per API key`);
  console.log(`  -> pool 1 key server  : ${plansPerDay} plan/hari untuk SEMUA user`);
  console.log(`  -> BYOK               : ${plansPerDay} plan/hari per user`);

  // RPM matters as much as RPD: the spec and task stages fan out in parallel.
  const widestFanout = Math.max(
    ...['specs', 'tasks'].map(
      (s) => pipeline.meter.calls.filter((c) => c.stage.startsWith(s)).length,
    ),
  );
  console.log(
    `  fan-out paralel terlebar: ${widestFanout} call (limit ~${tier.fast.rpm} req/menit)`,
  );

  // Output throughput, not request count, is what binds on some providers.
  const minutesPerPlan = t.outputTokens / tier.otpm;
  const byThroughput = Math.floor((24 * 60) / Math.max(minutesPerPlan, 0.001));
  console.log(
    `\n  output throughput: ${t.outputTokens.toLocaleString()} token/plan vs ~${tier.otpm.toLocaleString()} output token/menit`,
  );
  console.log(
    `  -> minimum ${minutesPerPlan.toFixed(1)} menit per plan (${byThroughput} plan/hari jika nonstop)`,
  );
  if (minutesPerPlan > 3) {
    console.log(
      `  !! throughput adalah batas sebenarnya di provider ini, bukan RPD. ${minutesPerPlan.toFixed(0)} menit/plan tidak layak untuk produk.`,
    );
  }

  if (plansPerDay < 20) {
    console.log('  !! pool server tidak layak di angka ini. BYOK wajib.');
  }

  const outDir = join(process.cwd(), 'out');
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  writeFileSync(join(outDir, `plan-${stamp}.md`), renderPlan(prd, features, specs, tasks), 'utf8');
  writeFileSync(
    join(outDir, `metrics-${stamp}.json`),
    JSON.stringify(
      { provider, language, idea, wallMs: wall, totals: t, calls: pipeline.meter.calls },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`\n  ditulis ke out/plan-${stamp}.md`);
  console.log(`  ditulis ke out/metrics-${stamp}.json\n`);

  const sample = tasks.tasks[0];
  if (sample) {
    console.log('=== CONTOH AGENT PROMPT (task pertama) ===');
    console.log(`  ${sample.title} [${sample.id}]`);
    console.log(
      sample.agentPrompt
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n'),
    );
    console.log('');
  }
}

main().catch((err) => {
  console.error('\nSPIKE GAGAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
