import { NextResponse } from 'next/server';
import { bad, errorMessage, pipelineFor, readBody, withUsage } from '@/lib/api';
import type { FeatureSet, Prd, TaskBatch } from '@/lib/ai/schemas';
import { reviseBody } from '@/lib/input';
import { checkRevisionLimit, REQUESTS_PER_EXPANSION } from '@/lib/limits';
import { loadPlan } from '@/lib/plans';
import { applyRevision, expandAddedFeature, setRevisionReply } from '@/lib/revise';
import { clientIpHash, peekSessionId } from '@/lib/session';

export const maxDuration = 60;

/**
 * Added features filled in per message. Each one costs three more requests
 * and most of the 60-second budget, so a message asking for six features gets
 * the first few filled in and the rest saved as headings.
 */
const MAX_EXPANSIONS_POOL = 2;
const MAX_EXPANSIONS_BYOK = 4;

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

  const body = await readBody(req, reviseBody);
  if (body.error) return body.error;
  const { message } = body.data;

  const caller = { sessionId, ipHash: await clientIpHash() };
  const { pipeline, byok } = await pipelineFor(sessionId);

  const limit = await checkRevisionLimit(caller, byok);
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

  // The expansion stages are logged under `revise:` so they count against the
  // revision allowance instead of passing as free plan generation.
  const usage = { ...caller, planId, byok };
  const expansionUsage = { ...usage, stagePrefix: 'revise:' };

  try {
    const revision = await withUsage(pipeline, usage, () =>
      pipeline.revise(message, featureSet, taskBatch, loaded.plan.language),
    );

    const { applied, skipped, revisionId } = await applyRevision(
      planId,
      sessionId,
      message,
      revision,
    );

    // A feature added by a revision arrives with nothing under it, and a
    // heading with no tasks is a dead end in a product whose whole output is
    // tasks. Fill it in immediately — within what this caller can afford.
    const added = applied.filter((o) => o.op === 'add_feature');
    const budget = byok
      ? MAX_EXPANSIONS_BYOK
      : Math.min(MAX_EXPANSIONS_POOL, Math.floor((limit.remaining - 1) / REQUESTS_PER_EXPANSION));
    let unexpanded = Math.max(0, added.length - Math.max(0, budget));

    for (const op of added.slice(0, Math.max(0, budget))) {
      const feature = revision.ops.find((o) => o.targetId === op.targetId);
      if (!feature) continue;
      const shape = {
        id: op.targetId,
        name: feature.name || op.targetId,
        benefit: feature.detail || '',
        priority: 'P1' as const,
      };

      try {
        await withUsage(pipeline, expansionUsage, async () => {
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
        unexpanded++;
      }
    }

    // Said in the reply, and stored with it, so the log explains a feature
    // that has no tasks under it after a reload too.
    let reply = revision.reply;
    if (unexpanded > 0) {
      reply +=
        `\n\n${unexpanded} fitur baru belum dirinci jadi subfitur dan task. ` +
        'Minta task untuk fitur itu di pesan berikutnya, satu fitur per pesan.';
      await setRevisionReply(revisionId, reply);
    }

    const plan = await loadPlan(planId, sessionId);

    return NextResponse.json({
      reply,
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
