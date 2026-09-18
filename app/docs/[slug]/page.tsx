import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/Markdown';
import { getChapter, headings, listChapters, neighbours } from '@/lib/docs';

type Params = { params: Promise<{ slug: string }> };

/** Statically generated: the manual is read from disk at build, never per request. */
export function generateStaticParams() {
  return listChapters().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter) return { title: 'Bab tidak ditemukan — Preflight' };

  return {
    title: `${chapter.title} — Manual Preflight`,
    description: chapter.summary,
    openGraph: { title: chapter.title, description: chapter.summary, type: 'article' },
    alternates: { canonical: `/docs/${slug}` },
  };
}

export default async function ChapterPage({ params }: Params) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter) notFound();

  const onPage = headings(chapter.body);
  const { prev, next } = neighbours(slug);

  return (
    <article>
      <h1 className="max-w-[24ch] text-[32px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[38px]">
        <span className="text-faint">{chapter.number}.</span> {chapter.title}
      </h1>
      {chapter.summary && (
        <p className="mt-5 max-w-[66ch] text-[16.5px] leading-relaxed text-muted">
          {chapter.summary}
        </p>
      )}

      {/* On-page contents, only where there is enough to be worth one. */}
      {onPage.length > 3 && (
        <nav aria-label="Isi bab ini" className="mt-10 border-l-2 border-rule pl-4">
          <h2 className="text-[13px] font-semibold text-faint">Di halaman ini</h2>
          <ul className="mt-2 space-y-1">
            {onPage.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className="text-[14px] leading-snug text-muted hover:text-signal"
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-4">
        <Markdown>{chapter.content}</Markdown>
      </div>

      <nav className="mt-16 grid gap-4 border-t border-rule pt-7 sm:grid-cols-2">
        {prev ? (
          <Link href={`/docs/${prev.slug}`} className="group">
            <span className="text-[13px] text-faint">Sebelumnya</span>
            <span className="mt-0.5 block text-[15.5px] font-medium text-ink group-hover:text-signal">
              {prev.number}. {prev.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/docs/${next.slug}`} className="group sm:text-right">
            <span className="text-[13px] text-faint">Berikutnya</span>
            <span className="mt-0.5 block text-[15.5px] font-medium text-ink group-hover:text-signal">
              {next.number}. {next.title}
            </span>
          </Link>
        )}
      </nav>
    </article>
  );
}
