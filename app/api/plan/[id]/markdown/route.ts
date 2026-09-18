import { bad } from '@/lib/api';
import { renderPlan } from '@/lib/ai/render';
import type { FeatureSet, Prd, SpecBatch, TaskBatch } from '@/lib/ai/schemas';
import { loadPlan } from '@/lib/plans';
import { peekSessionId } from '@/lib/session';

/** The whole plan as one Markdown file, for pasting into a repo or an agent. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) return bad('Sesi tidak ditemukan.', 404);

  const { id } = await ctx.params;
  const loaded = await loadPlan(id, sessionId);
  if (!loaded?.plan.prd) return bad('Plan belum siap.', 404);

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
    specs: loaded.features.filter((f) => f.spec).map((f) => f.spec as SpecBatch['specs'][number]),
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

  const markdown = renderPlan(loaded.plan.prd as Prd, featureSet, specs, taskBatch);
  const slug = (loaded.plan.title ?? 'preflight').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-plan.md"`,
    },
  });
}
