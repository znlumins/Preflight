import { saveTasks } from '@/lib/plans';
import { runStage } from '@/lib/stages';

export const maxDuration = 120;

/** Stage 4. Tasks with paste-ready agent prompts — the actual deliverable. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return runStage(ctx, async ({ pipeline, planId, prd, featureSet, specs, language }) => {
    const batch = await pipeline.tasks(prd, featureSet, specs, language);
    await saveTasks(planId, batch);
    return batch;
  });
}
