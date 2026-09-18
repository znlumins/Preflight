import { NextResponse } from 'next/server';
import { bad, errorMessage, pipelineFor, withUsage } from '@/lib/api';
import { createPlan, markError, savePrd } from '@/lib/plans';
import { checkPlanLimit } from '@/lib/limits';
import { getSessionId } from '@/lib/session';

export const maxDuration = 60;

/**
 * Stage 2. Creates the plan row, then generates the PRD.
 *
 * The row is committed before the model call so a failure leaves something the
 * user can retry against, rather than losing their idea and answers.
 */
export async function POST(req: Request) {
  const sessionId = await getSessionId();
  const { idea, context, language = 'id', questions, answers } = await req.json();

  if (typeof idea !== 'string' || idea.trim().length < 15) {
    return bad('Ceritakan idenya sedikit lebih panjang — minimal satu kalimat utuh.');
  }

  const { pipeline, byok } = await pipelineFor(sessionId);

  // Checked before the row is created: refusing here costs nothing, while
  // stopping someone three stages in would waste the quota already spent.
  const limit = await checkPlanLimit(sessionId, byok);
  if (!limit.allowed) return bad(limit.reason!, 429);

  const planId = await createPlan({
    sessionId,
    idea: idea.trim(),
    context,
    language,
    questions,
    answers,
  });

  try {
    const prd = await withUsage(pipeline, sessionId, planId, byok, () =>
      pipeline.prd({ idea: idea.trim(), context, language, answers }),
    );
    await savePrd(planId, prd);
    return NextResponse.json({ planId, prd });
  } catch (err) {
    const message = errorMessage(err, byok);
    await markError(planId, message);
    // 200 with the id on purpose: the plan exists and is resumable, so the
    // client should navigate to it and show the error there.
    return NextResponse.json({ planId, error: message }, { status: 200 });
  }
}
