import { NextResponse } from 'next/server';
import { Pipeline } from './ai/pipeline';
import type { FeatureSet, Prd, SpecBatch } from './ai/schemas';
import { bad, errorMessage, pipelineFor, withUsage } from './api';
import { loadPlan, markError } from './plans';
import { peekSessionId } from './session';

/**
 * Shared shape of the three post-PRD stage routes.
 *
 * Each rebuilds its inputs from the database rather than trusting the client,
 * so a stage can be re-run after a reload, a crash, or a quota error without
 * the browser having to hold any of the plan in memory.
 */

type Loaded = {
  pipeline: Pipeline;
  sessionId: string;
  planId: string;
  language: 'id' | 'en';
  prd: Prd;
  featureSet: FeatureSet;
  specs: SpecBatch;
};

export async function runStage(
  ctx: { params: Promise<{ id: string }> },
  stage: (loaded: Loaded) => Promise<unknown>,
) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id: planId } = await ctx.params;
  const loaded = await loadPlan(planId, sessionId);
  if (!loaded) return bad('Plan tidak ditemukan.', 404);
  if (!loaded.plan.prd) return bad('PRD belum dibuat.', 409);

  // Rebuild the pipeline's view of the plan from rows.
  const featureSet: FeatureSet = {
    features: loaded.features.map((f) => ({
      id: f.id,
      name: f.name,
      benefit: f.benefit,
      priority: f.priority,
      subfeatures: loaded.subfeatures
        .filter((s) => s.featureId === f.id)
        .map((s) => ({ id: s.id, name: s.name, summary: s.summary })),
    })),
  };
  const specs: SpecBatch = {
    specs: loaded.features
      .filter((f) => f.spec)
      .map((f) => f.spec as SpecBatch['specs'][number]),
  };

  const { pipeline, byok } = await pipelineFor(sessionId);
  try {
    const result = await withUsage(pipeline, sessionId, planId, byok, () =>
      stage({
        pipeline,
        sessionId,
        planId,
        language: loaded.plan.language,
        prd: loaded.plan.prd as Prd,
        featureSet,
        specs,
      }),
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = errorMessage(err, byok);
    await markError(planId, message);
    return bad(message, 502);
  }
}
