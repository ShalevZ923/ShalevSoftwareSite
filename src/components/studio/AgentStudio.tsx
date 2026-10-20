import { useEffect, useMemo, useState } from "react";
import type { AgentContent, AgentPackage, AgentRelease, AgentCompatibility, AgentMcp } from "../../agentTypes";
import { agentFacets, agentPackageTypes, supportLabels } from "../../agentCatalog";
import { MarkdownDocument } from "../../markdown";
import { agentDownloadTarget } from "../../agentDelivery";
import { Field, Icon } from "../ui";

type AgentRecord = Omit<AgentPackage, "guidePath">;
type Entry = { id: string; metadata: AgentRecord; guide: string };
type Draft = { metadata: AgentRecord; guide: string };
const today = () => new Date().toISOString().slice(0, 10);
const starter = (): Draft => ({
  metadata: {
    schemaVersion: 1, id: "new-agent", name: "New skill", publisher: "Tool Atlas",
    packageType: "Skill", icon: "SK", description: "Briefly describe what this resource does.",
    highlights: ["New resource"], updatedAt: today(), status: "example", review: { status: "pending" },
    capabilities: ["development"], compatibility: [], requirements: [], riskLevel: "Unknown",
    permissions: [], contents: [], maintainer: { name: "Unassigned", team: "Owner needed", initials: "—", email: "unassigned@example.invalid" },
    tags: ["Skill"], releases: [],
  },
  guide: "## Overview\n\nDescribe the workflow and its intended users.\n\n## Support\n\nSupport owner not yet assigned.\n",
});
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function ListField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  const [text, setText] = useState(values.join("\n"));
  useEffect(() => setText(values.join("\n")), [values]);
  return <Field label={label}><textarea rows={3} value={text} onChange={(event) => setText(event.target.value)}
    onBlur={() => onChange(text.split("\n").map((item) => item.trim()).filter(Boolean))} /></Field>;
}

export function AgentStudio({ token, onCatalogUpdated, onDraftStateChange }: {
  token: string;
  onCatalogUpdated: () => void;
  onDraftStateChange: (dirty: boolean, saving: boolean) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<"Overview" | "Review" | "Delivery" | "Guide">("Overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const dirty = !!draft && (creating || JSON.stringify(draft) !== saved);
  useEffect(() => onDraftStateChange(dirty, saving), [dirty, saving, onDraftStateChange]);
  useEffect(() => () => onDraftStateChange(false, false), []);
  const headers = useMemo(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }), [token]);
  const load = async (select = true) => {
    setLoading(true);
    try {
      const response = await fetch("/api/developer/agents", { headers });
      if (!response.ok) throw new Error(`Unable to load agents (HTTP ${response.status})`);
      const data: Entry[] = await response.json();
      setEntries(data);
      if (select && data.length) {
        const first = copy({ metadata: data[0].metadata, guide: data[0].guide });
        setDraft(first); setSaved(JSON.stringify(first)); setActiveId(data[0].id);
      }
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to load agents" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [headers]);
  const select = (entry: Entry) => {
    if (dirty && !window.confirm("Discard unsaved agent changes?")) return;
    const next = copy({ metadata: entry.metadata, guide: entry.guide });
    setDraft(next); setSaved(JSON.stringify(next)); setActiveId(entry.id); setCreating(false); setMessage(null); setSection("Overview");
  };
  const add = () => {
    if (dirty && !window.confirm("Discard unsaved agent changes?")) return;
    const next = starter();
    setDraft(next); setSaved(JSON.stringify(next)); setActiveId(""); setCreating(true); setMessage(null); setSection("Overview");
  };
  const patch = (change: Partial<AgentRecord>) => setDraft((current) => current ? { ...current, metadata: { ...current.metadata, ...change } } : null);
  const save = async () => {
    if (!draft || saving) return;
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(creating ? "/api/developer/agents" : `/api/developer/agents/${activeId}`, {
        method: creating ? "POST" : "PUT", headers, body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Save failed (HTTP ${response.status})`);
      setSaved(JSON.stringify(draft)); setActiveId(draft.metadata.id); setCreating(false);
      setMessage({ tone: "success", text: `${draft.metadata.name} saved to the local Agent Catalog.` });
      await load(false);
      onCatalogUpdated();
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Save failed" }); }
    finally { setSaving(false); }
  };
  const filtered = entries.filter((entry) => `${entry.metadata.name} ${entry.metadata.id} ${entry.metadata.packageType}`.toLowerCase().includes(search.toLowerCase()));
  const agent = draft?.metadata;
  const review = agent?.review;
  const currentRelease = agent?.releases.find((item) => item.version === agent.currentVersion);
  const previewDownload = agent && agentDownloadTarget({ ...agent, guidePath: "" }, currentRelease);
  const currentReleaseIndex = agent?.releases.findIndex((item) => item.version === agent.currentVersion) ?? -1;
  const existingVersions = new Set(entries.find((entry) => entry.id === activeId)?.metadata.releases.map((release) => release.version) ?? []);
  const updateRelease = (index: number, change: Partial<AgentRelease>) => {
    const previous = agent!.releases[index];
    patch({
      releases: agent!.releases.map((release, position) => position === index ? { ...release, ...change } : release),
      ...(change.version && previous.version === agent!.currentVersion ? { currentVersion: change.version } : {}),
    });
  };
  const updateContent = (index: number, change: Partial<AgentContent>) => {
    const contents = agent!.contents.map((item, position) => position === index ? { ...item, ...change } : item);
    patch({ contents, releases: agent!.releases.map((release) => release.version === agent!.currentVersion && release.artifact ? { ...release, contents } : release) });
  };
  const updateCompatibility = (index: number, change: Partial<AgentCompatibility>) =>
    patch({ compatibility: agent!.compatibility.map((item, position) => position === index ? { ...item, ...change } : item) });
  return <div className="dev-workspace">
    <nav className="dev-sidebar" aria-label="Agent resources">
      <div className="dev-sidebar-tools">
        <label className="dev-search-box"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter agents…" aria-label="Filter agents" /></label>
        <button className="dev-create-btn" type="button" onClick={add} disabled={saving}>+ Add resource</button>
      </div>
      <div className="dev-item-list">
        {loading && <p className="dev-list-message">Loading resources…</p>}
        {filtered.map((entry) => <button key={entry.id} type="button" className={entry.id === activeId && !creating ? "dev-item-card selected" : "dev-item-card"} onClick={() => select(entry)}>
          <span className="dev-agent-glyph">{entry.metadata.icon}</span><span className="dev-item-info"><strong className="dev-item-name">{entry.metadata.name}</strong><small className="dev-item-sub">{entry.metadata.packageType} · {supportLabels[entry.metadata.status]}</small></span>
        </button>)}
      </div>
    </nav>
    <div className="dev-editor-main">{agent && <div className="dev-editor-container">
      <div className="dev-editor-bar"><div><h2>{creating ? "New Agent Resource" : agent.name}</h2><span className="dev-record-detail">{agent.publisher} · {agent.packageType}</span></div>
        <div className="dev-action-group"><span className="dev-save-state">{saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}</span><button type="button" className="dev-save-btn" disabled={!dirty || saving} onClick={save}>Save changes</button></div>
      </div>
      {message && <p role={message.tone === "error" ? "alert" : "status"} className={`dev-agent-message ${message.tone}`}>{message.text}</p>}
      <nav className="dev-section-nav" aria-label="Agent sections">{(["Overview", "Review", "Delivery", "Guide"] as const).map((name) => <button type="button" key={name} className={section === name ? "active" : ""} aria-current={section === name ? "true" : undefined} onClick={() => setSection(name)}>{name}</button>)}</nav>
      <fieldset className="dev-form-body" disabled={saving}>
        <section className="dev-agent-section" hidden={section !== "Overview"}>
          <div className="dev-grid-2"><Field label="Resource ID"><input value={agent.id} disabled={!creating} onChange={(event) => patch({ id: event.target.value })} /></Field><Field label="Publisher"><input value={agent.publisher} disabled={!creating} onChange={(event) => patch({ publisher: event.target.value })} /></Field></div>
          <div className="dev-grid-2"><Field label="Name"><input value={agent.name} onChange={(event) => patch({ name: event.target.value })} /></Field><Field label="Type"><select value={agent.packageType} disabled={!creating} onChange={(event) => patch({ packageType: event.target.value as AgentRecord["packageType"], mcp: event.target.value === "MCP Server" ? { transport: "stdio", hosting: "local", authentication: "none", tools: [], resources: [], prompts: [] } : undefined })}>{agentPackageTypes.map((type) => <option key={type}>{type}</option>)}</select></Field></div>
          <div className="dev-grid-2"><Field label="Icon text"><input value={agent.icon} onChange={(event) => patch({ icon: event.target.value })} maxLength={8} /></Field><Field label="Updated"><input type="date" value={agent.updatedAt} onChange={(event) => patch({ updatedAt: event.target.value })} /></Field></div>
          <Field label="Short description"><textarea rows={2} value={agent.description} onChange={(event) => patch({ description: event.target.value })} maxLength={180} /></Field>
          <ListField key={agent.id + "-highlights"} label="Highlights · one per line" values={agent.highlights} onChange={(highlights) => patch({ highlights })} />
          <ListField key={agent.id + "-tags"} label="Search tags · one per line" values={agent.tags} onChange={(tags) => patch({ tags })} />
          <div className="dev-agent-checkboxes"><span>Capabilities</span>{agentFacets.capabilities.map((item) => <label key={item.id}><input type="checkbox" checked={agent.capabilities.includes(item.id)} onChange={(event) => patch({ capabilities: event.target.checked ? [...agent.capabilities, item.id] : agent.capabilities.filter((id) => id !== item.id) })} />{item.label}</label>)}</div>
        </section>
        <section className="dev-agent-section" hidden={section !== "Review"}>
          <div className="dev-grid-2"><Field label="Catalog status"><select value={agent.status} onChange={(event) => patch({ status: event.target.value as AgentRecord["status"] })}><option value="example">Example</option><option value="evaluation">In evaluation</option><option value="supported">Supported</option><option value="deprecated">Deprecated</option></select></Field><Field label="Risk level"><select value={agent.riskLevel} onChange={(event) => patch({ riskLevel: event.target.value as AgentRecord["riskLevel"] })}>{["Unknown", "Low", "Medium", "High"].map((risk) => <option key={risk}>{risk}</option>)}</select></Field></div>
          <p className="dev-section-help">Supported status requires pinned source, license, reviewed current version, assessed risk, a named owner, and a verified host. The server validates these before saving.</p>
          <div className="dev-grid-2"><Field label="Source URL"><input type="url" value={agent.source?.url ?? ""} onChange={(event) => patch({ source: event.target.value ? { url: event.target.value, ...(agent.source?.revision ? { revision: agent.source.revision } : {}) } : undefined })} /></Field><Field label="Pinned revision"><input value={agent.source?.revision ?? ""} onChange={(event) => patch({ source: { url: agent.source?.url ?? "", revision: event.target.value } })} /></Field></div>
          <Field label="License"><input value={agent.license ?? ""} onChange={(event) => patch({ license: event.target.value || undefined })} /></Field>
          <div className="dev-grid-2"><Field label="Review status"><select value={review?.status ?? "pending"} onChange={(event) => patch({ review: { ...review!, status: event.target.value as "pending" | "reviewed" } })}><option value="pending">Pending</option><option value="reviewed">Reviewed</option></select></Field><Field label="Reviewed version"><input value={review?.version ?? ""} onChange={(event) => patch({ review: { ...review!, version: event.target.value } })} /></Field></div>
          <div className="dev-grid-2"><Field label="Review date"><input type="date" value={review?.date ?? ""} onChange={(event) => patch({ review: { ...review!, date: event.target.value } })} /></Field><Field label="Review evidence"><input value={review?.evidence ?? ""} onChange={(event) => patch({ review: { ...review!, evidence: event.target.value } })} /></Field></div>
          <div className="dev-grid-2"><Field label="Owner name"><input value={agent.maintainer.name} onChange={(event) => patch({ maintainer: { ...agent.maintainer, name: event.target.value } })} /></Field><Field label="Owner team"><input value={agent.maintainer.team} onChange={(event) => patch({ maintainer: { ...agent.maintainer, team: event.target.value } })} /></Field></div>
          <div className="dev-grid-2"><Field label="Owner initials"><input value={agent.maintainer.initials} onChange={(event) => patch({ maintainer: { ...agent.maintainer, initials: event.target.value } })} /></Field><Field label="Owner email"><input type="email" value={agent.maintainer.email} onChange={(event) => patch({ maintainer: { ...agent.maintainer, email: event.target.value } })} /></Field></div>
          <ListField key={agent.id + "-requirements"} label="Requirements · one per line" values={agent.requirements} onChange={(requirements) => patch({ requirements })} />
          <ListField key={agent.id + "-permissions"} label="Permissions · one per line" values={agent.permissions} onChange={(permissions) => patch({ permissions })} />
          <ListField key={agent.id + "-risks"} label="Risks · one per line" values={agent.risks ?? []} onChange={(risks) => patch({ risks })} />
          <div className="dev-agent-subhead"><h3>Host verification</h3><button type="button" className="dev-small-btn" onClick={() => patch({ compatibility: [...agent.compatibility, { target: "agent-skills", status: "unverified", notes: "Not tested" }] })}>Add target</button></div>
          {agent.compatibility.map((item, index) => <div className="dev-agent-item" key={index}><div className="dev-grid-2"><Field label="Target"><select value={item.target} onChange={(event) => updateCompatibility(index, { target: event.target.value })}>{agentFacets.targets.map((target) => <option value={target.id} key={target.id}>{target.label}</option>)}</select></Field><Field label="Result"><select value={item.status} onChange={(event) => updateCompatibility(index, { status: event.target.value as "verified" | "unverified" })}><option value="unverified">Unverified</option><option value="verified">Verified</option></select></Field></div><Field label="Notes"><input value={item.notes} onChange={(event) => updateCompatibility(index, { notes: event.target.value })} /></Field>{item.status === "verified" && <div className="dev-grid-3"><Field label="Version"><input value={item.version ?? ""} onChange={(event) => updateCompatibility(index, { version: event.target.value })} /></Field><Field label="Verified on"><input type="date" value={item.verifiedOn ?? ""} onChange={(event) => updateCompatibility(index, { verifiedOn: event.target.value })} /></Field><Field label="Evidence"><input value={item.evidence ?? ""} onChange={(event) => updateCompatibility(index, { evidence: event.target.value })} /></Field></div>}<button type="button" className="dev-danger-btn" onClick={() => patch({ compatibility: agent.compatibility.filter((_, position) => position !== index) })}>Remove target</button></div>)}
        </section>
        <section className="dev-agent-section" hidden={section !== "Delivery"}>
          <div className="dev-grid-2"><Field label="Current version"><select value={agent.currentVersion ?? ""} onChange={(event) => patch({ currentVersion: event.target.value || undefined })}><option value="">No release</option>{agent.releases.map((release) => <option value={release.version} key={release.version}>{release.version}</option>)}</select></Field><Field label="Download button label"><input value={agent.downloadButtonLabel ?? ""} placeholder={agent.status === "evaluation" ? "Download ZIP for testing" : "Download complete ZIP"} maxLength={44} onChange={(event) => patch({ downloadButtonLabel: event.target.value || undefined })} /></Field></div>
          <div className="dev-agent-preview"><span className={`agent-support agent-support-${agent.status}`}>{supportLabels[agent.status]}</span>{previewDownload
            ? <span className="primary-button">{agent.downloadButtonLabel ?? (agent.status === "evaluation" ? "Download ZIP for testing" : "Download complete ZIP")}</span>
            : <small>Download button hidden until the listing and current ZIP meet the review gate.</small>}</div>
          <p className="dev-section-help">This preview checks metadata. The public catalog also checks that the ZIP is available before showing the button. Changing its label cannot bypass either check.</p>
          <div className="dev-agent-subhead"><h3>Releases</h3><button type="button" className="dev-small-btn" onClick={() => { let patchVersion = 0; while (agent.releases.some((item) => item.version === `1.0.${patchVersion}`)) patchVersion++; const version = `1.0.${patchVersion}`; patch({ releases: [...agent.releases, { version, releasedAt: today() }], currentVersion: version }); }}>Add release</button></div>
          {agent.releases.map((release, index) => <div className="dev-agent-item" key={index}><div className="dev-grid-2"><Field label="Version"><input value={release.version} disabled={existingVersions.has(release.version)} onChange={(event) => updateRelease(index, { version: event.target.value })} /></Field><Field label="Released"><input type="date" value={release.releasedAt} onChange={(event) => updateRelease(index, { releasedAt: event.target.value })} /></Field></div><Field label="Release note"><input value={release.notes ?? ""} onChange={(event) => updateRelease(index, { notes: event.target.value || undefined })} /></Field><div className="dev-grid-2"><Field label="Artifact · ID/version/file.zip"><input value={release.artifact ?? ""} onChange={(event) => updateRelease(index, { artifact: event.target.value || undefined, ...(event.target.value && !release.contents ? { contents: agent.contents } : {}) })} /></Field><Field label="SHA-256"><input value={release.sha256 ?? ""} onChange={(event) => updateRelease(index, { sha256: event.target.value || undefined })} /></Field></div><div className="dev-grid-2"><Field label="Archive root"><input value={release.archiveRoot ?? ""} onChange={(event) => updateRelease(index, { archiveRoot: event.target.value || undefined })} /></Field><Field label="Archive review date"><input type="date" value={release.review?.date ?? ""} onChange={(event) => updateRelease(index, { review: { date: event.target.value, evidence: release.review?.evidence ?? "" } })} /></Field></div><Field label="Archive review evidence"><input value={release.review?.evidence ?? ""} onChange={(event) => updateRelease(index, { review: { date: release.review?.date ?? "", evidence: event.target.value } })} /></Field>{index === currentReleaseIndex ? <small>Current release files are managed below.</small> : release.contents && <small>Archived release retains {release.contents.length} reviewed path records.</small>}</div>)}
          <div className="dev-agent-subhead"><h3>Current package files</h3><button type="button" className="dev-small-btn" onClick={() => { const contents = [...agent.contents, { path: "", kind: "doc" as const }]; patch({ contents, releases: agent.releases.map((release) => release.version === agent.currentVersion && release.artifact ? { ...release, contents } : release) }); }}>Add file or folder</button></div>
          {agent.contents.map((item, index) => <div className="dev-agent-file" key={index}><Field label="Relative path"><input value={item.path} onChange={(event) => updateContent(index, { path: event.target.value })} /></Field><Field label="Kind"><select value={item.kind} onChange={(event) => updateContent(index, { kind: event.target.value as AgentContent["kind"] })}>{["skill", "script", "prompt", "config", "doc", "asset"].map((kind) => <option key={kind}>{kind}</option>)}</select></Field><button type="button" className="dev-danger-btn" onClick={() => { const contents = agent.contents.filter((_, position) => position !== index); patch({ contents, releases: agent.releases.map((release) => release.version === agent.currentVersion && release.artifact ? { ...release, contents } : release) }); }}>Remove</button></div>)}
          {agent.install?.unpack && <div className="dev-grid-2"><Field label="Project unpack folder"><input value={agent.install.unpack.project} onChange={(event) => patch({ install: { ...agent.install, unpack: { ...agent.install!.unpack!, project: event.target.value } } })} /></Field><Field label="User unpack folder"><input value={agent.install.unpack.global} onChange={(event) => patch({ install: { ...agent.install, unpack: { ...agent.install!.unpack!, global: event.target.value } } })} /></Field></div>}
          {agent.packageType === "MCP Server" && agent.mcp && <><div className="dev-agent-subhead"><h3>MCP interface</h3></div><div className="dev-grid-3"><Field label="Transport"><select value={agent.mcp.transport} onChange={(event) => patch({ mcp: { ...agent.mcp!, transport: event.target.value as AgentMcp["transport"] } })}>{["stdio", "streamable-http", "sse", "custom", "unknown"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Hosting"><select value={agent.mcp.hosting} onChange={(event) => patch({ mcp: { ...agent.mcp!, hosting: event.target.value as AgentMcp["hosting"] } })}>{["local", "remote", "unknown"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Authentication"><select value={agent.mcp.authentication} onChange={(event) => patch({ mcp: { ...agent.mcp!, authentication: event.target.value as AgentMcp["authentication"] } })}>{["none", "oauth", "token", "unknown"].map((value) => <option key={value}>{value}</option>)}</select></Field></div><div className="dev-agent-subhead"><h3>Tools</h3><button type="button" className="dev-small-btn" onClick={() => patch({ mcp: { ...agent.mcp!, tools: [...agent.mcp!.tools, { name: "new_tool", description: "Describe the tool.", effect: "unknown" }] } })}>Add tool</button></div>{agent.mcp.tools.map((tool, index) => <div className="dev-agent-file" key={index}><Field label="Name"><input value={tool.name} onChange={(event) => patch({ mcp: { ...agent.mcp!, tools: agent.mcp!.tools.map((item, position) => position === index ? { ...item, name: event.target.value } : item) } })} /></Field><Field label="Effect"><select value={tool.effect} onChange={(event) => patch({ mcp: { ...agent.mcp!, tools: agent.mcp!.tools.map((item, position) => position === index ? { ...item, effect: event.target.value as typeof item.effect } : item) } })}>{["read", "write", "execute", "unknown"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Description"><input value={tool.description} onChange={(event) => patch({ mcp: { ...agent.mcp!, tools: agent.mcp!.tools.map((item, position) => position === index ? { ...item, description: event.target.value } : item) } })} /></Field><button type="button" className="dev-danger-btn" onClick={() => patch({ mcp: { ...agent.mcp!, tools: agent.mcp!.tools.filter((_, position) => position !== index) } })}>Remove</button></div>)}<ListField key={agent.id + "-mcp-resources"} label="MCP resources · one per line" values={agent.mcp.resources} onChange={(resources) => patch({ mcp: { ...agent.mcp!, resources } })} /><ListField key={agent.id + "-mcp-prompts"} label="MCP prompts · one per line" values={agent.mcp.prompts} onChange={(prompts) => patch({ mcp: { ...agent.mcp!, prompts } })} /></>}
        </section>
        <section className="dev-agent-section" hidden={section !== "Guide"}><Field label="Usage guide"><textarea className="dev-textarea" value={draft!.guide} onChange={(event) => setDraft({ ...draft!, guide: event.target.value })} /></Field><div className="dev-preview-pane markdown-body"><MarkdownDocument content={draft!.guide} /></div></section>
      </fieldset>
      <p className="dev-local-note">Saves validated source files to this local working tree. Review the diff and package evidence before publishing.</p>
    </div>}</div>
  </div>;
}
