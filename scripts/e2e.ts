/**
 * End-to-end check against the running dev server.
 *
 * Drives the same sequence the browser does — questions, create, features,
 * specs, tasks — over real HTTP with a real cookie jar, so it exercises the
 * routes, the session, and the database rather than the pipeline in isolation.
 *
 *   npm run dev            (in another terminal)
 *   npx tsx scripts/e2e.ts
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

let cookie = '';

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...init?.headers },
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  const body = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  return { status: res.status, body: parsed as Record<string, unknown> & { error?: string } };
}

const started = Date.now();
const step = (label: string) =>
  console.log(`\n[${((Date.now() - started) / 1000).toFixed(1).padStart(5)}s] ${label}`);

async function main() {
  const idea =
    'Aplikasi buat pemilik warung kopi kecil untuk catat stok biji kopi, ' +
    'hitung harga pokok per cangkir, dan lihat menu mana yang paling untung.';
  const context = 'Solo developer, 4 minggu, budget nol, web dulu.';

  step('POST /api/plan/questions');
  const q = await call('/api/plan/questions', {
    method: 'POST',
    body: JSON.stringify({ idea, context, language: 'id' }),
  });
  if (q.status !== 200) throw new Error(`questions ${q.status}: ${q.body.error}`);
  const questions = (q.body.questions ?? []) as { id: string; question: string; options: { label: string }[] }[];
  console.log(`       ${questions.length} pertanyaan`);
  questions.forEach((x) => console.log(`       - ${x.question}`));

  step('POST /api/plan/create');
  const created = await call('/api/plan/create', {
    method: 'POST',
    body: JSON.stringify({
      idea,
      context,
      language: 'id',
      questions: q.body,
      answers: questions.map((x) => ({
        questionId: x.id,
        answer: x.options[0]?.label ?? 'tidak ada preferensi',
      })),
    }),
  });
  const planId = created.body.planId as string;
  if (!planId) throw new Error(`create failed: ${JSON.stringify(created.body).slice(0, 300)}`);
  if (created.body.error) throw new Error(`prd failed: ${created.body.error}`);
  console.log(`       planId ${planId}`);
  console.log(`       "${(created.body.prd as { title: string }).title}"`);

  for (const stage of ['features', 'specs', 'tasks'] as const) {
    step(`POST /api/plan/${planId}/${stage}`);
    const res = await call(`/api/plan/${planId}/${stage}`, { method: 'POST' });
    if (res.status !== 200) throw new Error(`${stage} ${res.status}: ${res.body.error}`);
    const counts = {
      features: () => (res.body.features as unknown[])?.length,
      specs: () => (res.body.specs as unknown[])?.length,
      tasks: () => (res.body.tasks as unknown[])?.length,
    };
    console.log(`       ${counts[stage]()} ${stage}`);
  }

  step(`GET /api/plan/${planId}`);
  const full = await call(`/api/plan/${planId}`);
  const plan = full.body as unknown as {
    plan: { status: string; title: string };
    features: unknown[];
    subfeatures: unknown[];
    tasks: { id: string; agentPrompt: string; done: boolean }[];
  };
  console.log(`       status ${plan.plan.status}`);
  console.log(
    `       ${plan.features.length} fitur, ${plan.subfeatures.length} subfitur, ${plan.tasks.length} task`,
  );

  step(`PATCH /api/plan/${planId}/task`);
  const first = plan.tasks[0];
  const patched = await call(`/api/plan/${planId}/task`, {
    method: 'PATCH',
    body: JSON.stringify({ taskId: first.id, done: true }),
  });
  console.log(`       ${patched.status === 200 ? 'task ditandai selesai' : 'GAGAL'}`);

  step(`GET /api/plan/${planId}/markdown`);
  const md = await fetch(`${BASE}/api/plan/${planId}/markdown`, { headers: { cookie } });
  const text = await md.text();
  console.log(`       ${md.status} · ${text.length.toLocaleString()} karakter`);
  console.log(`       ${md.headers.get('content-disposition')}`);

  step('GET /plans/[id] (SSR)');
  const page = await fetch(`${BASE}/plans/${planId}`, { headers: { cookie } });
  const html = await page.text();
  console.log(`       ${page.status} · ${html.length.toLocaleString()} bytes`);
  console.log(`       judul ter-render: ${html.includes(plan.plan.title) ? 'ya' : 'TIDAK'}`);

  step('Cek isolasi sesi (cookie lain tidak boleh melihat plan ini)');
  const stranger = await fetch(`${BASE}/api/plan/${planId}`, {
    headers: { cookie: 'preflight_sid=orang-lain-sama-sekali' },
  });
  console.log(`       ${stranger.status === 404 ? 'ok, 404' : `BOCOR: ${stranger.status}`}`);

  console.log(`\nselesai dalam ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`buka: ${BASE}/plans/${planId}\n`);

  console.log('=== contoh agent prompt ===');
  console.log(first.agentPrompt);
  console.log('');
}

main().catch((err) => {
  console.error('\nE2E GAGAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
