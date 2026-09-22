import { ImageResponse } from 'next/og';
import type { Prd } from '@/lib/ai/schemas';
import { loadPublicPlan } from '@/lib/publish';

/**
 * The share card of a published plan: its title and one-liner.
 *
 * A plan link travels through chat apps and timelines — this is what a
 * recipient judges the click on. `twitter: card: summary_large_image` is
 * already declared on the page; this gives that declaration an image to ship.
 */

export const alt = 'Kartu berbagi rencana';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ink = '#1b2a33';
const muted = '#5e7180';
const paper = '#fdfcfa';
const signal = '#0e7c86';

type Params = { params: Promise<{ slug: string }> };

export default async function PlanOpengraphImage({ params }: Params) {
  const { slug } = await params;
  const data = await loadPublicPlan(slug);

  if (!data?.plan.prd) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: paper,
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ fontSize: 48, color: muted, display: 'flex' }}>Rencana tidak ditemukan</div>
        </div>
      ),
      size
    );
  }

  const prd = data.plan.prd as Prd;

  // Model output: a long title is normal, so the type shrinks instead of
  // clipping. The card only needs to survive a squint at a phone screen.
  const titleSize = prd.title.length > 60 ? 56 : prd.title.length > 32 ? 72 : 88;
  const oneLiner =
    prd.oneLiner.length > 120 ? `${prd.oneLiner.slice(0, 117).trimEnd()}…` : prd.oneLiner;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: paper,
          padding: '64px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: signal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 32 32">
              <path
                d="M9 16.5l4.6 4.6L23.2 11.5"
                fill="none"
                stroke={paper}
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: muted, letterSpacing: '-0.01em' }}>
            rencana · preflight
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 700,
              color: ink,
              letterSpacing: '-0.03em',
              lineHeight: 1.12,
            }}
          >
            {prd.title}
          </div>
          <div style={{ marginTop: 20, fontSize: 34, color: muted, lineHeight: 1.4 }}>
            {oneLiner}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: signal, fontSize: 28, fontWeight: 600 }}>
          <div style={{ display: 'flex' }}>
            {data.features.length} fitur · {data.tasks.length} task
          </div>
        </div>
      </div>
    ),
    size
  );
}
