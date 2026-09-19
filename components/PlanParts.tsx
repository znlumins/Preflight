import type { Prd, SpecBatch } from '@/lib/ai/schemas';
import type { FeatureRow, SubfeatureRow } from '@/lib/db/schema';

/**
 * The parts of a plan that only render.
 *
 * Deliberately not a client module. The owner's view wraps these in
 * interactivity (checkboxes, revision, generation progress) while the public
 * page renders them on the server with no JavaScript at all — which is the
 * whole point of a shareable plan being a real page Google can read.
 */

export type Spec = SpecBatch['specs'][number];

export function Prose({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{heading}</h2>
      <div className="mt-2.5 text-[15.5px] text-ink">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
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

export function PrdSection({ prd, animate = true }: { prd: Prd; animate?: boolean }) {
  return (
    <article className={`${animate ? 'settle ' : ''}mt-14`}>
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

export function SpecPart({ heading, items }: { heading: string; items: string[] }) {
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

/** Feature heading, subfeatures and spec — everything above the task list. */
export function FeatureHeader({
  feature,
  subfeatures,
}: {
  feature: FeatureRow;
  subfeatures: SubfeatureRow[];
}) {
  const spec = feature.spec as Spec | null;

  return (
    <>
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
          <summary className="tap cursor-pointer list-none text-[14px] text-muted hover:text-signal">
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
    </>
  );
}
