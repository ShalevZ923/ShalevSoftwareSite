import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentPackage, RiskLevel } from "../agents";
import {
  agentFiltersToSearch,
  defaultAgentFilters,
  getAgentCatalog,
  getRecentAgentUpdates,
  type AgentCatalogFilters,
} from "../agentCatalog";
import {
  agentReleaseSha256,
  isZipDownloadTarget,
  mcpInstallHref,
  unpackPathForScope,
  type InstallScope,
} from "../agentInstall";
import {
  agentTargetFromSearch,
  resolveAgentRelease,
  type AgentCatalogTarget,
} from "../agentLinks";
import { filterSavedToolIds, readSavedAgentIds, writeSavedAgentIds } from "../catalogStorage";
import { getReleaseDownloadTarget } from "../downloads";
import { Field, Icon, PageHeader, ToolGlyph } from "./ui";

const risks: Array<"All risks" | RiskLevel> = ["All risks", "Low", "Medium", "High"];

export function AgentCatalog({
  search,
  agents,
}: {
  agents: AgentPackage[];
  search: string;
}) {
  const packageTypes = useMemo(
    () => ["All types", ...Array.from(new Set(agents.map((agent) => agent.packageType))).sort()],
    [agents],
  );
  const publishers = useMemo(
    () => ["All publishers", ...Array.from(new Set(agents.map((agent) => agent.publisher))).sort()],
    [agents],
  );
  const agentIds = useMemo(() => new Set(agents.map((agent) => agent.id)), [agents]);
  const initialLink = useMemo(() => agentTargetFromSearch(search, agents), [search, agents]);
  const [target, setTarget] = useState<AgentCatalogTarget | null>(initialLink.target);
  const [pointedAgent, setPointedAgent] = useState(initialLink.target?.agentId);
  const [filters, setFilters] = useState<AgentCatalogFilters>(() => initialLink.filters);
  const [expanded, setExpanded] = useState<string | null>(initialLink.target?.agentId ?? null);
  useEffect(() => {
    if (!initialLink.target) return;
    setTarget(initialLink.target);
    setExpanded(initialLink.target.agentId);
    setPointedAgent(initialLink.target.agentId);
    setFilters(initialLink.filters);
  }, [initialLink.target?.agentId, initialLink.target?.version]);
  const [savedAgentIds, setSavedAgentIds] = useState<string[]>(() => readSavedAgentIds(agentIds));
  const [savedOnly, setSavedOnly] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">("idle");
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => getAgentCatalog(agents, filters), [agents, filters]);
  const savedAgentIdSet = useMemo(() => new Set(savedAgentIds), [savedAgentIds]);
  const visibleAgents = useMemo(
    () => (savedOnly ? filtered.filter((agent) => savedAgentIdSet.has(agent.id)) : filtered),
    [filtered, savedOnly, savedAgentIdSet],
  );
  const updateFilter = <K extends keyof AgentCatalogFilters>(key: K, value: AgentCatalogFilters[K]) => {
    setTarget(null);
    setPointedAgent(undefined);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const clear = () => {
    setTarget(null);
    setPointedAgent(undefined);
    setFilters(defaultAgentFilters);
  };
  const toggleSaved = (id: string) =>
    setSavedAgentIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return [...next];
    });
  const resetView = () => {
    clear();
    setSavedOnly(false);
  };

  useEffect(() => {
    const current = new URL(window.location.href);
    const params = new URLSearchParams(agentFiltersToSearch(filters));
    params.set("page", "agents");
    if (target) {
      params.set("agent", target.agentId);
      if (target.version) params.set("version", target.version);
    }
    current.search = params.toString();
    window.history.replaceState(null, "", `${current.pathname}${current.search}${current.hash}`);
  }, [filters, target]);

  useEffect(() => {
    writeSavedAgentIds(savedAgentIds);
  }, [savedAgentIds]);

  useEffect(() => {
    setSavedAgentIds((current) => {
      const valid = filterSavedToolIds(current, agentIds);
      return valid.length === current.length ? current : valid;
    });
  }, [agentIds]);

  const copyViewLink = async () => {
    try {
      await window.navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
    } catch {
      setCopyState("unavailable");
    }
  };

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <section className="page catalog-page">
      <PageHeader
        title="Agent catalog"
        copy="Find reviewed skills, agent packs, role packs, and MCP servers from trusted publishers."
      />
      {initialLink.missingAgent && (
        <p className="catalog-link-notice" role="status">
          The linked package is no longer in the catalog. Browse or search for another package below.
        </p>
      )}
      <div className="catalog-layout">
        <div className="catalog-core">
          <label className="search-box">
            <Icon name="search" />
            <input
              ref={searchRef}
              aria-label="Search agent packages"
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Search packages, publishers, or tags…"
            />
            <kbd>⌘K</kbd>
          </label>
          <div className="filters" aria-label="Agent catalog filters">
            <Field label="Type">
              <select value={filters.packageType} onChange={(event) => updateFilter("packageType", event.target.value)}>
                {packageTypes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Publisher">
              <select value={filters.publisher} onChange={(event) => updateFilter("publisher", event.target.value)}>
                {publishers.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Risk">
              <select
                value={filters.risk}
                onChange={(event) => updateFilter("risk", event.target.value as AgentCatalogFilters["risk"])}
              >
                {risks.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <button className="clear-button" onClick={clear}>
              Clear filters
            </button>
          </div>
          <div className="catalog-toolbar">
            <strong role="status" aria-live="polite" aria-atomic="true">
              {visibleAgents.length} {savedOnly ? "saved " : ""}
              {visibleAgents.length === 1 ? "package" : "packages"} found
            </strong>
            <div className="catalog-toolbar-actions">
              <button
                className={savedOnly ? "toolbar-button active" : "toolbar-button"}
                aria-pressed={savedOnly}
                onClick={() => {
                  setTarget(null);
                  setPointedAgent(undefined);
                  setSavedOnly((current) => !current);
                }}
              >
                <Icon name="bookmark" size={16} />
                {savedOnly ? "All packages" : `Saved packages (${savedAgentIds.length})`}
              </button>
              <button className="toolbar-button" onClick={copyViewLink}>
                <Icon name={copyState === "copied" ? "check" : "link"} size={16} />
                {copyState === "copied" ? "Link copied" : "Copy view link"}
              </button>
              <span className="sr-only" role="status" aria-live="polite">
                {copyState === "unavailable"
                  ? "Could not copy the link. Copy the address from your browser instead."
                  : ""}
              </span>
              <label className="sort-select">
                Sort by{" "}
                <select
                  value={filters.sort}
                  onChange={(event) => updateFilter("sort", event.target.value as AgentCatalogFilters["sort"])}
                >
                  <option value="name">Name A–Z</option>
                  <option value="type">Type</option>
                  <option value="updated">Recently updated</option>
                </select>
              </label>
            </div>
          </div>
          <div className="tool-list" role="list">
            <div className="list-head">
              <span>Package</span>
              <span>Type</span>
              <span>Risk</span>
              <span>Publisher</span>
              <span>Reviewer</span>
            </div>
            {visibleAgents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                expanded={expanded === agent.id}
                initialVersion={
                  initialLink.target?.agentId === agent.id ? initialLink.target.version : undefined
                }
                pointed={pointedAgent === agent.id}
                versionUnavailable={initialLink.unavailableVersion && initialLink.target?.agentId === agent.id}
                toggle={(version) => {
                  const next = expanded === agent.id ? null : agent.id;
                  setExpanded(next);
                  setPointedAgent(undefined);
                  setTarget(next ? { agentId: next, version } : null);
                }}
                onVersionChange={(version) => {
                  setPointedAgent(undefined);
                  setTarget({ agentId: agent.id, version });
                }}
                saved={savedAgentIdSet.has(agent.id)}
                onToggleSaved={() => toggleSaved(agent.id)}
              />
            ))}
            {visibleAgents.length === 0 && (
              <div className="empty-state">
                <Icon name={savedOnly ? "bookmark" : "search"} size={28} />
                <h2>{savedOnly ? "No saved packages in this view" : "No packages match those filters"}</h2>
                <p>
                  {savedOnly
                    ? "Show every package or save a package from its expanded details."
                    : "Try another name, publisher, tag, or clear your filters."}
                </p>
                <button className="secondary-button" onClick={savedOnly ? () => setSavedOnly(false) : resetView}>
                  {savedOnly ? "Show all packages" : "Clear filters"}
                </button>
              </div>
            )}
          </div>
        </div>
        <aside className="updates">
          <h2>Recent updates</h2>
          {getRecentAgentUpdates(agents).slice(0, 5).map((agent) => (
            <div key={agent.id} className="update">
              <span />
              <div>
                <strong>
                  {agent.name} {agent.releases[0].version}
                </strong>
                <small>{agent.updated}</small>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}

function AgentRow({
  versionUnavailable,
  initialVersion,
  pointed,
  onVersionChange,
  agent,
  expanded,
  toggle,
  saved,
  onToggleSaved,
}: {
  agent: AgentPackage;
  expanded: boolean;
  versionUnavailable: boolean;
  initialVersion?: string;
  pointed: boolean;
  onVersionChange: (version: string) => void;
  toggle: (version: string) => void;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const [selectedVersion, setSelectedVersion] = useState(
    () => resolveAgentRelease(agent, initialVersion).version,
  );
  const [scope, setScope] = useState<InstallScope>("project");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">("idle");
  useEffect(() => {
    if (initialVersion) setSelectedVersion(initialVersion);
  }, [initialVersion]);
  const selectedRelease = resolveAgentRelease(agent, selectedVersion);
  const rowRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!pointed || !expanded) return;
    const frame = requestAnimationFrame(() => {
      rowRef.current?.querySelector<HTMLButtonElement>(".tool-summary")?.focus({ preventScroll: true });
      rowRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pointed, expanded]);
  const downloadTarget = getReleaseDownloadTarget(selectedRelease);
  const zipDownload = isZipDownloadTarget(downloadTarget);
  const unpackPath = unpackPathForScope(agent.install, scope);
  const sha256 = agentReleaseSha256(selectedRelease.sha256);

  const copyUnpackPath = async () => {
    if (!unpackPath) return;
    try {
      await window.navigator.clipboard.writeText(unpackPath);
      setCopyState("copied");
    } catch {
      setCopyState("unavailable");
    }
  };

  return (
    <article
      ref={rowRef}
      id={`agent-${agent.id}`}
      className={`tool-row ${expanded ? "expanded" : ""} ${pointed ? "linked-tool" : ""}`}
      role="listitem"
    >
      <button
        className="tool-summary"
        onClick={() => toggle(selectedRelease.version)}
        aria-expanded={expanded}
        aria-controls={`details-${agent.id}`}
      >
        <span className="disclosure">
          <Icon name="chevron" size={17} />
        </span>
        <span className="software-cell">
          <ToolGlyph tool={agent} />
          <span>
            <strong>{agent.name}</strong>
            <small>
              {agent.publisher} · {agent.releases[0].version}
            </small>
          </span>
        </span>
        <span className="category-cell">{agent.packageType}</span>
        <span>
          <span className={`lifecycle risk-${agent.riskLevel.toLowerCase()}`}>{agent.riskLevel}</span>
        </span>
        <span className="platforms">{agent.publisher}</span>
        <span className="support-mini">
          <span className="avatar">{agent.maintainer.initials}</span>
          <span>
            <strong>{agent.maintainer.name}</strong>
            <small>{agent.maintainer.team}</small>
          </span>
        </span>
      </button>
      {expanded && (
        <div id={`details-${agent.id}`} className="tool-details">
          <div className="details-product">
            <ToolGlyph tool={agent} />
            <div>
              <h2>{agent.name}</h2>
              <p>{agent.description}</p>
              <div className="tag-row">
                {agent.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              {agent.notice && (
                <aside className={`tool-notice ${agent.notice.tone}`}>
                  <strong>{agent.notice.title}</strong>
                  <p>{agent.notice.message}</p>
                </aside>
              )}
              {agent.facts && agent.facts.length > 0 && (
                <dl className="tool-facts">
                  {agent.facts.map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <section className="agent-meta" aria-label="Package contents and permissions">
                <div>
                  <h3>Contains</h3>
                  <ul className="agent-contents">
                    {agent.contents.map((item) => (
                      <li key={item.path}>
                        <code>{item.path}</code>
                        <span className="agent-content-kind">{item.kind}</span>
                        {item.note ? <small>{item.note}</small> : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Permissions</h3>
                  <ul className="agent-permissions">
                    {agent.permissions.map((permission) => (
                      <li key={permission}>{permission}</li>
                    ))}
                  </ul>
                  {agent.risks && agent.risks.length > 0 && (
                    <>
                      <h3>Risks</h3>
                      <ul className="agent-risks">
                        {agent.risks.map((risk) => (
                          <li key={risk}>{risk}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </section>
              {pointed && versionUnavailable && (
                <p className="catalog-link-notice" role="status">
                  The linked version is unavailable. Showing the default release, {selectedRelease.version}.
                </p>
              )}
              <div className="detail-actions agent-install-actions">
                <label className="release-picker">
                  <span>Version</span>
                  <select
                    aria-label={`Package version for ${agent.name}`}
                    value={selectedRelease.version}
                    onChange={(event) => {
                      setSelectedVersion(event.target.value);
                      onVersionChange(event.target.value);
                    }}
                  >
                    {agent.releases.map((release) => (
                      <option key={release.version} value={release.version}>
                        {release.version}
                      </option>
                    ))}
                  </select>
                </label>
                {sha256 && (
                  <p className="agent-sha256">
                    SHA-256 <code>{sha256}</code>
                  </p>
                )}
                {downloadTarget && (
                  <a
                    className="secondary-button"
                    href={downloadTarget.href}
                    target={downloadTarget.external ? "_blank" : undefined}
                    rel={downloadTarget.external ? "noopener noreferrer" : undefined}
                    download={downloadTarget.filename}
                  >
                    <Icon name="download" />
                    {zipDownload ? `Download ${selectedRelease.version} ZIP` : `Open package ${selectedRelease.version}`}
                    {downloadTarget.external && <Icon name="external" size={15} />}
                  </a>
                )}
                {agent.install.mcp && (
                  <>
                    <a className="secondary-button" href={mcpInstallHref(agent.install.mcp)}>
                      <Icon name="download" />
                      Install in VS Code
                    </a>
                    <a className="text-action" href={mcpInstallHref(agent.install.mcp, "vscode-insiders")}>
                      Insiders
                      <Icon name="external" size={15} />
                    </a>
                  </>
                )}
                <div className="agent-command">
                  <div className="scope-toggle" role="group" aria-label="Unpack location">
                    <button
                      type="button"
                      className={scope === "project" ? "toolbar-button active" : "toolbar-button"}
                      aria-pressed={scope === "project"}
                      onClick={() => setScope("project")}
                    >
                      Project
                    </button>
                    <button
                      type="button"
                      className={scope === "global" ? "toolbar-button active" : "toolbar-button"}
                      aria-pressed={scope === "global"}
                      onClick={() => setScope("global")}
                    >
                      Global
                    </button>
                  </div>
                  <p className="agent-unpack-copy">
                    Download the ZIP, then extract it so the package root is this folder. Tool Atlas does not run
                    scripts from the archive.
                  </p>
                  <code className="agent-command-text">{unpackPath}</code>
                  <button className="secondary-button" onClick={copyUnpackPath}>
                    <Icon name={copyState === "copied" ? "check" : "link"} />
                    {copyState === "copied" ? "Copied" : "Copy path"}
                  </button>
                  <span className="sr-only" role="status" aria-live="polite">
                    {copyState === "unavailable"
                      ? "Could not copy the path. Select the text and copy it instead."
                      : ""}
                  </span>
                </div>
                <button
                  className={saved ? "secondary-button saved-tool" : "secondary-button"}
                  aria-pressed={saved}
                  onClick={onToggleSaved}
                >
                  <Icon name="bookmark" />
                  {saved ? "Saved" : "Save package"}
                </button>
              </div>
            </div>
          </div>
          <div className="details-support">
            <span>Reviewed by</span>
            <div className="support-owner">
              <span className="avatar large">{agent.maintainer.initials}</span>
              <div>
                <strong>{agent.maintainer.name}</strong>
                <small>{agent.maintainer.team}</small>
              </div>
            </div>
            <a href={`mailto:${agent.maintainer.email}`}>
              <Icon name="mail" size={16} />
              {agent.maintainer.email}
            </a>
          </div>
        </div>
      )}
    </article>
  );
}
