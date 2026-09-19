import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugifyHeading } from "./catalog";
import { getTrustedImageSource } from "./trustedMedia";

export { getTrustedHttpsUrl } from "./downloads";
export { getTrustedImageSource } from "./trustedMedia";

export function getTrustedLinkTarget(href?: string) {
  if (!href) return undefined;
  if (/^#[A-Za-z0-9-]*$/.test(href)) return href;

  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "mailto:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * React Markdown supplies formatted heading content as nested React nodes.
 * Flatten it before creating an anchor so headings such as `## Install **now**`
 * retain useful, stable fragment links instead of becoming "[object Object]".
 */
export function getHeadingText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) return children.map(getHeadingText).join("");
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return getHeadingText(children.props.children);
  }
  return "";
}

function MarkdownLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const target = getTrustedLinkTarget(href);
  if (!target) return <span>{children}</span>;

  const isExternal = target.startsWith("https:");
  return (
    <a
      href={target}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const source = getTrustedImageSource(src);
  return source ? (
    <img
      src={source}
      alt={alt ?? ""}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : null;
}

/** Renders catalog-owned Markdown with an explicit local-image and safe-link boundary. */
export function MarkdownDocument({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 id={slugifyHeading(getHeadingText(children))}>{children}</h2>
        ),
        a: MarkdownLink,
        img: MarkdownImage,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
