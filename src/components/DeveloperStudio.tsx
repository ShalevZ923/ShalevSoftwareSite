import { useEffect, useMemo, useState } from "react";
import type { GuideResource, Lifecycle, Platform, Tool, ToolRelease } from "../data";
import { MarkdownDocument } from "../markdown";
import { Field, Icon } from "./ui";

type DocFile = {
  name: string;
  sizeBytes: number;
  modified: string;
};

type ToolEntryPayload = {
  id: string;
  metadata: Tool & { order: number };
  guide: string;
};

const defaultNewTool: ToolEntryPayload = {
  id: "new-tool",
  metadata: {
    id: "new-tool",
    order: 1,
    name: "New Software",
    company: "Internal Team",
    category: "Development",
    platforms: ["Windows"],
    lifecycle: "Current",
    icon: "NS",
    updated: new Date().toISOString().slice(0, 10),
    description: "Brief summary of the approved software.",
    support: {
      name: "Platform Owner",
      team: "Platform Engineering",
      initials: "PO",
      email: "support@atlas.local",
    },
    releases: [
      {
        version: "1.0.0",
        download: "https://example.com/downloads/v1.0.0",
      },
    ],
    tags: ["Utility"],
  },
  guide: `# New Software\n\nBrief summary of the approved software.\n\n## Install\n\n1. Download the approved release.\n2. Run the installer with organizational defaults.\n\n## Support\n\nPlatform Engineering supports the base installation and access.`,
};

export function DeveloperStudio({
  token,
  onExit,
  onCatalogUpdated,
}: {
  token: string;
  onExit: () => void;
  onCatalogUpdated: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"tools" | "docs">("tools");
  const [toolsList, setToolsList] = useState<ToolEntryPayload[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string>("");
  const [editingTool, setEditingTool] = useState<ToolEntryPayload | null>(null);
  const [toolSearch, setToolSearch] = useState("");
  const [isCreatingNewTool, setIsCreatingNewTool] = useState(false);

  const [docsList, setDocsList] = useState<DocFile[]>([]);
  const [selectedDocName, setSelectedDocName] = useState<string>("");
  const [editingDocContent, setEditingDocContent] = useState<string>("");
  const [guideLibraryFiles, setGuideLibraryFiles] = useState<string[]>([]);

  const [guideViewMode, setGuideViewMode] = useState<"split" | "edit" | "preview">("split");
  const [docViewMode, setDocViewMode] = useState<"split" | "edit" | "preview">("split");

  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const headers = useMemo(() => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  // Load all tools from developer API
  const loadTools = async () => {
    try {
      const res = await fetch("/api/developer/tools", { headers });
      if (!res.ok) {
        throw new Error(`Failed to load tools: ${res.statusText}`);
      }
      const data: ToolEntryPayload[] = await res.json();
      setToolsList(data);
      if (data.length > 0 && !selectedToolId) {
        setSelectedToolId(data[0].id);
        setEditingTool(JSON.parse(JSON.stringify(data[0])));
      }
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Error loading tools",
      });
    }
  };

  // Load docs list from developer API
  const loadDocs = async () => {
    try {
      const res = await fetch("/api/developer/docs", { headers });
      if (!res.ok) {
        throw new Error(`Failed to load docs: ${res.statusText}`);
      }
      const data: DocFile[] = await res.json();
      setDocsList(data);
      if (data.length > 0 && !selectedDocName) {
        setSelectedDocName(data[0].name);
        loadSingleDoc(data[0].name);
      }
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Error loading docs",
      });
    }
  };

  const loadSingleDoc = async (docName: string) => {
    try {
      const res = await fetch(`/api/developer/docs/${encodeURIComponent(docName)}`, { headers });
      if (!res.ok) throw new Error("Failed to load document");
      const data = await res.json();
      setEditingDocContent(data.content || "");
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Error reading document",
      });
    }
  };

  useEffect(() => {
    loadTools();
    loadDocs();
  }, [headers]);

  useEffect(() => {
    if (!selectedToolId) return;
    fetch(`/api/developer/guide-library/${encodeURIComponent(selectedToolId)}`, { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((files: string[]) => setGuideLibraryFiles(Array.isArray(files) ? files : []))
      .catch(() => setGuideLibraryFiles([]));
  }, [headers, selectedToolId]);

  // Select tool
  const handleSelectTool = (tool: ToolEntryPayload) => {
    setIsCreatingNewTool(false);
    setSelectedToolId(tool.id);
    setEditingTool(JSON.parse(JSON.stringify(tool)));
    setStatusMessage(null);
  };

  // Select doc
  const handleSelectDoc = (docName: string) => {
    setSelectedDocName(docName);
    loadSingleDoc(docName);
    setStatusMessage(null);
  };

  // Start new tool
  const handleStartNewTool = () => {
    const nextOrder =
      toolsList.reduce((max, item) => Math.max(max, item.metadata.order || 0), 0) + 1;
    const freshTool: ToolEntryPayload = JSON.parse(JSON.stringify(defaultNewTool));
    freshTool.metadata.order = nextOrder;
    setIsCreatingNewTool(true);
    setSelectedToolId("");
    setEditingTool(freshTool);
    setStatusMessage(null);
  };

  // Save Tool Changes
  const handleSaveTool = async () => {
    if (!editingTool) return;
    setIsSaving(true);
    setStatusMessage({ tone: "info", text: "Validating and saving tool..." });

    try {
      const endpoint = isCreatingNewTool
        ? "/api/developer/tools"
        : `/api/developer/tools/${editingTool.id}`;
      const method = isCreatingNewTool ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify({
          metadata: editingTool.metadata,
          guide: editingTool.guide,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || `Server responded with ${res.status}`);
      }

      setStatusMessage({
        tone: "success",
        text: `Successfully saved ${editingTool.metadata.name}! Catalog regenerated.`,
      });
      setIsCreatingNewTool(false);
      setSelectedToolId(editingTool.id);
      await loadTools();
      onCatalogUpdated();
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Save Document
  const handleSaveDoc = async () => {
    if (!selectedDocName) return;
    setIsSaving(true);
    setStatusMessage({ tone: "info", text: "Saving documentation..." });

    try {
      const res = await fetch(`/api/developer/docs/${encodeURIComponent(selectedDocName)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ content: editingDocContent }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || `Failed to save ${selectedDocName}`);
      }
      setStatusMessage({
        tone: "success",
        text: `Successfully saved docs/${selectedDocName}!`,
      });
      await loadDocs();
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to save doc",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTools = useMemo(() => {
    const q = toolSearch.trim().toLowerCase();
    if (!q) return toolsList;
    return toolsList.filter(
      (t) =>
        t.metadata.name.toLowerCase().includes(q) ||
        t.metadata.category.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    );
  }, [toolsList, toolSearch]);

  return (
    <div className="developer-studio">
      {/* Studio Header */}
      <header className="dev-header">
        <div className="dev-header-brand">
          <Icon name="atlas" size={24} />
          <div>
            <h1>Developer Studio</h1>
            <span className="dev-badge-connected">
              <span className="dot" /> Session Active (In-Memory Token)
            </span>
          </div>
        </div>
        <div className="dev-header-actions">
          <button
            className={`dev-tab-btn ${activeTab === "tools" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("tools");
              setStatusMessage(null);
            }}
          >
            <Icon name="catalog" size={16} /> Software Catalog ({toolsList.length})
          </button>
          <button
            className={`dev-tab-btn ${activeTab === "docs" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("docs");
              setStatusMessage(null);
            }}
          >
            <Icon name="book" size={16} /> Documentation Files ({docsList.length})
          </button>
          <button className="dev-exit-btn" onClick={onExit} title="Exit Developer Studio">
            <Icon name="close" size={16} /> Exit Studio
          </button>
        </div>
      </header>

      {/* Global Status Banner */}
      {statusMessage && (
        <aside
          aria-live="polite"
          className={`dev-status-banner tone-${statusMessage.tone}`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            aria-label="Dismiss message"
            className="dev-dismiss-btn"
          >
            &times;
          </button>
        </aside>
      )}

      {/* Main Studio Body */}
      {activeTab === "tools" ? (
        <div className="dev-workspace">
          {/* Left Column: Tool Explorer */}
          <nav aria-label="Catalog Tools" className="dev-sidebar">
            <div className="dev-sidebar-tools">
              <div className="dev-search-box">
                <Icon name="search" size={16} />
                <input
                  type="text"
                  placeholder="Filter software..."
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  aria-label="Filter software list"
                />
              </div>
              <button className="dev-create-btn" onClick={handleStartNewTool}>
                + Add Software
              </button>
            </div>

            <div className="dev-item-list" role="list">
              {filteredTools.map((tool) => {
                const isSelected = !isCreatingNewTool && tool.id === selectedToolId;
                return (
                  <button
                    key={tool.id}
                    className={`dev-item-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectTool(tool)}
                  >
                    <span className="dev-item-icon">{tool.metadata.icon}</span>
                    <div className="dev-item-info">
                      <strong className="dev-item-name">{tool.metadata.name}</strong>
                      <small className="dev-item-sub">
                        {tool.metadata.category} &bull; {tool.metadata.lifecycle}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Right Column: Tool Editor Form & Markdown Guide */}
          <main className="dev-editor-main">
            {editingTool ? (
              <div className="dev-editor-container">
                {/* Editor Top Bar */}
                <div className="dev-editor-bar">
                  <div>
                    <h2>
                      {isCreatingNewTool
                        ? "New Software Entry"
                        : `Editing: ${editingTool.metadata.name}`}
                    </h2>
                    <span className="dev-filename">content/tools/{editingTool.id}.md</span>
                  </div>
                  <div className="dev-action-group">
                    <button
                      className="dev-save-btn"
                      onClick={handleSaveTool}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>

                <div className="dev-form-sections">
                  {/* Section: Metadata */}
                  <fieldset className="dev-section">
                    <legend>Metadata & Catalog Card</legend>
                    <div className="dev-grid-2">
                      <Field label="Software Name">
                        <input
                          type="text"
                          value={editingTool.metadata.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: { ...prev.metadata, name },
                                  }
                                : null,
                            );
                          }}
                        />
                      </Field>
                      <Field label="Identifier (kebab-case)">
                        <input
                          type="text"
                          disabled={!isCreatingNewTool}
                          value={editingTool.id}
                          onChange={(e) => {
                            const id = e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]+/g, "-");
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    id,
                                    metadata: { ...prev.metadata, id },
                                  }
                                : null,
                            );
                          }}
                        />
                      </Field>
                    </div>

                    <div className="dev-grid-3">
                      <Field label="Vendor / Company">
                        <input
                          type="text"
                          value={editingTool.metadata.company}
                          onChange={(e) => {
                            const company = e.target.value;
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: { ...prev.metadata, company },
                                  }
                                : null,
                            );
                          }}
                        />
                      </Field>
                      <Field label="Category">
                        <input
                          type="text"
                          value={editingTool.metadata.category}
                          onChange={(e) => {
                            const category = e.target.value;
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: { ...prev.metadata, category },
                                  }
                                : null,
                            );
                          }}
                        />
                      </Field>
                      <Field label="Catalog Order">
                        <input
                          type="number"
                          value={editingTool.metadata.order}
                          onChange={(e) => {
                            const order = parseInt(e.target.value, 10) || 1;
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: { ...prev.metadata, order },
                                  }
                                : null,
                            );
                          }}
                        />
                      </Field>
                    </div>

                    <div className="dev-grid-3">
                      <Field label="Icon Initials (2-3 chars)">
                        <input
                          type="text"
                          maxLength={4}
                          value={editingTool.metadata.icon}
                          onChange={(e) => {
                            const icon = e.target.value.toUpperCase();
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: { ...prev.metadata, icon },
                                  }
                                : null,
                            );
                          }}
                        />
                      </Field>
                      <Field label="Lifecycle">
                        <select
                          value={editingTool.metadata.lifecycle}
                          onChange={(e) => {
                            const lifecycle = e.target.value as Lifecycle;
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: { ...prev.metadata, lifecycle },
                                  }
                                : null,
                            );
                          }}
                        >
                          <option value="Current">Current</option>
                          <option value="New">New</option>
                          <option value="Legacy">Legacy</option>
                        </select>
                      </Field>
                      <Field label="Updated Date / Label">
                        <input
                          type="text"
                          value={editingTool.metadata.updated}
                          onChange={(e) => {
                            const updated = e.target.value;
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: { ...prev.metadata, updated },
                                  }
                                : null,
                            );
                          }}
                        />
                      </Field>
                    </div>

                    <Field label="Short Description">
                      <input
                        type="text"
                        value={editingTool.metadata.description}
                        onChange={(e) => {
                          const description = e.target.value;
                          setEditingTool((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  metadata: { ...prev.metadata, description },
                                }
                              : null,
                          );
                        }}
                      />
                    </Field>

                    <Field label="Supported Platforms">
                      <div className="dev-checkbox-row">
                        {(["Windows", "Linux", "macOS", "Web"] as Platform[]).map((platform) => {
                          const checked = editingTool.metadata.platforms.includes(platform);
                          return (
                            <label key={platform} className="dev-check-label">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const platforms = e.target.checked
                                    ? [...editingTool.metadata.platforms, platform]
                                    : editingTool.metadata.platforms.filter((p) => p !== platform);
                                  setEditingTool((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          metadata: { ...prev.metadata, platforms },
                                        }
                                      : null,
                                  );
                                }}
                              />
                              <span>{platform}</span>
                            </label>
                          );
                        })}
                      </div>
                    </Field>

                    <Field label="Tags (comma-separated)">
                      <input
                        type="text"
                        value={editingTool.metadata.tags.join(", ")}
                        onChange={(e) => {
                          const tags = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean);
                          setEditingTool((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  metadata: { ...prev.metadata, tags },
                                }
                              : null,
                          );
                        }}
                      />
                    </Field>
                  </fieldset>

                  {/* Section: Support Owner */}
                  <fieldset className="dev-section">
                    <legend>Platform Support Owner</legend>
                    <div className="dev-grid-3">
                      <Field label="Owner Name">
                        <input
                          type="text"
                          value={editingTool.metadata.support.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: {
                                      ...prev.metadata,
                                      support: { ...prev.metadata.support, name },
                                    },
                                  }
                                : null,
                            );
                          }}
                        />
                      </Field>
                      <Field label="Team / Organization">
                        <input
                          type="text"
                          value={editingTool.metadata.support.team}
                          onChange={(e) => {
                            const team = e.target.value;
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: {
                                      ...prev.metadata,
                                      support: { ...prev.metadata.support, team },
                                    },
                                  }
                                : null,
                            );
                          }}
                        />
                      </Field>
                      <Field label="Support Email">
                        <input
                          type="email"
                          value={editingTool.metadata.support.email}
                          onChange={(e) => {
                            const email = e.target.value;
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: {
                                      ...prev.metadata,
                                      support: { ...prev.metadata.support, email },
                                    },
                                  }
                                : null,
                            );
                          }}
                        />
                      </Field>
                    </div>
                  </fieldset>

                  {/* Section: Releases */}
                  <fieldset className="dev-section">
                    <div className="dev-section-header">
                      <legend>Approved Releases</legend>
                      <button
                        type="button"
                        className="dev-small-btn"
                        onClick={() => {
                          const newRelease: ToolRelease = {
                            version: "1.0.0",
                            download: "https://example.com",
                          };
                          setEditingTool((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  metadata: {
                                    ...prev.metadata,
                                    releases: [...prev.metadata.releases, newRelease],
                                  },
                                }
                              : null,
                          );
                        }}
                      >
                        + Add Release
                      </button>
                    </div>

                    {editingTool.metadata.releases.map((rel, idx) => (
                      <div key={idx} className="dev-release-row">
                        <div style={{ width: "120px" }}>
                          <Field label="Version">
                            <input
                              type="text"
                              value={rel.version}
                              onChange={(e) => {
                                const releases = [...editingTool.metadata.releases];
                                releases[idx] = { ...releases[idx], version: e.target.value };
                                setEditingTool((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        metadata: { ...prev.metadata, releases },
                                      }
                                    : null,
                                );
                              }}
                            />
                          </Field>
                        </div>
                        <div style={{ flex: 1 }}>
                          <Field label="Download URL or artifact:tool-id/version/filename">
                            <input
                              type="text"
                              value={rel.download || (rel.artifact ? `artifact:${rel.artifact}` : "")}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                const releases = [...editingTool.metadata.releases];
                                if (val.startsWith("artifact:")) {
                                  releases[idx] = {
                                    version: rel.version,
                                    artifact: val.slice("artifact:".length),
                                  };
                                } else {
                                  releases[idx] = {
                                    version: rel.version,
                                    download: val,
                                  };
                                }
                                setEditingTool((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        metadata: { ...prev.metadata, releases },
                                      }
                                    : null,
                                );
                              }}
                            />
                          </Field>
                        </div>
                        <button
                          type="button"
                          className="dev-danger-btn"
                          onClick={() => {
                            if (editingTool.metadata.releases.length <= 1) return;
                            const releases = editingTool.metadata.releases.filter((_, i) => i !== idx);
                            setEditingTool((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    metadata: { ...prev.metadata, releases },
                                  }
                                : null,
                            );
                          }}
                          disabled={editingTool.metadata.releases.length <= 1}
                          title="Delete release"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </fieldset>

                  <fieldset className="dev-section">
                    <div className="dev-section-header">
                      <div>
                        <legend>Guides &amp; files</legend>
                        <p className="dev-section-help">Attach an approved SharePoint/intranet link or select a PDF or PowerPoint already placed in this tool&apos;s server guide library.</p>
                      </div>
                      <button type="button" className="dev-small-btn" onClick={() => {
                        const resource: GuideResource = { id: "new-guide", title: "New guide", kind: "internal-guide", format: "pdf", url: "https://", appliesTo: [editingTool.metadata.releases[0]?.version || "Current"], owner: editingTool.metadata.support.team, reviewedOn: new Date().toISOString().slice(0, 10) };
                        setEditingTool((prev) => prev ? { ...prev, metadata: { ...prev.metadata, resources: [...(prev.metadata.resources || []), resource] } } : null);
                      }}>+ Add guide</button>
                    </div>
                    {(editingTool.metadata.resources || []).map((resource, idx) => {
                      const update = (change: Partial<GuideResource>) => setEditingTool((prev) => {
                        if (!prev) return null;
                        const resources = [...(prev.metadata.resources || [])];
                        resources[idx] = { ...resources[idx], ...change };
                        return { ...prev, metadata: { ...prev.metadata, resources } };
                      });
                      const isFile = resource.file !== undefined;
                      return <div className="dev-resource-card" key={`${resource.id}-${idx}`}>
                        <div className="dev-grid-3">
                          <Field label="Title"><input value={resource.title} onChange={(e) => update({ title: e.target.value })} /></Field>
                          <Field label="Type"><select value={resource.kind} onChange={(e) => update({ kind: e.target.value as GuideResource["kind"] })}><option value="official-manual">Official manual</option><option value="internal-guide">Internal guide</option><option value="training">Training</option></select></Field>
                          <Field label="Format"><select value={resource.format} onChange={(e) => update({ format: e.target.value as GuideResource["format"] })}><option value="pdf">PDF</option><option value="pptx">PowerPoint</option><option value="web">Web page</option></select></Field>
                        </div>
                        <div className="dev-grid-3">
                          <Field label="Source"><select value={isFile ? "file" : "url"} onChange={(e) => { const file = e.target.value === "file"; update(file ? { file: guideLibraryFiles[0] || `${editingTool.id}/guide.pdf`, url: undefined } : { url: "https://", file: undefined }); }}><option value="url">Approved HTTPS link</option><option value="file" disabled={resource.format === "web"}>Server guide library</option></select></Field>
                          {isFile ? <Field label="Server file"><select value={resource.file} onChange={(e) => update({ file: e.target.value })}>{guideLibraryFiles.length ? guideLibraryFiles.map((file) => <option key={file} value={file}>{file}</option>) : <option value={resource.file}>{resource.file}</option>}</select></Field> : <Field label="SharePoint or intranet HTTPS URL"><input value={resource.url || ""} onChange={(e) => update({ url: e.target.value })} /></Field>}
                          <Field label="Applies to versions"><input value={resource.appliesTo.join(", ")} onChange={(e) => update({ appliesTo: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></Field>
                        </div>
                        <div className="dev-grid-3">
                          <Field label="Owner"><input value={resource.owner} onChange={(e) => update({ owner: e.target.value })} /></Field>
                          <Field label="Reviewed on"><input type="date" value={resource.reviewedOn} onChange={(e) => update({ reviewedOn: e.target.value })} /></Field>
                          <div className="dev-resource-remove"><button type="button" className="dev-danger-btn" onClick={() => setEditingTool((prev) => prev ? { ...prev, metadata: { ...prev.metadata, resources: (prev.metadata.resources || []).filter((_, position) => position !== idx) } } : null)}>Remove guide</button></div>
                        </div>
                      </div>;
                    })}
                  </fieldset>

                  {/* Section: Markdown Documentation Guide */}
                  <fieldset className="dev-section">
                    <div className="dev-section-header">
                      <legend>Markdown Guide (must include ## Install and ## Support)</legend>
                      <div className="dev-mode-toggle">
                        <button
                          type="button"
                          className={guideViewMode === "edit" ? "active" : ""}
                          onClick={() => setGuideViewMode("edit")}
                        >
                          Editor
                        </button>
                        <button
                          type="button"
                          className={guideViewMode === "split" ? "active" : ""}
                          onClick={() => setGuideViewMode("split")}
                        >
                          Split
                        </button>
                        <button
                          type="button"
                          className={guideViewMode === "preview" ? "active" : ""}
                          onClick={() => setGuideViewMode("preview")}
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    <div className={`dev-guide-editor mode-${guideViewMode}`}>
                      {(guideViewMode === "edit" || guideViewMode === "split") && (
                        <textarea
                          className="dev-textarea"
                          value={editingTool.guide}
                          onChange={(e) => {
                            const guide = e.target.value;
                            setEditingTool((prev) => (prev ? { ...prev, guide } : null));
                          }}
                          placeholder="Write the guide in markdown. Include ## Install and ## Support..."
                          rows={14}
                        />
                      )}
                      {(guideViewMode === "preview" || guideViewMode === "split") && (
                        <div className="dev-preview-pane">
                          <MarkdownDocument content={editingTool.guide} />
                        </div>
                      )}
                    </div>
                  </fieldset>
                </div>
              </div>
            ) : (
              <div className="dev-placeholder">
                <p>Select a software record from the list or click "+ Add Software" to begin.</p>
              </div>
            )}
          </main>
        </div>
      ) : (
        /* Documentation Files Tab */
        <div className="dev-workspace">
          {/* Docs Left Sidebar */}
          <nav aria-label="Documentation Files" className="dev-sidebar">
            <div className="dev-sidebar-tools">
              <h3 style={{ margin: "6px 0", fontSize: "14px" }}>System Docs (docs/*.md)</h3>
            </div>
            <div className="dev-item-list" role="list">
              {docsList.map((doc) => {
                const isSelected = doc.name === selectedDocName;
                return (
                  <button
                    key={doc.name}
                    className={`dev-item-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectDoc(doc.name)}
                  >
                    <Icon name="document" size={18} />
                    <div className="dev-item-info">
                      <strong className="dev-item-name">{doc.name}</strong>
                      <small className="dev-item-sub">
                        {(doc.sizeBytes / 1024).toFixed(1)} KB
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Docs Editor Main */}
          <main className="dev-editor-main">
            {selectedDocName ? (
              <div className="dev-editor-container">
                <div className="dev-editor-bar">
                  <div>
                    <h2>Editing: {selectedDocName}</h2>
                    <span className="dev-filename">docs/{selectedDocName}</span>
                  </div>
                  <div className="dev-action-group">
                    <button
                      className="dev-save-btn"
                      onClick={handleSaveDoc}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save Documentation"}
                    </button>
                  </div>
                </div>

                <div className="dev-form-sections">
                  <fieldset className="dev-section">
                    <div className="dev-section-header">
                      <legend>Markdown Document</legend>
                      <div className="dev-mode-toggle">
                        <button
                          type="button"
                          className={docViewMode === "edit" ? "active" : ""}
                          onClick={() => setDocViewMode("edit")}
                        >
                          Editor
                        </button>
                        <button
                          type="button"
                          className={docViewMode === "split" ? "active" : ""}
                          onClick={() => setDocViewMode("split")}
                        >
                          Split
                        </button>
                        <button
                          type="button"
                          className={docViewMode === "preview" ? "active" : ""}
                          onClick={() => setDocViewMode("preview")}
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    <div className={`dev-guide-editor mode-${docViewMode}`}>
                      {(docViewMode === "edit" || docViewMode === "split") && (
                        <textarea
                          className="dev-textarea"
                          value={editingDocContent}
                          onChange={(e) => setEditingDocContent(e.target.value)}
                          placeholder="Write markdown documentation here..."
                          rows={22}
                        />
                      )}
                      {(docViewMode === "preview" || docViewMode === "split") && (
                        <div className="dev-preview-pane">
                          <MarkdownDocument content={editingDocContent} />
                        </div>
                      )}
                    </div>
                  </fieldset>
                </div>
              </div>
            ) : (
              <div className="dev-placeholder">
                <p>Select a document from the left to edit its content.</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
