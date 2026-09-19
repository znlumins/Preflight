import { and, asc, desc, eq, isNull, max } from 'drizzle-orm';
import { db } from './db';
import { features, plans, revisions, subfeatures, tasks } from './db/schema';
import type { FeatureExpansion, Revision, SpecBatch, TaskBatch } from './ai/schemas';

/**
 * Applying a revision.
 *
 * The model returns a diff, never a regenerated plan, so this walks the
 * operations and touches only what they name. Two rules keep that safe:
 *
 *  - An op that targets an id which does not exist is skipped, not guessed at.
 *    A free-tier model will occasionally invent an id, and quietly editing the
 *    nearest match would corrupt a plan in a way nobody could trace.
 *  - Removing a feature removes its subfeatures and tasks too, because leaving
 *    orphans behind is worse than doing nothing.
 */

export type AppliedOp = { op: string; targetId: string; label: string; reason: string };

/** The plan as it stood before a revision, enough to restore it exactly. */
export type PlanSnapshot = {
  features: (typeof features.$inferSelect)[];
  subfeatures: (typeof subfeatures.$inferSelect)[];
  tasks: (typeof tasks.$inferSelect)[];
};

/** The handle `db.transaction` passes to its callback. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function snapshotOf(tx: Tx, planId: string): Promise<PlanSnapshot> {
  const [f, s, t] = await Promise.all([
    tx.select().from(features).where(eq(features.planId, planId)),
    tx.select().from(subfeatures).where(eq(subfeatures.planId, planId)),
    tx.select().from(tasks).where(eq(tasks.planId, planId)),
  ]);
  return { features: f, subfeatures: s, tasks: t };
}

/**
 * One transaction per revision: an op that fails halfway (a duplicate id, a
 * dropped connection) rolls back every op before it, so the plan is either
 * fully revised or untouched — never half of each with no snapshot to undo to.
 */
export function applyRevision(
  planId: string,
  sessionId: string,
  message: string,
  revision: Revision,
): Promise<{ applied: AppliedOp[]; skipped: AppliedOp[]; revisionId: number }> {
  return db.transaction((tx) => applyRevisionIn(tx, planId, sessionId, message, revision));
}

async function applyRevisionIn(
  tx: Tx,
  planId: string,
  sessionId: string,
  message: string,
  revision: Revision,
): Promise<{ applied: AppliedOp[]; skipped: AppliedOp[]; revisionId: number }> {
  const [featureRows, taskRows] = await Promise.all([
    tx.select().from(features).where(eq(features.planId, planId)),
    tx.select().from(tasks).where(eq(tasks.planId, planId)),
  ]);

  const before = await snapshotOf(tx, planId);

  const featureIds = new Set(featureRows.map((f) => f.id));
  const taskIds = new Set(taskRows.map((t) => t.id));

  const applied: AppliedOp[] = [];
  const skipped: AppliedOp[] = [];

  const [{ value: lastFeaturePos } = { value: null }] = await tx
    .select({ value: max(features.position) })
    .from(features)
    .where(eq(features.planId, planId));
  const [{ value: lastTaskPos } = { value: null }] = await tx
    .select({ value: max(tasks.position) })
    .from(tasks)
    .where(eq(tasks.planId, planId));

  let nextFeaturePos = (lastFeaturePos ?? -1) + 1;
  let nextTaskPos = (lastTaskPos ?? -1) + 1;

  for (const raw of revision.ops) {
    const entry: AppliedOp = {
      op: raw.op,
      targetId: raw.targetId,
      // Prefer the name the model gave; fall back to what is already stored, so
      // a removal still reads as 'Pengingat WhatsApp' rather than an id.
      label:
        raw.name ||
        featureRows.find((f) => f.id === raw.targetId)?.name ||
        taskRows.find((t) => t.id === raw.targetId)?.title ||
        raw.targetId,
      reason: raw.reason,
    };

    switch (raw.op) {
      case 'none':
        continue;

      case 'add_feature': {
        if (!raw.targetId || featureIds.has(raw.targetId)) {
          skipped.push(entry);
          continue;
        }
        await tx.insert(features).values({
          id: raw.targetId,
          planId,
          name: raw.name || raw.targetId,
          benefit: raw.detail || '',
          priority: 'P1',
          position: nextFeaturePos++,
        });
        featureIds.add(raw.targetId);
        applied.push(entry);
        break;
      }

      case 'update_feature': {
        if (!featureIds.has(raw.targetId)) {
          skipped.push(entry);
          continue;
        }
        const patch: Record<string, string> = {};
        if (raw.name) patch.name = raw.name;
        if (raw.detail) patch.benefit = raw.detail;
        if (Object.keys(patch).length === 0) {
          skipped.push(entry);
          continue;
        }
        await tx
          .update(features)
          .set(patch)
          .where(and(eq(features.planId, planId), eq(features.id, raw.targetId)));
        applied.push(entry);
        break;
      }

      case 'remove_feature': {
        if (!featureIds.has(raw.targetId)) {
          skipped.push(entry);
          continue;
        }
        // Children go with the parent; orphaned tasks are worse than no change.
        await tx
          .delete(tasks)
          .where(and(eq(tasks.planId, planId), eq(tasks.featureId, raw.targetId)));
        await tx
          .delete(subfeatures)
          .where(and(eq(subfeatures.planId, planId), eq(subfeatures.featureId, raw.targetId)));
        await tx
          .delete(features)
          .where(and(eq(features.planId, planId), eq(features.id, raw.targetId)));
        featureIds.delete(raw.targetId);
        applied.push(entry);
        break;
      }

      case 'add_task': {
        if (!raw.targetId || taskIds.has(raw.targetId) || !featureIds.has(raw.featureId)) {
          skipped.push(entry);
          continue;
        }
        // Hang it off any subfeature of the owning feature; the model rarely
        // names one on an add, and an unattached task disappears from the UI.
        const [anySub] = await tx
          .select({ id: subfeatures.id })
          .from(subfeatures)
          .where(and(eq(subfeatures.planId, planId), eq(subfeatures.featureId, raw.featureId)))
          .orderBy(asc(subfeatures.position))
          .limit(1);

        await tx.insert(tasks).values({
          id: raw.targetId,
          planId,
          featureId: raw.featureId,
          subfeatureId: anySub?.id ?? raw.featureId,
          title: raw.name || raw.targetId,
          description: raw.detail || '',
          priority: 'P1',
          dependsOn: [],
          agentPrompt: raw.agentPrompt || raw.detail || raw.name || '',
          position: nextTaskPos++,
        });
        taskIds.add(raw.targetId);
        applied.push(entry);
        break;
      }

      case 'update_task': {
        if (!taskIds.has(raw.targetId)) {
          skipped.push(entry);
          continue;
        }
        const patch: Record<string, string> = {};
        if (raw.name) patch.title = raw.name;
        if (raw.detail) patch.description = raw.detail;
        if (raw.agentPrompt) patch.agentPrompt = raw.agentPrompt;
        if (Object.keys(patch).length === 0) {
          skipped.push(entry);
          continue;
        }
        await tx
          .update(tasks)
          .set(patch)
          .where(and(eq(tasks.planId, planId), eq(tasks.id, raw.targetId)));
        applied.push(entry);
        break;
      }

      case 'remove_task': {
        if (!taskIds.has(raw.targetId)) {
          skipped.push(entry);
          continue;
        }
        await tx.delete(tasks).where(and(eq(tasks.planId, planId), eq(tasks.id, raw.targetId)));
        taskIds.delete(raw.targetId);
        applied.push(entry);
        break;
      }

      default:
        skipped.push(entry);
    }
  }

  const [row] = await tx
    .insert(revisions)
    .values({
      planId,
      sessionId,
      message,
      reply: revision.reply,
      ops: applied,
      // Only worth keeping when something actually changed.
      snapshot: applied.length ? before : null,
    })
    .returning({ id: revisions.id });

  if (applied.length) {
    await tx.update(plans).set({ updatedAt: new Date() }).where(eq(plans.id, planId));
  }

  return { applied, skipped, revisionId: row.id };
}

export async function listRevisions(planId: string) {
  return db
    .select()
    .from(revisions)
    .where(eq(revisions.planId, planId))
    .orderBy(desc(revisions.createdAt))
    .limit(30);
}

/**
 * Fills in a feature that a revision created.
 *
 * Runs after the op is already committed, so a failure here leaves a thin
 * feature rather than losing the user's edit. Its own writes are one
 * transaction: subfeatures without their tasks would be a half-filled feature
 * that looks finished.
 */
export function expandAddedFeature(
  planId: string,
  featureId: string,
  expansion: FeatureExpansion,
  batch: TaskBatch,
  specs: SpecBatch,
): Promise<void> {
  return db.transaction((tx) =>
    expandAddedFeatureIn(tx, planId, featureId, expansion, batch, specs),
  );
}

async function expandAddedFeatureIn(
  tx: Tx,
  planId: string,
  featureId: string,
  expansion: FeatureExpansion,
  batch: TaskBatch,
  specs: SpecBatch,
) {
  const [{ value: lastSubPos } = { value: null }] = await tx
    .select({ value: max(subfeatures.position) })
    .from(subfeatures)
    .where(and(eq(subfeatures.planId, planId), eq(subfeatures.featureId, featureId)));
  const [{ value: lastTaskPos } = { value: null }] = await tx
    .select({ value: max(tasks.position) })
    .from(tasks)
    .where(eq(tasks.planId, planId));

  let subPos = (lastSubPos ?? -1) + 1;
  let taskPos = (lastTaskPos ?? -1) + 1;

  const subIds = new Set<string>();
  const subRows = expansion.subfeatures
    .filter((s) => s.id && !subIds.has(s.id) && subIds.add(s.id))
    .map((s) => ({
      id: s.id,
      planId,
      featureId,
      name: s.name,
      summary: s.summary,
      position: subPos++,
    }));
  if (subRows.length) await tx.insert(subfeatures).values(subRows);

  // A task pointing at a subfeature that was not created would vanish from the
  // UI, so those get reattached to the first real one.
  const fallback = subRows[0]?.id ?? featureId;
  const taskIds = new Set<string>();
  const taskRows = batch.tasks
    .filter((t) => t.id && !taskIds.has(t.id) && taskIds.add(t.id))
    .map((t) => ({
      id: t.id,
      planId,
      featureId,
      subfeatureId: subIds.has(t.subfeatureId) ? t.subfeatureId : fallback,
      title: t.title,
      description: t.description,
      priority: t.priority,
      dependsOn: [] as string[],
      agentPrompt: t.agentPrompt,
      position: taskPos++,
    }));
  if (taskRows.length) await tx.insert(tasks).values(taskRows);

  // Attach the spec so the new feature reads like every other one in the plan.
  const spec = specs.specs.find((s) => s.featureId === featureId);
  if (spec) {
    await tx
      .update(features)
      .set({ spec })
      .where(and(eq(features.planId, planId), eq(features.id, featureId)));
  }
}

/**
 * Restores the plan to how it stood before a revision.
 *
 * Replaces rather than reverses: working out the inverse of a set of operations
 * is guesswork once a cascade has removed rows, while the snapshot is exactly
 * what was there. Task completion flags come back with it.
 *
 * The delete-then-restore runs in one transaction: a restore that failed after
 * the delete would otherwise leave an empty plan.
 */
export function undoRevision(
  planId: string,
  sessionId: string,
  revisionId: number,
): Promise<{ ok: boolean; reason?: string }> {
  return db.transaction((tx) => undoRevisionIn(tx, planId, sessionId, revisionId));
}

async function undoRevisionIn(
  tx: Tx,
  planId: string,
  sessionId: string,
  revisionId: number,
): Promise<{ ok: boolean; reason?: string }> {
  const [row] = await tx
    .select()
    .from(revisions)
    .where(
      and(
        eq(revisions.id, revisionId),
        eq(revisions.planId, planId),
        eq(revisions.sessionId, sessionId),
      ),
    )
    .limit(1);

  if (!row) return { ok: false, reason: 'Revisi tidak ditemukan.' };
  if (row.undoneAt) return { ok: false, reason: 'Revisi ini sudah dibatalkan.' };
  if (!row.snapshot) return { ok: false, reason: 'Revisi ini tidak mengubah apa pun.' };

  // Only the newest revision can be undone: rolling back an older one would
  // silently discard everything done after it.
  const [newest] = await tx
    .select({ id: revisions.id })
    .from(revisions)
    .where(and(eq(revisions.planId, planId), isNull(revisions.undoneAt)))
    .orderBy(desc(revisions.createdAt))
    .limit(1);
  if (newest && newest.id !== revisionId) {
    return { ok: false, reason: 'Batalkan revisi yang paling baru dulu.' };
  }

  const snap = row.snapshot as PlanSnapshot;

  await tx.delete(tasks).where(eq(tasks.planId, planId));
  await tx.delete(subfeatures).where(eq(subfeatures.planId, planId));
  await tx.delete(features).where(eq(features.planId, planId));

  if (snap.features.length) await tx.insert(features).values(snap.features);
  if (snap.subfeatures.length) await tx.insert(subfeatures).values(snap.subfeatures);
  if (snap.tasks.length) await tx.insert(tasks).values(snap.tasks);

  await tx.update(revisions).set({ undoneAt: new Date() }).where(eq(revisions.id, revisionId));
  await tx.update(plans).set({ updatedAt: new Date() }).where(eq(plans.id, planId));

  return { ok: true };
}

/** Replaces a revision's stored reply, when the route adds to what the model said. */
export async function setRevisionReply(revisionId: number, reply: string) {
  await db.update(revisions).set({ reply }).where(eq(revisions.id, revisionId));
}
