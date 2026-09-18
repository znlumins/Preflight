import { NextResponse } from 'next/server';
import { bad, errorMessage, pipelineFor, withUsage } from '@/lib/api';
import { getSessionId } from '@/lib/session';

export const maxDuration = 60;

/** Stage 1. Runs before a plan row exists, so usage is logged without a planId. */
export async function POST(req: Request) {
  const sessionId = await getSessionId();
  const { idea, context, language = 'id' } = await req.json();

  if (typeof idea !== 'string' || idea.trim().length < 15) {
    return bad('Ceritakan idenya sedikit lebih panjang — minimal satu kalimat utuh.');
  }

  const { pipeline, byok } = await pipelineFor(sessionId);
  try {
    const questionnaire = await withUsage(pipeline, sessionId, null, byok, () =>
      pipeline.questions({ idea: idea.trim(), context, language }),
    );
    return NextResponse.json(questionnaire);
  } catch (err) {
    return bad(errorMessage(err, byok), 502);
  }
}
