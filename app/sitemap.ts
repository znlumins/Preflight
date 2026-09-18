import type { MetadataRoute } from 'next';
import { listChapters } from '@/lib/docs';
import { listPublicPlans } from '@/lib/publish';

export const revalidate = 3600;

/** Only published plans. Private ones are never named here. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const published = await listPublicPlans(1000);

  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/rencana`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/docs`, changeFrequency: 'monthly', priority: 0.7 },
    ...listChapters().map((c) => ({
      url: `${base}/docs/${c.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...published
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${base}/p/${p.slug}`,
        lastModified: p.publishedAt ?? undefined,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
  ];
}
