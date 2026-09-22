import Link from 'next/link';

/**
 * The one shared site header.
 *
 * Wide screens get the plain inline nav. Narrow screens fold the links into a
 * hamburger — built on <details> like the docs sidebar, so it opens without
 * JavaScript and keeps its state while navigating within a layout.
 */
export function SiteHeader({ links }: { links: { href: string; label: string }[] }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
      <Link href="/" className="tap text-[15px] font-semibold tracking-tight text-ink hover:text-signal">
        preflight
      </Link>

      {/* Wide screens: all links visible. */}
      <nav className="hidden items-baseline gap-x-5 text-[13.5px] sm:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="tap whitespace-nowrap text-muted hover:text-signal"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Narrow screens: hamburger. <details> toggles without JavaScript. */}
      <details className="group relative sm:hidden">
        <summary
          className="tap-area flex h-11 w-11 cursor-pointer list-none items-center justify-center
                     text-muted [&::-webkit-details-marker]:hidden hover:text-ink"
          aria-label="Buka menu"
        >
          {/* Bars swap to an X while the menu is open. */}
          <svg viewBox="0 0 20 20" aria-hidden className="h-5 w-5">
            <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" className="transition-transform duration-150 origin-center group-open:translate-y-[5px] group-open:rotate-45" />
              <line x1="3" y1="10" x2="17" y2="10" className="transition-opacity duration-150 group-open:opacity-0" />
              <line x1="3" y1="15" x2="17" y2="15" className="transition-transform duration-150 origin-center group-open:-translate-y-[5px] group-open:-rotate-45" />
            </g>
          </svg>
        </summary>
        <nav
          className="absolute right-0 top-12 z-10 min-w-44 border border-rule bg-paper
                     py-1 shadow-sm"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="tap flex min-h-11 items-center px-4 text-[14px] text-muted hover:bg-paper-sunk hover:text-signal"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </details>
    </header>
  );
}
