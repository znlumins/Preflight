'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Publishing a plan to a public URL.
 *
 * This is the one control on the page that sends someone's product idea out of
 * their browser, so it states the consequence before the action rather than
 * after: published means anyone with the link, and search engines too. The
 * button says what will happen, and taking it down is one click from here.
 */
export function SharePlan({ planId, initialSlug }: { planId: string; initialSlug: string | null }) {
  const [slug, setSlug] = useState(initialSlug);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Read from the environment rather than `window.location`: the latter is
  // empty during server rendering and populated on the client, which renders
  // two different strings and fails hydration.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const url = slug ? `${origin}/p/${slug}` : '';

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/plan/${planId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlug(data.slug);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menerbitkan.');
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    setError(null);
    try {
      await fetch(`/api/plan/${planId}/publish`, { method: 'DELETE' });
      setSlug(null);
    } catch {
      setError('Gagal menurunkan.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Tidak bisa menyalin. Salin manual dari kotak di atas.');
    }
  }

  if (slug) {
    return (
      <section className="mt-16 border-t border-rule pt-8">
        <h2 className="text-[19px] font-semibold tracking-tight text-ink">Rencana ini publik</h2>
        <p className="mt-2 max-w-[62ch] text-[15.5px] leading-relaxed text-muted">
          Siapa pun yang punya tautannya bisa membacanya, dan mesin pencari bisa mengindeksnya.
          Yang tampil hanya rencananya — ide asli, jawaban kuesioner, dan riwayat revisi kamu
          tidak ikut.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-[3px] border border-rule bg-paper-sunk px-3 py-2 font-mono text-[13.5px] text-ink">
            {url}
          </code>
          <button
            type="button"
            onClick={copy}
            className="rounded-[3px] bg-ink px-4 py-2 text-[14px] font-medium text-paper transition-opacity hover:opacity-90"
          >
            {copied ? 'Tersalin' : 'Salin tautan'}
          </button>
          <a
            href={`/p/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="tap text-[14px] text-muted underline decoration-rule underline-offset-4 hover:text-signal"
          >
            Lihat
          </a>
        </div>

        <button
          type="button"
          onClick={unpublish}
          disabled={busy}
          className="mt-4 text-[14px] text-muted underline decoration-rule underline-offset-4 hover:text-warn disabled:opacity-50"
        >
          Turunkan dari publik
        </button>

        {error && (
          <p role="alert" className="mt-3 border-l-2 border-warn pl-3 text-[14px] text-warn">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mt-16 border-t border-rule pt-8">
      <h2 className="text-[19px] font-semibold tracking-tight text-ink">Bagikan rencana ini</h2>
      <p className="mt-2 max-w-[62ch] text-[15.5px] leading-relaxed text-muted">
        Terbitkan ke tautan publik yang bisa kamu kirim ke tim, klien, atau siapa pun. Rencananya
        saja yang tampil — ide asli, jawaban kuesioner, dan riwayat revisi kamu tetap tersimpan
        pribadi.
      </p>

      {confirming ? (
        <div className="mt-5 border-l-2 border-warn pl-4">
          <p className="max-w-[62ch] text-[14.5px] leading-relaxed text-ink">
            Setelah terbit, siapa pun yang punya tautannya bisa membaca, dan mesin pencari bisa
            mengindeksnya. Kamu bisa menurunkannya kapan saja, tapi yang sudah terlanjur dibaca
            atau ter-cache tidak bisa ditarik kembali.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={publish}
              disabled={busy}
              className="rounded-[3px] bg-ink px-5 py-2.5 text-[15px] font-medium text-paper transition-colors hover:opacity-90 disabled:bg-rule disabled:text-faint"
            >
              {busy ? 'Menerbitkan' : 'Ya, terbitkan'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-[14px] text-muted underline decoration-rule underline-offset-4 hover:text-ink"
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-5 rounded-[3px] border border-rule px-4 py-2 text-[14.5px] text-ink transition-colors hover:border-faint"
        >
          Terbitkan ke tautan publik
        </button>
      )}

      {error && (
        <p role="alert" className="mt-3 border-l-2 border-warn pl-3 text-[14px] text-warn">
          {error}
        </p>
      )}
    </section>
  );
}
