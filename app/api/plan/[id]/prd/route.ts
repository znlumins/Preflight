import { NextResponse } from 'next/server';
import { bad, errorMessage, pipelineFor, withUsage } from '@/lib/api';
import type { Answer } from '@/lib/ai/pipeline';
import { checkStageLimit } from '@/lib/limits';
import { pendingStage } from '@/lib/pending';
import { loadPlan, markError, savePrd } from '@/lib/plans';
import { clientIpHash, peekSessionId } from '@/lib/session';

export const maxDuration = 60;

/**
 * Stage 2, retried.
 *
 * `create` generates the PRD in the same request that makes the plan row, so
 * when that call fails the plan exists with nothing in it. This reruns the PRD
 * from what the row already holds — the idea, context and interview answers —
 * so the user does not have to type any of it again.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id: planId } = await ctx.params;
  const loaded = await loadPlan(planId, sessionId);
  if (!loaded) return bad('Plan tidak ditemukan.', 404);
  if (pendingStage(loaded) !== 'prd') {
    return bad('Tahap ini sudah selesai atau belum waktunya dijalankan.', 409);
  }

  const { plan } = loaded;
  const { pipeline, byok } = await pipelineFor(sessionId);

  const limit = await checkStageLimit(planId, byok);
  if (!limit.allowed) return bad(limit.reason!, 429);

  const ipHash = await clientIpHash();
  try {
    const prd = await withUsage(pipeline, { sessionId, ipHash, planId, byok }, () =>
      pipeline.prd({
        idea: plan.idea,
        context: plan.context ?? undefined,
        language: plan.language,
        answers: (plan.answers as Answer[] | null) ?? undefined,
      }),
    );
    await savePrd(planId, prd);
    return NextResponse.json({ prd });
  } catch (err) {
    const message = errorMessage(err, byok);
    await markError(planId, message);
    return bad(message, 502);
  }
}
