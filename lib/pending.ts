/**
 * Which generation stage a plan should run next.
 *
 * Shared by the stage routes (to refuse anything else) and the plan page (to
 * know what "Coba lagi" should retry), so the two cannot disagree. Pure and
 * import-free, which is what lets a client component use it.
 *
 * An errored plan does not record which stage failed, so for `error` it is
 * read off the rows: the first stage whose output is missing. Reading it from
 * the rows rather than storing it also means a plan that failed before this
 * existed resumes correctly.
 */

export type StageKey = 'prd' | 'features' | 'specs' | 'tasks';

type PlanShape = {
  plan: { status: string; prd: unknown };
  features: { spec: unknown }[];
  tasks: unknown[];
};

export function pendingStage({ plan, features, tasks }: PlanShape): StageKey | null {
  switch (plan.status) {
    case 'draft':
      return 'prd';
    case 'prd':
      return 'features';
    case 'features':
      return 'specs';
    case 'specs':
      return 'tasks';
    case 'error':
      if (!plan.prd) return 'prd';
      if (!features.length) return 'features';
      if (features.some((f) => !f.spec)) return 'specs';
      if (!tasks.length) return 'tasks';
      return null;
    default:
      return null;
  }
}
