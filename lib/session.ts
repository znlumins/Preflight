import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';

/**
 * Anonymous sessions.
 *
 * No accounts in v1. A plan belongs to a cookie, which is enough to let someone
 * arrive, generate, come back tomorrow, and still find their work — without a
 * signup wall in front of the thing they came to try.
 */

const COOKIE = 'preflight_sid';
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Reads the session id, creating one if this is a first visit. */
export async function getSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;

  const id = nanoid(21);
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  });
  return id;
}

/** Reads the session id without creating one. Use in read-only paths. */
export async function peekSessionId(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}
