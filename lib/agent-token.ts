import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './db';
import { mcpTokens } from './db/schema';

/**
 * Tokens that let a coding agent reach one session's plans over MCP.
 *
 * Stored as a SHA-256 hash: the raw value is shown once, at issue time, and is
 * not recoverable afterwards. That means a database dump does not hand anyone
 * an agent's worth of access to someone's plans.
 *
 * The token goes in an `Authorization: Bearer` header, never in the URL —
 * URLs end up in server logs, browser history and referrer headers, and a
 * bearer credential has no business in any of those.
 */

const PREFIX = 'pf_';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export type TokenStatus = { hint: string; createdAt: string; lastUsedAt: string | null } | null;

/** Issues a token, replacing any existing one for this session. */
export async function issueToken(sessionId: string): Promise<string> {
  const token = PREFIX + randomBytes(24).toString('base64url');

  // One live token per session: reissuing is also how a person revokes a token
  // they pasted somewhere they regret.
  await db.delete(mcpTokens).where(eq(mcpTokens.sessionId, sessionId));
  await db.insert(mcpTokens).values({
    tokenHash: hash(token),
    sessionId,
    hint: token.slice(-4),
  });

  return token;
}

export async function revokeToken(sessionId: string): Promise<void> {
  await db.delete(mcpTokens).where(eq(mcpTokens.sessionId, sessionId));
}

/** What the browser may know about the token: never the token itself. */
export async function tokenStatus(sessionId: string): Promise<TokenStatus> {
  const [row] = await db
    .select()
    .from(mcpTokens)
    .where(and(eq(mcpTokens.sessionId, sessionId), isNull(mcpTokens.revokedAt)))
    .orderBy(desc(mcpTokens.createdAt))
    .limit(1);

  if (!row) return null;
  return {
    hint: row.hint,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

/**
 * Resolves a bearer token to the session it belongs to.
 *
 * The lookup is by hash, so an attacker who can read the table still cannot
 * present a valid token. The constant-time compare guards the last step
 * against a timing oracle on the stored hash.
 */
export async function sessionForToken(token: string | undefined): Promise<string | null> {
  if (!token || !token.startsWith(PREFIX)) return null;

  const candidate = hash(token);
  const [row] = await db
    .select()
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, candidate), isNull(mcpTokens.revokedAt)))
    .limit(1);

  if (!row) return null;

  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(candidate);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Best-effort: a failed touch must not fail the agent's request.
  void db
    .update(mcpTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(mcpTokens.tokenHash, row.tokenHash))
    .catch(() => {});

  return row.sessionId;
}
