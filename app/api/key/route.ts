import { NextResponse } from 'next/server';
import { bad, readBody } from '@/lib/api';
import { keyBody } from '@/lib/input';
import { deleteKey, keyStatus, saveKey, verifyKey } from '@/lib/keys';
import { getSessionId, peekSessionId } from '@/lib/session';

/**
 * The user's own API key.
 *
 * GET never returns the key — only the provider and its last four characters,
 * which is enough for someone to recognise which key is saved and not enough
 * for anything else.
 */
export async function GET() {
  const sessionId = await peekSessionId();
  return NextResponse.json(sessionId ? await keyStatus(sessionId) : null);
}

export async function PUT(req: Request) {
  const body = await readBody(req, keyBody);
  if (body.error) return body.error;
  const { provider, apiKey } = body.data;
  const sessionId = await getSessionId();

  // Check against the provider before storing, so a typo fails here rather than
  // halfway through someone's first generation.
  const problem = await verifyKey(provider, apiKey);
  if (problem) return bad(problem);

  await saveKey(sessionId, provider, apiKey);
  return NextResponse.json(await keyStatus(sessionId));
}

export async function DELETE() {
  const sessionId = await peekSessionId();
  if (sessionId) await deleteKey(sessionId);
  return NextResponse.json({ ok: true });
}
