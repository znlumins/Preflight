import { saveSpecs } from '@/lib/plans';
import { runStage } from '@/lib/stages';

export const maxDuration = 60;

/** Stage 3b. The four-section spec per feature, batched. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return runStage('specs', ctx, async ({ pipeline, planId, prd, featureSet, language }) => {
    const batch = await pipeline.specs(prd, featureSet, language);
    await saveSpecs(planId, batch);
    return batch;
  });
}
