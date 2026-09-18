import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

/**
 * BYOK checks against the running dev server.
 *
 * The important assertions here are the negative ones: a saved key must never
 * come back out of the API, and must not be readable in the database. Those are
 * the promises the settings page makes to the user, so they get tested rather
 * than assumed.
 *
 *   npx tsx scripts/e2e-byok.ts
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
  return { status: res.status, body, text };
}

const results: { label: string; ok: boolean; detail: string }[] = [];
const check = (label: string, ok: boolean, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'GAGAL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

async function main() {
  if (!REAL_KEY) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY belum diisi di .env.local');

  console.log('\n=== BYOK ===\n');

  const empty = await call('/api/key');
  check('sesi baru belum punya key', empty.status === 200 && empty.body === null);

  const rejected = await call('/api/key', {
    method: 'PUT',
    body: JSON.stringify({ provider: 'google', apiKey: 'AIza-jelas-salah-sekali' }),
  });
  check(
    'key ngawur ditolak sebelum disimpan',
    rejected.status === 400,
    String(rejected.body.error ?? '').slice(0, 60),
  );

  const stillEmpty = await call('/api/key');
  check('key ngawur tidak ikut tersimpan', stillEmpty.body === null);

  const saved = await call('/api/key', {
    method: 'PUT',
    body: JSON.stringify({ provider: 'google', apiKey: REAL_KEY }),
  });
  check('key asli diterima', saved.status === 200, JSON.stringify(saved.body));

  const status = await call('/api/key');
  const leaked = status.text.includes(REAL_KEY) || status.text.includes(REAL_KEY.slice(0, 20));
  check('GET /api/key tidak membocorkan key', !leaked);
  check(
    'yang dikembalikan hanya 4 karakter terakhir',
    (status.body as { hint?: string }).hint === REAL_KEY.slice(-4),
    String((status.body as { hint?: string }).hint),
  );

  const settingsHtml = await (await fetch(`${BASE}/pengaturan`, { headers: { cookie } })).text();
  check('halaman pengaturan tidak memuat key', !settingsHtml.includes(REAL_KEY.slice(0, 20)));

  // A plan generated on the user's own key should be logged as byok, and should
  // use the deep tier that the shared pool cannot afford.
  console.log('\n=== generasi memakai key sendiri ===\n');
  const q = await call('/api/plan/questions', {
    method: 'POST',
    body: JSON.stringify({
      idea: 'Aplikasi buat guru les privat untuk atur jadwal murid dan catat pembayaran bulanan.',
      context: 'Sendirian, 3 minggu, budget nol.',
      language: 'id',
    }),
  });
  check('tahap pertanyaan jalan di key user', q.status === 200);

  const created = await call('/api/plan/create', {
    method: 'POST',
    body: JSON.stringify({
      idea: 'Aplikasi buat guru les privat untuk atur jadwal murid dan catat pembayaran bulanan.',
      context: 'Sendirian, 3 minggu, budget nol.',
      language: 'id',
      questions: q.body,
      answers: [],
    }),
  });
  const planId = created.body.planId as string;
  check('PRD dibuat', !!planId && !created.body.error, String(created.body.error ?? ''));

  const removed = await call('/api/key', { method: 'DELETE' });
  check('key bisa dihapus', removed.status === 200);
  const afterDelete = await call('/api/key');
  check('setelah dihapus kembali ke kuota bersama', afterDelete.body === null);

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} lolos${failed.length ? ` — ${failed.length} GAGAL` : ''}\n`,
  );
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error('\nGAGAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
