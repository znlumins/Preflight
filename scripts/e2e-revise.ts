import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

/**
 * Revision and rate-limit checks against the running dev server.
 *
 * The assertions that matter are about blast radius: a revision must change
 * what was asked for and leave everything else alone, and the pool limit must
 * actually refuse rather than merely warn.
 *
 *   npx tsx scripts/e2e-revise.ts
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const REAL_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '';

let cookie = '';

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...init?.headers },
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

const results: { label: string; ok: boolean }[] = [];
const check = (label: string, ok: boolean, detail = '') => {
  results.push({ label, ok });
  console.log(`  ${ok ? 'ok  ' : 'GAGAL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

type Plan = {
  plan: { status: string };
  features: { id: string; name: string; benefit: string }[];
  tasks: { id: string; title: string; agentPrompt: string; done: boolean }[];
};

async function buildPlan(): Promise<string> {
  const idea =
    'Aplikasi untuk klinik gigi kecil: atur jadwal pasien, catat riwayat perawatan, dan ingatkan kontrol berikutnya.';
  const q = await call('/api/plan/questions', {
    method: 'POST',
    body: JSON.stringify({ idea, context: 'Sendirian, 5 minggu, budget nol.', language: 'id' }),
  });
  const created = await call('/api/plan/create', {
    method: 'POST',
    body: JSON.stringify({ idea, context: 'Sendirian, 5 minggu, budget nol.', language: 'id', questions: q.body, answers: [] }),
  });
  const planId = created.body.planId as string;
  for (const stage of ['features', 'specs', 'tasks']) {
    await call(`/api/plan/${planId}/${stage}`, { method: 'POST' });
  }
  return planId;
}

async function main() {
  if (!REAL_KEY) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY belum diisi.');

  // Run on a user key so the pool limit does not interfere with the revision
  // tests; the limit gets its own section below, on a fresh session.
  await call('/api/key', {
    method: 'PUT',
    body: JSON.stringify({ provider: 'google', apiKey: REAL_KEY }),
  });

  console.log('\n=== menyiapkan rencana ===\n');
  const planId = await buildPlan();
  const before = (await call(`/api/plan/${planId}`)).body as unknown as Plan;
  check('rencana selesai', before.plan.status === 'done', `${before.features.length} fitur, ${before.tasks.length} task`);

  // Mark a task done: user state must survive a revision.
  await call(`/api/plan/${planId}/task`, {
    method: 'PATCH',
    body: JSON.stringify({ taskId: before.tasks[0].id, done: true }),
  });

  console.log('\n=== revisi: menambah ===\n');
  const add = await call(`/api/plan/${planId}/revise`, {
    method: 'POST',
    body: JSON.stringify({ message: 'Tambahkan fitur ekspor rekap perawatan pasien ke CSV.' }),
  });
  check('revisi diterima', add.status === 200, String(add.body.reply ?? add.body.error ?? '').slice(0, 70));

  const afterAdd = (await call(`/api/plan/${planId}`)).body as unknown as Plan;
  check(
    'jumlah fitur bertambah',
    afterAdd.features.length > before.features.length,
    `${before.features.length} -> ${afterAdd.features.length}`,
  );
  check(
    'fitur lama tidak hilang',
    before.features.every((f) => afterAdd.features.some((g) => g.id === f.id)),
  );
  check(
    'task lama tidak hilang',
    before.tasks.every((t) => afterAdd.tasks.some((u) => u.id === t.id)),
  );
  check(
    'status selesai pada task tetap terjaga',
    afterAdd.tasks.find((t) => t.id === before.tasks[0].id)?.done === true,
  );

  // A feature with no tasks is a dead end in a product whose output is tasks.
  const newFeature = afterAdd.features.find((f) => !before.features.some((b) => b.id === f.id));
  const newTasks = afterAdd.tasks.filter(
    (t) => (t as unknown as { featureId: string }).featureId === newFeature?.id,
  );
  check(
    'fitur baru langsung berisi task, bukan judul kosong',
    newTasks.length > 0,
    `${newFeature?.id}: ${newTasks.length} task`,
  );
  check(
    'task fitur baru punya agent prompt yang layak',
    newTasks.every((t) => t.agentPrompt.length > 150),
  );

  console.log('\n=== revisi: menghapus ===\n');
  const victim = before.features[before.features.length - 1];
  const del = await call(`/api/plan/${planId}/revise`, {
    method: 'POST',
    body: JSON.stringify({ message: `Buang fitur ${victim.name}, terlalu jauh untuk versi pertama.` }),
  });
  check('permintaan hapus diterima', del.status === 200, String(del.body.reply ?? '').slice(0, 70));

  const afterDel = (await call(`/api/plan/${planId}`)).body as unknown as Plan;
  const gone = !afterDel.features.some((f) => f.id === victim.id);
  check('fitur yang diminta hilang', gone, victim.id);
  check(
    'task milik fitur itu ikut hilang (tidak jadi yatim)',
    !afterDel.tasks.some((t) => before.tasks.some((b) => b.id === t.id && !afterDel.features.some((f) => f.id === victim.id) && false)) &&
      afterDel.tasks.every((t) => afterDel.features.some((f) => f.id === (t as unknown as { featureId: string }).featureId)),
  );

  console.log('\n=== membatalkan revisi ===\n');
  check('revisi mengembalikan detail op, bukan cuma jumlah', Array.isArray(del.body.ops));

  const lastRevId = del.body.revisionId as number;
  const undone = await call(`/api/plan/${planId}/undo`, {
    method: 'POST',
    body: JSON.stringify({ revisionId: lastRevId }),
  });
  check('undo diterima', undone.status === 200, String(undone.body.error ?? ''));

  const afterUndo = (await call(`/api/plan/${planId}`)).body as unknown as Plan;
  check('fitur yang dihapus kembali', afterUndo.features.some((f) => f.id === victim.id), victim.id);
  check(
    'task fitur itu ikut kembali',
    afterUndo.tasks.length > afterDel.tasks.length,
    `${afterDel.tasks.length} -> ${afterUndo.tasks.length}`,
  );
  check(
    'centang selesai milik user ikut pulih',
    afterUndo.tasks.find((t) => t.id === before.tasks[0].id)?.done === true,
  );
  // The whole point of snapshotting rather than inverting the operations.
  check(
    'pemulihannya persis, bukan kira-kira',
    afterUndo.features.length === afterAdd.features.length &&
      afterUndo.tasks.length === afterAdd.tasks.length,
    `${afterUndo.features.length} fitur / ${afterUndo.tasks.length} task`,
  );

  const twice = await call(`/api/plan/${planId}/undo`, {
    method: 'POST',
    body: JSON.stringify({ revisionId: lastRevId }),
  });
  check('undo dua kali ditolak', twice.status === 409, String(twice.body.error ?? '').slice(0, 45));

  console.log('\n=== riwayat revisi bertahan setelah reload ===\n');
  const html = await (await fetch(`${BASE}/plans/${planId}`, { headers: { cookie } })).text();
  check('pesan revisi muncul di HTML server-rendered', html.includes('ekspor rekap') || html.includes('Ekspor'));

  console.log('\n=== rate limit kuota bersama ===\n');
  cookie = ''; // fresh session, no key, so it runs on the pool
  const fresh = await call('/api/key');
  check('sesi baru memakai kuota bersama', fresh.body === null);

  let refusedAt = 0;
  for (let i = 1; i <= 5; i++) {
    const res = await call('/api/plan/create', {
      method: 'POST',
      body: JSON.stringify({
        idea: `Aplikasi uji batas kuota nomor ${i} untuk memastikan limit benar-benar menahan.`,
        language: 'id',
        answers: [],
      }),
    });
    if (res.status === 429) {
      refusedAt = i;
      console.log(`       ditolak pada percobaan ke-${i}: ${String(res.body.error).slice(0, 80)}`);
      break;
    }
  }
  check('kuota bersama benar-benar menolak, bukan cuma memperingatkan', refusedAt > 0, `berhenti di #${refusedAt}`);
  check('batasnya 3 rencana per sesi', refusedAt === 4, `ditolak di #${refusedAt}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} lolos${failed.length ? ` — ${failed.length} GAGAL` : ''}\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error('\nGAGAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
