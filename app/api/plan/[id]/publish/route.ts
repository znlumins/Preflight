import { NextResponse } from 'next/server';
import { bad } from '@/lib/api';
import { publishPlan, unpublishPlan } from '@/lib/publish';
import { peekSessionId } from '@/lib/session';

/** Publishes a finished plan to a public URL. Owner only, opt-in, reversible. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id } = await ctx.params;
  const result = await publishPlan(id, sessionId);
  if (!result) return bad('Rencana belum selesai atau tidak ditemukan.', 409);

  return NextResponse.json(result);
}

/** Takes it down. The slug is cleared, so the old link 404s rather than lingering. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id } = await ctx.params;
  await unpublishPlan(id, sessionId);
  return NextResponse.json({ ok: true });
}
