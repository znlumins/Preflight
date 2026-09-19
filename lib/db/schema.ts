import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * Plan storage.
 *
 * Every stage writes its own rows as soon as it finishes, so a reload during a
 * 60-second generation shows the work done so far instead of an empty page.
 * That is also why `status` lives on the plan: the client resumes from whatever
 * stage the row says was reached.
 */

const now = sql`now()`;

export const plans = pgTable(
  'plans',
  {
    id: text('id').primaryKey(),
    /** Anonymous cookie session. No accounts in v1. */
    sessionId: text('session_id').notNull(),
    /** Salted IP hash, so clearing the cookie does not reset the pool allowance. */
    ipHash: text('ip_hash'),

    idea: text('idea').notNull(),
    context: text('context'),
    language: text('language', { enum: ['id', 'en'] })
      .notNull()
      .default('id'),

    /** How far generation got. The client drives the next stage from this. */
    status: text('status', {
      enum: ['draft', 'prd', 'features', 'specs', 'done', 'error'],
    })
      .notNull()
      .default('draft'),
    error: text('error'),

    title: text('title'),
    /** Questionnaire and PRD kept as JSON: read whole, never queried by field. */
    questions: jsonb('questions'),
    answers: jsonb('answers'),
    prd: jsonb('prd'),

    /**
     * Public sharing.
     *
     * Null until the owner explicitly publishes. A plan holds someone's product
     * idea, so this is opt-in, reversible, and never a side effect of anything
     * else — unpublishing clears the slug, which makes the old URL a 404 rather
     * than leaving a quietly reachable copy behind.
     */
    publicSlug: text('public_slug').unique(),
    publishedAt: timestamp('published_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index('plans_session_idx').on(t.sessionId, t.createdAt),
    index('plans_ip_idx').on(t.ipHash, t.createdAt),
  ],
);

export const features = pgTable(
  'features',
  {
    /** Model-authored kebab-case id, unique within a plan. */
    id: text('id').notNull(),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    benefit: text('benefit').notNull(),
    priority: text('priority', { enum: ['P0', 'P1', 'P2'] }).notNull(),
    position: integer('position').notNull(),

    /** The 4-section spec, attached once stage 3b completes. */
    spec: jsonb('spec'),
  },
  (t) => [index('features_plan_idx').on(t.planId, t.position)],
);

export const subfeatures = pgTable(
  'subfeatures',
  {
    id: text('id').notNull(),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    featureId: text('feature_id').notNull(),

    name: text('name').notNull(),
    summary: text('summary').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [index('subfeatures_plan_idx').on(t.planId, t.featureId, t.position)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: text('id').notNull(),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    featureId: text('feature_id').notNull(),
    subfeatureId: text('subfeature_id').notNull(),

    title: text('title').notNull(),
    description: text('description').notNull(),
    priority: text('priority', { enum: ['P0', 'P1', 'P2'] }).notNull(),
    dependsOn: jsonb('depends_on').$type<string[]>().notNull(),
    /** The deliverable: paste-ready instruction for a coding agent. */
    agentPrompt: text('agent_prompt').notNull(),

    /** User-owned, not model-owned. Survives regeneration of everything else. */
    done: boolean('done').notNull().default(false),
    position: integer('position').notNull(),
  },
  (t) => [index('tasks_plan_idx').on(t.planId, t.position)],
);

/**
 * Bring-your-own-key.
 *
 * One free key is shared by everyone, which caps the whole product at ~71 plans
 * a day. A user's own key moves that ceiling onto their own quota, so this is
 * what makes "free" scale rather than just "free until lunchtime".
 *
 * Keys are stored encrypted (see `lib/crypto.ts`) and never sent back to the
 * browser — only the last four characters, so a person can tell which key is
 * saved without the value being recoverable from the page.
 */
export const apiKeys = pgTable('api_keys', {
  sessionId: text('session_id').primaryKey(),
  provider: text('provider', { enum: ['google', 'groq'] }).notNull(),
  /** AES-256-GCM, base64, with iv and auth tag packed in. */
  ciphertext: text('ciphertext').notNull(),
  hint: text('hint').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});

/**
 * Tokens that let a coding agent reach this session over MCP.
 *
 * Only the SHA-256 of the token is stored, so a database dump does not hand
 * anyone access — the raw value is shown once, when it is issued, and never
 * again. Revoking sets `revokedAt` rather than deleting, which keeps the last
 * use visible after the fact.
 */
export const mcpTokens = pgTable(
  'mcp_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    sessionId: text('session_id').notNull(),
    /** Last four characters, so a person can tell which token is which. */
    hint: text('hint').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('mcp_tokens_session_idx').on(t.sessionId)],
);

/**
 * Per-call metering, mirroring `lib/ai/meter.ts`.
 *
 * Free quota is the scarce resource, so usage is recorded per plan from the
 * start rather than bolted on once it starts hurting.
 */
export const usageLog = pgTable(
  'usage_log',
  {
    id: serial('id').primaryKey(),
    planId: text('plan_id'),
    sessionId: text('session_id').notNull(),
    ipHash: text('ip_hash'),

    stage: text('stage').notNull(),
    model: text('model').notNull(),
    tier: text('tier', { enum: ['fast', 'deep'] }).notNull(),
    /** Whose quota paid for this call. Pool usage is the number to watch. */
    byok: boolean('byok').notNull().default(false),
    ms: integer('ms').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    ok: boolean('ok').notNull(),
    error: text('error'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index('usage_session_idx').on(t.sessionId, t.createdAt),
    index('usage_ip_idx').on(t.ipHash, t.createdAt),
    index('usage_plan_idx').on(t.planId, t.createdAt),
    index('usage_created_idx').on(t.createdAt),
  ],
);

/**
 * The revision conversation.
 *
 * Kept server side so reloading the plan does not erase what was asked and what
 * changed — a chat that forgets on refresh is a demo, not a feature.
 */
export const revisions = pgTable(
  'revisions',
  {
    id: serial('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),

    message: text('message').notNull(),
    reply: text('reply').notNull(),
    /** What the diff actually changed, so the log explains itself later. */
    ops: jsonb('ops')
      .$type<{ op: string; targetId: string; label: string; reason: string }[]>()
      .notNull(),

    /**
     * The plan as it stood before this revision.
     *
     * Removing a feature takes its subfeatures and tasks with it, which is not
     * something a person should have to accept on a model's judgement with no
     * way back. A whole-plan snapshot is a few kilobytes and makes undo exact
     * rather than a second guess at the inverse operation.
     */
    snapshot: jsonb('snapshot'),
    undoneAt: timestamp('undone_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [index('revisions_plan_idx').on(t.planId, t.createdAt)],
);

export type PlanRow = typeof plans.$inferSelect;
export type FeatureRow = typeof features.$inferSelect;
export type SubfeatureRow = typeof subfeatures.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type RevisionRow = typeof revisions.$inferSelect;
export type McpTokenRow = typeof mcpTokens.$inferSelect;
