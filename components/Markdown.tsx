import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

/**
 * Manual pages, rendered on the server.
 *
 * A server component on purpose: documentation should be readable with
 * JavaScript switched off and fully legible to a crawler. Nothing here needs
 * to be interactive.
 *
 * Code blocks reuse the dark treatment from the agent prompts, so "this is
 * something you copy and run" means the same thing everywhere in the product.
 */
/** Pulls the text out of a fenced block, ignoring the `code` element inside it. */
function plainText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plainText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return plainText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return '';
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[16px] leading-[1.75] text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-0 max-w-[24ch] text-[32px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[38px]">
              {children}
            </h1>
          ),
          h2: ({ children, id }) => (
            // Scroll margin so a deep link does not land under the heading.
            <h2
              id={id}
              className="mt-14 scroll-mt-8 border-t border-rule pt-7 text-[22px] font-semibold tracking-tight text-ink"
            >
              {children}
            </h2>
          ),
          h3: ({ children, id }) => (
            <h3 id={id} className="mt-9 scroll-mt-8 text-[17.5px] font-semibold text-ink">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mt-4 max-w-[68ch] leading-[1.75] text-ink">{children}</p>
          ),
          a: ({ href, children }) => {
            // Links between chapters are written as "07-arsitektur.md" so the
            // files stay navigable on GitHub; here they become routes.
            const internal = href?.match(/^(\d\d-[a-z-]+)\.md$/);
            const target = internal
              ? `/docs/${internal[1]}`
              : href === 'README.md'
                ? '/docs'
                : href;

            if (target?.startsWith('/')) {
              return (
                <Link
                  href={target}
                  className="text-signal underline decoration-signal/30 underline-offset-4 hover:decoration-signal"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={target}
                target="_blank"
                rel="noreferrer noopener"
                className="text-signal underline decoration-signal/30 underline-offset-4 hover:decoration-signal"
              >
                {children}
              </a>
            );
          },
          ul: ({ children }) => <ul className="mt-4 max-w-[68ch] space-y-2">{children}</ul>,
          ol: ({ children }) => (
            <ol className="mt-4 max-w-[68ch] list-decimal space-y-2 pl-5 marker:text-faint">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-[1.7]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mt-5 max-w-[68ch] border-l-2 border-signal bg-signal-soft px-4 py-3 [&>p]:mt-0 [&>p+p]:mt-3">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="mt-12 border-0" />,
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          // Only ever reached for inline code: `pre` below renders its own text
          // and never delegates here. Keying off a language class instead would
          // give an unlabelled fence the inline pill styling — a light chip
          // inside a dark block.
          code: ({ children }) => (
            <code className="rounded-[2px] bg-paper-sunk px-1.5 py-0.5 font-mono text-[13.5px] text-ink">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <div className="screen mt-5 overflow-x-auto rounded-[3px] bg-screen px-4 py-3.5">
              <pre className="font-mono text-[12.5px] leading-[1.7] text-screen-ink">
                {plainText(children)}
              </pre>
            </div>
          ),
          table: ({ children }) => (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-[15px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-rule text-left">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="py-2 pr-6 text-[14px] font-semibold text-muted last:pr-0">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-rule py-2.5 pr-6 align-top leading-[1.6] last:pr-0">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
