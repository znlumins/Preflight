import { bad } from '@/lib/api';
import { renderPlan } from '@/lib/ai/render';
import type { FeatureSet, Prd, SpecBatch, TaskBatch } from '@/lib/ai/schemas';
import { loadPublicPlan } from '@/lib/publish';

/**
 * The Markdown of a published plan, for anyone who arrived from a shared link.
 *
 * The owner already has "Unduh semuanya sebagai Markdown" on their private
 * page; this is the same file for the reader — an agent or a teammate who got
 * the URL and wants the plan in their repo, not in a browser tab. It serves
 * exactly what the public page shows: no idea text, no interview answers, no
 * revision history.
 *
 * Cached like the page itself (`revalidate = 300`), since the content is the
 * same for every visitor and the plan can only change by being unpublished.
 */
export const revalidate = 300;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const data = await loadPublicPlan(slug);
  if (!data?.plan.prd) return bad('Rencana tidak ditemukan.', 404);

  const prd = data.plan.prd as Prd;

  const featureSet: FeatureSet = {
    features: data.features.map((f) => ({
      id: f.id,
      name: f.name,
      benefit: f.benefit,
      priority: f.priority,
      subfeatures: data.subfeatures
        .filter((s) => s.featureId === f.id)
        .map((s) => ({ id: s.id, name: s.name, summary: s.summary })),
    })),
  };
  const specs: SpecBatch = {
    specs: data.features
      .filter((f) => f.spec)
      .map((f) => f.spec as SpecBatch['specs'][number]),
  };
  const taskBatch: TaskBatch = {
    tasks: data.tasks.map((t) => ({
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

  const markdown = renderPlan(prd, featureSet, specs, taskBatch);
  const base = (data.plan.title ?? 'preflight')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${base || 'rencana'}-${slug}.md"`,
    },
  });
}
