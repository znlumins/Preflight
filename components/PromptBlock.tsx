'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * The agent prompt, and the one dark surface in the document.
 *
 * This is what the user actually came for, and they will meet it forty times in
 * a plan, so the affordance has to be quiet enough to repeat and obvious enough
 * to never hunt for. Copying is the primary action: the whole block is the
 * button, and the label only confirms what happened.
 */
export function PromptBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure origin, denied permission). Select the text
      // instead so the keyboard shortcut still works.
      const node = document.getElementById(`prompt-${text.length}`);
      if (node) window.getSelection()?.selectAllChildren(node);
    }
  }

  return (
    <div className="screen group relative mt-3">
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Prompt tersalin' : 'Salin prompt untuk AI coding agent'}
        className="block w-full cursor-copy rounded-[3px] bg-screen px-4 py-3.5 text-left
                   transition-colors duration-150 hover:bg-[#13212a] active:bg-[#13212a] focus-visible:outline-signal"
      >
        {/* `anywhere`: prompts are full of paths like src/components/Foo.tsx
            with nowhere to break, which pushed a phone-width page sideways. */}
        <p className="font-mono text-[12.5px] leading-[1.75] text-screen-ink whitespace-pre-wrap [overflow-wrap:anywhere]">
          {/* Always visible: on touch there is no hover, so a hover-only
              affordance would leave the primary action undiscoverable on half
              the devices. Floated rather than pinned in a padded gutter, so
              only the first line gives up room for it — a fixed right gutter
              left a phone about a hundred pixels per line. */}
          <span
            aria-hidden
            className={`pointer-events-none float-right -mt-0.5 mb-1 ml-3 select-none rounded-[2px]
                        px-2 py-0.5 text-[11px] tracking-tight transition-colors duration-200
                        ${
                          copied
                            ? 'bg-signal text-white'
                            : 'bg-[#1d2f39] text-[#93a9b5] group-hover:text-[#b6c7d1]'
                        }`}
          >
            {copied ? 'tersalin' : 'salin'}
          </span>
          {text}
        </p>
      </button>

      {/* Always mounted, so the change is announced rather than just rendered. */}
      <div role="status" className="sr-only">
        {copied ? 'Prompt tersalin' : ''}
      </div>

      {/* A long prompt on a phone is taller than the screen, so the label at its
          top is often scrolled away by the time the thumb lands near the end.
          Touch gets a notice pinned to the viewport. Portalled to <body>: the
          feature sections animate `transform`, which would otherwise pin a
          fixed child to the section instead of the screen. */}
      {copied &&
        createPortal(
          <span
            aria-hidden
            className="settle pointer-events-none fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-20
                       -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-signal px-4 py-2.5 text-[14px] text-white
                       shadow-sm pointer-fine:hidden"
          >
            Prompt tersalin — tempel ke agent kamu
          </span>,
          document.body,
        )}
    </div>
  );
}
