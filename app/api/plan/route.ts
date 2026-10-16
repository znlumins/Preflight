import { NextResponse } from 'next/server';
import { listPlans } from '@/lib/plans';
import { peekSessionId } from '@/lib/session';

export async function GET() {
  const sessionId = await peekSessionId();
  if (!sessionId) return NextResponse.json([]);
  const rows = await listPlans(sessionId);
  return NextResponse.json(rows);
}
