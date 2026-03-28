import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

/**
 * Renders Gemini / markdown-style text with XSS-safe HTML (rehype-sanitize).
 * Typography: Arial, 16pt.
 */
export default function ChatMarkdown({ children, variant = "assistant" }) {
  const isUser = variant === "user";
  const tone = isUser
    ? "[&_a]:text-cyan-100 [&_code]:bg-white/15 [&_code]:text-white"
    : "[&_a]:text-cyan-400 [&_code]:bg-zinc-900 [&_code]:text-zinc-200";

  return (
    <div
      className={`chat-markdown ${tone} font-[Arial,sans-serif] text-[16pt] leading-relaxed [&_*:first-child]:mt-0 [&_p:last-child]:mb-0`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          p: ({ node: _n, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
          strong: ({ node: _n, ...props }) => <strong className="font-semibold" {...props} />,
          em: ({ node: _n, ...props }) => <em className="italic" {...props} />,
          h1: ({ node: _n, ...props }) => (
            <h1 className="mb-2 mt-3 border-b border-white/10 pb-1 text-[1.15em] font-bold first:mt-0" {...props} />
          ),
          h2: ({ node: _n, ...props }) => <h2 className="mb-2 mt-3 text-[1.08em] font-bold first:mt-0" {...props} />,
          h3: ({ node: _n, ...props }) => <h3 className="mb-1.5 mt-2 text-[1.05em] font-semibold first:mt-0" {...props} />,
          ul: ({ node: _n, ...props }) => <ul className="mb-2 list-disc pl-5 last:mb-0" {...props} />,
          ol: ({ node: _n, ...props }) => <ol className="mb-2 list-decimal pl-5 last:mb-0" {...props} />,
          li: ({ node: _n, ...props }) => <li className="mb-0.5" {...props} />,
          a: ({ node: _n, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" {...props} />
          ),
          code: ({ inline, className, children, ...props }) =>
            inline ? (
              <code className="rounded px-1 py-0.5 font-mono text-[0.9em]" {...props}>
                {children}
              </code>
            ) : (
              <pre className="mb-2 overflow-x-auto rounded-lg bg-zinc-950/80 p-3 font-mono text-[0.85em] ring-1 ring-zinc-700 last:mb-0">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ),
          blockquote: ({ node: _n, ...props }) => (
            <blockquote className="mb-2 border-l-2 border-zinc-500 pl-3 italic opacity-95" {...props} />
          ),
          hr: ({ node: _n, ...props }) => <hr className="my-3 border-zinc-600" {...props} />,
          table: ({ node: _n, ...props }) => (
            <div className="mb-2 overflow-x-auto">
              <table className="w-full border-collapse text-left text-[0.95em]" {...props} />
            </div>
          ),
          th: ({ node: _n, ...props }) => <th className="border border-zinc-600 px-2 py-1 font-semibold" {...props} />,
          td: ({ node: _n, ...props }) => <td className="border border-zinc-600 px-2 py-1" {...props} />,
        }}
      >
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
