import { and, count, eq, gte, sql, type SQL } from 'drizzle-orm';
import { db } from './db';
import { plans, usageLog } from './db/schema';
import type { Caller } from './session';

/**
 * Rate limiting for the shared pool.
 *
 * Without this, one person can spend everybody's day: the pool key is good for
 * roughly 500 model requests in 24 hours, and a single plan costs seven. So the
 * pool is rationed two ways — a per-caller allowance so no one visitor drains
 * it, and a global ceiling that stops the last few requests being burned on a
 * generation that would die halfway through.
 *
 * A caller is both the session cookie and the IP. Either one reaching its
 * allowance is enough to refuse: the cookie alone resets by clearing it, and
 * the IP alone is shared by everyone behind the same campus or office NAT, so
 * the IP allowance is set higher than the session one.
 *
 * Every route that spends pool quota goes through one of these checks. A user
 * on their own key is spending their own quota and is not limited here at all.
 * That asymmetry is the point: the limit is an argument for BYOK, not a paywall.
 */

/** Plans one session may start per rolling day on the shared pool. */
const POOL_PLANS_PER_SESSION = 3;
const POOL_PLANS_PER_IP = 6;

/** Questionnaire requests per rolling day — stage 1 runs before a plan exists. */
const POOL_QUESTIONS_PER_SESSION = 8;
const POOL_QUESTIONS_PER_IP = 16;

/**
 * Revision requests per rolling day. Counted in requests, not messages: a
 * revision that adds a feature also pays for filling it in.
 */
const POOL_REVISIONS_PER_SESSION = 20;
const POOL_REVISIONS_PER_IP = 40;

/**
 * Pool requests one plan may spend per rolling day across all its stages,
 * retries included. Three full generations' worth: enough to recover from a
 * few quota errors, not enough to loop a stage all day.
 */
const POOL_REQUESTS_PER_PLAN = 24;

/**
 * Global pool requests per rolling day. Held below the provider's ~500 so a
 * generation already in flight can finish instead of failing at stage four.
 */
const POOL_REQUESTS_PER_DAY = 420;

/** Requests one plan costs end to end, used to reserve headroom. */
const REQUESTS_PER_PLAN = 8;

/** Requests filling in one feature added by a revision costs: expand, specs, tasks. */
export const REQUESTS_PER_EXPANSION = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const since = () => new Date(Date.now() - DAY_MS);

export type LimitVerdict = {
  allowed: boolean;
  /** Units this caller can still spend today. Infinity on BYOK. */
  remaining: number;
  reason?: string;
};

export type PoolUsage = {
  used: number;
  limit: number;
  sessionRemaining: number;
};

const allowed = (remaining: number): LimitVerdict => ({ allowed: true, remaining });
const refused = (reason: string): LimitVerdict => ({ allowed: false, remaining: 0, reason });

const POOL_EXHAUSTED =
  'Kuota AI gratis bersama untuk hari ini sudah habis. Pasang API key kamu sendiri di Pengaturan untuk lanjut sekarang — gratis, tanpa kartu kredit.';

async function globalPoolUsed(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(usageLog)
    .where(and(eq(usageLog.byok, false), gte(usageLog.createdAt, since())));
  return row?.n ?? 0;
}

/** Pool requests matching `filter` in the last rolling day, per session and per IP. */
async function poolRequestsBy(caller: Caller, filter: SQL | undefined) {
  const base = and(eq(usageLog.byok, false), gte(usageLog.createdAt, since()), filter);
  const [[mine], [ip]] = await Promise.all([
    db
      .select({ n: count() })
      .from(usageLog)
      .where(and(base, eq(usageLog.sessionId, caller.sessionId))),
    caller.ipHash
      ? db
          .select({ n: count() })
          .from(usageLog)
          .where(and(base, eq(usageLog.ipHash, caller.ipHash)))
      : Promise.resolve([{ n: 0 }]),
  ]);
  return { session: mine?.n ?? 0, ip: ip?.n ?? 0 };
}

/** Plans started in the last rolling day, per session and per IP. */
async function plansStartedBy(caller: Caller) {
  const [[mine], [ip]] = await Promise.all([
    db
      .select({ n: count() })
      .from(plans)
      .where(and(eq(plans.sessionId, caller.sessionId), gte(plans.createdAt, since()))),
    caller.ipHash
      ? db
          .select({ n: count() })
          .from(plans)
          .where(and(eq(plans.ipHash, caller.ipHash), gte(plans.createdAt, since())))
      : Promise.resolve([{ n: 0 }]),
  ]);
  return { session: mine?.n ?? 0, ip: ip?.n ?? 0 };
}

/** Pool consumption over the last rolling day, for display. */
export async function poolUsage(caller: Caller): Promise<PoolUsage> {
  const [used, started] = await Promise.all([globalPoolUsed(), plansStartedBy(caller)]);
  return {
    used,
    limit: POOL_REQUESTS_PER_DAY,
    sessionRemaining: Math.max(
      0,
      Math.min(POOL_PLANS_PER_SESSION - started.session, POOL_PLANS_PER_IP - started.ip),
    ),
  };
}

/**
 * Whether this caller may start another plan.
 *
 * Checked before creating a plan, not before every stage: stopping someone
 * three stages into a generation would waste the quota already spent on them.
 */
export async function checkPlanLimit(caller: Caller, byok: boolean): Promise<LimitVerdict> {
  if (byok) return allowed(Infinity);

  const [used, started] = await Promise.all([globalPoolUsed(), plansStartedBy(caller)]);
  if (used + REQUESTS_PER_PLAN > POOL_REQUESTS_PER_DAY) return refused(POOL_EXHAUSTED);

  if (started.session >= POOL_PLANS_PER_SESSION) {
    return refused(
      `Kamu sudah membuat ${POOL_PLANS_PER_SESSION} rencana hari ini dengan kuota bersama. Pasang API key kamu sendiri di Pengaturan untuk lanjut tanpa batas ini — gratis.`,
    );
  }
  if (started.ip >= POOL_PLANS_PER_IP) {
    return refused(
      'Jatah rencana gratis untuk jaringan internet ini sudah habis hari ini. Pasang API key kamu sendiri di Pengaturan untuk lanjut — gratis.',
    );
  }

  return allowed(
    Math.min(POOL_PLANS_PER_SESSION - started.session, POOL_PLANS_PER_IP - started.ip),
  );
}

/** Stage 1 runs before a plan row exists, so it needs its own allowance. */
export async function checkQuestionsLimit(caller: Caller, byok: boolean): Promise<LimitVerdict> {
  if (byok) return allowed(Infinity);

  const [used, mine] = await Promise.all([
    globalPoolUsed(),
    poolRequestsBy(caller, eq(usageLog.stage, 'questions')),
  ]);
  if (used + REQUESTS_PER_PLAN > POOL_REQUESTS_PER_DAY) return refused(POOL_EXHAUSTED);

  const remaining = Math.min(
    POOL_QUESTIONS_PER_SESSION - mine.session,
    POOL_QUESTIONS_PER_IP - mine.ip,
  );
  if (remaining <= 0) {
    return refused(
      'Kamu sudah terlalu sering menyiapkan pertanyaan hari ini dengan kuota bersama. Pasang API key kamu sendiri di Pengaturan untuk lanjut — gratis.',
    );
  }
  return allowed(remaining);
}

/**
 * Whether a plan may run another generation stage.
 *
 * The plan was already admitted by `checkPlanLimit`, so there is no headroom
 * reserve here — only a per-plan cap, so a stage that keeps failing cannot be
 * retried into the whole pool.
 */
export async function checkStageLimit(planId: string, byok: boolean): Promise<LimitVerdict> {
  if (byok) return allowed(Infinity);

  const [[row], used] = await Promise.all([
    db
      .select({ n: count() })
      .from(usageLog)
      .where(
        and(
          eq(usageLog.planId, planId),
          eq(usageLog.byok, false),
          gte(usageLog.createdAt, since()),
        ),
      ),
    globalPoolUsed(),
  ]);
  if (used >= POOL_REQUESTS_PER_DAY) return refused(POOL_EXHAUSTED);

  const remaining = POOL_REQUESTS_PER_PLAN - (row?.n ?? 0);
  if (remaining <= 0) {
    return refused(
      'Rencana ini sudah terlalu sering diulang hari ini dengan kuota bersama. Coba lagi besok, atau pasang API key kamu sendiri di Pengaturan — gratis.',
    );
  }
  return allowed(remaining);
}

/**
 * Guard for the revision chat. `remaining` is in requests, so the caller can
 * decide how many added features it can afford to fill in.
 */
export async function checkRevisionLimit(caller: Caller, byok: boolean): Promise<LimitVerdict> {
  if (byok) return allowed(Infinity);

  const [used, mine] = await Promise.all([
    globalPoolUsed(),
    poolRequestsBy(caller, sql`${usageLog.stage} like 'revise%'`),
  ]);
  if (used >= POOL_REQUESTS_PER_DAY) return refused(POOL_EXHAUSTED);

  const remaining = Math.min(
    POOL_REVISIONS_PER_SESSION - mine.session,
    POOL_REVISIONS_PER_IP - mine.ip,
    POOL_REQUESTS_PER_DAY - used,
  );
  if (remaining <= 0) {
    return refused(
      'Kamu sudah memakai jatah revisi hari ini dengan kuota bersama. Pasang API key kamu sendiri di Pengaturan untuk lanjut — gratis.',
    );
  }
  return allowed(remaining);
}
