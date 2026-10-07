import { useMemo, useState } from "react";
import type { AgentPackage } from "../agentTypes";
import { formatAgentDate, supportLabels } from "../agentCatalog";
import {
  catalogUpdateKind,
  catalogUpdateKindLabel,
  getRecentUpdates,
  type CatalogUpdateKind,
} from "../catalog";
import type { Tool } from "../data";
import { Icon, PageHeader, ToolGlyph } from "./ui";

const kindFilters: Array<{ id: "all" | CatalogUpdateKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "release", label: "Releases" },
  { id: "notice", label: "Notices" },
  { id: "update", label: "Other" },
];

function updateSummary(tool: Tool): string {
  const kind = catalogUpdateKind(tool);
  const version = tool.releases[0]?.version;
  if (kind === "new") return `${tool.name} is now an approved listing. ${tool.description}`;
  if (kind === "release") return `${version} is the current approved download. ${tool.description}`;
  return tool.description;
}

export function UpdatesPage({
  tools,
  agents,
  onCatalog,
  onAgent,
  onDocs,
}: {
  tools: Tool[];
  agents: AgentPackage[];
  onCatalog: (tool: Tool) => void;
  onAgent: (agentId: string) => void;
  onDocs: (tool: Tool) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof kindFilters)[number]["id"]>("all");
  const ranked = useMemo(() => getRecentUpdates(tools), [tools]);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return ranked.filter((tool) => {
      if (kind !== "all" && catalogUpdateKind(tool) !== kind) return false;
      if (!needle) return true;
      return [
        tool.name,
        tool.company,
        tool.category,
        tool.support.name,
        tool.support.team,
        ...tool.tags,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [kind, query, ranked]);
  const groups = useMemo(() => {
    const next: Array<{ label: string; tools: Tool[] }> = [];
    for (const tool of visible) {
      const last = next.at(-1);
      if (last && last.label === tool.updated) last.tools.push(tool);
      else next.push({ label: tool.updated, tools: [tool] });
    }
    return next;
  }, [visible]);
  const agentUpdates = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...agents]
      .filter((agent) => !needle || [agent.name, agent.publisher, agent.packageType, agent.description, ...agent.tags].join(" ").toLocaleLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));
  }, [agents, query]);

  return (
    <section className="page updates-page">
      <PageHeader
        title="Recent updates"
        copy="Approved releases and catalog changes, newest first."
      />
      <div className="updates-toolbar">
        <p className="updates-count">{visible.length} {visible.length === 1 ? "change" : "changes"}</p>
        <div className="updates-kinds" role="group" aria-label="Update type">
          {kindFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={kind === filter.id}
              className={kind === filter.id ? "updates-kind active" : "updates-kind"}
              onClick={() => setKind(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      <label className="search-box updates-search">
        <Icon name="search" />
        <input
          aria-label="Search updates"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by tool, vendor, or owner…"
        />
      </label>
      {visible.length === 0 ? (
        <div className="empty-state">
          <Icon name="updates" size={28} />
          <h2>No matching updates</h2>
          <p>Try another search or show all catalog changes.</p>
          <button type="button" className="primary-button" onClick={() => { setQuery(""); setKind("all"); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="updates-list" aria-label="Recent catalog updates">
          {groups.map((group) => (
            <section key={group.label} className="updates-group" aria-labelledby={`updates-${group.label.replace(/\s+/g, "-").toLowerCase()}`}>
              <h2 id={`updates-${group.label.replace(/\s+/g, "-").toLowerCase()}`}>{group.label}</h2>
              {group.tools.map((tool) => {
                const updateKind = catalogUpdateKind(tool);
                return (
                  <article className="update-card" key={tool.id}>
                    <ToolGlyph tool={tool} />
                    <div>
                      <div className="update-card-head">
                        <span className="update-kind">{catalogUpdateKindLabel[updateKind]}</span>
                        <span className={`lifecycle ${tool.lifecycle.toLowerCase()}`}>{tool.lifecycle}</span>
                      </div>
                      <h3>{tool.name} {tool.releases[0].version}</h3>
                      <p>{updateSummary(tool)}</p>
                      {tool.notice && (
                        <p className={`update-notice ${tool.notice.tone}`}>
                          <strong>{tool.notice.title}.</strong> {tool.notice.message}
                        </p>
                      )}
                      <p className="update-card-meta">
                        {tool.category} · {tool.support.team}
                      </p>
                      <div className="update-card-actions">
                        <button type="button" className="text-action" onClick={() => onCatalog(tool)}>
                          <Icon name="catalog" size={15} /> View in catalog
                        </button>
                        <button type="button" className="text-action" onClick={() => onDocs(tool)}>
                          <Icon name="book" size={15} /> View documentation
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
      {agentUpdates.length > 0 && (
        <section className="updates-group" aria-labelledby="agent-catalog-updates">
          <h2 id="agent-catalog-updates">Agent catalog</h2>
          <p>Experimental listings for evaluation. These are not approved software releases.</p>
          {agentUpdates.map((agent) => (
            <article className="update-card" key={agent.id}>
              <ToolGlyph tool={agent} />
              <div>
                <div className="update-card-head">
                  <span className="update-kind">{agent.packageType}</span>
                  <span className={`agent-support agent-support-${agent.status}`}>{supportLabels[agent.status]}</span>
                </div>
                <h3>{agent.name}{agent.currentVersion ? ` ${agent.currentVersion}` : ""}</h3>
                <p>{agent.description}</p>
                <p className="update-card-meta">{formatAgentDate(agent.updatedAt)} · {agent.publisher}</p>
                <div className="update-card-actions">
                  <button type="button" className="text-action" onClick={() => onAgent(agent.id)}>
                    <Icon name="agents" size={15} /> View in agent catalog
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
