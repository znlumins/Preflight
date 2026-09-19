import Link from 'next/link';
import { DocsNav } from '@/components/DocsNav';
import { listChapters } from '@/lib/docs';

/**
 * Shell for the manual.
 *
 * The sidebar sits beside the content on wide screens and folds into a
 * <details> above it on narrow ones. No drawer, no scripted toggle: a
 * documentation site whose navigation needs JavaScript is a documentation site
 * that fails for the people most likely to be reading it from a broken
 * environment.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const chapters = listChapters();

  return (
    <div className="mx-auto w-full max-w-[64rem] px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <Link href="/" className="tap text-[15px] font-semibold tracking-tight text-ink hover:text-signal">
          preflight
        </Link>
        <nav className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13.5px]">
          <Link href="/docs" className="tap whitespace-nowrap text-muted hover:text-signal">
            Manual
          </Link>
          <Link href="/rencana" className="tap whitespace-nowrap text-muted hover:text-signal">
            Contoh rencana
          </Link>
          <Link href="/" className="tap whitespace-nowrap text-muted hover:text-signal">
            Bikin rencana
          </Link>
        </nav>
      </header>

      {/* Narrow screens: folded, so the chapter is the first thing on the
          screen instead of ten links. <details> opens without JavaScript. */}
      <details className="group mt-8 border-y border-rule lg:hidden">
        <summary
          className="flex cursor-pointer list-none items-center justify-between py-3.5 text-[14.5px]
                     text-muted [&::-webkit-details-marker]:hidden"
        >
          Daftar bab
          <svg
            viewBox="0 0 12 12"
            aria-hidden
            className="h-3 w-3 text-faint transition-transform duration-150 group-open:rotate-180"
          >
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </summary>
        <div className="pb-5 pt-1">
          <DocsNav chapters={chapters} />
        </div>
      </details>

      <div className="mt-10 gap-14 lg:mt-12 lg:flex">
        <aside className="hidden shrink-0 lg:block lg:w-52">
          <div className="lg:sticky lg:top-10">
            <DocsNav chapters={chapters} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
