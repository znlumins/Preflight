import { notFound } from 'next/navigation';
import { PlanDocument } from '@/components/PlanDocument';
import { loadPlan } from '@/lib/plans';
import { listRevisions } from '@/lib/revise';
import { peekSessionId } from '@/lib/session';

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const sessionId = await peekSessionId();
  if (!sessionId) notFound();

  const { id } = await params;
  const data = await loadPlan(id, sessionId);
  if (!data) notFound();

  const rows = await listRevisions(id);
  // Only the newest live revision can be rolled back; undoing an older one
  // would silently discard everything done after it.
  const newestLive = rows.find((r) => !r.undoneAt)?.id;
  const history = rows.map((r) => ({
    id: r.id,
    message: r.message,
    reply: r.reply,
    ops: r.ops,
    applied: r.ops.length,
    skipped: 0,
    undone: !!r.undoneAt,
    canUndo: r.id === newestLive && !!r.snapshot,
  }));

  return (
    <PlanDocument initial={data} revisions={history} publicSlug={data.plan.publicSlug} />
  );
}
