import { and, asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from './db';
import { features, plans, subfeatures, tasks, usageLog } from './db/schema';
import type { Meter } from './ai/meter';
import type { FeatureSet, Prd, Questionnaire, SpecBatch, TaskBatch } from './ai/schemas';

/**
 * Persistence for the planning pipeline.
 *
 * Each stage commits as it completes, so a reload mid-generation shows partial
 * work rather than nothing, and the client can resume from `plan.status`.
 */

export type PlanStatus = 'draft' | 'prd' | 'features' | 'specs' | 'done' | 'error';

/** The next stage to run, or null when the plan is finished. */
export function nextStage(status: PlanStatus): 'prd' | 'features' | 'specs' | 'tasks' | null {
  switch (status) {
    case 'draft':
      return 'prd';
    case 'prd':
      return 'features';
    case 'features':
      return 'specs';
    case 'specs':
      return 'tasks';
    default:
      return null;
  }
}

export async function createPlan(input: {
  sessionId: string;
  idea: string;
  context?: string;
  language: 'id' | 'en';
  questions?: Questionnaire;
  answers?: { questionId: string; answer: string }[];
}): Promise<string> {
  const id = nanoid(12);
  await db.insert(plans).values({
    id,
    sessionId: input.sessionId,
    idea: input.idea,
    context: input.context ?? null,
    language: input.language,
    questions: input.questions ?? null,
    answers: input.answers ?? null,
    status: 'draft',
  });
  return id;
}

/** Loads a plan and everything under it, scoped to the owning session. */
export async function loadPlan(planId: string, sessionId: string) {
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.sessionId, sessionId)))
    .limit(1);
  if (!plan) return null;

  const [featureRows, subRows, taskRows] = await Promise.all([
    db.select().from(features).where(eq(features.planId, planId)).orderBy(asc(features.position)),
    db
      .select()
      .from(subfeatures)
      .where(eq(subfeatures.planId, planId))
      .orderBy(asc(subfeatures.position)),
    db.select().from(tasks).where(eq(tasks.planId, planId)).orderBy(asc(tasks.position)),
  ]);

  return { plan, features: featureRows, subfeatures: subRows, tasks: taskRows };
}

export async function listPlans(sessionId: string) {
  return db
    .select({
      id: plans.id,
      title: plans.title,
      idea: plans.idea,
      status: plans.status,
      createdAt: plans.createdAt,
    })
    .from(plans)
    .where(eq(plans.sessionId, sessionId))
    .orderBy(asc(plans.createdAt));
}

const touch = () => ({ updatedAt: new Date() });

export async function savePrd(planId: string, prd: Prd) {
  await db
    .update(plans)
    .set({ prd, title: prd.title, status: 'prd', error: null, ...touch() })
    .where(eq(plans.id, planId));
}

export async function saveFeatures(planId: string, set: FeatureSet) {
  // Replace wholesale: a regenerated breakdown may drop or rename ids, and
  // merging would leave orphans behind.
  await db.delete(subfeatures).where(eq(subfeatures.planId, planId));
  await db.delete(features).where(eq(features.planId, planId));

  const featureRows = set.features.map((f, i) => ({
    id: f.id,
    planId,
    name: f.name,
    benefit: f.benefit,
    priority: f.priority,
    position: i,
  }));
  const subRows = set.features.flatMap((f) =>
    f.subfeatures.map((s, i) => ({
      id: s.id,
      planId,
      featureId: f.id,
      name: s.name,
      summary: s.summary,
      position: i,
    })),
  );

  if (featureRows.length) await db.insert(features).values(featureRows);
  if (subRows.length) await db.insert(subfeatures).values(subRows);

  await db.update(plans).set({ status: 'features', ...touch() }).where(eq(plans.id, planId));
}

export async function saveSpecs(planId: string, batch: SpecBatch) {
  await Promise.all(
    batch.specs.map((spec) =>
      db
        .update(features)
        .set({ spec })
        .where(and(eq(features.planId, planId), eq(features.id, spec.featureId))),
    ),
  );
  await db.update(plans).set({ status: 'specs', ...touch() }).where(eq(plans.id, planId));
}

export async function saveTasks(planId: string, batch: TaskBatch) {
  await db.delete(tasks).where(eq(tasks.planId, planId));

  // The model can repeat an id across batches; keep the first and drop the rest
  // rather than failing the whole save.
  const seen = new Set<string>();
  const rows = batch.tasks
    .filter((t) => !seen.has(t.id) && seen.add(t.id))
    .map((t, i) => ({
      id: t.id,
      planId,
      featureId: t.featureId,
      subfeatureId: t.subfeatureId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      dependsOn: t.dependsOn,
      agentPrompt: t.agentPrompt,
      position: i,
    }));

  if (rows.length) await db.insert(tasks).values(rows);
  await db.update(plans).set({ status: 'done', ...touch() }).where(eq(plans.id, planId));
}

export async function setTaskDone(planId: string, taskId: string, done: boolean) {
  await db
    .update(tasks)
    .set({ done })
    .where(and(eq(tasks.planId, planId), eq(tasks.id, taskId)));
}

export async function markError(planId: string, message: string) {
  await db
    .update(plans)
    .set({ status: 'error', error: message.slice(0, 500), ...touch() })
    .where(eq(plans.id, planId));
}

/** Flushes a pipeline run's metering into the usage log. */
export async function recordUsage(
  meter: Meter,
  sessionId: string,
  planId: string | null,
  byok: boolean,
) {
  if (!meter.calls.length) return;
  await db.insert(usageLog).values(
    meter.calls.map((c) => ({
      planId,
      sessionId,
      stage: c.stage,
      model: c.model,
      tier: c.tier,
      byok,
      ms: c.ms,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
      ok: c.ok,
      error: c.error ?? null,
    })),
  );
}
