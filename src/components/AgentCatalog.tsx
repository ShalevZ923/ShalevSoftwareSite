import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { armCopyFeedbackTimer, copyLinkAnnouncement, copyLinkLabel, searchShortcutHint } from "../catalogChrome";
import type { AgentPackage, RiskLevel } from "../agentTypes";
import {
  agentFacets, agentFiltersToSearch, agentPackageTypes, agentPageFromSearch, defaultAgentFilters,
  facetLabel, formatAgentDate, getAgentCatalog, paginateAgents, supportLabels,
  type AgentCatalogFilters,
} from "../agentCatalog";
import { agentTargetFromSearch, type AgentCatalogTarget } from "../agentLinks";
import { filterSavedToolIds, readSavedAgentIds, writeSavedAgentIds } from "../catalogStorage";
import { MarkdownDocument } from "../markdown";
import { Field, Icon, PageHeader, ToolGlyph } from "./ui";
import { AgentDelivery } from "./AgentDelivery";

const riskOptions: Array<"All risks" | RiskLevel> = ["All risks", "Low", "Medium", "High", "Unknown"];
const guideModules = import.meta.glob<string>("/content/agents/**/guide.md", { query: "?raw", import: "default" });

function Guide({ path }: { path: string }) {
  const [guide, setGuide] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setGuide(null);
    const loader = guideModules[path];
    if (loader) loader().then((content) => { if (active) setGuide(content); }).catch(() => { if (active) setGuide("Guide unavailable."); });
    else setGuide("Guide unavailable.");
    return () => { active = false; };
  }, [path]);
  return <div className="agent-guide markdown-body">{guide === null ? "Loading guide…" : <MarkdownDocument content={guide} />}</div>;
}

export function AgentCatalog({ search, agents, hotkeysEnabled = true }: { search: string; agents: AgentPackage[]; hotkeysEnabled?: boolean }) {
  const publishers = useMemo(() => ["All publishers", ...new Set(agents.map((a) => a.publisher))].sort((a, b) => a === "All publishers" ? -1 : b === "All publishers" ? 1 : a.localeCompare(b)), [agents]);
  const knownIds = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);
  const initial = useMemo(() => agentTargetFromSearch(search, agents), [search, agents]);
  const [filters, setFilters] = useState<AgentCatalogFilters>(initial.filters);
  const [expanded, setExpanded] = useState<string | null>(initial.target?.agentId ?? null);
  const [target, setTarget] = useState<AgentCatalogTarget | null>(initial.target);
  const [page, setPage] = useState(() => agentPageFromSearch(search));
  const [savedIds, setSavedIds] = useState<string[]>(() => readSavedAgentIds(knownIds));
  const [savedOnly, setSavedOnly] = useState(() => new URLSearchParams(search).get("saved") === "1");
  const [filtersOpen, setFiltersOpen] = useState(() => initial.filters.capability !== "all" || initial.filters.status !== "all" || initial.filters.publisher !== "All publishers" || initial.filters.risk !== "All risks");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">("idle");
  const [linkNotice, setLinkNotice] = useState(() => ({ missing: initial.missingAgent, unavailable: initial.unavailableVersion }));
  const copyTimerRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const dismissLinkNotice = () => setLinkNotice({ missing: false, unavailable: false });
  const deferredQuery = useDeferredValue(filters.query);
  const filtering = filters.query !== deferredQuery;
  const filtered = useMemo(() => getAgentCatalog(agents, { ...filters, query: deferredQuery }), [agents, filters, deferredQuery]);
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const results = useMemo(() => savedOnly ? filtered.filter((a) => savedSet.has(a.id)) : filtered, [filtered, savedOnly, savedSet]);
  const paged = useMemo(() => paginateAgents(results, page, target?.agentId), [results, page, target]);
  const resetFilters = () => { dismissLinkNotice(); setFilters(defaultAgentFilters); setSavedOnly(false); setPage(1); setTarget(null); setExpanded(null); };
  const updateFilter = <K extends keyof AgentCatalogFilters>(key: K, value: AgentCatalogFilters[K]) => {
    dismissLinkNotice(); setFilters((current) => ({ ...current, [key]: value })); setPage(1); setTarget(null); setExpanded(null);
  };
  useEffect(() => { writeSavedAgentIds(savedIds); }, [savedIds]);
  useEffect(() => {
    setSavedIds((current) => { const valid = filterSavedToolIds(current, knownIds); return valid.length === current.length ? current : valid; });
  }, [knownIds]);
  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(agentFiltersToSearch(filters));
    params.set("page", "agents");
    if (savedOnly) params.set("saved", "1");
    if (paged.page > 1) params.set("p", String(paged.page));
    if (target) { params.set("agent", target.agentId); if (target.version) params.set("version", target.version); }
    url.search = params.toString();
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [filters, paged.page, target, savedOnly]);
  useEffect(() => {
    if (!hotkeysEnabled) return;
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [hotkeysEnabled]);
  useEffect(() => () => { if (copyTimerRef.current !== undefined) window.clearTimeout(copyTimerRef.current); }, []);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopyState("copied"); }
    catch { setCopyState("unavailable"); }
    copyTimerRef.current = armCopyFeedbackTimer(
      copyTimerRef.current,
      (id) => window.clearTimeout(id),
      (callback, ms) => window.setTimeout(callback, ms),
      () => setCopyState("idle"),
    );
  };
  const toggleSaved = (id: string) => setSavedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const typeCounts = useMemo(() => new Map(agentPackageTypes.map((type) => [type, agents.filter((a) => a.packageType === type).length])), [agents]);
  const capabilities = useMemo(() => new Set(agents.flatMap((agent) => agent.capabilities)), [agents]);
  const activeFilterCount = Number(filters.capability !== "all") + Number(filters.status !== "all") + Number(filters.publisher !== "All publishers") + Number(filters.risk !== "All risks");

  return <section className="page catalog-page agent-catalog-page">
    <PageHeader title="Agent catalog" copy="Discover MCP servers, skills, and agent packages for your workflows." />
    <p className="agent-host-note">For compatible tools such as OpenCode, VS Code/Copilot, CodePilot, and Cline. Format support varies by resource.</p>
    {linkNotice.missing && <p className="catalog-link-notice" role="status">This resource is no longer listed. Browse the catalog below.</p>}
    {linkNotice.unavailable && <p className="catalog-link-notice" role="status">The linked version is unavailable. The resource listing is shown without that version.</p>}
    <label className="search-box agent-search"><Icon name="search" /><input ref={searchRef} aria-label="Search agent catalog" value={filters.query}
      onChange={(event) => updateFilter("query", event.target.value)} placeholder="Search resources…" /><kbd aria-label={`Search shortcut ${searchShortcutHint(navigator.userAgent, navigator.platform)}`}>{searchShortcutHint(navigator.userAgent, navigator.platform)}</kbd></label>
    <div className="agent-discovery-bar"><nav className="agent-type-tabs" aria-label="Resource types">
      {(["All types", ...agentPackageTypes.filter((type) => (typeCounts.get(type) ?? 0) > 0)] as const).map((type) => <button key={type} type="button"
        className={filters.packageType === type ? "agent-type-tab active" : "agent-type-tab"}
        aria-pressed={filters.packageType === type}
        onClick={() => updateFilter("packageType", type)}>
        {type === "All types" ? "All resources" : type === "MCP Server" ? "MCP servers" : type === "Skill" ? "Skills" : type === "Agent Pack" ? "Agent packs" : "Role packs"}
        <span>{type === "All types" ? agents.length : typeCounts.get(type) ?? 0}</span>
      </button>)}
    </nav><button className={activeFilterCount ? "agent-filter-toggle active" : "agent-filter-toggle"} type="button" aria-expanded={filtersOpen} aria-controls={filtersOpen ? "agent-filter-panel" : undefined} onClick={() => setFiltersOpen((value) => !value)}><Icon name="filter" size={16} />Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}<Icon name="chevron" size={14} /></button></div>
    {filtersOpen && <div id="agent-filter-panel" className="agent-filters" role="group" aria-label="Catalog filters">
      <Field label="Capability"><select value={filters.capability} onChange={(e) => updateFilter("capability", e.target.value)}><option value="all">All capabilities</option>{agentFacets.capabilities.filter((item) => capabilities.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
      <Field label="Support"><select value={filters.status} onChange={(e) => updateFilter("status", e.target.value as AgentCatalogFilters["status"])}><option value="all">All statuses</option>{Object.entries(supportLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
      <Field label="Publisher"><select value={filters.publisher} onChange={(e) => updateFilter("publisher", e.target.value)}>{publishers.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Risk"><select value={filters.risk} onChange={(e) => updateFilter("risk", e.target.value as AgentCatalogFilters["risk"])}>{riskOptions.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <button className="clear-button" type="button" onClick={resetFilters}>Clear filters</button>
    </div>}
    <div className="catalog-toolbar agent-toolbar">
      <strong role="status" aria-live="polite">{filtering ? "Searching…" : `${results.length} ${results.length === 1 ? "resource" : "resources"} found`}</strong>
      <div className="catalog-toolbar-actions">
        <button className={savedOnly ? "toolbar-button active" : "toolbar-button"} type="button" aria-pressed={savedOnly} onClick={() => { dismissLinkNotice(); setSavedOnly((v) => !v); setPage(1); setTarget(null); setExpanded(null); }}><Icon name="bookmark" size={16} />Saved ({savedIds.length})</button>
        <button className="toolbar-button" type="button" onClick={copyLink}><Icon name={copyState === "copied" ? "check" : "link"} size={16} />{copyLinkLabel(copyState)}</button>
        <span className="sr-only" role="status" aria-live="polite">{copyLinkAnnouncement(copyState)}</span>
        <label className="sort-select">Sort by <select value={filters.sort} onChange={(e) => updateFilter("sort", e.target.value as AgentCatalogFilters["sort"])}><option value="name">Name A–Z</option><option value="type">Type</option><option value="updated">Recently updated</option></select></label>
      </div>
    </div>
    <div className="agent-result-list" role="list">
      {paged.items.map((agent) => <AgentRow key={agent.id} agent={agent} expanded={expanded === agent.id} saved={savedSet.has(agent.id)}
        pointed={target?.agentId === agent.id} version={target?.agentId === agent.id ? target.version : undefined}
        onVersionChange={(version) => setTarget({ agentId: agent.id, version })}
        onToggle={() => { dismissLinkNotice(); const next = expanded === agent.id ? null : agent.id; setExpanded(next); setTarget(next ? { agentId: agent.id } : null); }} onSaved={() => toggleSaved(agent.id)} />)}
      {results.length === 0 && !filtering && <div className="empty-state"><Icon name={savedOnly ? "bookmark" : "search"} size={28} /><h2>No resources match this view</h2><p>Try a broader search or clear the filters.</p><button className="secondary-button" onClick={resetFilters}>Clear filters</button></div>}
    </div>
    {paged.pageCount > 1 && <nav className="agent-pagination" aria-label="Result pages"><button disabled={paged.page === 1} onClick={() => { dismissLinkNotice(); setPage(paged.page - 1); setExpanded(null); setTarget(null); }}>Previous</button><span>Page {paged.page} of {paged.pageCount}</span><button disabled={paged.page === paged.pageCount} onClick={() => { dismissLinkNotice(); setPage(paged.page + 1); setExpanded(null); setTarget(null); }}>Next</button></nav>}
  </section>;
}

function AgentRow({ agent, expanded, saved, pointed, version, onVersionChange, onToggle, onSaved }: {
  agent: AgentPackage; expanded: boolean; saved: boolean; pointed: boolean; version?: string; onVersionChange: (version: string) => void; onToggle: () => void; onSaved: () => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => { if (pointed && expanded) row.current?.scrollIntoView({ block: "nearest" }); }, [pointed, expanded]);
  return <div ref={row} id={`agent-${agent.id}`} role="listitem" className={`agent-row ${expanded ? "expanded" : ""}`}>
    <button className="agent-row-summary" aria-expanded={expanded} aria-controls={expanded ? `agent-detail-${agent.id}` : undefined} onClick={onToggle}>
      <ToolGlyph tool={agent} />
      <span className="agent-row-name"><strong>{agent.name}</strong><small className="agent-row-inline-type">{agent.packageType}</small></span>
      <span className="agent-row-type">{agent.packageType}</span>
      <span className="agent-row-description">{agent.description}</span>
      <span className="agent-row-tags">{agent.highlights.slice(0, 2).map((highlight) => <span key={highlight}>{highlight}</span>)}</span>
      <span className={`agent-support agent-support-${agent.status}`}>{supportLabels[agent.status]}</span>
      <Icon name="chevron" size={16} />
    </button>
    {expanded && <div id={`agent-detail-${agent.id}`} className="agent-detail">
      <div className="agent-detail-lead">
        <div><h2 className="agent-section-title">At a glance</h2><div className="agent-highlight-list">{agent.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}</div></div>
        <button className={saved ? "secondary-button saved-tool" : "secondary-button"} aria-pressed={saved} onClick={onSaved}><Icon name="bookmark" size={15} />{saved ? "Saved" : "Save resource"}</button>
      </div>
      {agent.status === "example" && <p className="agent-example-note">Example listing. Package and support details have not been verified.</p>}
      {(agent.releases.length > 0 || agent.install?.mcp) && <AgentDelivery agent={agent} version={version} onVersionChange={onVersionChange} />}
      <div className="agent-detail-disclosures">
        {(agent.mcp || agent.contents.length > 0) && <details><summary>What's included</summary>
          {agent.mcp && <div className="agent-mcp-summary">{agent.mcp.tools.length > 0 && <><h4>MCP tools</h4><ul className="agent-mcp-tools">{agent.mcp.tools.map((tool) => <li key={tool.name}><strong>{tool.name}</strong><span>{tool.effect}</span><p>{tool.description}</p></li>)}</ul></>}
            {(["resources", "prompts"] as const).map((kind) => agent.mcp![kind].length > 0 && <div key={kind}><h4>{kind[0].toUpperCase() + kind.slice(1)}</h4><ul>{agent.mcp![kind].map((item) => <li key={item}>{item}</li>)}</ul></div>)}
          </div>}
          {agent.contents.length > 0 && <><h4>Package files</h4><ul className="agent-contents">{agent.contents.map((item) => <li key={item.path}><code>{item.path}</code><span className="agent-content-kind">{item.kind}</span>{item.note && <small>{item.note}</small>}</li>)}</ul></>}
        </details>}
        <details><summary>Requirements &amp; permissions</summary>
          <p>Risk: {agent.riskLevel === "Unknown" ? "Not assessed" : agent.riskLevel}</p>
          {agent.requirements.length > 0 && <><h4>Requirements</h4><ul>{agent.requirements.map((item) => <li key={item}>{item}</li>)}</ul></>}
          <h4>Permissions</h4>{agent.permissions.length > 0 ? <ul>{agent.permissions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Permissions not assessed.</p>}
          {agent.risks && agent.risks.length > 0 && <><h4>Risks</h4><ul>{agent.risks.map((item) => <li key={item}>{item}</li>)}</ul></>}
        </details>
        <details><summary>Technical details</summary>
          <dl className="agent-facts"><div><dt>Publisher</dt><dd>{agent.publisher}</dd></div><div><dt>Version</dt><dd>{agent.currentVersion ?? "Not recorded"}</dd></div><div><dt>Updated</dt><dd>{formatAgentDate(agent.updatedAt)}</dd></div><div><dt>Support owner</dt><dd>{agent.maintainer.name}</dd></div><div><dt>License</dt><dd>{agent.license ?? "Not recorded"}</dd></div><div><dt>Review</dt><dd>{agent.review.status}{agent.review.date ? ` · ${formatAgentDate(agent.review.date)}` : ""}</dd></div></dl>
          <p className="agent-facet-line">{agent.capabilities.map(facetLabel).join(" · ")}</p>
          {agent.mcp && <dl className="agent-facts"><div><dt>Transport</dt><dd>{agent.mcp.transport}</dd></div><div><dt>Hosting</dt><dd>{agent.mcp.hosting}</dd></div><div><dt>Authentication</dt><dd>{agent.mcp.authentication}</dd></div></dl>}
          {agent.source && <a href={agent.source.url} target="_blank" rel="noopener noreferrer">View source <Icon name="external" size={14} /></a>}
        </details>
        <details className="agent-guide-toggle"><summary>Read usage guide</summary><Guide path={agent.guidePath} /></details>
      </div>
    </div>}
  </div>;
}
