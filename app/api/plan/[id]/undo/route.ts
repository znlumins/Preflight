import { NextResponse } from 'next/server';
import { bad, readBody } from '@/lib/api';
import { undoBody } from '@/lib/input';
import { loadPlan } from '@/lib/plans';
import { undoRevision } from '@/lib/revise';
import { peekSessionId } from '@/lib/session';

/** Rolls back one revision by restoring the snapshot taken before it. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id: planId } = await ctx.params;
  if (!(await loadPlan(planId, sessionId))) return bad('Plan tidak ditemukan.', 404);

  const body = await readBody(req, undoBody);
  if (body.error) return body.error;
  const { revisionId } = body.data;

  const result = await undoRevision(planId, sessionId, revisionId);
  if (!result.ok) return bad(result.reason!, 409);

  return NextResponse.json({ plan: await loadPlan(planId, sessionId) });
}
