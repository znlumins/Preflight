'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Connecting a coding agent to the plan.
 *
 * The payoff is that nobody copies thirty prompts by hand — the agent pulls the
 * queue itself. So this section's job is to get a working config into the
 * user's editor in one paste, and to be honest that the token in it is a
 * credential.
 */

type Status = { hint: string; createdAt: string; lastUsedAt: string | null } | null;

export function AgentSetup({ initial }: { initial: Status }) {
  const [status, setStatus] = useState<Status>(initial);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  // The token only exists in this page's memory, right after it is issued.
  const config = JSON.stringify(
    {
      mcpServers: {
        preflight: {
          url: `${origin}/api/mcp/mcp`,
          headers: { Authorization: `Bearer ${token ?? 'pf_…'}` },
        },
      },
    },
    null,
    2,
  );

  async function issue() {
    setBusy(true);
    try {
      const res = await fetch('/api/agent-token', { method: 'POST' });
      const data = await res.json();
      setToken(data.token);
      setStatus(data.status);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await fetch('/api/agent-token', { method: 'DELETE' });
      setToken(null);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* The block is selectable; the keyboard shortcut still works. */
    }
  }

  return (
    <section className="mt-16 border-t border-rule pt-8">
      <h2 className="text-[19px] font-semibold tracking-tight text-ink">
        Sambungkan ke AI coding agent
      </h2>
      <p className="mt-2 max-w-[62ch] text-[15.5px] leading-relaxed text-muted">
        Daripada menyalin prompt satu per satu, biarkan agent-nya yang mengambil sendiri. Setelah
        tersambung, kamu cukup bilang <em className="not-italic text-ink">&ldquo;kerjakan rencana
        Preflight-ku&rdquo;</em> — agent ambil task, kerjakan, tandai selesai, lanjut sendiri.
        Jalan di Claude Code dan Cursor lewat MCP.
      </p>

      {status && !token && (
        <div className="mt-5 border-l-2 border-signal bg-signal-soft px-4 py-3.5">
          <p className="text-[15px] text-ink">
            Sudah ada token aktif, berakhiran{' '}
            <span className="font-mono text-[13.5px]">{status.hint}</span>.
            {status.lastUsedAt
              ? ' Terakhir dipakai agent.'
              : ' Belum pernah dipakai agent.'}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            Nilainya tidak bisa ditampilkan lagi. Kalau kamu kehilangannya, buat yang baru — token
            lama otomatis berhenti berlaku.
          </p>
        </div>
      )}

      {token && (
        <div className="mt-5">
          <p className="max-w-[62ch] border-l-2 border-warn pl-4 text-[14.5px] leading-relaxed text-warn">
            Token ini hanya tampil sekali. Salin sekarang — ini kredensial, jadi perlakukan seperti
            password dan jangan taruh di repo publik.
          </p>

          <div className="screen mt-4 rounded-[3px] bg-screen px-4 py-3.5">
            <pre className="overflow-x-auto font-mono text-[12.5px] leading-[1.7] text-screen-ink">
              {config}
            </pre>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={copy}
              className="rounded-[3px] bg-ink px-4 py-2 text-[14px] font-medium text-paper transition-opacity hover:opacity-90"
            >
              {copied ? 'Tersalin' : 'Salin konfigurasi'}
            </button>
            <span className="text-[13.5px] text-faint">
              Tempel ke <code className="font-mono">.mcp.json</code> (Claude Code) atau pengaturan
              MCP di Cursor.
            </span>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-5">
        <button
          type="button"
          onClick={issue}
          disabled={busy}
          className="rounded-[3px] border border-rule px-4 py-2 text-[14.5px] text-ink transition-colors hover:border-faint disabled:opacity-50"
        >
          {busy ? 'Menyiapkan' : status ? 'Buat token baru' : 'Buat token'}
        </button>
        {status && (
          <button
            type="button"
            onClick={revoke}
            disabled={busy}
            className="text-[14px] text-muted underline decoration-rule underline-offset-4 hover:text-warn disabled:opacity-50"
          >
            Cabut token
          </button>
        )}
      </div>
    </section>
  );
}
