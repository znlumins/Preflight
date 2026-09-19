'use client';

import { useState } from 'react';
import type { PlanData } from './PlanDocument';

/**
 * Revising the plan by asking.
 *
 * The reply is a receipt, not a conversation: the plan above is the real
 * answer, and it changes in place. So this stays small and sits at the bottom
 * of the document, where someone has finished reading and knows what is wrong.
 */

export type RevisionOp = { op: string; targetId: string; label: string; reason: string };

export type RevisionEntry = {
  id: number;
  message: string;
  reply: string;
  ops: RevisionOp[];
  applied: number;
  skipped: number;
  undone?: boolean;
  canUndo?: boolean;
};

/**
 * How each operation reads in the receipt.
 *
 * A count alone ("1 perubahan diterapkan") does not let anyone check whether
 * the right thing changed, which is the one question a person has after asking
 * a model to edit their plan.
 */
const OP_LABEL: Record<string, { verb: string; kind: string; sign: string }> = {
  add_feature: { verb: 'Menambah', kind: 'fitur', sign: '+' },
  update_feature: { verb: 'Mengubah', kind: 'fitur', sign: '~' },
  remove_feature: { verb: 'Menghapus', kind: 'fitur', sign: '−' },
  add_task: { verb: 'Menambah', kind: 'task', sign: '+' },
  update_task: { verb: 'Mengubah', kind: 'task', sign: '~' },
  remove_task: { verb: 'Menghapus', kind: 'task', sign: '−' },
};

const EXAMPLES = [
  'Tambahkan fitur reset password',
  'Buang fitur notifikasi, terlalu jauh untuk v1',
  'Pecah task migrasi database jadi dua',
];

export function ReviseChat({
  planId,
  history,
  onPlanChange,
}: {
  planId: string;
  history: RevisionEntry[];
  onPlanChange: (plan: PlanData) => void;
}) {
  const [log, setLog] = useState<RevisionEntry[]>(history);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = message.trim();
    if (text.length < 3) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/plan/${planId}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setLog((l) => [
        {
          id: data.revisionId,
          message: text,
          reply: data.reply,
          ops: data.ops ?? [],
          applied: data.applied,
          skipped: data.skipped,
          canUndo: data.applied > 0,
        },
        // Only the newest revision stays undoable; rolling back an older one
        // would discard everything done after it.
        ...l.map((e) => ({ ...e, canUndo: false })),
      ]);
      setMessage('');
      if (data.plan) onPlanChange(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal merevisi.');
    } finally {
      setBusy(false);
    }
  }

  async function undo(revisionId: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/plan/${planId}/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // The undone entry stays in the log, greyed: hiding it would make the
      // history lie about what was tried.
      setLog((l) => {
        const marked = l.map((e) => (e.id === revisionId ? { ...e, undone: true, canUndo: false } : e));
        const nextLive = marked.find((e) => !e.undone && e.applied > 0);
        return marked.map((e) => ({ ...e, canUndo: e.id === nextLive?.id }));
      });
      if (data.plan) onPlanChange(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membatalkan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-16 border-t border-rule pt-8">
      <h2 className="text-[22px] font-semibold tracking-tight text-ink">Ubah rencana</h2>
      <p className="mt-2 max-w-[62ch] text-[15.5px] leading-relaxed text-muted">
        Tulis apa yang mau diubah. Yang kamu sebut saja yang berubah — sisanya tetap.
      </p>

      <div className="mt-6">
        <label htmlFor="revise" className="sr-only">
          Perubahan yang kamu mau
        </label>
        <textarea
          id="revise"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; the box is for one instruction, not an essay.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Misal: tambahkan fitur reset password di Autentikasi"
          rows={2}
          enterKeyHint="send"
          disabled={busy}
          className="w-full resize-none rounded-[3px] border border-rule bg-paper-sunk px-4 py-3
                     text-[15.5px] leading-relaxed text-ink placeholder:text-faint
                     focus:bg-paper disabled:opacity-60 pointer-coarse:text-base"
        />

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button
            type="button"
            onClick={send}
            disabled={busy || message.trim().length < 3}
            className="rounded-[3px] bg-ink px-5 py-2.5 text-[15px] font-medium text-paper
                       transition-colors hover:opacity-90 disabled:bg-rule disabled:text-faint"
          >
            {busy ? 'Menerapkan' : 'Terapkan'}
          </button>

          {log.length === 0 && !busy && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setMessage(e)}
                  className="rounded-[3px] border border-rule px-2.5 py-1 text-[13.5px] text-muted
                             transition-colors hover:border-faint hover:text-ink"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 border-l-2 border-warn pl-4 text-[14px] leading-relaxed text-warn">
            {error}
          </p>
        )}
      </div>

      {log.length > 0 && (
        <ol className="mt-9 space-y-6">
          {log.map((entry) => (
            <li
              key={entry.id}
              className={`border-l pl-4 ${entry.undone ? 'border-rule opacity-50' : 'border-rule'}`}
            >
              <p className="text-[15px] font-medium text-ink">{entry.message}</p>
              <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{entry.reply}</p>

              {entry.ops.length > 0 && (
                <ul className="mt-2.5 space-y-1">
                  {entry.ops.map((op, i) => {
                    const meta = OP_LABEL[op.op];
                    if (!meta) return null;
                    return (
                      <li
                        key={`${op.targetId}-${i}`}
                        className="flex gap-2.5 text-[13.5px] leading-snug"
                      >
                        <span
                          aria-hidden
                          className={`font-mono ${
                            op.op.startsWith('remove') ? 'text-warn' : 'text-signal'
                          }`}
                        >
                          {meta.sign}
                        </span>
                        <span className="min-w-0 text-muted">
                          {meta.verb} {meta.kind}{' '}
                          <span className="text-ink">{op.label}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="text-[13px] text-faint">
                  {entry.undone
                    ? 'Dibatalkan.'
                    : entry.applied === 0
                      ? 'Tidak ada yang diubah.'
                      : `${entry.applied} perubahan diterapkan.`}
                  {entry.skipped > 0 &&
                    ` ${entry.skipped} dilewati karena menunjuk bagian yang tidak ada.`}
                </p>

                {entry.canUndo && !entry.undone && (
                  <button
                    type="button"
                    onClick={() => undo(entry.id)}
                    disabled={busy}
                    className="text-[13px] text-muted underline decoration-rule underline-offset-4
                               hover:text-signal disabled:opacity-50"
                  >
                    Batalkan
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
