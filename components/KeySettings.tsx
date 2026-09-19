'use client';

import { useState } from 'react';
import type { KeyStatus } from '@/lib/keys';
import type { PoolUsage } from '@/lib/limits';

/**
 * Bring-your-own-key settings.
 *
 * The honest framing matters more than the form: the shared key is a trial that
 * runs out, and a person's own key is free, takes two minutes, and removes the
 * limit. Saying that plainly is what makes someone bother.
 */

const PROVIDERS = [
  {
    id: 'google' as const,
    name: 'Google AI Studio',
    href: 'https://aistudio.google.com/apikey',
    detail: 'Sekitar 500 permintaan per hari. Gratis, tanpa kartu kredit.',
    placeholder: 'AIza…',
  },
  {
    id: 'groq' as const,
    name: 'Groq',
    href: 'https://console.groq.com/keys',
    detail: 'Cepat, tapi batas throughput-nya rendah untuk rencana panjang.',
    placeholder: 'gsk_…',
  },
];

export function KeySettings({ initial, usage }: { initial: KeyStatus; usage: PoolUsage | null }) {
  const [saved, setSaved] = useState<KeyStatus>(initial);
  const [provider, setProvider] = useState<'google' | 'groq'>(initial?.provider ?? 'google');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = PROVIDERS.find((p) => p.id === provider)!;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(data);
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan key.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    await fetch('/api/key', { method: 'DELETE' });
    setSaved(null);
    setBusy(false);
  }

  return (
    <div>
      {saved ? (
        <div className="border-l-2 border-signal bg-signal-soft px-4 py-3.5">
          <p className="text-[15px] text-ink">
            Pakai key {saved.provider === 'google' ? 'Google AI Studio' : 'Groq'} kamu sendiri,
            berakhiran <span className="font-mono text-[13.5px]">{saved.hint}</span>.
          </p>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="mt-2 text-[14px] text-muted underline decoration-rule underline-offset-4 hover:text-ink disabled:opacity-50"
          >
            Hapus key, kembali ke kuota bersama
          </button>
        </div>
      ) : (
        <div className="border-l-2 border-rule px-4 py-3.5">
          <p className="text-[15px] leading-relaxed text-muted">
            Sekarang kamu pakai kuota bersama.{' '}
            {usage
              ? `Sisa jatah kamu ${usage.sessionRemaining} rencana hari ini, dan kuota bersama terpakai ${usage.used} dari ${usage.limit} permintaan.`
              : null}
          </p>
        </div>
      )}

      <div className="mt-10">
        <fieldset>
          <legend className="text-[15px] font-semibold text-ink">Pilih provider</legend>
          <div className="mt-3 space-y-2.5">
            {PROVIDERS.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer gap-3 rounded-[3px] border px-4 py-3 transition-colors
                  ${
                    provider === p.id
                      ? 'border-signal bg-signal-soft'
                      : 'border-rule hover:border-faint'
                  }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.id}
                  checked={provider === p.id}
                  onChange={() => setProvider(p.id)}
                  className="mt-1 accent-signal"
                />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{p.name}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-muted">
                    {p.detail}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-8">
          <label htmlFor="apikey" className="block text-[15px] font-semibold text-ink">
            Tempel API key
          </label>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            Ambil di{' '}
            <a
              href={active.href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-signal underline decoration-signal/30 underline-offset-4"
            >
              {active.href.replace('https://', '')}
            </a>
            , lalu tempel di sini.
          </p>

          <input
            id="apikey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={active.placeholder}
            autoComplete="off"
            spellCheck={false}
            className="mt-3 w-full max-w-md rounded-[3px] border border-rule bg-paper-sunk px-3.5 py-2.5
                       font-mono text-[14px] text-ink placeholder:text-faint focus:bg-paper pointer-coarse:py-3 pointer-coarse:text-base"
          />

          {error && (
            <p role="alert" className="mt-3 border-l-2 border-warn pl-3 text-[14px] text-warn">
              {error}
            </p>
          )}

          <div className="mt-5">
            <button
              type="button"
              onClick={save}
              disabled={busy || !apiKey.trim()}
              className="rounded-[3px] bg-ink px-5 py-2.5 text-[15px] font-medium text-paper
                         transition-colors hover:opacity-90 disabled:bg-rule disabled:text-faint"
            >
              {busy ? 'Mengecek key' : 'Simpan key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
