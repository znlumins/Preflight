import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

/**
 * Design review screenshots.
 *
 * Captures the states that actually matter — empty idea form, filled interview,
 * finished plan, mobile — so the layout gets looked at rather than imagined.
 *
 *   npx tsx scripts/shots.ts <planId>
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const planId = process.argv[2];
const OUT = 'shots';

async function main() {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });

  // Claim the session cookie the e2e run used, so the plan page is visible.
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/1-home.png`, fullPage: true });
  console.log('1-home.png');

  // Fill the idea box to see the form in its active state.
  await page.fill(
    '#idea',
    'Aplikasi buat pemilik warung kopi kecil untuk catat stok biji kopi, hitung harga pokok per cangkir, dan lihat menu mana yang paling untung.',
  );
  await page.fill('input[placeholder^="Batasannya"]', 'Sendirian, 4 minggu, budget nol.');
  await page.screenshot({ path: `${OUT}/2-idea-filled.png`, fullPage: true });
  console.log('2-idea-filled.png');

  // Plans are scoped to the session cookie, so the browser has to generate its
  // own rather than borrow one from the e2e run.
  let id = planId;
  if (!id) {
    console.log('membuat plan baru untuk screenshot…');
    const idea =
      'Aplikasi buat pemilik warung kopi kecil untuk catat stok biji kopi, ' +
      'hitung harga pokok per cangkir, dan lihat menu mana yang paling untung.';
    const context = 'Sendirian, 4 minggu, budget nol, web dulu.';

    const q = await page.request.post(`${BASE}/api/plan/questions`, {
      data: { idea, context, language: 'id' },
    });
    const questionnaire = await q.json();

    const created = await page.request.post(`${BASE}/api/plan/create`, {
      data: {
        idea,
        context,
        language: 'id',
        questions: questionnaire,
        answers: questionnaire.questions.map((x: { id: string; options: { label: string }[] }) => ({
          questionId: x.id,
          answer: x.options[0]?.label ?? 'tidak ada preferensi',
        })),
      },
      timeout: 120_000,
    });
    id = (await created.json()).planId;

    for (const stage of ['features', 'specs', 'tasks']) {
      await page.request.post(`${BASE}/api/plan/${id}/${stage}`, { timeout: 180_000 });
      console.log(`  ${stage} selesai`);
    }
  }

  if (id) {
    const planId = id;
    await page.goto(`${BASE}/plans/${planId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/3-plan-top.png` });
    console.log('3-plan-top.png');

    // The thing the product is actually for: a task with its agent prompt.
    const task = page.locator('ol li').filter({ has: page.locator('.screen') }).first();
    if (await task.count()) {
      await task.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/4-tasks.png` });
      console.log('4-tasks.png');
    }

    await page.screenshot({ path: `${OUT}/5-plan-full.png`, fullPage: true });
    console.log('5-plan-full.png');

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      storageState: await ctx.storageState(),
    });
    const m = await mobile.newPage();
    await m.goto(`${BASE}/plans/${planId}`);
    await m.waitForLoadState('networkidle');
    await m.waitForTimeout(400);
    await m.screenshot({ path: `${OUT}/6-mobile.png` });
    console.log('6-mobile.png');
    await mobile.close();
  }

  await page.goto(`${BASE}/pengaturan`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/7-pengaturan.png`, fullPage: true });
  console.log('7-pengaturan.png');

  await browser.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
