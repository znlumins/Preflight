import { NextResponse } from 'next/server';
import { bad } from '@/lib/api';
import { loadPlan, setTaskDone } from '@/lib/plans';
import { peekSessionId } from '@/lib/session';

/** Toggles a task's done flag. User-owned state, not model-owned. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id: planId } = await ctx.params;
  if (!(await loadPlan(planId, sessionId))) return bad('Plan tidak ditemukan.', 404);

  const { taskId, done } = await req.json();
  if (typeof taskId !== 'string' || typeof done !== 'boolean') return bad('Payload tidak valid.');

  await setTaskDone(planId, taskId, done);
  return NextResponse.json({ ok: true });
}
