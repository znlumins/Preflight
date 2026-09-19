import { NextResponse } from 'next/server';
import { bad, errorMessage, pipelineFor, readBody, withUsage } from '@/lib/api';
import { createBody } from '@/lib/input';
import { createPlan, markError, savePrd } from '@/lib/plans';
import { checkPlanLimit } from '@/lib/limits';
import { getCaller } from '@/lib/session';

export const maxDuration = 60;

/**
 * Stage 2. Creates the plan row, then generates the PRD.
 *
 * The row is committed before the model call so a failure leaves something the
 * user can retry against, rather than losing their idea and answers.
 */
export async function POST(req: Request) {
  const body = await readBody(req, createBody);
  if (body.error) return body.error;
  const { idea, context, language, questions, answers } = body.data;

  const caller = await getCaller();
  const { pipeline, byok } = await pipelineFor(caller.sessionId);

  // Checked before the row is created: refusing here costs nothing, while
  // stopping someone three stages in would waste the quota already spent.
  const limit = await checkPlanLimit(caller, byok);
  if (!limit.allowed) return bad(limit.reason!, 429);

  const planId = await createPlan({ ...caller, idea, context, language, questions, answers });

  try {
    const prd = await withUsage(pipeline, { ...caller, planId, byok }, () =>
      pipeline.prd({ idea, context, language, answers }),
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
