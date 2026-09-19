import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FeatureHeader, PrdSection } from '@/components/PlanParts';
import { PromptBlock } from '@/components/PromptBlock';
import type { Prd } from '@/lib/ai/schemas';
import { loadPublicPlan } from '@/lib/publish';

/**
 * A published plan, readable by anyone.
 *
 * Server-rendered with no client JavaScript except the copy button, because
 * this page exists to be read by people who did not make it — and by search
 * engines. It shows the plan and nothing about its author: no idea text, no
 * interview answers, no revision history.
 */

export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicPlan(slug);
  if (!data?.plan.prd) return { title: 'Rencana tidak ditemukan — Preflight' };

  const prd = data.plan.prd as Prd;
  const description = `${prd.oneLiner} — PRD, ${data.features.length} fitur, dan ${data.tasks.length} task siap dikerjakan AI coding agent.`;

  return {
    title: `${prd.title} — rencana lengkap`,
    description,
    openGraph: {
      title: `${prd.title} — rencana lengkap`,
      description,
      type: 'article',
      locale: 'id_ID',
    },
    twitter: { card: 'summary_large_image', title: prd.title, description },
    alternates: { canonical: `/p/${slug}` },
  };
}

export default async function PublicPlanPage({ params }: Params) {
  const { slug } = await params;
  const data = await loadPublicPlan(slug);
  if (!data?.plan.prd) notFound();

  const { plan, features, subfeatures, tasks } = data;
  const prd = plan.prd as Prd;

  // Structured data: this is a technical document, and search engines should
  // be able to tell what it is rather than guessing from the markup.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `${prd.title} — rencana lengkap`,
    description: prd.oneLiner,
    datePublished: plan.publishedAt?.toISOString(),
    inLanguage: plan.language === 'id' ? 'id-ID' : 'en',
    articleSection: 'Product planning',
  };

  return (
    <div className="mx-auto w-full max-w-[46rem] px-6 py-10 sm:py-14">
      <script
        type="application/ld+json"
        // The title and one-liner are model output steered by user input, so
        // they can contain `</script>`. JSON.stringify does not escape `<`;
        // left as is, a published plan would run script for every visitor.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <Link href="/" className="tap text-[15px] font-semibold tracking-tight text-ink hover:text-signal">
          preflight
        </Link>
        <span className="text-[13.5px] text-faint">Rencana yang dibagikan</span>
      </header>

      <PrdSection prd={prd} animate={false} />

      {features.length > 0 && (
        <section className="mt-16 border-t border-rule pt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">Rencana kerja</h2>
            <p className="text-[13.5px] tabular-nums text-faint">
              {features.length} fitur · {tasks.length} task
            </p>
          </div>

          <div className="mt-10 space-y-14">
            {features.map((f) => {
              const own = tasks.filter((t) => t.featureId === f.id);
              return (
                <section key={f.id}>
                  <FeatureHeader
                    feature={f}
                    subfeatures={subfeatures.filter((s) => s.featureId === f.id)}
                  />

                  <div className="mt-7">
                    {own.length === 0 ? (
                      <p className="text-[14.5px] text-faint">Belum ada task.</p>
                    ) : (
                      <ol className="space-y-8">
                        {own.map((t, i) => (
                          <li key={t.id}>
                            <div className="flex items-baseline gap-2.5">
                              <span className="font-mono text-[12px] tabular-nums text-faint">
                                {i + 1}
                              </span>
                              <h4 className="text-[16px] font-medium leading-snug text-ink">
                                {t.title}
                              </h4>
                            </div>
                            <p className="mt-1 max-w-[64ch] text-[14.5px] leading-relaxed text-muted sm:pl-[1.9rem]">
                              {t.description}
                            </p>
                            {/* Indented under the title from `sm` up; full width on a phone. */}
                            <div className="sm:pl-[1.9rem]">
                              <PromptBlock text={t.agentPrompt} />
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-20 border-t border-rule pt-8">
        <h2 className="text-[19px] font-semibold tracking-tight text-ink">
          Punya ide yang mau dibangun?
        </h2>
        <p className="mt-2 max-w-[58ch] text-[15.5px] leading-relaxed text-muted">
          Rencana ini dibuat dengan Preflight — tulis idemu, jawab lima pertanyaan, dan dapat
          PRD, fitur, serta task yang tiap satunya sudah berisi prompt siap tempel ke AI coding
          agent. Gratis, tanpa daftar akun.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-[3px] bg-ink px-5 py-2.5 text-[15px] font-medium text-paper transition-opacity hover:opacity-90"
        >
          Bikin rencana kamu sendiri
        </Link>
      </section>
    </div>
  );
}
