'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Fallback for an unexpected server or render error.
 *
 * Says nothing about the cause: the message of an unhandled error can carry
 * internals, and in production Next.js replaces it anyway. The digest is
 * shown because it is what ties a report back to the server log.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[46rem] px-6 py-14 sm:py-20">
      <header className="flex items-baseline justify-between">
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink hover:text-signal">
          preflight
        </Link>
      </header>

      <main className="mt-16">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Ada yang gagal
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16.5px] leading-relaxed text-muted">
          Halaman ini tidak bisa dimuat. Biasanya ini sementara — coba lagi sebentar.
        </p>
        <p className="mt-8 flex gap-6 text-[15px]">
          <button
            type="button"
            onClick={() => retry()}
            className="font-medium text-ink underline decoration-rule underline-offset-4 hover:text-signal"
          >
            Coba lagi
          </button>
          <Link href="/" className="text-muted underline decoration-rule underline-offset-4 hover:text-signal">
            Ke beranda
          </Link>
        </p>
        {error.digest && (
          <p className="mt-10 text-[13px] text-faint">
            Kode error: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </main>
    </div>
  );
}
