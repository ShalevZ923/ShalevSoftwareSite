import { lazy, Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { docs as staticDocs, tools as staticTools, type Platform, type Tool } from "./data";
import {
  catalogFiltersToSearch,
  defaultFilters,
  getCatalogTools,
  getRecentUpdates,
  type CatalogFilters,
} from "./catalog";
import { armCopyFeedbackTimer, copyLinkAnnouncement, copyLinkLabel, searchShortcutHint } from "./catalogChrome";
import { filterSavedToolIds, readSavedToolIds, writeSavedToolIds } from "./catalogStorage";
import { Field, Icon, PageHeader, PlatformMark, ToolGlyph, type IconName } from "./components/ui";
import { getReleaseDownloadTarget } from "./downloads";
import { focusableElements, wrapTabTarget } from "./focusTrap";
import { applyTheme, readStoredTheme, resolveTheme, systemTheme, writeTheme, type Theme } from "./theme";
import { catalogTargetFromSearch, resolveToolRelease, toolPageHref, type CatalogTarget } from "./toolLinks";

const About = lazy(async () => {
  const module = await import("./components/About");
  return { default: module.About };
});
const UpdatesPage = lazy(async () => {
  const module = await import("./components/UpdatesPage");
  return { default: module.UpdatesPage };
});
const DeveloperStudio = lazy(async () => {
  const module = await import("./components/DeveloperStudio");
  return { default: module.DeveloperStudio };
});
const DeveloperLockGate = lazy(async () => {
  const module = await import("./components/DeveloperLockGate");
  return { default: module.DeveloperLockGate };
});
const DocumentationPage = lazy(async () => {
  const module = await import("./components/DocumentationPage");
  return { default: module.DocumentationPage };
});

function PageFallback() {
  return (
    <p className="page-loading" role="status">
      Loading page…
    </p>
  );
}

type Page = "catalog" | "documentation" | "updates" | "about" | "developer";

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
  collapsed,
  onToggleCollapsed,
  theme,
  onToggleTheme,
  sidebarRef,
  compact,
}: {
  page: Page;
  navigate: (page: Page) => void;
  isOpen: boolean;
  close: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  sidebarRef: RefObject<HTMLElement | null>;
  compact: boolean;
}) {
  const links: Array<[Page, string, IconName]> = [
    ["catalog", "Catalog", "catalog"],
    ["documentation", "Documentation", "book"],
    ["updates", "Updates", "updates"],
    ["about", "About", "info"],
  ];
  if (page === "developer") links.push(["developer", "Developer Studio", "catalog"]);
  const drawerOpen = compact && isOpen;
  return (
    <aside
      id="site-menu"
      ref={sidebarRef}
      inert={compact && !isOpen}
      role={drawerOpen ? "dialog" : undefined}
      aria-modal={drawerOpen ? true : undefined}
      aria-label={drawerOpen ? "Site menu" : undefined}
      className={`sidebar${isOpen ? " sidebar-open" : ""}${collapsed ? " sidebar-collapsed" : ""}`}
    >
      <button
        type="button"
        className="brand"
        aria-label="Tool Atlas home"
        onClick={() => {
          navigate("catalog");
          close();
        }}
      >
        <img src="/logo.svg" width={32} height={32} alt="" />
        <span>Tool Atlas</span>
      </button>
      <button
        type="button"
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
            type="button"
            className={page === id ? "nav-link active" : "nav-link"}
            aria-label={label}
            aria-current={page === id ? "page" : undefined}
            title={collapsed ? label : undefined}
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
      <div className="sidebar-foot">
        <button
          type="button"
          className="theme-toggle"
          aria-pressed={theme === "dark"}
          aria-label={theme === "dark" ? "Dark mode" : "Light mode"}
          title={collapsed ? (theme === "dark" ? "Switch to light mode" : "Switch to dark mode") : undefined}
          onClick={onToggleTheme}
        >
          <Icon name={theme === "dark" ? "moon" : "sun"} />
          <span>{theme === "dark" ? "Dark" : "Light"}</span>
        </button>
        <button
          type="button"
          className="sidebar-toggle"
          aria-pressed={collapsed}
          aria-controls="main-navigation"
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={onToggleCollapsed}
        >
          <Icon name="chevron" />
          <span>{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>
    </aside>
  );
}

function App() {
  const [page, setPage] = useState<Page>(() => pageFromSearch(window.location.search));
  const [menuOpen, setMenuOpen] = useState(false);
  const [compactNav, setCompactNav] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerOpen = compactNav && menuOpen;
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("tool-atlas-nav-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggleNavCollapsed = () => {
    setNavCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("tool-atlas-nav-collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(readStoredTheme(), systemTheme()));
  const [themeFollowsSystem, setThemeFollowsSystem] = useState(() => readStoredTheme() === null);
  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      writeTheme(next);
      return next;
    });
    setThemeFollowsSystem(false);
  };
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (!themeFollowsSystem) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [themeFollowsSystem]);
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
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => {
      setCompactNav(media.matches);
      if (!media.matches) setMenuOpen(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (initialPageRender.current) {
      initialPageRender.current = false;
      return;
    }
    const main = document.getElementById("main-content");
    if (!main) return;
    let focused = false;
    const focusTitle = () => {
      if (focused) return;
      const title = main.querySelector<HTMLElement>("#page-title");
      if (!title) return;
      title.focus();
      focused = true;
    };
    focusTitle();
    if (focused) return;
    const observer = new MutationObserver(() => {
      focusTitle();
      if (focused) observer.disconnect();
    });
    observer.observe(main, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => observer.disconnect(), 4000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [page]);

  useEffect(() => {
    if (!drawerOpen) return;
    const sidebar = sidebarRef.current;
    const previouslyFocused = document.activeElement;
    const closeButton = sidebar?.querySelector<HTMLElement>(".mobile-close");
    const focusable = sidebar ? focusableElements(sidebar) : [];
    (closeButton ?? focusable[0])?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (!sidebar) return;
      const wrapTo = wrapTabTarget(event.key, event.shiftKey, document.activeElement, focusableElements(sidebar));
      if (wrapTo instanceof HTMLElement) {
        event.preventDefault();
        wrapTo.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      else menuButtonRef.current?.focus();
    };
  }, [drawerOpen]);

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
    <div className={`app-shell${navCollapsed ? " app-shell-nav-collapsed" : ""}`} data-page={page}>
      <a className="skip-link" href="#main-content" inert={drawerOpen}>
        Skip to main content
      </a>
      <Sidebar
        page={page}
        navigate={navigate}
        isOpen={menuOpen}
        close={() => setMenuOpen(false)}
        collapsed={navCollapsed}
        onToggleCollapsed={toggleNavCollapsed}
        theme={theme}
        onToggleTheme={toggleTheme}
        sidebarRef={sidebarRef}
        compact={compactNav}
      />
      {menuOpen && (
        <button
          className="scrim"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main id="main-content" inert={drawerOpen}>
        <button
          ref={menuButtonRef}
          type="button"
          className="mobile-menu"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
        >
          <Icon name="menu" />
        </button>
        {page === "developer" && (
          <Suspense fallback={<PageFallback />}>
            {isDevAuthenticated ? (
              <DeveloperStudio token={devToken} onExit={exitDeveloperStudio} onCatalogUpdated={refreshCatalog}
                onDraftStateChange={(dirty, saving) => { studioDirty.current = dirty; studioSaving.current = saving; }} />
            ) : <DeveloperLockGate onUnlock={verifyDeveloperToken} onBack={() => navigate("catalog")} />}
          </Suspense>
        )}
        {page === "catalog" && (
          <Catalog
            key={`${routeRevision}:${routeSearch}`}
            search={routeSearch}
            tools={catalogTools}
            onDocs={(tool, version) => {
              navigate("documentation", tool.id, version);
            }}
            onUpdates={() => navigate("updates")}
            hotkeysEnabled={!drawerOpen}
          />
        )}
        {page === "documentation" && (
          <Suspense fallback={<PageFallback />}>
            <DocumentationPage
              tools={catalogTools}
              docs={catalogDocs}
              requestedVersion={new URLSearchParams(routeSearch).get("version") || undefined}
              onCatalog={openCatalogTool}
              selected={selectedDoc}
              setSelected={(toolId) => navigate("documentation", toolId)}
            />
          </Suspense>
        )}
        {page === "updates" && (
          <Suspense fallback={<PageFallback />}>
            <UpdatesPage
              tools={catalogTools}
              onCatalog={openCatalogTool}
              onDocs={(tool) => navigate("documentation", tool.id)}
            />
          </Suspense>
        )}
        {page === "about" && (
          <Suspense fallback={<PageFallback />}>
            <About onOpenCatalog={() => navigate("catalog")} />
          </Suspense>
        )}
      </main>
    </div>
  );
}

function Catalog({
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
  const copyTimerRef = useRef<number | undefined>(undefined);
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
  }, [hotkeysEnabled]);
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
            <kbd aria-label={`Search shortcut ${searchShortcutHint(navigator.userAgent, navigator.platform)}`}>
              {searchShortcutHint(navigator.userAgent, navigator.platform)}
            </kbd>
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
              <button type="button" className="toolbar-button" onClick={copyViewLink}>
                <Icon
                  name={copyState === "copied" ? "check" : "link"}
                  size={16}
                />
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
      )}
    </article>
  );
}

function Updates({ tools, onViewAll }: { tools: Tool[]; onViewAll: () => void }) {
  return (
    <aside className="updates">
      <h2>Recent updates</h2>
      {getRecentUpdates(tools).slice(0, 5).map((tool) => (
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

export default App;
