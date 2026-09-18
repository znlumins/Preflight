import Link from 'next/link';
import { IdeaFlow } from '@/components/IdeaFlow';
import { poolUsage } from '@/lib/limits';
import { keyStatus } from '@/lib/keys';
import { listPlans } from '@/lib/plans';
import { peekSessionId } from '@/lib/session';

export default async function Home() {
  const sessionId = await peekSessionId();
  const recent = sessionId ? (await listPlans(sessionId)).reverse().slice(0, 4) : [];
  const byok = sessionId ? await keyStatus(sessionId) : null;
  const usage = sessionId && !byok ? await poolUsage(sessionId) : null;

  return (
    <div className="mx-auto w-full max-w-[46rem] px-6 py-14 sm:py-20">
      <header className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold tracking-tight text-ink">preflight</span>
        <nav className="flex items-baseline gap-5 text-[13.5px]">
          <Link href="/rencana" className="text-muted hover:text-signal">
            Contoh rencana
          </Link>
          <Link href="/pengaturan" className="text-muted hover:text-signal">
            Pengaturan
          </Link>
        </nav>
      </header>

      <main className="mt-14 sm:mt-20">
        <h1 className="max-w-[20ch] text-[34px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[42px]">
          Apa yang mau kamu bangun?
        </h1>
        <p className="mt-5 max-w-[56ch] text-[16.5px] leading-relaxed text-muted">
          Jawab lima pertanyaan, dapat PRD, daftar fitur, dan task berurutan. Tiap task sudah
          berisi prompt yang tinggal kamu tempel ke Claude Code, Cursor, atau agent lain.
        </p>

        <div className="mt-10">
          <IdeaFlow />
        </div>
      </main>

      {recent.length > 0 && (
        <section className="mt-16 border-t border-rule pt-7">
          <h2 className="text-[14px] font-medium text-muted">Rencana kamu sebelumnya</h2>
          <ul className="mt-4 space-y-1">
            {recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/plans/${p.id}`}
                  className="group flex items-baseline gap-3 py-1.5 text-[15px] text-ink hover:text-signal"
                >
                  <span className="truncate font-medium group-hover:underline">
                    {p.title ?? p.idea.slice(0, 48)}
                  </span>
                  {p.status !== 'done' && (
                    <span className="shrink-0 text-[13px] text-faint">
                      {p.status === 'error' ? 'gagal' : 'belum selesai'}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-16 border-t border-rule pt-7 text-[13.5px] leading-relaxed text-faint">
        {byok ? (
          <>
            Pakai API key kamu sendiri, jadi tanpa batas dari sisi kami.{' '}
            <Link href="/pengaturan" className="underline decoration-rule underline-offset-4 hover:text-signal">
              Ubah di Pengaturan
            </Link>
            .
          </>
        ) : (
          <>
            Sisa {usage?.sessionRemaining ?? 3} rencana hari ini dengan kuota bersama.{' '}
            <Link href="/pengaturan" className="underline decoration-rule underline-offset-4 hover:text-signal">
              Pasang API key sendiri
            </Link>{' '}
            untuk lepas dari batas itu — gratis. Rencana kamu tersimpan di browser ini tanpa akun.
          </>
        )}
      </footer>
    </div>
  );
}
