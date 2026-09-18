import { saveFeatures } from '@/lib/plans';
import { runStage } from '@/lib/stages';

export const maxDuration = 60;

/** Stage 3. Feature and subfeature breakdown, with its own repair pass. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return runStage(ctx, async ({ pipeline, planId, prd, language }) => {
    const set = await pipeline.features(prd, language);
    await saveFeatures(planId, set);
    return set;
  });
}
