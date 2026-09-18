import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

/**
 * Public sharing checks against the running dev server.
 *
 * Publishing is the only thing in this app that sends a user's product idea out
 * of their own browser, so most of these assertions are about what must NOT
 * happen: an unpublished plan stays unreachable, a published one exposes the
 * plan and not its author, and taking it down really takes it down.
 *
 *   npx tsx scripts/e2e-public.ts
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

/** Fetches a page with no cookie at all — the way a stranger or a crawler would. */
async function anonymous(path: string) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  return { status: res.status, text: await res.text() };
}

const results: { label: string; ok: boolean }[] = [];
const check = (label: string, ok: boolean, detail = '') => {
  results.push({ label, ok });
  console.log(`  ${ok ? 'ok  ' : 'GAGAL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const IDEA =
  'Aplikasi untuk penyewaan alat kemah: katalog alat, cek ketersediaan tanggal, dan hitung total sewa.';
const SECRET_CONTEXT = 'RAHASIA-BISNIS-JANGAN-BOCOR: margin 40 persen, partner utama Eiger.';

async function main() {
  if (!REAL_KEY) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY belum diisi.');

  await call('/api/key', {
    method: 'PUT',
    body: JSON.stringify({ provider: 'google', apiKey: REAL_KEY }),
  });

  console.log('\n=== menyiapkan rencana ===\n');
  const q = await call('/api/plan/questions', {
    method: 'POST',
    body: JSON.stringify({ idea: IDEA, context: SECRET_CONTEXT, language: 'id' }),
  });
  const created = await call('/api/plan/create', {
    method: 'POST',
    body: JSON.stringify({
      idea: IDEA,
      context: SECRET_CONTEXT,
      language: 'id',
      questions: q.body,
      answers: [],
    }),
  });
  const planId = created.body.planId as string;
  for (const stage of ['features', 'specs', 'tasks']) {
    await call(`/api/plan/${planId}/${stage}`, { method: 'POST' });
  }
  const plan = (await call(`/api/plan/${planId}`)).body as unknown as {
    plan: { status: string; title: string };
    features: unknown[];
    tasks: unknown[];
  };
  check('rencana selesai', plan.plan.status === 'done', `${plan.features.length} fitur, ${plan.tasks.length} task`);

  console.log('\n=== sebelum diterbitkan, harus tidak terjangkau ===\n');
  const privatePage = await anonymous(`/plans/${planId}`);
  check('halaman privat 404 untuk orang lain', privatePage.status === 404, `HTTP ${privatePage.status}`);

  // Compared by the links the index actually contains, not by title: two plans
  // can legitimately share a name, and a title match would report a leak that
  // is not one.
  const linksIn = (html: string) => new Set(html.match(/\/p\/[a-z0-9-]+/g) ?? []);
  const indexBefore = linksIn((await anonymous('/rencana')).text);
  check('indeks publik dibaca sebagai daftar tautan', true, `${indexBefore.size} sudah terbit`);

  console.log('\n=== menerbitkan ===\n');
  const published = await call(`/api/plan/${planId}/publish`, { method: 'POST' });
  const slug = published.body.slug as string;
  check('terbit', published.status === 200 && !!slug, slug);
  check('slug aman untuk URL', /^[a-z0-9-]+$/.test(slug ?? ''));

  const pub = await anonymous(`/p/${slug}`);
  check('halaman publik bisa dibuka tanpa cookie', pub.status === 200, `HTTP ${pub.status}`);
  check('isi rencana tampil', pub.text.includes(plan.plan.title));

  // The point of publishing the plan and not the person.
  console.log('\n=== yang TIDAK boleh ikut tampil ===\n');
  check('konteks rahasia tidak bocor', !pub.text.includes('RAHASIA-BISNIS-JANGAN-BOCOR'));
  check('teks ide asli tidak bocor', !pub.text.includes(IDEA.slice(0, 40)));
  check('id sesi pemilik tidak bocor', !pub.text.includes(cookie.split('=')[1] ?? 'xxx'));
  check('id internal rencana tidak dipakai di URL publik', !slug.includes(planId));

  console.log('\n=== SEO ===\n');
  check('judul halaman memakai nama produk', pub.text.includes(`<title>${plan.plan.title}`));
  check('ada meta description', /<meta name="description"/.test(pub.text));
  check('ada Open Graph', /property="og:title"/.test(pub.text));
  check('ada structured data', pub.text.includes('"@type":"TechArticle"'));
  check('ada canonical', /rel="canonical"/.test(pub.text));

  const sitemap = await anonymous('/sitemap.xml');
  check('sitemap memuat rencana ini', sitemap.text.includes(`/p/${slug}`), `HTTP ${sitemap.status}`);

  const robots = await anonymous('/robots.txt');
  check('robots melarang /plans/', robots.text.includes('/plans/'));
  check('robots melarang /api/', robots.text.includes('/api/'));
  check('robots menunjuk sitemap', robots.text.toLowerCase().includes('sitemap'));

  const indexAfter = linksIn((await anonymous('/rencana')).text);
  check('muncul di indeks publik', indexAfter.has(`/p/${slug}`));
  check(
    'yang bertambah di indeks hanya rencana ini',
    indexAfter.size === indexBefore.size + 1,
    `${indexBefore.size} -> ${indexAfter.size}`,
  );

  console.log('\n=== menurunkan ===\n');
  const down = await call(`/api/plan/${planId}/publish`, { method: 'DELETE' });
  check('turun diterima', down.status === 200);

  const gone = await anonymous(`/p/${slug}`);
  check('tautan lama jadi 404, bukan tetap terbaca', gone.status === 404, `HTTP ${gone.status}`);

  const indexDown = linksIn((await anonymous('/rencana')).text);
  check('hilang dari indeks setelah diturunkan', !indexDown.has(`/p/${slug}`));

  const sitemapAfter = await anonymous('/sitemap.xml');
  check('hilang dari sitemap', !sitemapAfter.text.includes(`/p/${slug}`));

  console.log('\n=== orang lain tidak bisa menerbitkan rencana kita ===\n');
  const stranger = await fetch(`${BASE}/api/plan/${planId}/publish`, {
    method: 'POST',
    headers: { cookie: 'preflight_sid=orang-lain-sama-sekali' },
  });
  check('publish oleh sesi lain ditolak', stranger.status >= 400, `HTTP ${stranger.status}`);

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
