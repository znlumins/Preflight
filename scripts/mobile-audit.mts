/**
 * Mobile audit: run every page through real phone viewports and report
 * anything that scrolls sideways, taps smaller than a finger, or wraps the
 * header nav into two rows.
 *
 * Reads its targets from argv so it is reusable against any local session:
 *
 *   npx tsx scripts/mobile-audit.mts \
 *     --base http://localhost:3000 \
 *     --sid <preflight_sid cookie> \
 *     --plan <plan id> --slug <public slug>
 *
 * The plan's slug is swapped in for the run so `/p/<slug>` is reachable, and
 * restored afterwards even when the audit crashes. Screenshots of the smallest
 * profile land in shots/mobile-audit/ for eyeballing.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { chromium, devices } from 'playwright';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i !== -1 ? process.argv[i + 1] : undefined;
  if (v === undefined && fallback === undefined) {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return v ?? fallback!;
}

const B = arg('base', 'http://localhost:3000');
const SID = arg('sid');
const PLAN = arg('plan');
const SLUG = arg('slug', 'mobile-audit');

const { default: postgres } = await import('postgres');
const sql = postgres(process.env.DATABASE_URL!);
const [orig] = await sql`select public_slug, published_at from plans where id = ${PLAN}`;
await sql`update plans set public_slug = ${SLUG}, published_at = now() where id = ${PLAN}`;

const Q = { questions: [
  { id: 'a', question: 'Siapa yang paling sering memakai aplikasinya?', why: 'Menentukan alur tercepat.', type: 'single', options: [ { value: 'x', label: 'Pemilik usaha' }, { value: 'y', label: 'Kasir' } ] },
  { id: 'b', question: 'Satu fitur wajib di versi pertama?', why: 'Jadi P0.', type: 'text', options: [] } ] };

const CHECK = `(() => {
  var small = [], smallFont = [];
  document.querySelectorAll('a, button, input, textarea, summary').forEach(function (el) {
    var b = el.getBoundingClientRect(); if (!b.width) return;
    var cs = getComputedStyle(el), after = getComputedStyle(el, '::after'), h = b.height;
    if (after.content !== 'none' && after.position === 'absolute') h = Math.max(h, parseFloat(after.height));
    if (cs.display === 'inline') h = h + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    if (h < 43.5) small.push(el.tagName.toLowerCase() + ' "' + ((el.textContent || el.getAttribute('aria-label') || el.placeholder || '').trim().slice(0, 22)) + '" ' + Math.round(h));
    if ((el.tagName === 'INPUT' && el.type !== 'radio' || el.tagName === 'TEXTAREA') && parseFloat(cs.fontSize) < 16) smallFont.push(el.tagName.toLowerCase() + ' ' + cs.fontSize);
  });
  var nav = document.querySelector('header nav'); var rows = 0;
  if (nav) { var tops = {}; nav.querySelectorAll('a').forEach(function (a) { tops[Math.round(a.getBoundingClientRect().top)] = 1; }); rows = Object.keys(tops).length; }
  return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: small, smallFont: smallFont, navRows: rows };
})()`;

const profiles = { 'iPhone SE': devices['iPhone SE'], 'iPhone 13': devices['iPhone 13'], 'iPhone 13 miring': devices['iPhone 13 landscape'], 'Pixel 7': devices['Pixel 7'], 'Galaxy S8': devices['Galaxy S8'] };
const pages = ['/', '/pengaturan', '/docs', '/docs/05-agent', '/rencana', '/plans/' + PLAN, '/p/' + SLUG];

const browser = await chromium.launch();
try {
  for (const [name, dev] of Object.entries(profiles)) {
    // `defaultBrowserType` is Playwright-internal; the rest of the device
    // descriptor is the viewport + UA + touch context the audit wants.
    const { defaultBrowserType: _drop, ...opts } = dev as typeof dev & { defaultBrowserType?: string };
    void _drop;
    const ctx = await browser.newContext(opts);
    await ctx.addCookies([{ name: 'preflight_sid', value: SID, url: B }]);
    await ctx.route('**/api/plan/questions', (r) => r.fulfill({ json: Q }));
    const page = await ctx.newPage();
    const issues: string[] = [];
    for (const path of pages) {
      await page.goto(B + path, { waitUntil: 'networkidle' });
      const r = (await page.evaluate(CHECK)) as { over: number; small: string[]; smallFont: string[]; navRows: number };
      if (r.over || r.small.length || r.smallFont.length || r.navRows > 1) issues.push(`${path}: over=${r.over} navRows=${r.navRows} ${r.small.join(' | ')} ${r.smallFont.join(',')}`);
    }
    await page.goto(B + '/', { waitUntil: 'networkidle' });
    await page.fill('#idea', 'Aplikasi kasir buat warung kopi kecil dengan stok dan rekap harian');
    await page.getByRole('button', { name: 'Mulai' }).click();
    await page.getByText('Lima pertanyaan.').waitFor();
    const r = (await page.evaluate(CHECK)) as { over: number; small: string[]; smallFont: string[] };
    if (r.over || r.small.length || r.smallFont.length) issues.push(`wawancara: over=${r.over} ${r.small.join(' | ')} ${r.smallFont.join(',')}`);
    console.log(name + ': ' + (issues.length ? '\n   ' + issues.join('\n   ') : 'bersih'));
    if (name === 'iPhone SE') {
      for (const p of ['/', '/docs']) {
        await page.goto(B + p, { waitUntil: 'networkidle' });
        await page.screenshot({ path: 'shots/mobile-audit/se' + p.replace('/', '-') + '.png', clip: { x: 0, y: 0, width: 320, height: 330 } });
      }
    }
    if (name === 'iPhone 13 miring') {
      await page.goto(B + '/', { waitUntil: 'networkidle' });
      await page.screenshot({ path: 'shots/mobile-audit/landscape-home.png' });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await sql`update plans set public_slug = ${orig.public_slug}, published_at = ${orig.published_at} where id = ${PLAN}`;
  await sql.end();
}
