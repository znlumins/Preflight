import Link from 'next/link';
import type { Chapter } from '@/lib/docs';

/**
 * Chapter navigation.
 *
 * Numbered because the manual genuinely is a sequence — chapter 1 assumes
 * nothing, chapter 10 assumes the rest. The split between reading it to use
 * Preflight and reading it to change Preflight is the first thing someone
 * needs to know, so it is a visible division rather than a flat list.
 */
export function DocsNav({ chapters, current }: { chapters: Chapter[]; current?: string }) {
  const forUsers = chapters.filter((c) => Number(c.number) <= 5);
  const forDevs = chapters.filter((c) => Number(c.number) > 5);

  return (
    <nav aria-label="Daftar bab" className="text-[14.5px]">
      {[
        { heading: 'Memakai', items: forUsers },
        { heading: 'Mengembangkan', items: forDevs },
      ].map((group) => (
        <div key={group.heading} className="mt-7 first:mt-0">
          <h2 className="text-[13px] font-semibold text-faint">{group.heading}</h2>
          <ul className="mt-2.5 space-y-0.5">
            {group.items.map((c) => {
              const active = c.slug === current;
              return (
                <li key={c.slug}>
                  <Link
                    href={`/docs/${c.slug}`}
                    aria-current={active ? 'page' : undefined}
                    className={`-mx-2 flex gap-2.5 rounded-[3px] px-2 py-3 leading-snug transition-colors lg:py-1.5
                      ${
                        active
                          ? 'bg-signal-soft font-medium text-signal'
                          : 'text-muted hover:bg-paper-sunk hover:text-ink'
                      }`}
                  >
                    <span
                      className={`font-mono text-[12px] tabular-nums ${
                        active ? 'text-signal' : 'text-faint'
                      }`}
                    >
                      {c.number}
                    </span>
                    <span className="min-w-0">{c.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
