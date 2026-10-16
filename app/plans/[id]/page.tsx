import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { PlanDocument } from '@/components/PlanDocument';
import { AppShell } from '@/components/shell/AppShell';
import { keyStatus } from '@/lib/keys';
import { poolUsage } from '@/lib/limits';
import { listPlans, loadPlan } from '@/lib/plans';
import { listRevisions } from '@/lib/revise';
import { clientIpHash, peekSessionId } from '@/lib/session';

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get('preflight_sidebar_open')?.value;
  const initialSidebarOpen = sidebarCookie !== undefined ? sidebarCookie === 'true' : true;

  const sessionId = await peekSessionId();
  if (!sessionId) notFound();

  const { id } = await params;
  const data = await loadPlan(id, sessionId);
  if (!data) notFound();

  const [allPlans, keys, rows] = await Promise.all([
    listPlans(sessionId),
    keyStatus(sessionId),
    listRevisions(id),
  ]);

  const hasByok = Object.keys(keys).length > 0;
  const usage = !hasByok ? await poolUsage({ sessionId, ipHash: await clientIpHash() }) : null;

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
    <AppShell
      plans={allPlans}
      currentPlanId={id}
      savedKeys={keys}
      usage={usage}
      stage={data.plan.status === 'done' ? 'task' : 'prd'}
      initialSidebarOpen={initialSidebarOpen}
    >
      <PlanDocument
        initial={data}
        revisions={history}
        publicSlug={data.plan.publicSlug}
        hideHeader
      />
    </AppShell>
  );
}
