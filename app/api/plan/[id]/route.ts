import { NextResponse } from 'next/server';
import { bad } from '@/lib/api';
import { loadPlan } from '@/lib/plans';
import { peekSessionId } from '@/lib/session';

/** Full plan state. The client polls this to resume an interrupted generation. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id } = await ctx.params;
  const plan = await loadPlan(id, sessionId);
  if (!plan) return bad('Plan tidak ditemukan.', 404);

  return NextResponse.json(plan);
}
