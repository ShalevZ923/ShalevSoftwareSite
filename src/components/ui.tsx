import type { ReactNode } from "react";
import type { Platform, Tool } from "../data";

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
  | "search";

const iconPaths: Record<IconName, ReactNode> = {
  atlas: <><path d="m12 2 9 18H3L12 2Z" /><path d="m12 7 4 9H8l4-9Z" /></>,
  catalog: <><path d="m7 7-4 5 4 5" /><path d="m17 7 4 5-4 5" /><path d="m14 4-4 16" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22V5.5Z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  chevron: <path d="m7 10 5 5 5-5" />,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  external: <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" /></>,
  bookmark: <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4V4Z" />,
  link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 1 0 12 20l1.1-1.1" /></>,
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

export function PlatformMark({ platform }: { platform: Platform }) {
  const labels: Record<Platform, string> = { Windows: "Win", Linux: "Lin", macOS: "Mac", Web: "Web" };

  return <span className="platform-mark" title={platform}><span aria-hidden="true">{labels[platform]}</span>{platform}</span>;
}

export function ToolGlyph({ tool }: { tool: Tool }) {
  return (
    <span className={`tool-glyph glyph-${tool.id}`} aria-hidden="true">
      {tool.image ? <img src={tool.image.src} alt="" loading="lazy" /> : tool.icon}
    </span>
  );
}

export function PageHeader({ title, copy }: { title: string; copy: string }) {
  return <header className="page-header"><div><h1 id="page-title" tabIndex={-1}>{title}</h1><p>{copy}</p></div><div className="topo-lines" aria-hidden="true" /></header>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
