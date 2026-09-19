'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FeatureHeader, FeatureIndex, PrdSection, featureAnchor, taskAnchor } from './PlanParts';
import { JumpTo } from './JumpTo';
import { PromptBlock } from './PromptBlock';
import { SharePlan } from './SharePlan';
import { ReviseChat, type RevisionEntry } from './ReviseChat';
import type { Prd } from '@/lib/ai/schemas';
import type { FeatureRow, PlanRow, SubfeatureRow, TaskRow } from '@/lib/db/schema';
import { pendingStage } from '@/lib/pending';

export type PlanData = {
  plan: PlanRow;
  features: FeatureRow[];
  subfeatures: SubfeatureRow[];
  tasks: TaskRow[];
};

/**
 * The plan, as a document that fills in while it is being written.
 *
 * Generation takes the better part of a minute across four model calls, so the
 * page never shows a spinner over an empty screen: each stage commits server
 * side and appears as soon as it lands. Refreshing mid-run resumes from
 * whatever the database says was reached.
 */

const STAGES = [
  { key: 'prd', label: 'PRD' },
  { key: 'features', label: 'Fitur' },
  { key: 'specs', label: 'Spec' },
  { key: 'tasks', label: 'Task' },
] as const;

const NEXT: Record<string, (typeof STAGES)[number]['key'] | null> = {
  draft: 'prd',
  prd: 'features',
  features: 'specs',
  specs: 'tasks',
  done: null,
  error: null,
};

export function PlanDocument({
  initial,
  revisions,
  publicSlug,
}: {
  initial: PlanData;
  revisions: RevisionEntry[];
  publicSlug: string | null;
}) {
  const [data, setData] = useState(initial);
  const [running, setRunning] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(initial.plan.error);
  const inFlight = useRef(false);

  const { plan, features, subfeatures, tasks } = data;
  const prd = plan.prd as Prd | null;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/plan/${plan.id}`);
    if (res.ok) setData(await res.json());
  }, [plan.id]);

  // Drive the remaining stages, one at a time, in order.
  useEffect(() => {
    const stage = NEXT[plan.status];
    if (!stage || stage === 'prd' || inFlight.current || failed) return;

    inFlight.current = true;
    setRunning(stage);

    fetch(`/api/plan/${plan.id}/${stage}`, { method: 'POST' })
      .then(async (res) => {
        // 409: the stage already ran, usually from another tab. Not a failure —
        // resync and carry on from wherever the plan actually is.
        if (!res.ok && res.status !== 409) throw new Error((await res.json()).error);
        await refresh();
      })
      .catch((err: unknown) => setFailed(err instanceof Error ? err.message : 'Gagal.'))
      .finally(() => {
        inFlight.current = false;
        setRunning(null);
      });
  }, [plan.status, plan.id, refresh, failed]);

  async function retry() {
    // After a reload the status is just 'error', which says nothing about
    // where it stopped; the rows do. Same rule the server enforces.
    const stage = pendingStage(data);
    if (!stage) {
      setFailed(null);
      await refresh().catch(() => {});
      return;
    }

    // Claimed before clearing the error, or the drive effect would see no
    // error, no request in flight, and start the same stage a second time.
    inFlight.current = true;
    setFailed(null);
    setRunning(stage);
    try {
      const res = await fetch(`/api/plan/${plan.id}/${stage}`, { method: 'POST' });
      // 409: already past this stage (another tab, or a stale page) — resync.
      if (!res.ok && res.status !== 409) throw new Error((await res.json()).error);
      await refresh();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'Gagal.');
    } finally {
      inFlight.current = false;
      setRunning(null);
    }
  }

  async function toggle(task: TaskRow) {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
    }));
    const saved = await fetch(`/api/plan/${plan.id}/task`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, done: !task.done }),
    }).then(
      (res) => res.ok,
      () => false,
    );

    // A tick the server did not keep must not stay ticked: put it back, then
    // resync in case something else changed underneath.
    if (!saved) {
      setData((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)),
      }));
      refresh().catch(() => {});
    }
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const complete = plan.status === 'done';

  return (
    <div className="mx-auto w-full max-w-[46rem] px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <Link href="/" className="tap text-[15px] font-semibold tracking-tight text-ink hover:text-signal">
          preflight
        </Link>
        <nav className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13.5px]">
          <Link href="/pengaturan" className="tap whitespace-nowrap text-muted hover:text-signal">
            Pengaturan
          </Link>
          <Link href="/" className="tap whitespace-nowrap text-muted hover:text-signal">
            Rencana baru
          </Link>
        </nav>
      </header>

      {(!complete || failed) && (
        <StageRail pending={pendingStage(data)} running={running} failed={failed} onRetry={retry} />
      )}

      {prd ? (
        <PrdSection prd={prd} />
      ) : (
        <p className="mt-16 text-[16px] text-muted">Menyusun PRD dari jawaban kamu…</p>
      )}

      {features.length > 0 && (
        <section className="settle mt-16 border-t border-rule pt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">Rencana kerja</h2>
            {tasks.length > 0 && (
              <p className="text-[13.5px] tabular-nums text-faint">
                {doneCount} dari {tasks.length} task selesai
              </p>
            )}
          </div>

          <div className="mt-2">
            <a
              href={`/api/plan/${plan.id}/markdown`}
              download
              className="tap text-[13.5px] text-muted underline decoration-rule underline-offset-4 hover:text-signal"
            >
              Unduh semuanya sebagai Markdown
            </a>
          </div>

          <FeatureIndex features={features} tasks={tasks} progress />

          <div className="mt-10 space-y-14">
            {features.map((f) => (
              <FeatureSection
                key={f.id}
                feature={f}
                subfeatures={subfeatures.filter((s) => s.featureId === f.id)}
                tasks={tasks.filter((t) => t.featureId === f.id)}
                onToggle={toggle}
                pendingTasks={running === 'tasks'}
              />
            ))}
          </div>
        </section>
      )}

      {complete && (
        <ReviseChat planId={plan.id} history={revisions} onPlanChange={setData} />
      )}

      {complete && <SharePlan planId={plan.id} initialSlug={publicSlug} />}

      {features.length > 1 && <JumpTo href="#daftar-fitur" label="Daftar fitur" />}
    </div>
  );
}

function StageRail({
  pending,
  running,
  failed,
  onRetry,
}: {
  pending: (typeof STAGES)[number]['key'] | null;
  running: string | null;
  failed: string | null;
  onRetry: () => void;
}) {
  // Everything before the pending stage is done. Read from the plan's rows,
  // not its status, so an errored plan still shows how far it got.
  const reached = pending ? STAGES.findIndex((s) => s.key === pending) - 1 : STAGES.length - 1;

  return (
    <div className="mt-10 border-y border-rule py-4">
      <ol className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {STAGES.map((s, i) => {
          const done = i <= reached;
          const active = running === s.key;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className={`h-[2px] w-5 rounded-full ${
                  active ? 'running bg-signal' : done ? 'bg-signal' : 'bg-rule'
                }`}
              />
              <span
                className={`text-[14px] ${
                  active ? 'font-medium text-signal' : done ? 'text-ink' : 'text-faint'
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {failed && (
        <div role="alert" className="mt-4 border-l-2 border-warn pl-4">
          <p className="text-[14px] leading-relaxed text-warn">{failed}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-[14px] font-medium text-ink underline decoration-rule underline-offset-4 hover:text-signal"
          >
            Coba lagi
          </button>
        </div>
      )}
    </div>
  );
}




function FeatureSection({
  feature,
  subfeatures,
  tasks,
  onToggle,
  pendingTasks,
}: {
  feature: FeatureRow;
  subfeatures: SubfeatureRow[];
  tasks: TaskRow[];
  onToggle: (t: TaskRow) => void;
  pendingTasks: boolean;
}) {
  return (
    <section id={featureAnchor(feature.id)} className="settle">
      <FeatureHeader feature={feature} subfeatures={subfeatures} />

      <div className="mt-7">
        {tasks.length === 0 ? (
          <p className="text-[14.5px] text-faint">
            {pendingTasks ? 'Menyusun task…' : 'Belum ada task.'}
          </p>
        ) : (
          <ol className="space-y-8">
            {tasks.map((t, i) => (
              // A grid, so on a phone the description and prompt can drop out
              // of the checkbox column and take the full width; from `sm` up
              // they sit indented under the title as before. Indenting them on
              // a 320px screen left the prompt about a hundred pixels wide.
              <li key={t.id} id={taskAnchor(t.id)} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3.5">
                <button
                  type="button"
                  onClick={() => onToggle(t)}
                  aria-pressed={t.done}
                  aria-label={t.done ? `Batalkan: ${t.title}` : `Tandai selesai: ${t.title}`}
                  className={`tap-area mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border
                    transition-colors duration-150
                    ${
                      t.done
                        ? 'border-signal bg-signal text-white'
                        : 'border-rule text-transparent hover:border-faint'
                    }`}
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden>
                    <path
                      d="M2.5 6.2 4.8 8.5 9.5 3.8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <div className={`flex min-w-0 items-baseline gap-2.5 ${t.done ? 'opacity-45' : ''}`}>
                  <span className="font-mono text-[12px] tabular-nums text-faint">{i + 1}</span>
                  <h4 className="text-[16px] font-medium leading-snug text-ink">{t.title}</h4>
                </div>
                <div
                  className={`col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:pl-[1.9rem] ${
                    t.done ? 'opacity-45' : ''
                  }`}
                >
                  <p className="mt-1 max-w-[64ch] text-[14.5px] leading-relaxed text-muted">
                    {t.description}
                  </p>
                  <PromptBlock text={t.agentPrompt} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

