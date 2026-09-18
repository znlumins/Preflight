import Link from 'next/link';
import { DocsNav } from '@/components/DocsNav';
import { listChapters } from '@/lib/docs';

/**
 * Shell for the manual.
 *
 * The sidebar is a plain list in the document, above the content on narrow
 * screens and beside it on wide ones. No drawer, no toggle: a documentation
 * site whose navigation needs JavaScript is a documentation site that fails
 * for the people most likely to be reading it from a broken environment.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const chapters = listChapters();

  return (
    <div className="mx-auto w-full max-w-[64rem] px-6 py-10 sm:py-14">
      <header className="flex items-baseline justify-between gap-4">
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink hover:text-signal">
          preflight
        </Link>
        <nav className="flex items-baseline gap-5 text-[13.5px]">
          <Link href="/docs" className="text-muted hover:text-signal">
            Manual
          </Link>
          <Link href="/rencana" className="text-muted hover:text-signal">
            Contoh rencana
          </Link>
          <Link href="/" className="text-muted hover:text-signal">
            Bikin rencana
          </Link>
        </nav>
      </header>

      <div className="mt-12 gap-14 lg:flex">
        <aside className="shrink-0 lg:w-52">
          <div className="lg:sticky lg:top-10">
            <DocsNav chapters={chapters} />
          </div>
        </aside>

        <main className="mt-12 min-w-0 flex-1 lg:mt-0">{children}</main>
      </div>
    </div>
  );
}
