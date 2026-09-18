import { z } from 'zod';

/**
 * Structured-output contracts for the planning pipeline.
 *
 * Deliberately conservative: objects, arrays, strings, numbers and enums only.
 * No discriminated unions, no records, no `.optional()` on nested fields —
 * Gemini and Llama both handle that subset reliably, and anything fancier
 * shows up as a schema-validation failure at 2am rather than a compile error.
 */

export const LANGUAGES = ['id', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const PRIORITIES = ['P0', 'P1', 'P2'] as const;

/* ---------------------------------------------------------------- stage 1 */

export const questionnaireSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().describe('kebab-case, stable, e.g. "target-user"'),
        question: z.string().describe('One question, plain language, no jargon.'),
        why: z
          .string()
          .describe('One short sentence: what this answer changes about the plan.'),
        type: z.enum(['single', 'multi', 'text']),
        options: z
          .array(
            z.object({
              value: z.string().describe('kebab-case'),
              label: z.string().describe('2-6 words'),
            }),
          )
          .describe('Empty array when type is "text". Otherwise 3-5 options.'),
      }),
    )
    .describe('Exactly 5 questions, ordered from most to least decision-changing.'),
});
export type Questionnaire = z.infer<typeof questionnaireSchema>;

/* ---------------------------------------------------------------- stage 2 */

/**
 * Structure only — the markdown document is rendered deterministically in
 * `render.ts`. Asking the model for prose *and* structure would roughly double
 * the output tokens of the single most expensive call in the pipeline.
 */
export const prdSchema = z.object({
  title: z.string().describe('Product name, 1-4 words.'),
  oneLiner: z.string().describe('One sentence: what it is and who it is for.'),
  problem: z.string().describe('2-4 sentences on the problem being solved.'),
  targetUsers: z.array(z.string()).describe('2-3 concrete user types.'),
  goals: z.array(z.string()).describe('3-5 outcomes the product must achieve.'),
  nonGoals: z
    .array(z.string())
    .describe('3-5 things explicitly out of scope. Be specific; this is the useful half.'),
  successMetrics: z.array(z.string()).describe('2-4 measurable signals.'),
  mvpScope: z.array(z.string()).describe('4-8 capabilities shipping in v1.'),
  laterScope: z.array(z.string()).describe('3-6 capabilities deferred past v1.'),
  techStack: z.object({
    frontend: z.string(),
    backend: z.string(),
    database: z.string(),
    deployment: z.string(),
    rationale: z.string().describe('One sentence on why this stack fits.'),
  }),
  risks: z
    .array(
      z.object({
        risk: z.string(),
        mitigation: z.string(),
      }),
    )
    .describe('2-4 risks that could actually sink the build.'),
});
export type Prd = z.infer<typeof prdSchema>;

/* ---------------------------------------------------------------- stage 3 */

export const featureSetSchema = z.object({
  features: z
    .array(
      z.object({
        id: z.string().describe('kebab-case, stable, e.g. "auth"'),
        name: z.string().describe('1-3 words, from the user point of view.'),
        benefit: z.string().describe('One sentence: what the user gains.'),
        priority: z.enum(PRIORITIES),
        subfeatures: z
          .array(
            z.object({
              id: z.string().describe('kebab-case, prefixed by feature id, e.g. "auth-login"'),
              name: z.string().describe('2-5 words.'),
              summary: z.string().describe('One sentence.'),
            }),
          )
          .describe('3-4 subfeatures. Two means you collapsed distinct capabilities.'),
      }),
    )
    .describe('5-9 features covering the MVP scope and nothing beyond it.'),
});
export type FeatureSet = z.infer<typeof featureSetSchema>;

/* --------------------------------------------------------------- stage 3b */

/** The "4-section spec": stories, acceptance, data, edges. */
export const specBatchSchema = z.object({
  specs: z
    .array(
      z.object({
        featureId: z.string().describe('Must match a feature id exactly.'),
        userStories: z.array(z.string()).describe('2-4, "As a X, I want Y so that Z".'),
        acceptanceCriteria: z.array(z.string()).describe('3-6, each independently testable.'),
        dataAndState: z.array(z.string()).describe('2-5 entities, fields or state transitions.'),
        edgeCases: z.array(z.string()).describe('2-4 failure or boundary cases.'),
      }),
    )
    .describe('One entry per requested feature, same order, same count.'),
});
export type SpecBatch = z.infer<typeof specBatchSchema>;

/* ---------------------------------------------------------------- stage 4 */

export const taskBatchSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z.string().describe('kebab-case, stable, unique across the whole plan.'),
        featureId: z.string().describe('Must match a feature id exactly.'),
        subfeatureId: z.string().describe('Must match a subfeature id exactly.'),
        title: z.string().describe('3-7 words, imperative: "Add password reset endpoint".'),
        description: z.string().describe('One sentence: what changes and where.'),
        priority: z.enum(PRIORITIES).describe('Aligned with dependency order, not importance.'),
        dependsOn: z
          .array(z.string())
          .describe('Task ids that must land first. Empty array when none.'),
        agentPrompt: z
          .string()
          .describe(
            'The deliverable. A self-contained instruction to paste into an AI coding agent: ' +
              'the goal, the files to touch, the constraints, and how to verify it works. ' +
              '4-8 sentences. Assume the agent can read the repo but has not read the PRD.',
          ),
      }),
    )
    .describe('Tasks for every requested feature, grouped by feature, in build order.'),
});
export type TaskBatch = z.infer<typeof taskBatchSchema>;

/* --------------------------------------------------- stage 4b: expansion */

/**
 * The subfeature breakdown for a feature a revision added.
 *
 * Only the breakdown: tasks then go through the normal task stage, which has
 * the granularity rules and the repair loop that several iterations of tuning
 * produced. Generating them here instead returned stub prompts of 60 characters
 * against the pipeline's average of 350.
 */
export const featureExpansionSchema = z.object({
  subfeatures: z
    .array(
      z.object({
        id: z.string().describe('kebab-case, prefixed by the feature id'),
        name: z.string().describe('2-5 words.'),
        summary: z.string().describe('One sentence.'),
      }),
    )
    .describe('3-4 subfeatures for this one feature.'),
});
export type FeatureExpansion = z.infer<typeof featureExpansionSchema>;

/* ---------------------------------------------------------------- stage 5 */

/**
 * Revision returns a *diff*, never a regenerated plan. Flat shape with an `op`
 * enum instead of a discriminated union, for provider compatibility.
 * Unused fields come back as empty strings.
 */
export const revisionSchema = z.object({
  reply: z.string().describe('One or two sentences to the user, in their language.'),
  ops: z
    .array(
      z.object({
        op: z.enum([
          'add_feature',
          'update_feature',
          'remove_feature',
          'add_task',
          'update_task',
          'remove_task',
          'none',
        ]),
        targetId: z
          .string()
          .describe('Exact existing id for update/remove. New kebab-case id for add. "" for none.'),
        featureId: z.string().describe('Owning feature id for task ops, else "".'),
        name: z.string().describe('New name or title. "" when unchanged.'),
        detail: z.string().describe('New benefit or description. "" when unchanged.'),
        agentPrompt: z.string().describe('New agent prompt for task ops. "" when unchanged.'),
        reason: z.string().describe('One sentence: why this op is needed.'),
      }),
    )
    .describe('Minimal set of operations. Empty array when the plan already matches the request.'),
});
export type Revision = z.infer<typeof revisionSchema>;
