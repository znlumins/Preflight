import { and, asc, desc, eq, isNotNull } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { db } from './db';
import { features, plans, subfeatures, tasks } from './db/schema';

/**
 * Public sharing.
 *
 * A plan holds someone's product idea, so publishing is opt-in, reversible, and
 * never a side effect of anything else. Unpublishing clears the slug outright
 * rather than flipping a flag: the old URL becomes a 404 instead of a page that
 * is still reachable by anyone who kept the link.
 */

// No vowels, so a random suffix cannot spell something unfortunate.
const suffix = customAlphabet('23456789bcdfghjkmnpqrstvwxyz', 6);

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base || 'rencana'}-${suffix()}`;
}

export async function publishPlan(
  planId: string,
  sessionId: string,
): Promise<{ slug: string } | null> {
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.sessionId, sessionId)))
    .limit(1);

  if (!plan || plan.status !== 'done') return null;
  if (plan.publicSlug) return { slug: plan.publicSlug };

  const slug = slugify(plan.title ?? 'rencana');
  await db
    .update(plans)
    .set({ publicSlug: slug, publishedAt: new Date() })
    .where(eq(plans.id, planId));

  return { slug };
}

export async function unpublishPlan(planId: string, sessionId: string): Promise<void> {
  await db
    .update(plans)
    .set({ publicSlug: null, publishedAt: null })
    .where(and(eq(plans.id, planId), eq(plans.sessionId, sessionId)));
}

/**
 * Loads a published plan by slug, for anyone.
 *
 * No session check by design — that is what published means. The owner's
 * identity, their original idea text, the interview answers and the revision
 * history are all left behind: only the plan itself is public.
 */
export async function loadPublicPlan(slug: string) {
  const [plan] = await db
    .select({
      id: plans.id,
      title: plans.title,
      prd: plans.prd,
      language: plans.language,
      publishedAt: plans.publishedAt,
    })
    .from(plans)
    .where(eq(plans.publicSlug, slug))
    .limit(1);

  if (!plan) return null;

  const [featureRows, subRows, taskRows] = await Promise.all([
    db.select().from(features).where(eq(features.planId, plan.id)).orderBy(asc(features.position)),
    db
      .select()
      .from(subfeatures)
      .where(eq(subfeatures.planId, plan.id))
      .orderBy(asc(subfeatures.position)),
    db.select().from(tasks).where(eq(tasks.planId, plan.id)).orderBy(asc(tasks.position)),
  ]);

  return { plan, features: featureRows, subfeatures: subRows, tasks: taskRows };
}

/**
 * Published plans, newest first — for the sitemap and the public index.
 *
 * Never throws. Both callers render at build time, and a database that is
 * briefly unreachable should cost a stale sitemap, not a failed deployment.
 */
export async function listPublicPlans(limit = 200) {
  try {
    return await queryPublicPlans(limit);
  } catch (err) {
    console.error('listPublicPlans failed, serving an empty list:', err);
    return [];
  }
}

async function queryPublicPlans(limit: number) {
  return db
    .select({
      slug: plans.publicSlug,
      title: plans.title,
      // The one-liner doubles as the list subtitle and as indexable text on a
      // page whose whole job is being found.
      prd: plans.prd,
      publishedAt: plans.publishedAt,
    })
    .from(plans)
    .where(and(isNotNull(plans.publicSlug), eq(plans.status, 'done')))
    .orderBy(desc(plans.publishedAt))
    .limit(limit);
}
