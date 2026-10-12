import { lazy, Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { docs as staticDocs, tools as staticTools, type Platform, type Tool } from "../../data";
import {
  catalogFiltersToSearch,
  defaultFilters,
  getCatalogTools,
  getRecentUpdates,
  type CatalogFilters,
} from "../../catalog";
import {
  armCopyFeedbackTimer,
  copyLinkAnnouncement,
  copyLinkLabel,
  searchShortcutHint,
} from "../../catalogChrome";
import { filterSavedToolIds, readSavedToolIds, writeSavedToolIds } from "../../catalogStorage";
import {
  Field,
  Icon,
  PageHeader,
  PlatformMark,
  ToolGlyph,
  type IconName,
} from "../../components/ui";
import { getReleaseDownloadTarget } from "../../downloads";
import { focusableElements, wrapTabTarget } from "../../focusTrap";
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  systemTheme,
  writeTheme,
  type Theme,
} from "../../theme";
import {
  catalogTargetFromSearch,
  resolveToolRelease,
  toolPageHref,
  type CatalogTarget,
} from "../../toolLinks";

const platforms: Array<"All platforms" | Platform> = [
  "All platforms",
  "Windows",
  "Linux",
  "macOS",
  "Web",
];
const lifecycles = ["All lifecycles", "Current", "New", "Legacy"];

export function SoftwareCatalog({
  search,
  tools,
  onDocs,
  onUpdates,
  hotkeysEnabled = true,
}: {
  tools: Tool[];
  search: string;
  onDocs: (tool: Tool, version: string) => void;
  onUpdates: () => void;
  hotkeysEnabled?: boolean;
}) {
  const categories = useMemo(
    () => ["All categories", ...Array.from(new Set(tools.map((tool) => tool.category))).sort()],
    [tools],
  );
  const toolIds = useMemo(() => new Set(tools.map((tool) => tool.id)), [tools]);
  const initialLink = useMemo(() => catalogTargetFromSearch(search, tools), [search, tools]);
  const [target, setTarget] = useState<CatalogTarget | null>(initialLink.target);
  const [pointedTool, setPointedTool] = useState(initialLink.target?.toolId);
  const [filters, setFilters] = useState<CatalogFilters>(() => initialLink.filters);
  const [expanded, setExpanded] = useState<string | null>(initialLink.target?.toolId ?? null);
  // A local server may supply a newly added tool/release after the static bundle loads.
  useEffect(() => {
    if (!initialLink.target) return;
    setTarget(initialLink.target);
    setExpanded(initialLink.target.toolId);
    setPointedTool(initialLink.target.toolId);
    setFilters(initialLink.filters);
  }, [initialLink]);
  const [savedToolIds, setSavedToolIds] = useState<string[]>(() => readSavedToolIds(toolIds));
  const [savedOnly, setSavedOnly] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">("idle");
  const copyTimerRef = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => getCatalogTools(tools, filters), [tools, filters]);
  const savedToolIdSet = useMemo(() => new Set(savedToolIds), [savedToolIds]);
  const visibleTools = useMemo(
    () => (savedOnly ? filtered.filter((tool) => savedToolIdSet.has(tool.id)) : filtered),
    [filtered, savedOnly, savedToolIdSet],
  );
  const updateFilter = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) => {
    setTarget(null);
    setPointedTool(undefined);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const clear = () => {
    setTarget(null);
    setPointedTool(undefined);
    setFilters(defaultFilters);
  };
  const toggleSaved = (id: string) =>
    setSavedToolIds((current) => {
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
    const params = new URLSearchParams(catalogFiltersToSearch(filters));
    if (target) {
      params.set("page", "catalog");
      params.set("tool", target.toolId);
      if (target.version) params.set("version", target.version);
    }
    current.search = params.toString();
    window.history.replaceState(null, "", `${current.pathname}${current.search}${current.hash}`);
  }, [filters, target]);

  useEffect(() => {
    writeSavedToolIds(savedToolIds);
  }, [savedToolIds]);

  useEffect(() => {
    setSavedToolIds((current) => {
      const valid = filterSavedToolIds(current, toolIds);
      return valid.length === current.length ? current : valid;
    });
  }, [toolIds]);

  const copyViewLink = async () => {
    try {
      await window.navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
    } catch {
      setCopyState("unavailable");
    }
    copyTimerRef.current = armCopyFeedbackTimer(
      copyTimerRef.current,
      (id) => window.clearTimeout(id),
      (callback, ms) => window.setTimeout(callback, ms),
      () => setCopyState("idle"),
    );
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== undefined) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hotkeysEnabled) return;
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [hotkeysEnabled]);
  return (
    <section className="page catalog-page">
      <PageHeader
        title="Software catalog"
        copy="Find, compare, and support the tools your team relies on."
      />
      {initialLink.missingTool && (
        <p className="catalog-link-notice" role="status">
          The linked tool is no longer in the catalog. Browse or search for another tool below.
        </p>
      )}
      <div className="catalog-layout">
        <div className="catalog-core">
          <label className="search-box">
            <Icon name="search" />
            <input
              ref={searchRef}
              aria-label="Search tools"
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Search tools, vendors, or tags…"
            />
            <kbd
              aria-label={`Search shortcut ${searchShortcutHint(navigator.userAgent, navigator.platform)}`}
            >
              {searchShortcutHint(navigator.userAgent, navigator.platform)}
            </kbd>
          </label>
          <div className="filters" aria-label="Catalog filters">
            <Field label="Category">
              <select
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Platform">
              <select
                value={filters.platform}
                onChange={(event) =>
                  updateFilter("platform", event.target.value as "All platforms" | Platform)
                }
              >
                {platforms.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Lifecycle">
              <select
                value={filters.lifecycle}
                onChange={(event) =>
                  updateFilter("lifecycle", event.target.value as CatalogFilters["lifecycle"])
                }
              >
                {lifecycles.map((item) => (
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
              {visibleTools.length} {savedOnly ? "saved " : ""}
              {visibleTools.length === 1 ? "tool" : "tools"} found
            </strong>
            <div className="catalog-toolbar-actions">
              <button
                className={savedOnly ? "toolbar-button active" : "toolbar-button"}
                aria-pressed={savedOnly}
                onClick={() => {
                  setTarget(null);
                  setPointedTool(undefined);
                  setSavedOnly((current) => !current);
                }}
              >
                <Icon name="bookmark" size={16} />
                {savedOnly ? "All tools" : `Saved tools (${savedToolIds.length})`}
              </button>
              <button type="button" className="toolbar-button" onClick={copyViewLink}>
                <Icon name={copyState === "copied" ? "check" : "link"} size={16} />
                {copyLinkLabel(copyState)}
              </button>
              <span className="sr-only" role="status" aria-live="polite">
                {copyLinkAnnouncement(copyState)}
              </span>
              <label className="sort-select">
                Sort by{" "}
                <select
                  value={filters.sort}
                  onChange={(event) =>
                    updateFilter("sort", event.target.value as CatalogFilters["sort"])
                  }
                >
                  <option value="name">Name A–Z</option>
                  <option value="category">Category</option>
                  <option value="updated">Recently updated</option>
                </select>
              </label>
            </div>
          </div>
          <div className="tool-list" role="list">
            <div className="list-head">
              <span>Software</span>
              <span>Category</span>
              <span>Lifecycle</span>
              <span>Platforms</span>
              <span>Support</span>
            </div>
            {visibleTools.map((tool) => (
              <ToolRow
                key={tool.id}
                tool={tool}
                expanded={expanded === tool.id}
                initialVersion={
                  initialLink.target?.toolId === tool.id ? initialLink.target.version : undefined
                }
                pointed={pointedTool === tool.id}
                versionUnavailable={
                  initialLink.unavailableVersion && initialLink.target?.toolId === tool.id
                }
                toggle={(version) => {
                  const next = expanded === tool.id ? null : tool.id;
                  setExpanded(next);
                  setPointedTool(undefined);
                  setTarget(next ? { toolId: next, version } : null);
                }}
                onVersionChange={(version) => {
                  setPointedTool(undefined);
                  setTarget({ toolId: tool.id, version });
                }}
                onDocs={(version) => onDocs(tool, version)}
                saved={savedToolIdSet.has(tool.id)}
                onToggleSaved={() => toggleSaved(tool.id)}
              />
            ))}
            {visibleTools.length === 0 && (
              <div className="empty-state">
                <Icon name={savedOnly ? "bookmark" : "search"} size={28} />
                <h2>
                  {savedOnly ? "No saved tools in this view" : "No tools match those filters"}
                </h2>
                <p>
                  {savedOnly
                    ? "Show every tool or save a tool from its expanded details."
                    : "Try another name, platform, tag, or clear your filters."}
                </p>
                <button
                  className="secondary-button"
                  onClick={savedOnly ? () => setSavedOnly(false) : resetView}
                >
                  {savedOnly ? "Show all tools" : "Clear filters"}
                </button>
              </div>
            )}
          </div>
        </div>
        <Updates tools={tools} onViewAll={onUpdates} />
      </div>
    </section>
  );
}

function ToolRow({
  versionUnavailable,
  initialVersion,
  pointed,
  onVersionChange,
  tool,
  expanded,
  toggle,
  onDocs,
  saved,
  onToggleSaved,
}: {
  tool: Tool;
  expanded: boolean;
  versionUnavailable: boolean;
  initialVersion?: string;
  pointed: boolean;
  onVersionChange: (version: string) => void;
  toggle: (version: string) => void;
  onDocs: (version: string) => void;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const [selectedVersion, setSelectedVersion] = useState(
    () => resolveToolRelease(tool, initialVersion).version,
  );
  useEffect(() => {
    if (initialVersion) setSelectedVersion(initialVersion);
  }, [initialVersion]);
  const selectedRelease = resolveToolRelease(tool, selectedVersion);
  const rowRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!pointed || !expanded) return;
    const frame = requestAnimationFrame(() => {
      rowRef.current
        ?.querySelector<HTMLButtonElement>(".tool-summary")
        ?.focus({ preventScroll: true });
      rowRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pointed, expanded]);
  const downloadTarget = getReleaseDownloadTarget(selectedRelease);

  return (
    <article
      ref={rowRef}
      id={`tool-${tool.id}`}
      className={`tool-row ${expanded ? "expanded" : ""} ${pointed ? "linked-tool" : ""}`}
      role="listitem"
    >
      <button
        className="tool-summary"
        onClick={() => toggle(selectedRelease.version)}
        aria-expanded={expanded}
        aria-controls={`details-${tool.id}`}
      >
        <span className="disclosure">
          <Icon name="chevron" size={17} />
        </span>
        <span className="software-cell">
          <ToolGlyph tool={tool} />
          <span>
            <strong>{tool.name}</strong>
            <small>
              {tool.company} · {tool.releases[0].version}
            </small>
          </span>
        </span>
        <span className="category-cell">{tool.category}</span>
        <span>
          <span className={`lifecycle ${tool.lifecycle.toLowerCase()}`}>{tool.lifecycle}</span>
        </span>
        <span className="platforms">
          {tool.platforms.map((item) => (
            <PlatformMark key={item} platform={item} />
          ))}
        </span>
        <span className="support-mini">
          <span className="avatar">{tool.support.initials}</span>
          <span>
            <strong>{tool.support.name}</strong>
            <small>{tool.support.team}</small>
          </span>
        </span>
      </button>
      {expanded && (
        <div id={`details-${tool.id}`} className="tool-details">
          <div className="details-top">
            <div className="details-product">
              <ToolGlyph tool={tool} />
              <div>
                <h2>{tool.name}</h2>
                <p>{tool.description}</p>
                <div className="tag-row">
                  {tool.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <aside className="details-support" aria-label="Support owner">
              <p className="details-support-kicker">Support owner</p>
              <div className="support-owner">
                <span className="avatar">{tool.support.initials}</span>
                <div>
                  <strong>{tool.support.name}</strong>
                  <small>{tool.support.team}</small>
                </div>
              </div>
              <a href={`mailto:${tool.support.email}`}>
                <Icon name="mail" size={16} />
                {tool.support.email}
              </a>
            </aside>
          </div>
          {tool.notice && (
            <aside className={`tool-notice ${tool.notice.tone}`}>
              <strong>{tool.notice.title}</strong>
              <p>{tool.notice.message}</p>
            </aside>
          )}
          {tool.facts && tool.facts.length > 0 && (
            <dl className="tool-facts">
              {tool.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {pointed && versionUnavailable && (
            <p className="catalog-link-notice" role="status">
              The linked version is unavailable. Showing the default release,{" "}
              {selectedRelease.version}.
            </p>
          )}
          <div className="detail-actions">
            <label className="release-picker">
              <span>Version</span>
              <select
                aria-label={`Download version for ${tool.name}`}
                value={selectedRelease.version}
                onChange={(event) => {
                  setSelectedVersion(event.target.value);
                  onVersionChange(event.target.value);
                }}
              >
                {tool.releases.map((release) => (
                  <option key={release.version} value={release.version}>
                    {release.version}
                  </option>
                ))}
              </select>
            </label>
            {downloadTarget && (
              <a
                className="text-action"
                href={downloadTarget.href}
                target={downloadTarget.external ? "_blank" : undefined}
                rel={downloadTarget.external ? "noopener noreferrer" : undefined}
                download={downloadTarget.filename}
              >
                <Icon name="download" />
                Download {selectedRelease.version}
                {downloadTarget.external && <Icon name="external" size={15} />}
              </a>
            )}
            <button className="secondary-button" onClick={() => onDocs(selectedRelease.version)}>
              <Icon name="book" />
              View documentation
            </button>
            <button
              className={saved ? "secondary-button saved-tool" : "secondary-button"}
              aria-pressed={saved}
              onClick={onToggleSaved}
            >
              <Icon name="bookmark" />
              {saved ? "Saved" : "Save tool"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Updates({ tools, onViewAll }: { tools: Tool[]; onViewAll: () => void }) {
  return (
    <aside className="updates">
      <h2>Recent updates</h2>
      {getRecentUpdates(tools)
        .slice(0, 5)
        .map((tool) => (
          <div key={tool.id} className="update">
            <span />
            <div>
              <strong>
                {tool.name} {tool.releases[0].version}
              </strong>
              <small>{tool.updated}</small>
            </div>
          </div>
        ))}
      <button className="updates-link" onClick={onViewAll}>
        View all updates <Icon name="arrow" size={17} />
      </button>
    </aside>
  );
}
