import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db } from './db';
import { plans, usageLog } from './db/schema';

/**
 * Rate limiting for the shared pool.
 *
 * Without this, one person can spend everybody's day: the pool key is good for
 * roughly 500 model requests in 24 hours, and a single plan costs seven. So the
 * pool is rationed two ways — a per-session allowance so no one visitor drains
 * it, and a global ceiling that stops the last few requests being burned on a
 * generation that would die halfway through.
 *
 * A user on their own key is spending their own quota and is not limited here
 * at all. That asymmetry is the point: the limit is an argument for BYOK, not a
 * paywall.
 */

/** Plans one session may start per rolling day on the shared pool. */
const POOL_PLANS_PER_SESSION = 3;

/**
 * Global pool requests per rolling day. Held below the provider's ~500 so a
 * generation already in flight can finish instead of failing at stage four.
 */
const POOL_REQUESTS_PER_DAY = 420;

/** Requests one plan costs end to end, used to reserve headroom. */
const REQUESTS_PER_PLAN = 8;

const DAY_MS = 24 * 60 * 60 * 1000;
const since = () => new Date(Date.now() - DAY_MS);

export type LimitVerdict = {
  allowed: boolean;
  /** Plans this session can still start today. Infinity on BYOK. */
  remaining: number;
  reason?: string;
};

export type PoolUsage = {
  used: number;
  limit: number;
  sessionRemaining: number;
};

/** Pool consumption over the last rolling day, for display. */
export async function poolUsage(sessionId: string): Promise<PoolUsage> {
  const [[global], [mine]] = await Promise.all([
    db
      .select({ n: count() })
      .from(usageLog)
      .where(and(eq(usageLog.byok, false), gte(usageLog.createdAt, since()))),
    db
      .select({ n: count() })
      .from(plans)
      .where(and(eq(plans.sessionId, sessionId), gte(plans.createdAt, since()))),
  ]);

  return {
    used: global?.n ?? 0,
    limit: POOL_REQUESTS_PER_DAY,
    sessionRemaining: Math.max(0, POOL_PLANS_PER_SESSION - (mine?.n ?? 0)),
  };
}

/**
 * Whether this session may start another plan.
 *
 * Checked before creating a plan, not before every stage: stopping someone
 * three stages into a generation would waste the quota already spent on them.
 */
export async function checkPlanLimit(sessionId: string, byok: boolean): Promise<LimitVerdict> {
  if (byok) return { allowed: true, remaining: Infinity };

  const usage = await poolUsage(sessionId);

  if (usage.used + REQUESTS_PER_PLAN > usage.limit) {
    return {
      allowed: false,
      remaining: 0,
      reason:
        'Kuota AI gratis bersama untuk hari ini sudah habis. Pasang API key kamu sendiri di Pengaturan untuk lanjut sekarang — gratis, tanpa kartu kredit.',
    };
  }

  if (usage.sessionRemaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      reason: `Kamu sudah membuat ${POOL_PLANS_PER_SESSION} rencana hari ini dengan kuota bersama. Pasang API key kamu sendiri di Pengaturan untuk lanjut tanpa batas ini — gratis.`,
    };
  }

  return { allowed: true, remaining: usage.sessionRemaining };
}

/**
 * Cheap guard for the revision chat, which costs one request rather than a
 * whole plan, so it gets its own smaller allowance.
 */
const POOL_REVISIONS_PER_SESSION = 20;

export async function checkRevisionLimit(
  sessionId: string,
  byok: boolean,
): Promise<LimitVerdict> {
  if (byok) return { allowed: true, remaining: Infinity };

  const [row] = await db
    .select({ n: count() })
    .from(usageLog)
    .where(
      and(
        eq(usageLog.sessionId, sessionId),
        eq(usageLog.byok, false),
        gte(usageLog.createdAt, since()),
        sql`${usageLog.stage} like 'revise%'`,
      ),
    );

  const used = row?.n ?? 0;
  if (used >= POOL_REVISIONS_PER_SESSION) {
    return {
      allowed: false,
      remaining: 0,
      reason:
        'Kamu sudah memakai jatah revisi hari ini dengan kuota bersama. Pasang API key kamu sendiri di Pengaturan untuk lanjut — gratis.',
    };
  }

  return { allowed: true, remaining: POOL_REVISIONS_PER_SESSION - used };
}
