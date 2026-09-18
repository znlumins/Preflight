import { NextResponse } from 'next/server';
import { bad, errorMessage, pipelineFor, withUsage } from '@/lib/api';
import type { FeatureSet, Prd, TaskBatch } from '@/lib/ai/schemas';
import { checkRevisionLimit } from '@/lib/limits';
import { loadPlan } from '@/lib/plans';
import { applyRevision, expandAddedFeature } from '@/lib/revise';
import { peekSessionId } from '@/lib/session';

export const maxDuration = 60;

/**
 * Stage 5. One message in, a diff out, applied to the plan.
 *
 * Costs a single model call because the model is sent a compact index of the
 * plan and asked for operations, not a rewrite — which is also why a revision
 * cannot silently lose the parts of the plan it was not asked about.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id: planId } = await ctx.params;
  const loaded = await loadPlan(planId, sessionId);
  if (!loaded) return bad('Plan tidak ditemukan.', 404);
  if (loaded.plan.status !== 'done') return bad('Tunggu rencananya selesai dulu.', 409);

  const { message } = await req.json();
  if (typeof message !== 'string' || message.trim().length < 3) {
    return bad('Tulis dulu perubahan yang kamu mau.');
  }

  const { pipeline, byok } = await pipelineFor(sessionId);

  const limit = await checkRevisionLimit(sessionId, byok);
  if (!limit.allowed) return bad(limit.reason!, 429);

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
  const taskBatch: TaskBatch = {
    tasks: loaded.tasks.map((t) => ({
      id: t.id,
      featureId: t.featureId,
      subfeatureId: t.subfeatureId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      dependsOn: t.dependsOn,
      agentPrompt: t.agentPrompt,
    })),
  };

  try {
    const revision = await withUsage(pipeline, sessionId, planId, byok, () =>
      pipeline.revise(message.trim(), featureSet, taskBatch, loaded.plan.language),
    );

    const { applied, skipped, revisionId } = await applyRevision(
      planId,
      sessionId,
      message.trim(),
      revision,
    );

    // A feature added by a revision arrives with nothing under it, and a
    // heading with no tasks is a dead end in a product whose whole output is
    // tasks. Fill it in immediately — one extra call, only when it happened.
    const added = applied.filter((o) => o.op === 'add_feature');
    for (const op of added) {
      const feature = revision.ops.find((o) => o.targetId === op.targetId);
      if (!feature) continue;
      const shape = {
        id: op.targetId,
        name: feature.name || op.targetId,
        benefit: feature.detail || '',
        priority: 'P1' as const,
      };

      try {
        await withUsage(pipeline, sessionId, planId, byok, async () => {
          const prd = loaded.plan.prd as Prd;
          const expansion = await pipeline.expandFeature(prd, shape, loaded.plan.language);
          const set = { features: [{ ...shape, subfeatures: expansion.subfeatures }] };

          // The full sequence, not a shortcut. Skipping the spec stage here
          // produced stub prompts: acceptance criteria, data and edge cases are
          // what give the task stage something concrete to write against.
          const specs = await pipeline.specs(prd, set, loaded.plan.language);
          const batch = await pipeline.tasks(prd, set, specs, loaded.plan.language);

          await expandAddedFeature(planId, op.targetId, expansion, batch, specs);
        });
      } catch {
        // The feature is already saved; leaving it thin beats losing the edit.
      }
    }

    const plan = await loadPlan(planId, sessionId);

    return NextResponse.json({
      reply: revision.reply,
      revisionId,
      // The ops themselves, not just a count: 'satu perubahan diterapkan' does
      // not tell anyone whether the right thing changed.
      ops: applied,
      applied: applied.length,
      // Surfaced rather than hidden: a model that names an id which does not
      // exist produced nothing, and the user should be told so.
      skipped: skipped.length,
      plan,
    });
  } catch (err) {
    return bad(errorMessage(err, byok), 502);
  }
}
