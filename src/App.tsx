import { decodeCatalog } from "./contracts";
import { Sidebar } from "./app/Sidebar";
import { pageFromSearch, type Page } from "./app/routes";
import { SoftwareCatalog as Catalog } from "./features/software/SoftwareCatalog";
import {
  useCallback,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { docs as staticDocs, tools as staticTools, type Platform, type Tool } from "./data";
import { agents as staticAgents, type AgentPackage } from "./agents";
import {
  catalogFiltersToSearch,
  defaultFilters,
  getCatalogTools,
  getRecentUpdates,
  type CatalogFilters,
} from "./catalog";
import {
  armCopyFeedbackTimer,
  copyLinkAnnouncement,
  copyLinkLabel,
  searchShortcutHint,
} from "./catalogChrome";
import { filterSavedToolIds, readSavedToolIds, writeSavedToolIds } from "./catalogStorage";
import { Field, Icon, PageHeader, PlatformMark, ToolGlyph, type IconName } from "./components/ui";
import { getReleaseDownloadTarget } from "./downloads";
import { focusableElements, wrapTabTarget } from "./focusTrap";
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  systemTheme,
  writeTheme,
  type Theme,
} from "./theme";
import {
  catalogTargetFromSearch,
  resolveToolRelease,
  toolPageHref,
  type CatalogTarget,
} from "./toolLinks";

import { agentPageHref } from "./agentLinks";

const AgentCatalog = lazy(async () => {
  const module = await import("./components/AgentCatalog");
  return { default: module.AgentCatalog };
});
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

function App() {
  const [page, setPage] = useState<Page>(() => pageFromSearch(window.location.search));
  const [menuOpen, setMenuOpen] = useState(false);
  const [compactNav, setCompactNav] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
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
    document.title =
      page === "agents"
        ? "Tool Atlas — Agent Catalog"
        : page === "catalog"
          ? "Tool Atlas — Software Catalog"
          : "Tool Atlas";
  }, [page]);
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
  const canLeaveStudio = () =>
    !studioSaving.current && (!studioDirty.current || window.confirm("Discard unsaved changes?"));
  const [catalogTools, setCatalogTools] = useState<Tool[]>(staticTools);
  const [catalogDocs, setCatalogDocs] = useState<Record<string, string>>(staticDocs);
  const [agentPackages, setAgentPackages] = useState<AgentPackage[]>(staticAgents);
  const [agentFeedStatus, setAgentFeedStatus] = useState<"loading" | "live" | "static">("loading");
  const [agentCatalogRevision, setAgentCatalogRevision] = useState(0);
  const [devToken, setDevToken] = useState<string>(() => {
    try {
      return window.sessionStorage.getItem("tool-atlas-dev-token") || "";
    } catch {
      return "";
    }
  });
  const initialDevToken = useRef(devToken);
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState(() => {
    const tool = new URLSearchParams(window.location.search).get("tool");
    return tool && staticTools.some((t) => t.id === tool) ? tool : staticTools[0]?.id || "";
  });
  const initialPageRender = useRef(true);

  const refreshSoftware = useCallback(async (required = false) => {
    try {
      const res = await fetch("/api/catalog");
      if (required && !res.ok)
        throw new Error("Saved, but catalog refresh failed. Reload the page to retry.");
      if (res.ok) {
        const data = decodeCatalog(await res.json());
        if (Array.isArray(data.tools) && data.tools.length > 0) {
          setCatalogTools(data.tools);
        }
        if (data.docs && typeof data.docs === "object") {
          setCatalogDocs(data.docs);
        }
      }
    } catch (error) {
      if (required) throw error;
      // Offline or static fallback
    }
  }, []);
  const refreshCatalog = useCallback(
    async (required = false) => {
      await Promise.all([
        refreshSoftware(required),
        (async () => {
          try {
            const res = await fetch("/api/agents");
            if (!res.ok) throw new Error("Live catalog unavailable");
            const data: AgentPackage[] = await res.json();
            if (!Array.isArray(data)) throw new Error("Invalid live catalog");
            setAgentPackages(data);
            setAgentFeedStatus("live");
            setAgentCatalogRevision((value) => value + 1);
          } catch {
            setAgentFeedStatus((status) => (status === "loading" ? "static" : status));
          }
        })(),
      ]);
    },
    [refreshSoftware],
  );

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
    } else if (initialDevToken.current) {
      verifyDeveloperToken(initialDevToken.current);
    }
  }, [refreshCatalog]);

  const navigate = (nextPage: Page, nextTool = selectedDoc, version?: string) => {
    if (nextPage === "developer" && page === "developer") return;
    if (nextPage !== "developer" && !canLeaveStudio()) return;
    studioDirty.current = false;
    const url = new URL(window.location.href);
    if (nextPage === "agents") url.searchParams.delete("page");
    else url.searchParams.set("page", nextPage);
    if (page === "agents" && nextPage !== "agents") {
      for (const key of [
        "agent",
        "saved",
        "type",
        "p",
        "capability",
        "publisher",
        "risk",
        "status",
        "query",
        "sort",
      ]) {
        url.searchParams.delete(key);
      }
    }

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

  const openAgent = (agentId: string) => {
    if (!canLeaveStudio()) return;
    const href = agentPageHref(agentId);
    window.history.pushState(null, "", href);
    studioDirty.current = false;
    setRouteSearch(href);
    setRouteRevision((revision) => revision + 1);
    setPage("agents");
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
    const menuButton = menuButtonRef.current;
    const closeButton = sidebar?.querySelector<HTMLElement>(".mobile-close");
    const focusable = sidebar ? focusableElements(sidebar) : [];
    (closeButton ?? focusable[0])?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (!sidebar) return;
      const wrapTo = wrapTabTarget(
        event.key,
        event.shiftKey,
        document.activeElement,
        focusableElements(sidebar),
      );
      if (wrapTo instanceof HTMLElement) {
        event.preventDefault();
        wrapTo.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      else menuButton?.focus();
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
              <DeveloperStudio
                token={devToken}
                onExit={exitDeveloperStudio}
                onCatalogUpdated={() => refreshCatalog(true)}
                onDraftStateChange={(dirty, saving) => {
                  studioDirty.current = dirty;
                  studioSaving.current = saving;
                }}
              />
            ) : (
              <DeveloperLockGate
                onUnlock={verifyDeveloperToken}
                onBack={() => navigate("catalog")}
              />
            )}
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
        {page === "agents" && (
          <Suspense fallback={<PageFallback />}>
            <AgentCatalog
              key={`agents:${routeRevision}:${routeSearch}`}
              search={routeSearch}
              agents={agentPackages}
              feedStatus={agentFeedStatus}
              catalogRevision={agentCatalogRevision}
              hotkeysEnabled={!drawerOpen}
            />
          </Suspense>
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
              agents={agentPackages}
              onCatalog={openCatalogTool}
              onAgent={openAgent}
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

export default App;
