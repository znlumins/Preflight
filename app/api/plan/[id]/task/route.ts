import { NextResponse } from 'next/server';
import { bad, readBody } from '@/lib/api';
import { taskBody } from '@/lib/input';
import { loadPlan, setTaskDone } from '@/lib/plans';
import { peekSessionId } from '@/lib/session';

/** Toggles a task's done flag. User-owned state, not model-owned. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id: planId } = await ctx.params;
  if (!(await loadPlan(planId, sessionId))) return bad('Plan tidak ditemukan.', 404);

  const body = await readBody(req, taskBody);
  if (body.error) return body.error;
  const { taskId, done } = body.data;

  if (!(await setTaskDone(planId, taskId, done))) return bad('Task tidak ditemukan.', 404);
  return NextResponse.json({ ok: true });
}
