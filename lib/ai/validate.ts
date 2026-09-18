import type { FeatureSet, Language, TaskBatch } from './schemas';

/**
 * Output validation.
 *
 * Free-tier models drift between runs: the same prompt produced 2.0 tasks per
 * subfeature on one run and 1.3 on the next, and Indonesian titles on one run
 * and English on the next. Prompt wording alone does not hold them. So the
 * contract is enforced here, in code, and violations are repaired with a
 * targeted re-ask instead of a full regeneration.
 */

export type Defect = {
  kind:
    | 'too-few-tasks'
    | 'wrong-language'
    | 'thin-prompts'
    | 'thin-features'
    | 'too-few-features';
  detail: string;
  /** How many items are affected. Lets callers compare two attempts by severity. */
  count: number;
};

/**
 * Total offending items across defects.
 *
 * Comparing attempts by defect *kind* was a bug: a repair that fixed seven of
 * ten stub prompts still reported one defect kind, so it looked no better than
 * the original and was discarded.
 */
export function severity(defects: Defect[]): number {
  return defects.reduce((n, d) => n + d.count, 0);
}

/**
 * Shortest agent prompt worth shipping.
 *
 * The task stage averages ~350 characters and rarely drops below 195, so
 * anything under this is a label rather than an instruction — "Buat tombol aksi
 * unduh CSV" tells an agent nothing about files, constraints or verification.
 * Measured in the spike from the first day; enforced here because measuring it
 * and not enforcing it is how three stub prompts reached a user's plan.
 */
const MIN_PROMPT_CHARS = 180;

/** Defects in the feature breakdown. Same drift problem as tasks, same remedy. */
export function inspectFeatures(features: FeatureSet['features']): Defect[] {
  const defects: Defect[] = [];

  if (features.length < 5) {
    defects.push({
      kind: 'too-few-features',
      count: Math.max(0, 5 - features.length),
      detail: `Returned ${features.length} features. The MVP scope needs at least 5 — you collapsed distinct capabilities together.`,
    });
  }

  const thin = features.filter((f) => f.subfeatures.length < 3);
  if (thin.length > 0) {
    defects.push({
      kind: 'thin-features',
      count: thin.length,
      detail: `These features have fewer than 3 subfeatures: ${thin
        .map((f) => `${f.id} (${f.subfeatures.length})`)
        .join(', ')}. Each needs at least a create path, a read/list path, and one state change or edge path named separately.`,
    });
  }

  return defects;
}

/** Heuristic: an imperative English verb opening a title we asked for in Indonesian. */
const EN_TITLE = /^(add|build|create|implement|set ?up|configure|write|update|remove|refactor|integrate|define)\b/i;

export function countEnglishTitles(tasks: TaskBatch['tasks'], language: Language): number {
  if (language !== 'id') return 0;
  return tasks.filter((t) => EN_TITLE.test(t.title)).length;
}

/** Defects in one task batch, given the features that batch covered. */
export function inspectTaskBatch(
  tasks: TaskBatch['tasks'],
  features: FeatureSet['features'],
  language: Language,
): Defect[] {
  const defects: Defect[] = [];

  const subs = features.reduce((n, f) => n + f.subfeatures.length, 0);
  const minTasks = subs * 2;
  if (tasks.length < minTasks) {
    defects.push({
      kind: 'too-few-tasks',
      count: minTasks - tasks.length,
      detail: `Returned ${tasks.length} tasks for ${subs} subfeatures. At least ${minTasks} are required — two to four per subfeature. Split the coarse ones: schema, server logic, UI, and error handling are separate tasks.`,
    });
  }

  const thin = tasks.filter((t) => t.agentPrompt.trim().length < MIN_PROMPT_CHARS);
  if (thin.length > 0) {
    defects.push({
      kind: 'thin-prompts',
      count: thin.length,
      detail: `These tasks have agent prompts too short to act on: ${thin
        .map((t) => t.id)
        .join(', ')}. Each prompt must name the files or modules to touch, the constraints, and how to verify the result — four to eight sentences, not a restated title.`,
    });
  }

  const english = countEnglishTitles(tasks, language);
  if (english > 0) {
    defects.push({
      kind: 'wrong-language',
      count: english,
      detail: `${english} of ${tasks.length} task titles are in English. Every title and description must be in Bahasa Indonesia. Keep file paths, identifiers and library names in English inside the sentence.`,
    });
  }

  return defects;
}
