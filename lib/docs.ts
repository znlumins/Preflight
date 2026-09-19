import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import GithubSlugger from 'github-slugger';

/**
 * The manual, read from `docs/` at build time.
 *
 * One source, two surfaces: the Markdown files stay readable on GitHub while
 * these pages render the same text as a real site. Keeping a second copy in a
 * CMS would guarantee the two drift apart.
 *
 * The pages are statically generated, so these reads happen during the build
 * and never on a request.
 */

const DIR = join(process.cwd(), 'docs');

export type Chapter = {
  /** URL segment, e.g. "01-mulai" */
  slug: string;
  /** Chapter number for the sidebar, e.g. "1" */
  number: string;
  /** First H1 in the file, minus its leading number */
  title: string;
  /** First paragraph that is not a back-link, for metadata and the index */
  summary: string;
  body: string;
  /**
   * Body without its H1 and opening paragraph.
   *
   * The page renders those two itself so the on-page contents can sit between
   * the introduction and the first section, which is where a reader looks for
   * it — rather than above the title, which is where it lands otherwise.
   */
  content: string;
};

/**
 * Reads a chapter with line endings normalised to \n.
 *
 * Git checks these files out as CRLF on Windows, and a lone \r is not \n — so
 * a pattern like `[^\n]+` matches the carriage return sitting on an otherwise
 * blank line and runs straight through the document. Normalising once here is
 * cheaper than making every pattern below CRLF-aware.
 */
function read(file: string): string {
  return readFileSync(join(DIR, file), 'utf8').replace(/\r\n/g, '\n');
}

/** Strips the back-link line so it does not render inside the page body. */
function stripBackLink(markdown: string): string {
  return markdown.replace(/^\[← Daftar isi\]\(README\.md\)\s*\n+/, '');
}

/**
 * The chapter's opening paragraph, or '' if it does not open with one.
 *
 * Only the first block counts. Searching further used to reach into the body
 * when a chapter opened with a rule or a table, and came back with whatever
 * prose-shaped text it met first — for chapter 6 a line from inside a code
 * block, a connection string with no spaces that pushed the index page
 * 200px past the edge of a phone.
 */
function openingParagraph(markdown: string): string {
  const block = markdown.split(/\n{2,}/)[0]?.trim() ?? '';
  if (!block || /^(#|\[|\||>|```|-|\*\s|\d+\.\s)/.test(block)) return '';
  return block.replace(/\s+/g, ' ').replace(/\*\*|`/g, '').slice(0, 200);
}

export function listChapters(): Chapter[] {
  return readdirSync(DIR)
    .filter((f) => /^\d\d-.+\.md$/.test(f))
    .sort()
    .map((file) => {
      const raw = read(file);
      const body = stripBackLink(raw);
      const heading = body.match(/^#\s+(.+)$/m)?.[1] ?? file;
      const [, number = '', title = heading] = heading.match(/^(\d+)\.\s+(.+)$/) ?? [];

      const afterTitle = body.replace(/^#\s+.+$/m, '').replace(/^\s+/, '');
      const summary = openingParagraph(afterTitle);

      return {
        slug: file.replace(/\.md$/, ''),
        number,
        title,
        summary,
        body,
        // Drop the opening paragraph too, but only when it is the summary the
        // page is about to render on its own.
        content: summary
          ? afterTitle.replace(/^[^\n]+(\n(?!\n)[^\n]+)*\n*/, '').replace(/^\s*---\s*\n/, '')
          : afterTitle,
      };
    });
}

export function getChapter(slug: string): Chapter | null {
  return listChapters().find((c) => c.slug === slug) ?? null;
}

/** Previous and next chapter, for the footer. */
export function neighbours(slug: string) {
  const all = listChapters();
  const i = all.findIndex((c) => c.slug === slug);
  return { prev: i > 0 ? all[i - 1] : null, next: i >= 0 && i < all.length - 1 ? all[i + 1] : null };
}

/**
 * Headings inside a chapter, for the on-page contents.
 *
 * Ids come from `github-slugger`, the same library `rehype-slug` uses to stamp
 * them onto the rendered headings. Reimplementing the rule looked fine until a
 * heading contained an em dash: "Langkah 1 — Tulis idenya" becomes
 * `langkah-1--tulis-idenya`, with the doubled hyphen the dash leaves behind,
 * and a hand-rolled version that collapsed whitespace produced a link to
 * nothing. Sharing the library removes the class of bug.
 */
export function headings(body: string): { id: string; text: string }[] {
  const slugger = new GithubSlugger();
  return [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => {
    const text = m[1].replace(/`/g, '').trim();
    return { id: slugger.slug(text), text };
  });
}
