import { and, asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from './db';
import { features, plans, subfeatures, tasks, usageLog } from './db/schema';
import type { CallMetric } from './ai/meter';
import type { UsageContext } from './api';
import type { FeatureSet, Prd, Questionnaire, SpecBatch, TaskBatch } from './ai/schemas';

/**
 * Persistence for the planning pipeline.
 *
 * Each stage commits as it completes, so a reload mid-generation shows partial
 * work rather than nothing, and the client can resume from `plan.status`.
 */

export type PlanStatus = 'draft' | 'prd' | 'features' | 'specs' | 'done' | 'error';

export async function createPlan(input: {
  sessionId: string;
  ipHash: string | null;
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
    ipHash: input.ipHash,
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

  // Replace wholesale: a regenerated breakdown may drop or rename ids, and
  // merging would leave orphans behind. One transaction, so a failed insert
  // leaves the previous breakdown in place instead of an empty plan.
  await db.transaction(async (tx) => {
    await tx.delete(subfeatures).where(eq(subfeatures.planId, planId));
    await tx.delete(features).where(eq(features.planId, planId));
    if (featureRows.length) await tx.insert(features).values(featureRows);
    if (subRows.length) await tx.insert(subfeatures).values(subRows);
    await tx
      .update(plans)
      .set({ status: 'features', error: null, ...touch() })
      .where(eq(plans.id, planId));
  });
}

export async function saveSpecs(planId: string, batch: SpecBatch) {
  await db.transaction(async (tx) => {
    for (const spec of batch.specs) {
      await tx
        .update(features)
        .set({ spec })
        .where(and(eq(features.planId, planId), eq(features.id, spec.featureId)));
    }
    await tx
      .update(plans)
      .set({ status: 'specs', error: null, ...touch() })
      .where(eq(plans.id, planId));
  });
}

export async function saveTasks(planId: string, batch: TaskBatch) {
  await db.transaction(async (tx) => {
    // Completion is user-owned: a task that survives a regeneration under the
    // same id keeps its tick.
    const finished = new Set(
      (
        await tx
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.planId, planId), eq(tasks.done, true)))
      ).map((t) => t.id),
    );

    // The model can repeat an id across batches; keep the first and drop the
    // rest rather than failing the whole save.
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
        done: finished.has(t.id),
        position: i,
      }));

    await tx.delete(tasks).where(eq(tasks.planId, planId));
    if (rows.length) await tx.insert(tasks).values(rows);
    await tx
      .update(plans)
      .set({ status: 'done', error: null, ...touch() })
      .where(eq(plans.id, planId));
  });
}

/**
 * Sets a task's done flag. Returns false when the task does not exist.
 *
 * Also touches the plan: agents default to the most recently updated plan, and
 * the one being worked through is the one they should land on.
 */
export async function setTaskDone(planId: string, taskId: string, done: boolean) {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(tasks)
      .set({ done })
      .where(and(eq(tasks.planId, planId), eq(tasks.id, taskId)))
      .returning({ id: tasks.id });
    if (!updated.length) return false;
    await tx.update(plans).set(touch()).where(eq(plans.id, planId));
    return true;
  });
}

export async function markError(planId: string, message: string) {
  await db
    .update(plans)
    .set({ status: 'error', error: message.slice(0, 500), ...touch() })
    .where(eq(plans.id, planId));
}

/** Flushes metered calls into the usage log. */
export async function recordUsage(calls: CallMetric[], ctx: UsageContext) {
  if (!calls.length) return;
  await db.insert(usageLog).values(
    calls.map((c) => ({
      planId: ctx.planId,
      sessionId: ctx.sessionId,
      ipHash: ctx.ipHash,
      stage: ctx.stagePrefix ? `${ctx.stagePrefix}${c.stage}` : c.stage,
      model: c.model,
      tier: c.tier,
      byok: ctx.byok,
      ms: c.ms,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
      ok: c.ok,
      error: c.error ?? null,
    })),
  );
}
