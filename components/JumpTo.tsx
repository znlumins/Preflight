'use client';

import { useEffect, useState } from 'react';

/**
 * A way back up a long page.
 *
 * A plan is PRD, then forty tasks each carrying a paragraph of prompt; on a
 * phone that is a couple of minutes of thumb-scrolling to get back to the list
 * of features. This appears once the reader is well past the fold and points
 * at `href` — the feature list on a plan, the top on a chapter. It is a real
 * anchor, so the jump itself needs no script; only showing and hiding does.
 */
export function JumpTo({ href, label }: { href: string; label: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // With a target on the page, only once the reader is past it: a button
    // pointing at a list already on screen is noise. `#top` has no element.
    const target = document.getElementById(href.slice(1));
    let frame = 0;
    const check = () => {
      frame = 0;
      const past = target ? target.getBoundingClientRect().bottom < 0 : true;
      setShown(past && window.scrollY > window.innerHeight * 1.5);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [href]);

  return (
    <a
      href={href}
      aria-hidden={!shown}
      tabIndex={shown ? undefined : -1}
      // Lifted clear of the home indicator and Safari's floating tab bar.
      className={`fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 flex items-center gap-1.5
                  rounded-[3px] border border-rule bg-paper/95 px-3.5 py-2 text-[13.5px] text-muted shadow-sm
                  backdrop-blur-sm transition-[opacity,translate] duration-200 hover:text-signal pointer-coarse:min-h-11
                  ${shown ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}
    >
      <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3">
        <path d="M2.5 7.5 6 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      {label}
    </a>
  );
}
