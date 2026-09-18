import { NextResponse } from 'next/server';
import { issueToken, revokeToken, tokenStatus } from '@/lib/agent-token';
import { bad } from '@/lib/api';
import { getSessionId, peekSessionId } from '@/lib/session';

/**
 * The token an agent uses to reach this session over MCP.
 *
 * GET never returns the token — only whether one exists and its last four
 * characters. The raw value is returned exactly once, by POST, because it is
 * not stored in a form anyone can read back.
 */
export async function GET() {
  const sessionId = await peekSessionId();
  return NextResponse.json(sessionId ? await tokenStatus(sessionId) : null);
}

export async function POST() {
  const sessionId = await getSessionId();
  const token = await issueToken(sessionId);
  // Shown once. Reissuing replaces the old token, which is also how someone
  // revokes one they pasted somewhere they regret.
  return NextResponse.json({ token, status: await tokenStatus(sessionId) });
}

export async function DELETE() {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);
  await revokeToken(sessionId);
  return NextResponse.json({ ok: true });
}
