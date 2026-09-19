import type { ReactNode } from "react";
import type { Platform, Tool } from "../data";
import { getTrustedImageSource } from "../trustedMedia";

export type IconName =
  | "arrow"
  | "atlas"
  | "book"
  | "bookmark"
  | "catalog"
  | "check"
  | "chevron"
  | "close"
  | "document"
  | "download"
  | "external"
  | "info"
  | "link"
  | "mail"
  | "menu"
  | "moon"
  | "search"
  | "sun"
  | "updates";

const CONCEPT_BOX = "0 0 40 40";
const conceptIcons = new Set<IconName>(["book", "bookmark", "catalog", "external", "info", "updates"]);

const iconPaths: Record<IconName, ReactNode> = {
  atlas: <><path d="m12 2 9 18H3L12 2Z" /><path d="m12 7 4 9H8l4-9Z" /></>,
  catalog: (
    <>
      <path d="M4 6h13v13H4zM23 6h13v13H23zM4 25h13v11H4z" />
      <path d="M23 25h13v11H23z" stroke="#f0a51a" />
    </>
  ),
  book: (
    <>
      <path d="M4 7c5-3 10-3 16 0v30c-6-3-11-3-16 0zM36 7c-5-3-10-3-16 0v30c6-3 11-3 16 0z" />
      <path d="M9 14h6M25 14h6M9 20h6M25 20h6" />
    </>
  ),
  updates: (
    <>
      <path d="M20 4a16 16 0 1 0 16 16" />
      <path d="M27 4h9v9M36 4 24 16" stroke="#f0a51a" />
      <path d="M20 12v9l6 4" />
    </>
  ),
  info: (
    <>
      <circle cx="20" cy="20" r="16" />
      <path d="M20 18v11M20 11h.01" />
      <path d="M9 7a16 16 0 0 1 22 0" stroke="#f0a51a" />
    </>
  ),
  bookmark: (
    <>
      <path d="M9 5h22a3 3 0 0 1 3 3v29L20 29 6 37V8a3 3 0 0 1 3-3z" />
      <path d="m13 18 5 5 10-11" stroke="#f0a51a" />
    </>
  ),
  external: (
    <>
      <path d="M23 5h13v13M36 5 18 23" stroke="#f0a51a" />
      <path d="M32 23v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3h10" />
    </>
  ),
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  chevron: <path d="m7 10 5 5 5-5" />,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  moon: <path d="M15 4a8 8 0 1 0 5 14 7 7 0 0 1-5-14Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M6.2 17.8l1.4-1.4M16.4 7.6l1.4-1.4" />
    </>
  ),
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 1 0 12 20l1.1-1.1" /></>,
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const sliced = conceptIcons.has(name);

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={sliced ? CONCEPT_BOX : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth={sliced ? 2.25 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

export function PlatformMark({ platform }: { platform: Platform }) {
  const labels: Record<Platform, string> = { Windows: "Win", Linux: "Lin", macOS: "Mac", Web: "Web" };

  return <span className="platform-mark" title={platform}><span aria-hidden="true">{labels[platform]}</span>{platform}</span>;
}

export function ToolGlyph({ tool }: { tool: Tool }) {
  const imageSource = getTrustedImageSource(tool.image?.src);

  return (
    <span className={`tool-glyph glyph-${tool.id}`} aria-hidden="true">
      {imageSource ? <img src={imageSource} alt="" loading="lazy" /> : tool.icon}
    </span>
  );
}

export function PageHeader({ title, copy }: { title: string; copy: string }) {
  return <header className="page-header"><div><h1 id="page-title" tabIndex={-1}>{title}</h1><p>{copy}</p></div></header>;
}

export function Field({
  label,
  children,
  invalid = false,
}: {
  label: string;
  children: ReactNode;
  invalid?: boolean;
}) {
  return <label className={invalid ? "field field-invalid" : "field"}><span>{label}</span>{children}</label>;
}
