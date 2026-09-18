import type { Metadata } from 'next';
import Link from 'next/link';
import { listChapters } from '@/lib/docs';

export const metadata: Metadata = {
  title: 'Manual Preflight',
  description:
    'Panduan lengkap Preflight: cara memakai, memasang API key sendiri, berbagi rencana, menyambungkan AI coding agent, arsitektur, deploy, dan catatan keputusan teknisnya.',
  alternates: { canonical: '/docs' },
};

export default function DocsIndex() {
  const chapters = listChapters();
  const forUsers = chapters.filter((c) => Number(c.number) <= 5);
  const forDevs = chapters.filter((c) => Number(c.number) > 5);

  return (
    <div>
      <h1 className="max-w-[20ch] text-[32px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[38px]">
        Manual Preflight
      </h1>
      <p className="mt-5 max-w-[62ch] text-[16.5px] leading-relaxed text-muted">
        Preflight mengubah ide jadi PRD, daftar fitur, dan task berurutan — di mana tiap task sudah
        berisi prompt siap tempel ke AI coding agent. Jalan di atas model AI gratis.
      </p>

      {[
        { heading: 'Memakai Preflight', hint: 'Kalau kamu mau memakainya.', items: forUsers },
        {
          heading: 'Mengembangkan',
          hint: 'Kalau kamu mau menjalankan atau mengubah kodenya.',
          items: forDevs,
        },
      ].map((group) => (
        <section key={group.heading} className="mt-14">
          <h2 className="text-[19px] font-semibold tracking-tight text-ink">{group.heading}</h2>
          <p className="mt-1 text-[14.5px] text-faint">{group.hint}</p>

          <ul className="mt-5 divide-y divide-rule border-t border-rule">
            {group.items.map((c) => (
              <li key={c.slug}>
                <Link href={`/docs/${c.slug}`} className="group flex gap-4 py-4">
                  <span className="mt-0.5 font-mono text-[13px] tabular-nums text-faint">
                    {c.number}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16.5px] font-medium text-ink group-hover:text-signal group-hover:underline">
                      {c.title}
                    </span>
                    {c.summary && (
                      <span className="mt-1 block max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
                        {c.summary}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-16 border-t border-rule pt-8">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">Mulai cepat</h2>
        <div className="screen mt-4 overflow-x-auto rounded-[3px] bg-screen px-4 py-3.5">
          <pre className="font-mono text-[12.5px] leading-[1.7] text-screen-ink">{`git clone https://github.com/znlumins/Preflight.git
cd Preflight && npm install
cp .env.example .env.local     # isi GOOGLE_GENERATIVE_AI_API_KEY + ENCRYPTION_KEY
npm run db:push
npm run dev`}</pre>
        </div>
        <p className="mt-4 max-w-[62ch] text-[15.5px] leading-relaxed text-muted">
          Detailnya ada di{' '}
          <Link
            href="/docs/06-menjalankan"
            className="text-signal underline decoration-signal/30 underline-offset-4"
          >
            Menjalankan lokal
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
