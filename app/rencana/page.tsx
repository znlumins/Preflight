import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prd } from '@/lib/ai/schemas';
import { listPublicPlans } from '@/lib/publish';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Rencana yang dibagikan — Preflight',
  description:
    'Kumpulan PRD, daftar fitur, dan task siap kerja yang dibagikan publik. Lihat bagaimana orang lain merencanakan produknya sebelum menulis kode.',
  alternates: { canonical: '/rencana' },
};

/** The public index: every shared plan is a way in for someone searching. */
export default async function PublicIndex() {
  const plans = await listPublicPlans(100);

  return (
    <div className="mx-auto w-full max-w-[46rem] px-6 py-14 sm:py-20">
      <header className="flex items-baseline justify-between">
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink hover:text-signal">
          preflight
        </Link>
        <Link href="/" className="text-[13.5px] text-muted hover:text-signal">
          Bikin rencana
        </Link>
      </header>

      <main className="mt-16">
        <h1 className="max-w-[24ch] text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Rencana yang dibagikan
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16.5px] leading-relaxed text-muted">
          PRD, daftar fitur, dan task lengkap dengan prompt siap tempel — dibagikan publik oleh
          pembuatnya. Lihat bagaimana orang lain memecah idenya sebelum menulis baris pertama.
        </p>

        {plans.length === 0 ? (
          <p className="mt-12 border-l-2 border-rule pl-4 text-[15.5px] leading-relaxed text-muted">
            Belum ada yang dibagikan. Kalau kamu bikin rencana, kamu bisa jadi yang pertama —
            terbitkan dari halaman rencananya.
          </p>
        ) : (
          <ul className="mt-12 divide-y divide-rule border-t border-rule">
            {plans.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/p/${p.slug}`}
                  className="group block py-4"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="min-w-0 truncate text-[16px] font-medium text-ink group-hover:text-signal group-hover:underline">
                      {p.title}
                    </span>
                    {p.publishedAt && (
                      <time
                        dateTime={p.publishedAt.toISOString()}
                        className="shrink-0 text-[13.5px] tabular-nums text-faint"
                      >
                        {p.publishedAt.toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </time>
                    )}
                  </div>
                  {/* The summary is both the useful subtitle and the indexable
                      text that makes this page worth a crawler's time. */}
                  {(p.prd as Prd | null)?.oneLiner && (
                    <p className="mt-1 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
                      {(p.prd as Prd).oneLiner}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
