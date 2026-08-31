import type { Tool } from "../data";
import { Icon, ToolGlyph } from "./ui";

type DocumentationPickerProps = {
  allToolsCount: number;
  matchingTools: Tool[];
  query: string;
  selectedId: string;
  onQueryChange: (query: string) => void;
  onSelect: (toolId: string) => void;
};

/** Searchable, scrollable guide library designed for catalogs with dozens of tools. */
export function DocumentationPicker({
  allToolsCount,
  matchingTools,
  query,
  selectedId,
  onQueryChange,
  onSelect,
}: DocumentationPickerProps) {
  return (
    <aside className="docs-index" aria-label="Documentation library">
      <div className="docs-index-heading">
        <span>TOOL GUIDES</span>
        <strong>{allToolsCount} documented tools</strong>
      </div>
      <div className="docs-search">
        <Icon name="search" size={17} />
        <label className="sr-only" htmlFor="documentation-search">
          Search documentation
        </label>
        <input
          id="documentation-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search tool, vendor, owner, or tag…"
          autoComplete="off"
        />
        {query && (
          <button
            className="docs-search-clear"
            type="button"
            aria-label="Clear documentation search"
            onClick={() => onQueryChange("")}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      <p className="docs-result-count" role="status" aria-live="polite">
        {matchingTools.length} {matchingTools.length === 1 ? "guide" : "guides"}
      </p>
      <nav className="docs-tool-list" aria-label="Choose a tool guide">
        {matchingTools.map((tool) => (
          <button
            key={tool.id}
            className={selectedId === tool.id ? "doc-tool-option active" : "doc-tool-option"}
            onClick={() => onSelect(tool.id)}
            aria-current={selectedId === tool.id ? "page" : undefined}
          >
            <ToolGlyph tool={tool} />
            <span>
              <strong>{tool.name}</strong>
              <small>{tool.company} · {tool.category}</small>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        ))}
        {matchingTools.length === 0 && (
          <div className="docs-empty">
            <Icon name="search" size={20} />
            <strong>No guides found</strong>
            <span>Try a different tool, vendor, category, or tag.</span>
          </div>
        )}
      </nav>
    </aside>
  );
}
