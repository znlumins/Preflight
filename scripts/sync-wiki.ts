/**
 * Writes the GitHub wiki from `docs/`.
 *
 *   git clone https://github.com/znlumins/Preflight.wiki.git ../Preflight.wiki
 *   npx tsx scripts/sync-wiki.ts ../Preflight.wiki
 *   cd ../Preflight.wiki && git add -A && git commit -m "Sync from docs/" && git push
 *
 * `docs/` stays the only source. The in-app manual at /docs already renders
 * the same files; the wiki is a third surface, and a hand-edited third copy
 * would drift from the other two within a release. So every page here is
 * generated, says where it came from, and is overwritten on the next sync.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'https://github.com/znlumins/Preflight';
const SITE = 'https://preflight.luminszn.my.id';
const DOCS = join(process.cwd(), 'docs');

const out = process.argv[2];
if (!out) {
  console.error('Usage: npx tsx scripts/sync-wiki.ts <path-to-wiki-clone>');
  process.exit(1);
}

type Page = { file: string; slug: string; number: string; title: string; wiki: string };

const read = (file: string) => readFileSync(join(DOCS, file), 'utf8').replace(/\r\n/g, '\n');

const pages: Page[] = readdirSync(DOCS)
  .filter((f) => /^\d+-.+\.md$/.test(f))
  .sort()
  .map((file) => {
    const heading = read(file).match(/^# (.+)$/m)?.[1] ?? file;
    const [, number = '', title = heading] = heading.match(/^(\d+)\.\s+(.+)$/) ?? [];
    return {
      file,
      slug: file.replace(/\.md$/, ''),
      number,
      title,
      // GitHub names a wiki page after its file, with hyphens shown as spaces.
      wiki: title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, ''),
    };
  });

const byFile = new Map(pages.map((p) => [p.file, p]));

/** Rewrites repo-relative links for the wiki: chapters to pages, the rest to GitHub. */
function relink(markdown: string): string {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (whole, target: string) => {
    if (/^(https?:|mailto:|#)/.test(target)) return whole;
    const [path, anchor] = target.split('#');
    const hash = anchor ? `#${anchor}` : '';
    if (path === 'README.md') return `](Home${hash})`;
    const page = byFile.get(path);
    if (page) return `](${page.wiki}${hash})`;
    // Anything else is a file in the repo, relative to docs/.
    const resolved = new URL(path, `${REPO}/blob/master/docs/`).href;
    return `](${resolved}${hash})`;
  });
}

function footer(source: string, siteSlug?: string) {
  const site = siteSlug ? ` · [baca di situs](${SITE}/docs/${siteSlug})` : '';
  return (
    `\n\n---\n\n<sub>Disalin dari [\`docs/${source}\`](${REPO}/blob/master/docs/${source})${site}. ` +
    'Ubah file itu di repo, bukan halaman ini: wiki ditulis ulang tiap sinkronisasi.</sub>\n'
  );
}

let written = 0;
const write = (name: string, body: string) => {
  writeFileSync(join(out, name), body);
  written++;
};

// Chapters. The wiki shows the file name as the page title, so the H1 and the
// back-link to the contents go — the sidebar does both jobs.
for (const page of pages) {
  const body = read(page.file)
    .replace(/^\[← Daftar isi\]\(README\.md\)\s*\n+/, '')
    .replace(/^# .+\n+/m, '')
    .replace(/^---\n+/, '');
  write(`${page.wiki}.md`, relink(body).trimEnd() + footer(page.file, page.slug));
}

// Home is the manual's own index.
const home = read('README.md').replace(/^# .+\n+/m, '');
write(
  'Home.md',
  `> Versi wiki dari [panduan di situs](${SITE}/docs). Isinya sama.\n\n` +
    relink(home).trimEnd() +
    footer('README.md'),
);

// Sidebar, grouped the way the index groups them: chapters 1–5 for people
// using the app, 6 onward for people running or changing it.
const link = (p: Page) => `- [${p.number}. ${p.title}](${p.wiki})`;
const users = pages.filter((p) => Number(p.number) <= 5);
const devs = pages.filter((p) => Number(p.number) > 5);
write(
  '_Sidebar.md',
  [
    '**[Panduan Preflight](Home)**',
    '',
    '**Untuk pengguna**',
    ...users.map(link),
    '',
    '**Untuk pengembang**',
    ...devs.map(link),
    '',
    `[Buka aplikasinya](${SITE}) · [Repo](${REPO})`,
    '',
  ].join('\n'),
);

console.log(`Wrote ${written} files to ${out}`);
