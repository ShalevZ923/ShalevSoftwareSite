import { useDeferredValue, useMemo, useState } from "react";
import { getDocumentationTools } from "../catalog";
import type { Tool } from "../data";
import { getGuideResourceTarget } from "../downloads";
import { MarkdownDocument } from "../markdown";
import { resolveToolRelease, toolPageHref } from "../toolLinks";
import { DocumentationPicker } from "./DocumentationPicker";
import { Icon, PageHeader } from "./ui";

export function DocumentationPage({
  requestedVersion,
  onCatalog,
  tools,
  docs,
  selected,
  setSelected,
}: {
  requestedVersion?: string;
  onCatalog: (tool: Tool, version?: string) => void;
  tools: Tool[];
  docs: Record<string, string>;
  selected: string;
  setSelected: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const matchingTools = useMemo(
    () => getDocumentationTools(tools, deferredQuery),
    [tools, deferredQuery],
  );
  const tool = tools.find((t) => t.id === selected) ?? tools[0];
  const guideResources = tool?.resources
    ? [...tool.resources].sort((left, right) => {
        if (!requestedVersion) return 0;
        return Number(right.appliesTo.includes(requestedVersion)) - Number(left.appliesTo.includes(requestedVersion));
      })
    : [];
  return (
    <section className="page documentation-page">
      <PageHeader
        title="Documentation"
        copy="Clear setup notes, ownership, and operating guidance for every supported tool."
      />
      <div className="docs-layout">
        <DocumentationPicker
          allToolsCount={tools.length}
          matchingTools={matchingTools}
          query={query}
          selectedId={selected}
          onQueryChange={setQuery}
          onSelect={setSelected}
        />
        <article className="markdown" id={`doc-${selected}`} tabIndex={-1}>
          <p
            id="documentation-update"
            className="sr-only"
            role="status"
            aria-live="polite"
          >
            Showing documentation for {tool ? tool.name : "selected tool"}
          </p>
          {tool && (
            <div className="doc-context">
              <div>
                <span>Owner</span>
                <strong>{tool.support.team}</strong>
              </div>
              <div>
                <span>Support</span>
                <a href={`mailto:${tool.support.email}`}>{tool.support.email}</a>
              </div>
              <div>
                <span>In this guide</span>
                <a href="#install">Install</a>
                <a href="#support">Support</a>
                {guideResources.length > 0 && <a href="#guide-resources-title">Guides &amp; files</a>}
              </div>
            </div>
          )}
          {tool && <div className="doc-catalog-action">
            <a className="secondary-button" href={toolPageHref("catalog", tool.id, requestedVersion)} onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onCatalog(tool, requestedVersion);
            }}><Icon name="catalog" size={16} /> View in catalog <Icon name="arrow" size={16} /></a>
            <span>{requestedVersion && resolveToolRelease(tool, requestedVersion).version !== requestedVersion ? "Requested version unavailable. Opens the default release." : requestedVersion ? `Opens version ${requestedVersion}` : "See approved downloads and available versions."}</span>
          </div>}
          <MarkdownDocument content={docs[selected] || (tool ? docs[tool.id] : "") || ""} />
          {guideResources.length > 0 && (
            <section className="guide-resources" aria-labelledby="guide-resources-title">
              <div className="guide-resources-heading">
                <div>
                  <span className="eyebrow">Documentation library</span>
                  <h2 id="guide-resources-title">Guides &amp; files</h2>
                </div>
                <span className="guide-resource-count">{guideResources.length} available</span>
              </div>
              <div className="guide-resource-list">
                {guideResources.map((resource) => {
                  const target = getGuideResourceTarget(resource);
                  const action = resource.format === "pptx" ? "Download" : "Open";
                  const matchesRequestedVersion = requestedVersion && resource.appliesTo.includes(requestedVersion);
                  return (
                    <article key={resource.id} className="guide-resource">
                      <div className="guide-resource-icon" aria-hidden="true"><Icon name="document" /></div>
                      <div className="guide-resource-copy">
                        <div className="guide-resource-title-row">
                          <h3>{resource.title}</h3>
                          <span className="guide-resource-format">{resource.format.toUpperCase()}</span>
                        </div>
                        <p>{matchesRequestedVersion ? `Matches ${requestedVersion} · ` : ""}{resource.kind.replace(/-/g, " ")} · {resource.appliesTo.join(", ")} · Reviewed {resource.reviewedOn}</p>
                        <small>Owner: {resource.owner}{resource.accessNote ? ` · ${resource.accessNote}` : ""}</small>
                      </div>
                      {target && (
                        <a className="guide-resource-action" href={target.href} target={target.external ? "_blank" : undefined} rel={target.external ? "noopener noreferrer" : undefined} aria-label={`${action} ${resource.title} — ${resource.format.toUpperCase()}`}>
                          {action} {resource.title} — {resource.format.toUpperCase()} <Icon name={target.external ? "external" : "arrow"} size={15} />
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </article>
      </div>
    </section>
  );
}
