import type { RefObject } from "react";
import { Icon, type IconName } from "../components/ui";
import type { Theme } from "../theme";
import type { Page } from "./routes";

export function Sidebar({
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
    ["agents", "Agent Catalog", "agents"],
    ["catalog", "Software Catalog", "catalog"],
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
          navigate("agents");
          close();
        }}
      >
        <img src="/logo.svg" width={32} height={32} alt="" />
        <span>Tool Atlas</span>
      </button>
      <button type="button" className="mobile-close" onClick={close} aria-label="Close navigation">
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
          title={
            collapsed
              ? theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
              : undefined
          }
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
