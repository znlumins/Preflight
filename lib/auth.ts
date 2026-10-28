import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { db } from './db';
import { plans, users, userSessions } from './db/schema';

export const AUTH_COOKIE = 'preflight_auth_token';
const THIRTY_DAYS = 30 * 24 * 60 * 60; // in seconds

export type AuthUser = {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

/** Reads the current session token from the auth cookie. */
export async function getAuthToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value;
}

/** Returns the authenticated user or null if unauthenticated. */
export async function getAuthUser(): Promise<AuthUser | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const now = new Date();
  const [row] = await db
    .select({
      id: users.id,
      googleId: users.googleId,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      expiresAt: userSessions.expiresAt,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(and(eq(userSessions.id, token), gt(userSessions.expiresAt, now)))
    .limit(1);

  if (!row) {
    // Expired or invalid token — cleanup
    try {
      await db.delete(userSessions).where(eq(userSessions.id, token));
      const jar = await cookies();
      jar.delete(AUTH_COOKIE);
    } catch {}
    return null;
  }

  return {
    id: row.id,
    googleId: row.googleId,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
  };
}

/** Creates a new session in the database and sets the session cookie. */
export async function createAuthSession(userId: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS * 1000);

  await db.insert(userSessions).values({
    id: token,
    userId,
    expiresAt,
  });

  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS,
  });

  return token;
}

/** Deletes the session from the database and removes the auth cookie. */
export async function destroyAuthSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (token) {
    try {
      await db.delete(userSessions).where(eq(userSessions.id, token));
    } catch {}
    jar.delete(AUTH_COOKIE);
  }
}

/** Upserts a Google user based on their Google profile ID or email. */
export async function upsertGoogleUser(data: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<AuthUser> {
  // Check by googleId first, then by email
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.googleId, data.googleId))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        name: data.name,
        avatarUrl: data.avatarUrl ?? existing.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));

    return {
      id: existing.id,
      googleId: existing.googleId,
      email: existing.email,
      name: data.name,
      avatarUrl: data.avatarUrl ?? existing.avatarUrl,
    };
  }

  // Check if an account already exists with the same email
  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (byEmail) {
    await db
      .update(users)
      .set({
        googleId: data.googleId,
        name: data.name,
        avatarUrl: data.avatarUrl ?? byEmail.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, byEmail.id));

    return {
      id: byEmail.id,
      googleId: data.googleId,
      email: byEmail.email,
      name: data.name,
      avatarUrl: data.avatarUrl ?? byEmail.avatarUrl,
    };
  }

  // Create new user
  const id = nanoid(21);
  await db.insert(users).values({
    id,
    googleId: data.googleId,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatarUrl ?? null,
  });

  return {
    id,
    googleId: data.googleId,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatarUrl ?? null,
  };
}

/** Tautkan seluruh rencana anonim milik cookie session ini ke akun user yang baru login. */
export async function linkAnonymousPlansToUser(sessionId: string, userId: string): Promise<void> {
  if (!sessionId || !userId) return;
  await db
    .update(plans)
    .set({
      userId,
      updatedAt: new Date(),
    })
    .where(and(eq(plans.sessionId, sessionId), isNull(plans.userId)));
}

/** Menentukan origin (localhost atau domain produksi) secara dinamis dari request headers. */
export function getAuthOrigin(request: Request): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto =
    request.headers.get('x-forwarded-proto') || (host && !host.includes('localhost') ? 'https' : 'http');
  if (host) {
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin;
}
