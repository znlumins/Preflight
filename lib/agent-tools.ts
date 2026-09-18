import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { features, plans, tasks } from './db/schema';

/**
 * What an agent can do with a plan.
 *
 * Three operations, deliberately. Every tool definition is loaded into the
 * agent's context window for the whole conversation, so a server with thirty
 * tools spends a person's context before they have asked for anything. These
 * three cover the loop that matters: what is next, mark it done, how far along.
 *
 * None of them calls a model. They read and write rows that already exist,
 * which is why this costs the server essentially nothing.
 */

export type AgentPlan = { id: string; title: string };

/**
 * The plan an agent works on when none is named.
 *
 * Most recently touched, because that is the one the person was just looking
 * at. Unfinished plans are excluded: there is nothing to hand an agent until
 * the tasks exist.
 */
async function resolvePlan(sessionId: string, planId?: string): Promise<AgentPlan | null> {
  const [row] = await db
    .select({ id: plans.id, title: plans.title })
    .from(plans)
    .where(
      planId
        ? and(eq(plans.sessionId, sessionId), eq(plans.id, planId))
        : and(eq(plans.sessionId, sessionId), eq(plans.status, 'done')),
    )
    .orderBy(desc(plans.updatedAt))
    .limit(1);

  return row ? { id: row.id, title: row.title ?? 'Tanpa judul' } : null;
}

export async function nextTask(sessionId: string, planId?: string) {
  const plan = await resolvePlan(sessionId, planId);
  if (!plan) return { error: 'Tidak ada rencana yang siap dikerjakan.' as const };

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.planId, plan.id), eq(tasks.done, false)))
    .orderBy(asc(tasks.position))
    .limit(1);

  const all = await db
    .select({ done: tasks.done })
    .from(tasks)
    .where(eq(tasks.planId, plan.id));

  const remaining = all.filter((t) => !t.done).length;

  if (!task) {
    return { plan, done: true as const, total: all.length, remaining: 0 };
  }

  const [feature] = await db
    .select({ name: features.name })
    .from(features)
    .where(and(eq(features.planId, plan.id), eq(features.id, task.featureId)))
    .limit(1);

  return {
    plan,
    done: false as const,
    total: all.length,
    remaining,
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      feature: feature?.name ?? task.featureId,
      priority: task.priority,
      /** The deliverable: a self-contained instruction for the agent. */
      instruction: task.agentPrompt,
    },
  };
}

export async function completeTask(sessionId: string, taskId: string, planId?: string) {
  const plan = await resolvePlan(sessionId, planId);
  if (!plan) return { error: 'Rencana tidak ditemukan.' as const };

  const [task] = await db
    .select({ id: tasks.id, title: tasks.title, done: tasks.done })
    .from(tasks)
    .where(and(eq(tasks.planId, plan.id), eq(tasks.id, taskId)))
    .limit(1);

  if (!task) {
    return { error: `Task "${taskId}" tidak ada di rencana ini.` as const };
  }

  if (!task.done) {
    await db
      .update(tasks)
      .set({ done: true })
      .where(and(eq(tasks.planId, plan.id), eq(tasks.id, taskId)));
  }

  const rows = await db
    .select({ done: tasks.done })
    .from(tasks)
    .where(eq(tasks.planId, plan.id));
  const remaining = rows.filter((t) => !t.done).length;

  return {
    plan,
    marked: task.title,
    alreadyDone: task.done,
    remaining,
    total: rows.length,
  };
}

export async function planStatus(sessionId: string, planId?: string) {
  const plan = await resolvePlan(sessionId, planId);
  if (!plan) return { error: 'Tidak ada rencana yang siap dikerjakan.' as const };

  const [taskRows, featureRows, otherPlans] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.planId, plan.id)).orderBy(asc(tasks.position)),
    db
      .select({ id: features.id, name: features.name, priority: features.priority })
      .from(features)
      .where(eq(features.planId, plan.id))
      .orderBy(asc(features.position)),
    db
      .select({ id: plans.id, title: plans.title })
      .from(plans)
      .where(and(eq(plans.sessionId, sessionId), eq(plans.status, 'done')))
      .orderBy(desc(plans.updatedAt))
      .limit(6),
  ]);

  const done = taskRows.filter((t) => t.done).length;

  return {
    plan,
    total: taskRows.length,
    done,
    remaining: taskRows.length - done,
    features: featureRows.map((f) => {
      const own = taskRows.filter((t) => t.featureId === f.id);
      return {
        name: f.name,
        priority: f.priority,
        done: own.filter((t) => t.done).length,
        total: own.length,
      };
    }),
    // Only worth mentioning when there is a choice to be made.
    otherPlans: otherPlans.filter((p) => p.id !== plan.id).map((p) => ({
      id: p.id,
      title: p.title ?? 'Tanpa judul',
    })),
  };
}
