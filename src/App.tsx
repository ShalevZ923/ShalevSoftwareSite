import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { docs, getToolById, tools, type Platform, type Tool } from "./data";
import {
  catalogFiltersFromSearch,
  catalogFiltersToSearch,
  defaultFilters,
  getCatalogTools,
  getDocumentationTools,
  type CatalogFilters,
} from "./catalog";
import { readSavedToolIds, writeSavedToolIds } from "./catalogStorage";
import { DocumentationPicker } from "./components/DocumentationPicker";
import { Field, Icon, PageHeader, PlatformMark, ToolGlyph, type IconName } from "./components/ui";
import { getReleaseDownloadTarget } from "./downloads";
import { MarkdownDocument } from "./markdown";

type Page = "catalog" | "documentation" | "updates" | "about";

const categories = [
  "All categories",
  ...Array.from(new Set(tools.map((tool) => tool.category))).sort(),
];
const platforms: Array<"All platforms" | Platform> = [
  "All platforms",
  "Windows",
  "Linux",
  "macOS",
  "Web",
];
const lifecycles = ["All lifecycles", "Current", "New", "Legacy"];
const toolIds = new Set(tools.map((tool) => tool.id));

function pageFromSearch(search: string): Page {
  const page = new URLSearchParams(search).get("page");
  return page === "documentation" || page === "updates" || page === "about"
    ? page
    : "catalog";
}

function selectedToolFromSearch(search: string) {
  const tool = new URLSearchParams(search).get("tool");
  return tool && toolIds.has(tool) ? tool : tools[0].id;
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
  const links: Array<[Page, string, IconName]> = [
    ["catalog", "Catalog", "catalog"],
    ["documentation", "Documentation", "book"],
    ["updates", "Updates", "document"],
    ["about", "About", "info"],
  ];
  return (
    <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
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
      <div className="sidebar-footer">
        <span className="avatar">JD</span>
        <div>
          <strong>Jane Developer</strong>
          <small>Platform Team</small>
        </div>
        <Icon name="chevron" size={16} />
      </div>
    </aside>
  );
}

function App() {
  const [page, setPage] = useState<Page>(() => pageFromSearch(window.location.search));
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(() => selectedToolFromSearch(window.location.search));
  const initialPageRender = useRef(true);

  const navigate = (nextPage: Page, nextTool = selectedDoc) => {
    const url = new URL(window.location.href);
    if (nextPage === "catalog") url.searchParams.delete("page");
    else url.searchParams.set("page", nextPage);

    if (nextPage === "documentation") url.searchParams.set("tool", nextTool);
    else url.searchParams.delete("tool");

    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setPage(nextPage);
    if (nextPage === "documentation") setSelectedDoc(nextTool);
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
      setPage(pageFromSearch(window.location.search));
      setSelectedDoc(selectedToolFromSearch(window.location.search));
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
        {page === "catalog" && (
          <Catalog
            onDocs={(tool) => {
              navigate("documentation", tool.id);
            }}
            onUpdates={() => navigate("updates")}
          />
        )}
        {page === "documentation" && (
          <Documentation
            selected={selectedDoc}
            setSelected={(toolId) => navigate("documentation", toolId)}
          />
        )}
        {page === "updates" && <UpdatesPage onDocs={(tool) => navigate("documentation", tool.id)} />}
        {page === "about" && <About />}
      </main>
    </div>
  );
}

function Catalog({ onDocs, onUpdates }: { onDocs: (tool: Tool) => void; onUpdates: () => void }) {
  const [filters, setFilters] = useState<CatalogFilters>(() =>
    catalogFiltersFromSearch(window.location.search, categories),
  );
  const [expanded, setExpanded] = useState<string | null>("intellij");
  const [savedToolIds, setSavedToolIds] = useState<string[]>(() => readSavedToolIds(toolIds));
  const [savedOnly, setSavedOnly] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">(
    "idle",
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => getCatalogTools(tools, filters), [filters]);
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
  ) => setFilters((current) => ({ ...current, [key]: value }));
  const clear = () => setFilters(defaultFilters);
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
    current.search = catalogFiltersToSearch(filters);
    window.history.replaceState(
      null,
      "",
      `${current.pathname}${current.search}${current.hash}`,
    );
  }, [filters]);

  useEffect(() => {
    writeSavedToolIds(savedToolIds);
  }, [savedToolIds]);

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
                onClick={() => setSavedOnly((current) => !current)}
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
                toggle={() =>
                  setExpanded(expanded === tool.id ? null : tool.id)
                }
                onDocs={() => onDocs(tool)}
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
        <Updates onViewAll={onUpdates} />
      </div>
    </section>
  );
}

function ToolRow({
  tool,
  expanded,
  toggle,
  onDocs,
  saved,
  onToggleSaved,
}: {
  tool: Tool;
  expanded: boolean;
  toggle: () => void;
  onDocs: () => void;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const [selectedVersion, setSelectedVersion] = useState(
    () => tool.releases[0].version,
  );
  const selectedRelease =
    tool.releases.find((release) => release.version === selectedVersion) ??
    tool.releases[0];
  const downloadTarget = getReleaseDownloadTarget(selectedRelease);

  return (
    <article
      className={`tool-row ${expanded ? "expanded" : ""}`}
      role="listitem"
    >
      <button
        className="tool-summary"
        onClick={toggle}
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
              <div className="detail-actions">
                <label className="release-picker">
                  <span>Version</span>
                  <select
                    aria-label={`Download version for ${tool.name}`}
                    value={selectedRelease.version}
                    onChange={(event) => setSelectedVersion(event.target.value)}
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
                <button className="secondary-button" onClick={onDocs}>
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

function Updates({ onViewAll }: { onViewAll: () => void }) {
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

function UpdatesPage({ onDocs }: { onDocs: (tool: Tool) => void }) {
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
  selected,
  setSelected,
}: {
  selected: string;
  setSelected: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const matchingTools = useMemo(
    () => getDocumentationTools(tools, deferredQuery),
    [deferredQuery],
  );
  const tool = getToolById(selected) ?? tools[0];
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
            Showing documentation for {tool.name}
          </p>
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
            </div>
          </div>
          <MarkdownDocument content={docs[selected]} />
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
    </section>
  );
}

export default App;
