import { config as loadEnv } from 'dotenv';
import { listChapters } from '../lib/docs';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

/**
 * Manual site checks against the running dev server.
 *
 * The two things most likely to rot silently: on-page anchors that point at
 * heading ids that no longer exist, and cross-chapter links still written as
 * `.md` paths. Both look fine until someone clicks.
 *
 *   npx tsx scripts/e2e-docs.ts
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const results: { label: string; ok: boolean }[] = [];
const check = (label: string, ok: boolean, detail = '') => {
  results.push({ label, ok });
  console.log(`  ${ok ? 'ok  ' : 'GAGAL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const get = async (path: string) => {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  return { status: res.status, html: await res.text() };
};

const textOf = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

async function main() {
  const chapters = listChapters();

  console.log('\n=== indeks ===\n');
  const index = await get('/docs');
  check('halaman /docs terbuka', index.status === 200, `HTTP ${index.status}`);
  check(
    'semua bab tertaut dari indeks',
    chapters.every((c) => index.html.includes(`/docs/${c.slug}`)),
    `${chapters.length} bab`,
  );

  console.log('\n=== tiap bab ===\n');
  for (const c of chapters) {
    const { status, html } = await get(`/docs/${c.slug}`);
    if (status !== 200) {
      check(`${c.number}. ${c.title}`, false, `HTTP ${status}`);
      continue;
    }

    // Anchors must resolve: rehype-slug generates the ids, and the table of
    // contents is built separately, so the two can drift apart unnoticed.
    const ids = new Set([...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1]));
    const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    const broken = anchors.filter((a) => !ids.has(a));

    // Links between chapters are authored as `.md` for GitHub; none should
    // survive into the rendered page.
    const rawMd = (html.match(/href="[^"]*\d\d-[a-z-]+\.md"/g) ?? []).length;

    const words = textOf(html);
    const ok = broken.length === 0 && rawMd === 0 && words > 200;

    check(
      `${c.number}. ${c.title}`,
      ok,
      [
        `${words} kata`,
        `${anchors.length} anchor`,
        broken.length ? `RUSAK: ${broken.join(', ')}` : '',
        rawMd ? `${rawMd} tautan .md tersisa` : '',
      ]
        .filter(Boolean)
        .join(', '),
    );
  }

  console.log('\n=== SEO ===\n');
  const sample = await get(`/docs/${chapters[chapters.length - 1].slug}`);
  check('judul halaman spesifik per bab', /<title>[^<]*Manual Preflight/.test(sample.html));
  check('ada meta description', /<meta name="description"/.test(sample.html));
  check('ada canonical', /rel="canonical"/.test(sample.html));

  const sitemap = await get('/sitemap.xml');
  check(
    'semua bab ada di sitemap',
    chapters.every((c) => sitemap.html.includes(`/docs/${c.slug}`)),
  );

  console.log('\n=== bab yang tidak ada ===\n');
  const missing = await get('/docs/bab-yang-tidak-pernah-ada');
  check('404, bukan halaman kosong', missing.status === 404, `HTTP ${missing.status}`);

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
