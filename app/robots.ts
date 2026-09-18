import type { MetadataRoute } from 'next';

/**
 * Private surfaces are disallowed explicitly.
 *
 * They are already unreachable without the owner's cookie, but a crawler should
 * not be following those URLs at all — and `/api` has no business being indexed.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/plans/', '/pengaturan'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
