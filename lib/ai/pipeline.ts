import { generateObject } from 'ai';
import { isWorthRerouting, resolveChain, type Credentials, type ModelTier } from './provider';
import { Meter } from './meter';
import { inspectFeatures, inspectTaskBatch, severity } from './validate';
import {
  featureExpansionSchema,
  featureSetSchema,
  prdSchema,
  questionnaireSchema,
  revisionSchema,
  specBatchSchema,
  taskBatchSchema,
  type FeatureExpansion,
  type FeatureSet,
  type Language,
  type Prd,
  type Questionnaire,
  type Revision,
  type SpecBatch,
  type TaskBatch,
} from './schemas';
import {
  systemFeatures,
  systemPrd,
  systemQuestions,
  systemRevise,
  systemSpecs,
  systemTasks,
} from './prompts';

/**
 * The five-stage planning pipeline.
 *
 * Batching is the load-bearing decision here. The naive shape is one model call
 * per feature for specs and again for tasks, which on a 8-feature plan is ~17
 * calls. Batching by group of features puts a full plan at ~6 calls instead,
 * which is the difference between a free tier serving tens of plans a day and
 * serving a few.
 */

export type Answer = { questionId: string; answer: string };

export type PlanInput = {
  idea: string;
  language: Language;
  /** Free-text extras: experience level, budget, deadline, must-have features. */
  context?: string;
  answers?: Answer[];
};

/** Features per spec call and per task call. Tuned against context limits, not vibes. */
const SPEC_BATCH_SIZE = 4;
const TASK_BATCH_SIZE = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type PipelineOptions = {
  /**
   * Route the `deep` stage to the `fast` model as well.
   *
   * On Google's free tier the full Flash models allow ~20 requests a day
   * against Flash-Lite's ~500, so a shared server key that uses `deep` at all
   * caps out at ~10 plans a day. Single-tier trades some PRD quality for ~8x
   * the throughput — the right default for a free pool, the wrong one for a
   * user spending their own quota.
   */
  singleTier?: boolean;
};

export class Pipeline {
  readonly meter = new Meter();

  constructor(
    private readonly creds: Credentials,
    private readonly options: PipelineOptions = {},
  ) {}

  private async call<T>(
    stage: string,
    requestedTier: ModelTier,
    opts: Record<string, unknown>,
  ): Promise<{ object: T }> {
    const tier = this.options.singleTier ? 'fast' : requestedTier;
    const chain = resolveChain(this.creds, tier);
    let lastError: unknown;

    for (let i = 0; i < chain.length; i++) {
      const { id, model } = chain[i];
      const isLast = i === chain.length - 1;
      try {
        return (await this.meter.track(stage, id, tier, () =>
          generateObject({
            model,
            temperature: 0.3,
            maxRetries: 2,
            ...opts,
          } as Parameters<typeof generateObject>[0]),
        )) as { object: T };
      } catch (err) {
        lastError = err;
        // A bad schema or prompt fails identically on every model, so only
        // re-route on capacity, quota or retirement errors.
        if (isLast || !isWorthRerouting(err)) throw err;
      }
    }

    throw lastError;
  }

  /* -------------------------------------------------------------- stage 1 */

  async questions(input: PlanInput): Promise<Questionnaire> {
    const { object } = await this.call<Questionnaire>('questions', 'fast', {
      schema: questionnaireSchema,
      system: systemQuestions(input.language),
      prompt: `Product idea:\n${input.idea}\n\n${
        input.context ? `Extra context:\n${input.context}` : 'No extra context given.'
      }`,
    });
    return object;
  }

  /* -------------------------------------------------------------- stage 2 */

  async prd(input: PlanInput): Promise<Prd> {
    const answers = input.answers?.length
      ? input.answers.map((a) => `- ${a.questionId}: ${a.answer}`).join('\n')
      : 'The user skipped the questionnaire. Choose sensible defaults.';

    const { object } = await this.call<Prd>('prd', 'deep', {
      schema: prdSchema,
      system: systemPrd(input.language),
      prompt: `Product idea:\n${input.idea}\n\nExtra context:\n${
        input.context ?? 'none'
      }\n\nInterview answers:\n${answers}`,
    });
    return object;
  }

  /* -------------------------------------------------------------- stage 3 */

  async features(prd: Prd, language: Language): Promise<FeatureSet> {
    const brief = [
      `Product: ${prd.title} — ${prd.oneLiner}`,
      `Problem: ${prd.problem}`,
      `MVP scope:\n${prd.mvpScope.map((s) => `- ${s}`).join('\n')}`,
      `Explicitly out of scope:\n${prd.nonGoals.map((s) => `- ${s}`).join('\n')}`,
      `Tech stack: ${prd.techStack.frontend} / ${prd.techStack.backend} / ${prd.techStack.database}`,
    ].join('\n\n');

    const first = await this.call<FeatureSet>('features', 'fast', {
      schema: featureSetSchema,
      system: systemFeatures(language),
      prompt: brief,
    });

    const defects = inspectFeatures(first.object.features);
    if (defects.length === 0) return first.object;

    // Same targeted-repair pattern as tasks: show the model its own output and
    // exactly what is wrong, rather than regenerating and hoping.
    const repaired = await this.call<FeatureSet>('features:fix', 'fast', {
      schema: featureSetSchema,
      system: systemFeatures(language),
      prompt: [
        `You produced this feature breakdown:`,
        first.object.features
          .map(
            (f) =>
              `- ${f.id}: ${f.name} (${f.subfeatures.length} subfeatures: ${f.subfeatures
                .map((s) => s.id)
                .join(', ')})`,
          )
          .join('\n'),
        `It has these problems:`,
        defects.map((d) => `- ${d.detail}`).join('\n'),
        `Return the corrected full breakdown. Keep the features and subfeatures that were already fine, with their ids unchanged.`,
        brief,
      ].join('\n\n'),
    });

    // Compared by severity, not defect count: a partial fix is still a fix.
    const after = inspectFeatures(repaired.object.features);
    return severity(after) < severity(defects) ? repaired.object : first.object;
  }

  /* ------------------------------------------------------------- stage 3b */

  async specs(prd: Prd, features: FeatureSet, language: Language): Promise<SpecBatch> {
    const batches = chunk(features.features, SPEC_BATCH_SIZE);

    const results = await Promise.all(
      batches.map((batch, i) =>
        this.call<SpecBatch>(`specs[${i + 1}/${batches.length}]`, 'fast', {
          schema: specBatchSchema,
          system: systemSpecs(language),
          prompt: [
            `Product: ${prd.title} — ${prd.oneLiner}`,
            `Tech stack: ${prd.techStack.frontend} / ${prd.techStack.backend} / ${prd.techStack.database}`,
            `Write one spec for each of these ${batch.length} features, in this exact order:`,
            batch
              .map(
                (f) =>
                  `## ${f.id} — ${f.name}\n${f.benefit}\nSubfeatures:\n${f.subfeatures
                    .map((s) => `- ${s.id}: ${s.name} — ${s.summary}`)
                    .join('\n')}`,
              )
              .join('\n\n'),
          ].join('\n\n'),
        }),
      ),
    );

    return { specs: results.flatMap((r) => r.object.specs) };
  }

  /* -------------------------------------------------------------- stage 4 */

  async tasks(
    prd: Prd,
    features: FeatureSet,
    specs: SpecBatch,
    language: Language,
  ): Promise<TaskBatch> {
    const specById = new Map(specs.specs.map((s) => [s.featureId, s]));
    const batches = chunk(features.features, TASK_BATCH_SIZE);

    const results = await Promise.all(
      batches.map(async (batch, i) => {
        // Counts computed here, not left to the model. A range in a schema
        // description reliably lands on its floor or below; an explicit number
        // derived from the actual subfeature count does not.
        const subs = batch.reduce((n, f) => n + f.subfeatures.length, 0);
        const minTasks = subs * 2;

        const first = await this.call<TaskBatch>(`tasks[${i + 1}/${batches.length}]`, 'fast', {
          schema: taskBatchSchema,
          system: systemTasks(language),
          prompt: [
            `Product: ${prd.title} — ${prd.oneLiner}`,
            `Tech stack: ${prd.techStack.frontend} / ${prd.techStack.backend} / ${prd.techStack.database} / ${prd.techStack.deployment}`,
            `These ${batch.length} features have ${subs} subfeatures between them. Return at least ${minTasks} tasks — two to four per subfeature. Returning ${subs} tasks means one per subfeature, which is wrong.`,
            `Generate tasks for these ${batch.length} features:`,
            batch
              .map((f) => {
                const spec = specById.get(f.id);
                return [
                  `## ${f.id} — ${f.name} (${f.priority})`,
                  `Subfeatures:\n${f.subfeatures.map((s) => `- ${s.id}: ${s.name}`).join('\n')}`,
                  spec
                    ? `Acceptance criteria:\n${spec.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`
                    : '',
                  spec ? `Data and state:\n${spec.dataAndState.map((c) => `- ${c}`).join('\n')}` : '',
                  spec ? `Edge cases:\n${spec.edgeCases.map((c) => `- ${c}`).join('\n')}` : '',
                ]
                  .filter(Boolean)
                  .join('\n');
              })
              .join('\n\n'),
          ].join('\n\n'),
        });

        const defects = inspectTaskBatch(first.object.tasks, batch, language);
        if (defects.length === 0) return first.object.tasks;

        // One targeted repair. Cheaper and far more stable than regenerating:
        // the model sees its own output plus a precise list of what is wrong.
        const repaired = await this.call<TaskBatch>(
          `tasks[${i + 1}/${batches.length}]:fix`,
          'fast',
          {
            schema: taskBatchSchema,
            system: systemTasks(language),
            prompt: [
              `You produced this task list:`,
              first.object.tasks
                .map((t) => `- ${t.id} (${t.subfeatureId}): ${t.title}`)
                .join('\n'),
              `It has these problems:`,
              defects.map((d) => `- ${d.detail}`).join('\n'),
              `Return the corrected full list for the same ${batch.length} features. Keep the tasks that were already fine, with their ids unchanged.`,
              batch
                .map(
                  (f) =>
                    `## ${f.id} — ${f.name}\nSubfeatures:\n${f.subfeatures
                      .map((s) => `- ${s.id}: ${s.name}`)
                      .join('\n')}`,
                )
                .join('\n\n'),
            ].join('\n\n'),
          },
        );

        // Keep the repair when it fixed anything at all, measured by how many
        // items still offend rather than how many kinds of problem remain.
        const after = inspectTaskBatch(repaired.object.tasks, batch, language);
        return severity(after) < severity(defects) ? repaired.object.tasks : first.object.tasks;
      }),
    );

    return { tasks: results.flat() };
  }

  /* ------------------------------------------------- stage 4b: expansion */

  /**
   * The subfeature breakdown for a feature a revision just added.
   *
   * Deliberately does not produce tasks. An earlier version asked for both in
   * one call to save quota and got stub prompts of 60 characters where the task
   * stage averages 350 — the caller runs `tasks()` on the result instead, which
   * carries the granularity rules and the repair loop.
   */
  async expandFeature(
    prd: Prd,
    feature: { id: string; name: string; benefit: string },
    language: Language,
  ): Promise<FeatureExpansion> {
    const { object } = await this.call<FeatureExpansion>('expand', 'fast', {
      schema: featureExpansionSchema,
      system: systemFeatures(language),
      prompt: [
        `Product: ${prd.title} — ${prd.oneLiner}`,
        `Tech stack: ${prd.techStack.frontend} / ${prd.techStack.backend} / ${prd.techStack.database} / ${prd.techStack.deployment}`,
        'This feature was just added to the plan and has nothing under it yet:',
        `## ${feature.id} — ${feature.name}\n${feature.benefit}`,
        `Break it into 3-4 subfeatures. Prefix every subfeature id with "${feature.id}-".`,
      ].join('\n\n'),
    });
    return object;
  }

  /* -------------------------------------------------------------- stage 5 */

  /** Returns a diff against the existing plan, never a regenerated plan. */
  async revise(
    message: string,
    features: FeatureSet,
    tasks: TaskBatch,
    language: Language,
  ): Promise<Revision> {
    const { object } = await this.call<Revision>('revise', 'fast', {
      schema: revisionSchema,
      system: systemRevise(language),
      prompt: [
        `Current features:\n${features.features
          .map((f) => `- ${f.id}: ${f.name} — ${f.benefit}`)
          .join('\n')}`,
        `Current tasks:\n${tasks.tasks
          .map((t) => `- ${t.id} (${t.featureId}): ${t.title}`)
          .join('\n')}`,
        `User message:\n${message}`,
      ].join('\n\n'),
    });
    return object;
  }

  /* ------------------------------------------------------------------ all */

  async full(input: PlanInput) {
    const prd = await this.prd(input);
    const features = await this.features(prd, input.language);
    const specs = await this.specs(prd, features, input.language);
    const tasks = await this.tasks(prd, features, specs, input.language);
    return { prd, features, specs, tasks };
  }
}
