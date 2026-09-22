import type { Metadata } from 'next';
import Link from 'next/link';
import { IdeaFlow } from '@/components/IdeaFlow';
import { pickExampleIdea } from '@/lib/example-ideas';
import { poolUsage } from '@/lib/limits';
import { keyStatus } from '@/lib/keys';
import { listPlans } from '@/lib/plans';
import { clientIpHash, peekSessionId } from '@/lib/session';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

// Structured data: the site and what it does, in one machine-readable block.
// The URL comes from metadataBase, not hardcoded, so staging and production
// agree without a second source of truth.
const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Preflight',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    inLanguage: 'id-ID',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Preflight',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description:
      'Ubah ide jadi PRD, daftar fitur, dan task berurutan — tiap task berisi prompt siap tempel ke AI coding agent. Gratis.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
];

export default async function Home() {
  const sessionId = await peekSessionId();
  const recent = sessionId ? (await listPlans(sessionId)).reverse().slice(0, 4) : [];
  const byok = sessionId ? await keyStatus(sessionId) : null;
  const usage = sessionId && !byok ? await poolUsage({ sessionId, ipHash: await clientIpHash() }) : null;

  return (
    <div className="mx-auto w-full max-w-[46rem] px-6 py-10 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <span className="text-[15px] font-semibold tracking-tight text-ink">preflight</span>
        <nav className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13.5px] max-sm:w-full max-sm:justify-between max-sm:gap-x-3">
          <Link href="/docs" className="tap whitespace-nowrap text-muted hover:text-signal">
            Cara pakai
          </Link>
          <Link href="/rencana" className="tap whitespace-nowrap text-muted hover:text-signal">
            Contoh rencana
          </Link>
          <Link href="/pengaturan" className="tap whitespace-nowrap text-muted hover:text-signal">
            Pengaturan
          </Link>
        </nav>
      </header>

      <main className="mt-10 sm:mt-20">
        <h1 className="max-w-[20ch] text-[34px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[42px]">
          Apa yang mau kamu bangun?
        </h1>
        <p className="mt-5 max-w-[56ch] text-[16.5px] leading-relaxed text-muted">
          Jawab lima pertanyaan, dapat PRD, daftar fitur, dan task berurutan. Tiap task sudah
          berisi prompt yang tinggal kamu tempel ke Claude Code, Cursor, atau agent lain.
        </p>

        <div className="mt-10">
          <IdeaFlow example={pickExampleIdea()} />
        </div>
      </main>

      {recent.length > 0 && (
        <section className="mt-16 border-t border-rule pt-7">
          <h2 className="text-[14px] font-medium text-muted">Rencana kamu sebelumnya</h2>
          <ul className="mt-4 space-y-1">
            {recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/plans/${p.id}`}
                  className="group flex items-baseline gap-3 py-3 text-[15px] text-ink hover:text-signal pointer-fine:py-1.5"
                >
                  <span className="truncate font-medium group-hover:underline">
                    {p.title ?? p.idea.slice(0, 48)}
                  </span>
                  {p.status !== 'done' && (
                    <span className="shrink-0 text-[13px] text-faint">
                      {p.status === 'error' ? 'gagal' : 'belum selesai'}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-16 border-t border-rule pt-7 text-[13.5px] leading-relaxed text-faint">
        {byok ? (
          <>
            Pakai API key kamu sendiri, jadi tanpa batas dari sisi kami.{' '}
            <Link href="/pengaturan" className="underline decoration-rule underline-offset-4 hover:text-signal">
              Ubah di Pengaturan
            </Link>
            .
          </>
        ) : (
          <>
            Sisa {usage?.sessionRemaining ?? 3} rencana hari ini dengan kuota bersama.{' '}
            <Link href="/pengaturan" className="underline decoration-rule underline-offset-4 hover:text-signal">
              Pasang API key sendiri
            </Link>{' '}
            untuk lepas dari batas itu — gratis. Rencana kamu tersimpan di browser ini tanpa akun.
          </>
        )}
      </footer>
    </div>
  );
}
