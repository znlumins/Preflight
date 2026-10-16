import { NextResponse } from 'next/server';
import { bad } from '@/lib/api';
import { deletePlan, loadPlan, renamePlan } from '@/lib/plans';
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

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id } = await ctx.params;
  await deletePlan(id, sessionId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id } = await ctx.params;
  try {
    const body = await req.json();
    if (!body?.title) return bad('Judul tidak boleh kosong.');
    await renamePlan(id, sessionId, body.title);
    return NextResponse.json({ ok: true });
  } catch {
    return bad('Payload tidak valid.');
  }
}
