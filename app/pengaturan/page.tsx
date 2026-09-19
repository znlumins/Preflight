import Link from 'next/link';
import { AgentSetup } from '@/components/AgentSetup';
import { KeySettings } from '@/components/KeySettings';
import { tokenStatus } from '@/lib/agent-token';
import { keyStatus } from '@/lib/keys';
import { poolUsage } from '@/lib/limits';
import { clientIpHash, peekSessionId } from '@/lib/session';

export const metadata = { title: 'Pengaturan — Preflight' };

export default async function SettingsPage() {
  const sessionId = await peekSessionId();
  const status = sessionId ? await keyStatus(sessionId) : null;
  const usage = sessionId ? await poolUsage({ sessionId, ipHash: await clientIpHash() }) : null;
  const agent = sessionId ? await tokenStatus(sessionId) : null;

  return (
    <div className="mx-auto w-full max-w-[46rem] px-6 py-14 sm:py-20">
      <header className="flex items-baseline justify-between">
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink hover:text-signal">
          preflight
        </Link>
        <Link href="/" className="text-[13.5px] text-muted hover:text-signal">
          Kembali
        </Link>
      </header>

      <main className="mt-16">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink">
          API key kamu sendiri
        </h1>
        <p className="mt-4 max-w-[62ch] text-[16.5px] leading-relaxed text-muted">
          Preflight jalan di atas model AI gratis. Kuota bersama yang dipakai semua pengunjung
          habis sekitar 70 rencana per hari. Pasang key kamu sendiri — juga gratis, tanpa kartu
          kredit — dan batas itu jadi milik kamu sendiri.
        </p>

        <div className="mt-10">
          <KeySettings initial={status} usage={status ? null : usage} />
        </div>

        <AgentSetup initial={agent} />

        <section className="mt-16 border-t border-rule pt-7">
          <h2 className="text-[15px] font-semibold text-ink">Bagaimana key kamu disimpan</h2>
          <ul className="mt-3 max-w-[64ch] space-y-2 text-[14.5px] text-muted">
            <li className="flex gap-2.5 leading-[1.6]">
              <span aria-hidden className="mt-[0.7em] h-px w-2.5 shrink-0 bg-faint" />
              <span>Dienkripsi AES-256-GCM sebelum masuk database, bukan disimpan apa adanya.</span>
            </li>
            <li className="flex gap-2.5 leading-[1.6]">
              <span aria-hidden className="mt-[0.7em] h-px w-2.5 shrink-0 bg-faint" />
              <span>Tidak pernah dikirim balik ke browser. Halaman ini cuma menerima empat karakter terakhir.</span>
            </li>
            <li className="flex gap-2.5 leading-[1.6]">
              <span aria-hidden className="mt-[0.7em] h-px w-2.5 shrink-0 bg-faint" />
              <span>Dipakai hanya saat kamu menyusun rencana, lalu dibuang dari memori.</span>
            </li>
            <li className="flex gap-2.5 leading-[1.6]">
              <span aria-hidden className="mt-[0.7em] h-px w-2.5 shrink-0 bg-faint" />
              <span>Bisa kamu hapus kapan saja, dan langsung hilang dari database.</span>
            </li>
          </ul>
          <p className="mt-4 max-w-[64ch] text-[14.5px] leading-relaxed text-muted">
            Satu hal yang perlu kamu tahu: di tier gratis, Google memakai isi permintaan untuk
            melatih modelnya. Jangan tempel ide yang benar-benar rahasia.
          </p>
        </section>
      </main>
    </div>
  );
}
