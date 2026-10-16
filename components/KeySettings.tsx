'use client';

import { useState } from 'react';
import type { KeyStatusMap } from '@/lib/keys';
import type { PoolUsage } from '@/lib/limits';
import type { ProviderId } from '@/lib/ai/provider';

/**
 * Multi-provider BYOK settings.
 *
 * Users can store API keys for Google, Anthropic, OpenAI, OpenRouter, and Groq
 * simultaneously, and choose between them freely when planning.
 */

const PROVIDERS = [
  {
    id: 'google' as const,
    name: 'Google AI Studio',
    href: 'https://aistudio.google.com/apikey',
    detail: 'Sekitar 500 permintaan per hari (Gemini Flash & Flash-Lite). Gratis, tanpa kartu kredit.',
    placeholder: 'AIza…',
  },
  {
    id: 'anthropic' as const,
    name: 'Anthropic Claude',
    href: 'https://console.anthropic.com/settings/keys',
    detail: 'Model Claude 3.7 Sonnet & 3.5 Haiku. Kualitas reasoning & arsitektur coding terbaik.',
    placeholder: 'sk-ant-…',
  },
  {
    id: 'openai' as const,
    name: 'OpenAI',
    href: 'https://platform.openai.com/api-keys',
    detail: 'Model GPT-4o & GPT-4o-mini. Fleksibel, tangguh, dan standar industri.',
    placeholder: 'sk-…',
  },
  {
    id: 'openrouter' as const,
    name: 'OpenRouter (Universal)',
    href: 'https://openrouter.ai/keys',
    detail: 'Akses 100+ model AI sekaligus: DeepSeek R1/V3, Llama 3.3, Claude, Qwen, dll.',
    placeholder: 'sk-or-…',
  },
  {
    id: 'groq' as const,
    name: 'Groq',
    href: 'https://console.groq.com/keys',
    detail: 'Cepat (Llama / Qwen OSS), tapi batas throughput-nya rendah untuk rencana panjang.',
    placeholder: 'gsk_…',
  },
];

const PROVIDER_NAMES: Record<ProviderId, string> = {
  google: 'Google AI Studio',
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
};

export function KeySettings({
  initial,
  usage,
}: {
  initial: KeyStatusMap | null;
  usage: PoolUsage | null;
}) {
  const [savedKeys, setSavedKeys] = useState<KeyStatusMap>(initial ?? {});
  const [activeProvider, setActiveProvider] = useState<ProviderId>('google');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = PROVIDERS.find((p) => p.id === activeProvider) ?? PROVIDERS[0];
  const savedList = Object.values(savedKeys).filter(Boolean);
  const currentSaved = savedKeys[activeProvider];

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: activeProvider, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedKeys(data);
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan key.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(pId: ProviderId) {
    setBusy(true);
    try {
      const res = await fetch(`/api/key?provider=${pId}`, { method: 'DELETE' });
      const data = await res.json();
      setSavedKeys(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {savedList.length > 0 ? (
        <div className="border-l-2 border-signal bg-signal-soft px-4 py-3.5">
          <p className="text-[15px] font-medium text-ink">
            {savedList.length} key provider tersimpan di browsermu:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {savedList.map((k) => (
              <span
                key={k.provider}
                className="inline-flex items-center gap-1.5 rounded-[3px] bg-paper px-2.5 py-1 text-[13px] text-ink border border-signal/20"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                <strong>{PROVIDER_NAMES[k.provider]}</strong>
                <span className="font-mono text-[12px] text-muted">({k.hint})</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">
            Kamu bisa memilih langsung provider di atas lewat dropdown di halaman utama saat mulai menyusun rencana.
          </p>
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
          <legend className="text-[15px] font-semibold text-ink">Pilih provider untuk memasang/mengedit key</legend>
          <div className="mt-3 space-y-2.5">
            {PROVIDERS.map((p) => {
              const isSaved = !!savedKeys[p.id];
              const isSelected = activeProvider === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setActiveProvider(p.id);
                    setApiKey('');
                    setError(null);
                  }}
                  className={`flex cursor-pointer items-start justify-between gap-3 rounded-[3px] border px-4 py-3 transition-colors
                    ${
                      isSelected
                        ? 'border-signal bg-signal-soft'
                        : isSaved
                        ? 'border-signal/40 bg-paper hover:border-signal/70'
                        : 'border-rule hover:border-faint'
                    }`}
                >
                  <label className="flex min-w-0 cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="provider"
                      value={p.id}
                      checked={isSelected}
                      onChange={() => {
                        setActiveProvider(p.id);
                        setApiKey('');
                        setError(null);
                      }}
                      className="mt-1 accent-signal"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-ink">{p.name}</span>
                        {isSaved && (
                          <span className="rounded bg-signal/10 px-1.5 py-0.5 text-[11px] font-semibold text-signal">
                            Aktif ({savedKeys[p.id]?.hint})
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[13.5px] leading-relaxed text-muted">
                        {p.detail}
                      </span>
                    </span>
                  </label>

                  {isSaved && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(p.id);
                      }}
                      disabled={busy}
                      className="ml-2 shrink-0 text-[13px] text-muted underline decoration-rule hover:text-warn disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-8">
          <label htmlFor="apikey" className="block text-[15px] font-semibold text-ink">
            {currentSaved ? `Ganti API key ${active.name}` : `Tempel API key ${active.name}`}
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
            placeholder={currentSaved ? `Tersimpan berakhiran ${currentSaved.hint} (isi untuk ganti)` : active.placeholder}
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
              {busy ? 'Mengecek key' : currentSaved ? `Perbarui key ${active.name}` : `Simpan key ${active.name}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
