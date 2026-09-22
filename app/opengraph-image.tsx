import { ImageResponse } from 'next/og';

/**
 * The card a shared link shows before anyone clicks it.
 *
 * Same palette as the site — warm paper, ink, the teal signal — because the
 * card is the first frame of the site, not a banner for it. Next.js injects
 * this on every route that does not ship its own card, so a bare link to any
 * page gets a face in chat apps and timelines.
 */

export const alt = 'Preflight — ubah ide jadi rencana siap kerjakan AI coding agent';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The site fonts are licensed subsets served by next/font; the card renderer
// cannot reach them, so the card is set in the same family every OS already
// has — the intent is the weight and the spacing, not the exact glyph.
const ink = '#1b2a33';
const muted = '#5e7180';
const paper = '#fdfcfa';
const rule = '#e3e7e5';
const signal = '#0e7c86';

export default function OpengraphImage() {
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
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: signal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* The mark from app/icon.svg: a checkmark, pre-flight complete. */}
            <svg width="36" height="36" viewBox="0 0 32 32">
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
          <div style={{ fontSize: 40, fontWeight: 600, color: ink, letterSpacing: '-0.02em' }}>
            preflight
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              color: ink,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            Rencana sebelum ngoding.
          </div>
          <div style={{ marginTop: 24, fontSize: 40, color: muted, lineHeight: 1.35 }}>
            Ide jadi PRD, daftar fitur, dan task — tiap task sudah berisi prompt
            siap tempel ke AI coding agent.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', color: muted, fontSize: 30 }}>
            preflight.luminszn.my.id
          </div>
          <div style={{ display: 'flex', color: signal, fontSize: 30, fontWeight: 600 }}>
            gratis, tanpa akun
          </div>
        </div>
        {/* Hairline the card sits on, like the rules that structure the site. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 8,
            background: rule,
            display: 'flex',
          }}
        />
      </div>
    ),
    size
  );
}
