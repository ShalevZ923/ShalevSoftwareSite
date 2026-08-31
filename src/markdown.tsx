import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugifyHeading } from "./catalog";

const localImagePath = /^\/tool-images\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function getTrustedImageSource(source?: string) {
  return source && localImagePath.test(source) && !source.includes("..")
    ? source
    : undefined;
}

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

export function getTrustedHttpsUrl(href?: string) {
  const target = getTrustedLinkTarget(href);
  return target?.startsWith("https:") ? target : undefined;
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
          <h2 id={slugifyHeading(String(children))}>{children}</h2>
        ),
        a: MarkdownLink,
        img: MarkdownImage,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
