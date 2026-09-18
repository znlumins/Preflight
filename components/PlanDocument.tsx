'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PromptBlock } from './PromptBlock';
import { ReviseChat, type RevisionEntry } from './ReviseChat';
import type { Prd, SpecBatch } from '@/lib/ai/schemas';
import type { FeatureRow, PlanRow, SubfeatureRow, TaskRow } from '@/lib/db/schema';

export type PlanData = {
  plan: PlanRow;
  features: FeatureRow[];
  subfeatures: SubfeatureRow[];
  tasks: TaskRow[];
};

type Spec = SpecBatch['specs'][number];

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
}: {
  initial: PlanData;
  revisions: RevisionEntry[];
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
        if (!res.ok) throw new Error((await res.json()).error);
        await refresh();
      })
      .catch((err: unknown) => setFailed(err instanceof Error ? err.message : 'Gagal.'))
      .finally(() => {
        inFlight.current = false;
        setRunning(null);
      });
  }, [plan.status, plan.id, refresh, failed]);

  async function retry() {
    setFailed(null);
    const stage = NEXT[plan.status] ?? 'prd';
    setRunning(stage);
    try {
      const res = await fetch(`/api/plan/${plan.id}/${stage}`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error);
      await refresh();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'Gagal.');
    } finally {
      setRunning(null);
    }
  }

  async function toggle(task: TaskRow) {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
    }));
    await fetch(`/api/plan/${plan.id}/task`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, done: !task.done }),
    }).catch(() => refresh());
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const complete = plan.status === 'done';

  return (
    <div className="mx-auto w-full max-w-[46rem] px-6 py-10 sm:py-14">
      <header className="flex items-baseline justify-between">
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink hover:text-signal">
          preflight
        </Link>
        <nav className="flex items-baseline gap-5 text-[13.5px]">
          <Link href="/pengaturan" className="text-muted hover:text-signal">
            Pengaturan
          </Link>
          <Link href="/" className="text-muted hover:text-signal">
            Rencana baru
          </Link>
        </nav>
      </header>

      {(!complete || failed) && (
        <StageRail status={plan.status} running={running} failed={failed} onRetry={retry} />
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
              className="text-[13.5px] text-muted underline decoration-rule underline-offset-4 hover:text-signal"
            >
              Unduh semuanya sebagai Markdown
            </a>
          </div>

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
    </div>
  );
}

function StageRail({
  status,
  running,
  failed,
  onRetry,
}: {
  status: string;
  running: string | null;
  failed: string | null;
  onRetry: () => void;
}) {
  const reached = STAGES.findIndex((s) => s.key === status);

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

function PrdSection({ prd }: { prd: Prd }) {
  return (
    <article className="settle mt-14">
      <h1 className="text-[34px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[40px]">
        {prd.title}
      </h1>
      <p className="mt-4 max-w-[58ch] text-[17px] leading-relaxed text-muted">{prd.oneLiner}</p>

      <div className="mt-11 space-y-9">
        <Prose heading="Masalah">
          <p className="max-w-[68ch] leading-[1.75]">{prd.problem}</p>
        </Prose>

        <div className="grid gap-9 sm:grid-cols-2">
          <Prose heading="Tujuan">
            <Bullets items={prd.goals} />
          </Prose>
          <Prose heading="Bukan tujuan">
            <Bullets items={prd.nonGoals} />
          </Prose>
        </div>

        <div className="grid gap-9 sm:grid-cols-2">
          <Prose heading="Lingkup v1">
            <Bullets items={prd.mvpScope} />
          </Prose>
          <Prose heading="Ditunda">
            <Bullets items={prd.laterScope} />
          </Prose>
        </div>

        <Prose heading="Tech stack">
          <dl className="max-w-md">
            {(
              [
                ['Frontend', prd.techStack.frontend],
                ['Backend', prd.techStack.backend],
                ['Database', prd.techStack.database],
                ['Deployment', prd.techStack.deployment],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex gap-4 border-b border-rule py-2 last:border-0">
                <dt className="w-24 shrink-0 text-muted">{k}</dt>
                <dd className="min-w-0 flex-1 text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 max-w-[68ch] leading-[1.75] text-muted">{prd.techStack.rationale}</p>
        </Prose>

        <Prose heading="Risiko">
          <ul className="max-w-[68ch] space-y-3">
            {prd.risks.map((r) => (
              <li key={r.risk} className="border-l border-rule pl-4">
                <p className="font-medium text-ink">{r.risk}</p>
                <p className="mt-0.5 leading-[1.7] text-muted">{r.mitigation}</p>
              </li>
            ))}
          </ul>
        </Prose>
      </div>
    </article>
  );
}

function Prose({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{heading}</h2>
      <div className="mt-2.5 text-[15.5px] text-ink">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it} className="flex gap-2.5 leading-[1.6]">
          <span aria-hidden className="mt-[0.7em] h-px w-2.5 shrink-0 bg-faint" />
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
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
  const spec = feature.spec as Spec | null;

  return (
    <section className="settle">
      <div className="flex items-baseline gap-3">
        <h3 className="text-[20px] font-semibold tracking-tight text-ink">{feature.name}</h3>
        <span
          className={`font-mono text-[12px] ${
            feature.priority === 'P0' ? 'text-signal' : 'text-faint'
          }`}
        >
          {feature.priority}
        </span>
      </div>
      <p className="mt-1.5 max-w-[64ch] text-[15.5px] leading-relaxed text-muted">
        {feature.benefit}
      </p>

      {subfeatures.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-l border-rule pl-4">
          {subfeatures.map((s) => (
            <li key={s.id} className="text-[14.5px] leading-snug">
              <span className="text-ink">{s.name}</span>
              <span className="text-faint"> — {s.summary}</span>
            </li>
          ))}
        </ul>
      )}

      {spec && (
        <details className="group mt-5">
          <summary className="cursor-pointer list-none text-[14px] text-muted hover:text-signal">
            <span className="underline decoration-rule underline-offset-4 group-open:hidden">
              Lihat spec
            </span>
            <span className="hidden underline decoration-rule underline-offset-4 group-open:inline">
              Sembunyikan spec
            </span>
          </summary>
          <div className="mt-4 grid gap-6 border-l border-rule pl-4 text-[14.5px] sm:grid-cols-2">
            <SpecPart heading="User story" items={spec.userStories} />
            <SpecPart heading="Kriteria penerimaan" items={spec.acceptanceCriteria} />
            <SpecPart heading="Data & state" items={spec.dataAndState} />
            <SpecPart heading="Edge case" items={spec.edgeCases} />
          </div>
        </details>
      )}

      <div className="mt-7">
        {tasks.length === 0 ? (
          <p className="text-[14.5px] text-faint">
            {pendingTasks ? 'Menyusun task…' : 'Belum ada task.'}
          </p>
        ) : (
          <ol className="space-y-8">
            {tasks.map((t, i) => (
              <li key={t.id} className="flex gap-3.5">
                <button
                  type="button"
                  onClick={() => onToggle(t)}
                  aria-pressed={t.done}
                  aria-label={t.done ? `Batalkan: ${t.title}` : `Tandai selesai: ${t.title}`}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border
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

                <div className={`min-w-0 flex-1 ${t.done ? 'opacity-45' : ''}`}>
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[12px] tabular-nums text-faint">{i + 1}</span>
                    <h4 className="text-[16px] font-medium leading-snug text-ink">{t.title}</h4>
                  </div>
                  <p className="mt-1 max-w-[64ch] pl-[1.9rem] text-[14.5px] leading-relaxed text-muted">
                    {t.description}
                  </p>
                  <div className="pl-[1.9rem]">
                    <PromptBlock text={t.agentPrompt} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function SpecPart({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div>
      <h5 className="text-[13.5px] font-semibold text-ink">{heading}</h5>
      <ul className="mt-1.5 space-y-1.5 text-muted">
        {items.map((it) => (
          <li key={it} className="leading-[1.65]">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
