import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Halaman tidak ditemukan — Preflight',
  robots: { index: false },
};

/**
 * Also what an owner sees for a plan made in another browser: plans belong to
 * a cookie, so "not found" is usually "not in this browser", and the page says
 * so rather than implying the plan is gone.
 */
export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-[46rem] px-6 py-14 sm:py-20">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <Link href="/" className="tap text-[15px] font-semibold tracking-tight text-ink hover:text-signal">
          preflight
        </Link>
      </header>

      <main className="mt-16">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Halaman ini tidak ada
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16.5px] leading-relaxed text-muted">
          Link-nya mungkin salah ketik, rencananya sudah tidak dibagikan lagi, atau rencana ini
          dibuat di browser lain — rencana tersimpan per browser, bukan per akun.
        </p>
        <p className="mt-8 flex gap-6 text-[15px]">
          <Link href="/" className="font-medium text-ink underline decoration-rule underline-offset-4 hover:text-signal">
            Bikin rencana baru
          </Link>
          <Link href="/rencana" className="text-muted underline decoration-rule underline-offset-4 hover:text-signal">
            Lihat rencana yang dibagikan
          </Link>
        </p>
      </main>
    </div>
  );
}
