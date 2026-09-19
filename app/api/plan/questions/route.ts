import { NextResponse } from 'next/server';
import { bad, errorMessage, pipelineFor, readBody, withUsage } from '@/lib/api';
import { questionsBody } from '@/lib/input';
import { checkQuestionsLimit } from '@/lib/limits';
import { getCaller } from '@/lib/session';

export const maxDuration = 60;

/** Stage 1. Runs before a plan row exists, so usage is logged without a planId. */
export async function POST(req: Request) {
  const body = await readBody(req, questionsBody);
  if (body.error) return body.error;
  const { idea, context, language } = body.data;

  const caller = await getCaller();
  const { pipeline, byok } = await pipelineFor(caller.sessionId);

  const limit = await checkQuestionsLimit(caller, byok);
  if (!limit.allowed) return bad(limit.reason!, 429);

  try {
    const questionnaire = await withUsage(pipeline, { ...caller, planId: null, byok }, () =>
      pipeline.questions({ idea, context, language }),
    );
    return NextResponse.json(questionnaire);
  } catch (err) {
    return bad(errorMessage(err, byok), 502);
  }
}
