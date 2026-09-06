import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { docs as staticDocs, tools as staticTools, type Platform, type Tool } from "./data";
import {
  catalogFiltersToSearch,
  defaultFilters,
  getCatalogTools,
  getDocumentationTools,
  type CatalogFilters,
} from "./catalog";
import { filterSavedToolIds, readSavedToolIds, writeSavedToolIds } from "./catalogStorage";
import { DocumentationPicker } from "./components/DocumentationPicker";
import { DeveloperStudio } from "./components/DeveloperStudio";
import { DeveloperLockGate } from "./components/DeveloperLockGate";
import { Field, Icon, PageHeader, PlatformMark, ToolGlyph, type IconName } from "./components/ui";
import { getGuideResourceTarget, getReleaseDownloadTarget } from "./downloads";
import { MarkdownDocument } from "./markdown";
import { catalogTargetFromSearch, resolveToolRelease, toolPageHref, type CatalogTarget } from "./toolLinks";

type Page = "catalog" | "documentation" | "updates" | "about" | "developer";

const appVersion = import.meta.env.VITE_APP_VERSION?.trim() || "1.5.0b";

const platforms: Array<"All platforms" | Platform> = [
  "All platforms",
  "Windows",
  "Linux",
  "macOS",
  "Web",
];
const lifecycles = ["All lifecycles", "Current", "New", "Legacy"];

function pageFromSearch(search: string): Page {
  const page = new URLSearchParams(search).get("page");
  return page === "documentation" || page === "updates" || page === "about" || page === "developer"
    ? page
    : "catalog";
}

function Sidebar({
  page,
  navigate,
  isOpen,
  close,
}: {
  page: Page;
  navigate: (page: Page) => void;
  isOpen: boolean;
  close: () => void;
}) {
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const links: Array<[Page, string, IconName]> = [
    ["catalog", "Catalog", "catalog"],
    ["documentation", "Documentation", "book"],
    ["updates", "Updates", "document"],
    ["about", "About", "info"],
  ];
  if (page === "developer") links.push(["developer", "Developer Studio", "catalog"]);
  return (
    <aside inert={compact && !isOpen} className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      <div className="brand">
        <Icon name="atlas" size={28} />
        <span>Tool Atlas</span>
      </div>
      <button
        className="mobile-close"
        onClick={close}
        aria-label="Close navigation"
      >
        <Icon name="close" />
      </button>
      <nav id="main-navigation" aria-label="Main navigation">
        {links.map(([id, label, icon]) => (
          <button
            key={id}
            className={page === id ? "nav-link active" : "nav-link"}
            onClick={() => {
              navigate(id);
              close();
            }}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function App() {
  const [page, setPage] = useState<Page>(() => pageFromSearch(window.location.search));
  const [menuOpen, setMenuOpen] = useState(false);
  const [routeSearch, setRouteSearch] = useState(() => window.location.search);
  const [routeRevision, setRouteRevision] = useState(0);
  const studioDirty = useRef(false);
  const studioSaving = useRef(false);
  const canLeaveStudio = () => !studioSaving.current && (!studioDirty.current || window.confirm("Discard unsaved changes?"));
  const [catalogTools, setCatalogTools] = useState<Tool[]>(staticTools);
  const [catalogDocs, setCatalogDocs] = useState<Record<string, string>>(staticDocs);
  const [devToken, setDevToken] = useState<string>(() => {
    try {
      return window.sessionStorage.getItem("tool-atlas-dev-token") || "";
    } catch {
      return "";
    }
  });
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState(() => {
    const tool = new URLSearchParams(window.location.search).get("tool");
    return tool && staticTools.some((t) => t.id === tool) ? tool : staticTools[0]?.id || "";
  });
  const initialPageRender = useRef(true);

  const refreshCatalog = async () => {
    try {
      const res = await fetch("/api/catalog");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tools) && data.tools.length > 0) {
          setCatalogTools(data.tools);
        }
        if (data.docs && typeof data.docs === "object") {
          setCatalogDocs(data.docs);
        }
      }
    } catch {
      // Offline or static fallback
    }
  };

  const verifyDeveloperToken = async (candidateToken: string) => {
    if (!candidateToken) return false;
    try {
      const res = await fetch("/api/developer/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: candidateToken }),
      });
      if (res.ok) {
        setDevToken(candidateToken);
        setIsDevAuthenticated(true);
        try {
          window.sessionStorage.setItem("tool-atlas-dev-token", candidateToken);
        } catch {
          // ignore
        }
        return true;
      }
    } catch {
      // ignore
    }
    setIsDevAuthenticated(false);
    try {
      window.sessionStorage.removeItem("tool-atlas-dev-token");
    } catch {
      // ignore
    }
    return false;
  };

  useEffect(() => {
    refreshCatalog();

    const url = new URL(window.location.href);
    if (url.searchParams.has("token")) {
      // Never authenticate from a query token. Scrub legacy links immediately
      // so the credential does not remain in subsequent history entries.
      url.searchParams.delete("token");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const tokenInUrl = new URLSearchParams(url.hash.slice(1)).get("token");
    if (tokenInUrl) {
      // Fragments are not sent in HTTP requests or Referer headers. Remove the
      // bootstrap token before making the verification request.
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      verifyDeveloperToken(tokenInUrl);
    } else if (devToken) {
      verifyDeveloperToken(devToken);
    }
  }, []);

  const navigate = (nextPage: Page, nextTool = selectedDoc, version?: string) => {
    if (nextPage === "developer" && page === "developer") return;
    if (nextPage !== "developer" && !canLeaveStudio()) return;
    studioDirty.current = false;
    const url = new URL(window.location.href);
    if (nextPage === "catalog") url.searchParams.delete("page");
    else url.searchParams.set("page", nextPage);

    if (nextPage === "documentation") url.searchParams.set("tool", nextTool);
    else url.searchParams.delete("tool");
    url.searchParams.delete("version");
    if (nextPage === "documentation" && version) url.searchParams.set("version", version);
    url.hash = "";

    window.history.pushState(null, "", `${url.pathname}${url.search}`);
    setPage(nextPage);
    setRouteSearch(url.search);
    setRouteRevision((revision) => revision + 1);
    if (nextPage === "documentation") setSelectedDoc(nextTool);
  };

  const openCatalogTool = (tool: Tool, version?: string) => {
    if (!canLeaveStudio()) return;
    const href = toolPageHref("catalog", tool.id, version);
    window.history.pushState(null, "", href);
    studioDirty.current = false;
    setRouteSearch(href);
    setRouteRevision((revision) => revision + 1);
    setPage("catalog");
  };

  const exitDeveloperStudio = () => {
    if (!canLeaveStudio()) return;
    studioDirty.current = false;
    setDevToken("");
    setIsDevAuthenticated(false);
    try {
      window.sessionStorage.removeItem("tool-atlas-dev-token");
    } catch {
      // ignore
    }
    navigate("catalog");
  };

  useEffect(() => {
    if (initialPageRender.current) {
      initialPageRender.current = false;
      return;
    }
    document.getElementById("page-title")?.focus();
  }, [page]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    const restoreRoute = () => {
      if (!canLeaveStudio()) {
        window.history.pushState(null, "", "?page=developer");
        return;
      }
      studioDirty.current = false;
      setRouteSearch(window.location.search);
      setRouteRevision((revision) => revision + 1);
      setPage(pageFromSearch(window.location.search));
      const toolInSearch = new URLSearchParams(window.location.search).get("tool");
      if (toolInSearch) setSelectedDoc(toolInSearch);
    };
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, []);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar
        page={page}
        navigate={navigate}
        isOpen={menuOpen}
        close={() => setMenuOpen(false)}
      />
      {menuOpen && (
        <button
          className="scrim"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main id="main-content">
        <button
          className="mobile-menu"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
        >
          <Icon name="menu" />
        </button>
        {page === "developer" && (isDevAuthenticated ? (
          <DeveloperStudio token={devToken} onExit={exitDeveloperStudio} onCatalogUpdated={refreshCatalog}
            onDraftStateChange={(dirty, saving) => { studioDirty.current = dirty; studioSaving.current = saving; }} />
        ) : <DeveloperLockGate onUnlock={verifyDeveloperToken} onBack={() => navigate("catalog")} />)}
        {page === "catalog" && (
          <Catalog
            key={`${routeRevision}:${routeSearch}`}
            search={routeSearch}
            tools={catalogTools}
            onDocs={(tool, version) => {
              navigate("documentation", tool.id, version);
            }}
            onUpdates={() => navigate("updates")}
          />
        )}
        {page === "documentation" && (
          <Documentation
            tools={catalogTools}
            docs={catalogDocs}
            requestedVersion={new URLSearchParams(routeSearch).get("version") || undefined}
            onCatalog={openCatalogTool}
            selected={selectedDoc}
            setSelected={(toolId) => navigate("documentation", toolId)}
          />
        )}
        {page === "updates" && (
          <UpdatesPage
            tools={catalogTools}
            onDocs={(tool) => navigate("documentation", tool.id)}
          />
        )}
        {page === "about" && <About />}
      </main>
    </div>
  );
}

function Catalog({
  search,
  tools,
  onDocs,
  onUpdates,
}: {
  tools: Tool[];
  search: string;
  onDocs: (tool: Tool, version: string) => void;
  onUpdates: () => void;
}) {
  const categories = useMemo(
    () => ["All categories", ...Array.from(new Set(tools.map((tool) => tool.category))).sort()],
    [tools],
  );
  const toolIds = useMemo(() => new Set(tools.map((tool) => tool.id)), [tools]);
  const initialLink = useMemo(() => catalogTargetFromSearch(search, tools), [search, tools]);
  const [target, setTarget] = useState<CatalogTarget | null>(initialLink.target);
  const [pointedTool, setPointedTool] = useState(initialLink.target?.toolId);
  const [filters, setFilters] = useState<CatalogFilters>(() =>
    initialLink.filters,
  );
  const [expanded, setExpanded] = useState<string | null>(initialLink.target?.toolId ?? null);
  // A local server may supply a newly added tool/release after the static bundle loads.
  useEffect(() => {
    if (!initialLink.target) return;
    setTarget(initialLink.target);
    setExpanded(initialLink.target.toolId);
    setPointedTool(initialLink.target.toolId);
    setFilters(initialLink.filters);
  }, [initialLink.target?.toolId, initialLink.target?.version]);
  const [savedToolIds, setSavedToolIds] = useState<string[]>(() => readSavedToolIds(toolIds));
  const [savedOnly, setSavedOnly] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">(
    "idle",
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => getCatalogTools(tools, filters), [tools, filters]);
  const savedToolIdSet = useMemo(() => new Set(savedToolIds), [savedToolIds]);
  const visibleTools = useMemo(
    () =>
      savedOnly
        ? filtered.filter((tool) => savedToolIdSet.has(tool.id))
        : filtered,
    [filtered, savedOnly, savedToolIdSet],
  );
  const updateFilter = <K extends keyof CatalogFilters>(
    key: K,
    value: CatalogFilters[K],
  ) => {
    setTarget(null);
    setPointedTool(undefined);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const clear = () => { setTarget(null); setPointedTool(undefined); setFilters(defaultFilters); };
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
    window.history.replaceState(
      null,
      "",
      `${current.pathname}${current.search}${current.hash}`,
    );
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
  };

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === "k"
      ) {
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
        title="Software catalog"
        copy="Find, compare, and support the tools your team relies on."
      />
      {initialLink.missingTool && <p className="catalog-link-notice" role="status">The linked tool is no longer in the catalog. Browse or search for another tool below.</p>}
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
            <kbd>⌘K</kbd>
          </label>
          <div className="filters" aria-label="Catalog filters">
            <Field label="Category">
              <select
                value={filters.category}
                onChange={(event) =>
                  updateFilter("category", event.target.value)
                }
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
                  updateFilter(
                    "platform",
                    event.target.value as "All platforms" | Platform,
                  )
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
                  updateFilter(
                    "lifecycle",
                    event.target.value as CatalogFilters["lifecycle"],
                  )
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
                className={
                  savedOnly ? "toolbar-button active" : "toolbar-button"
                }
                aria-pressed={savedOnly}
                onClick={() => { setTarget(null); setPointedTool(undefined); setSavedOnly((current) => !current); }}
              >
                <Icon name="bookmark" size={16} />
                {savedOnly
                  ? "All tools"
                  : `Saved tools (${savedToolIds.length})`}
              </button>
              <button className="toolbar-button" onClick={copyViewLink}>
                <Icon
                  name={copyState === "copied" ? "check" : "link"}
                  size={16}
                />
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
                  onChange={(event) =>
                    updateFilter(
                      "sort",
                      event.target.value as CatalogFilters["sort"],
                    )
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
                initialVersion={initialLink.target?.toolId === tool.id ? initialLink.target.version : undefined}
                pointed={pointedTool === tool.id}
                versionUnavailable={initialLink.unavailableVersion && initialLink.target?.toolId === tool.id}
                toggle={(version) => {
                  const next = expanded === tool.id ? null : tool.id;
                  setExpanded(next);
                  setPointedTool(undefined);
                  setTarget(next ? { toolId: next, version } : null);
                }}
                onVersionChange={(version) => { setPointedTool(undefined); setTarget({ toolId: tool.id, version }); }}
                onDocs={(version) => onDocs(tool, version)}
                saved={savedToolIdSet.has(tool.id)}
                onToggleSaved={() => toggleSaved(tool.id)}
              />
            ))}
            {visibleTools.length === 0 && (
              <div className="empty-state">
                <Icon name={savedOnly ? "bookmark" : "search"} size={28} />
                <h2>
                  {savedOnly
                    ? "No saved tools in this view"
                    : "No tools match those filters"}
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
  useEffect(() => { if (initialVersion) setSelectedVersion(initialVersion); }, [initialVersion]);
  const selectedRelease = resolveToolRelease(tool, selectedVersion);
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
          <span className={`lifecycle ${tool.lifecycle.toLowerCase()}`}>
            {tool.lifecycle}
          </span>
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
              {pointed && versionUnavailable && <p className="catalog-link-notice" role="status">The linked version is unavailable. Showing the default release, {selectedRelease.version}.</p>}
              <div className="detail-actions">
                <label className="release-picker">
                  <span>Version</span>
                  <select
                    aria-label={`Download version for ${tool.name}`}
                    value={selectedRelease.version}
                    onChange={(event) => { setSelectedVersion(event.target.value); onVersionChange(event.target.value); }}
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
                  className={
                    saved ? "secondary-button saved-tool" : "secondary-button"
                  }
                  aria-pressed={saved}
                  onClick={onToggleSaved}
                >
                  <Icon name="bookmark" />
                  {saved ? "Saved" : "Save tool"}
                </button>
              </div>
            </div>
          </div>
          <div className="details-support">
            <span>Support owner</span>
            <div className="support-owner">
              <span className="avatar large">{tool.support.initials}</span>
              <div>
                <strong>{tool.support.name}</strong>
                <small>{tool.support.team}</small>
              </div>
            </div>
            <a href={`mailto:${tool.support.email}`}>
              <Icon name="mail" size={16} />
              {tool.support.email}
            </a>
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
      {tools.slice(0, 5).map((tool) => (
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

function UpdatesPage({ tools, onDocs }: { tools: Tool[]; onDocs: (tool: Tool) => void }) {
  return (
    <section className="page updates-page">
      <PageHeader
        title="Recent updates"
        copy="The latest approved software releases and catalog changes."
      />
      <div className="updates-list" aria-label="Recent catalog updates">
        {tools.map((tool) => (
          <article className="update-card" key={tool.id}>
            <ToolGlyph tool={tool} />
            <div>
              <span className="update-kind">CATALOG UPDATE</span>
              <h2>{tool.name} {tool.releases[0].version}</h2>
              <p>
                The approved release and catalog entry were updated {tool.updated.toLocaleLowerCase()}.
              </p>
              {tool.notice && (
                <p className={`update-notice ${tool.notice.tone}`}>
                  <strong>{tool.notice.title}.</strong> {tool.notice.message}
                </p>
              )}
              <button className="text-action" onClick={() => onDocs(tool)}>
                View documentation <Icon name="arrow" size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Documentation({
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

function About() {
  return (
    <section className="page about-page">
      <PageHeader
        title="A shared map for your software"
        copy="Tool Atlas helps developers find the right software, get a trusted download path, and know who can help."
      />
      <div className="about-grid">
        <article className="about-lead">
          <h2>Less hunting. More building.</h2>
          <p>
            Our Developer Enablement division keeps the software landscape
            understandable: which tools are approved, where they fit, and how to
            get unstuck.
          </p>
          <p>
            This catalog is the front door. It connects practical documentation,
            standard configurations, and real people who support the tools your
            teams use.
          </p>
          <a href="mailto:devex@atlas.local" className="primary-button">
            Talk to Developer Enablement <Icon name="arrow" />
          </a>
        </article>
        <div className="about-points">
          <article>
            <span className="point-number">01</span>
            <h3>Find the right tool</h3>
            <p>
              Compare categories, platforms, lifecycle status, and ownership
              before you install.
            </p>
          </article>
          <article>
            <span className="point-number">02</span>
            <h3>Start with confidence</h3>
            <p>Use trusted download paths and short, maintained setup notes.</p>
          </article>
          <article>
            <span className="point-number">03</span>
            <h3>Get the right help</h3>
            <p>
              Every catalog entry makes its support boundary and owner visible.
            </p>
          </article>
        </div>
      </div>
      <section className="principles">
        <h2>How we maintain the catalog</h2>
        <div>
          <article>
            <h3>Useful over exhaustive</h3>
            <p>
              We lead with supported software, then make lifecycle status clear
              when a legacy tool remains necessary.
            </p>
          </article>
          <article>
            <h3>Ownership is explicit</h3>
            <p>
              A product listing includes the team responsible for the
              platform—not an anonymous help desk.
            </p>
          </article>
          <article>
            <h3>Documentation is practical</h3>
            <p>
              Guides answer the immediate question: install, configure, use
              safely, and request help.
            </p>
          </article>
        </div>
      </section>
      <p className="about-version"><small>Version {appVersion}</small></p>
    </section>
  );
}

export default App;
