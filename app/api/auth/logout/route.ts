import { NextResponse } from 'next/server';
import { destroyAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  await destroyAuthSession();
  return NextResponse.json({ ok: true });
}
