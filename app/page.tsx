import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { IdeaFlow } from '@/components/IdeaFlow';
import { AppShell } from '@/components/shell/AppShell';
import { pickExampleIdea } from '@/lib/example-ideas';
import { poolUsage } from '@/lib/limits';
import { keyStatus } from '@/lib/keys';
import { listPlans } from '@/lib/plans';
import { clientIpHash, peekSessionId } from '@/lib/session';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Preflight',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    inLanguage: 'id-ID',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Preflight',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description:
      'Ubah ide jadi PRD, daftar fitur, dan task berurutan — tiap task berisi prompt siap tempel ke AI coding agent. Gratis.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
];

export default async function Home() {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get('preflight_sidebar_open')?.value;
  const initialSidebarOpen = sidebarCookie !== undefined ? sidebarCookie === 'true' : true;

  const sessionId = await peekSessionId();
  const allPlans = sessionId ? await listPlans(sessionId) : [];
  const keys = sessionId ? await keyStatus(sessionId) : {};
  const hasByok = Object.keys(keys).length > 0;
  const usage = sessionId && !hasByok ? await poolUsage({ sessionId, ipHash: await clientIpHash() }) : null;

  return (
    <AppShell
      plans={allPlans}
      savedKeys={keys}
      usage={usage}
      stage="ide"
      initialSidebarOpen={initialSidebarOpen}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <IdeaFlow example={pickExampleIdea()} savedKeys={keys} />
    </AppShell>
  );
}
