import { useEffect, useMemo, useRef, useState } from "react";
import { MarkdownDocument } from "../markdown";
import type { ToolEntryPayload } from "./studio/types";
import {
  OverviewEditor,
  SupportEditor,
  ReleasesEditor,
  GuidesEditor,
} from "./studio/ToolSections";
import { Icon, ToolGlyph } from "./ui";

type DocFile = {
  name: string;
  sizeBytes: number;
  modified: string;
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
  onDraftStateChange,
}: {
  token: string;
  onExit: () => void;
  onCatalogUpdated: () => void;
  onDraftStateChange: (dirty: boolean, saving: boolean) => void;
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
  const [guideLibraryStatus, setGuideLibraryStatus] = useState<"loading" | "ready" | "error">("loading");
  const [guideLibraryRevision, setGuideLibraryRevision] = useState(0);

  const [guideViewMode, setGuideViewMode] = useState<
    "split" | "edit" | "preview"
  >("split");
  const [docViewMode, setDocViewMode] = useState<"split" | "edit" | "preview">(
    "split",
  );

  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [section, setSection] = useState("Overview");
  const [docSearch, setDocSearch] = useState("");
  const [savedTool, setSavedTool] = useState("");
  const [savedDoc, setSavedDoc] = useState("");
  const [loadingTools, setLoadingTools] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const statusRef = useRef<HTMLElement>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const docRequest = useRef(0);
  useEffect(() => {
    if (statusMessage?.tone === "error") statusRef.current?.focus();
  }, [statusMessage]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => {
      if (media.matches) {
        setGuideViewMode((mode) => (mode === "split" ? "edit" : mode));
        setDocViewMode((mode) => (mode === "split" ? "edit" : mode));
      }
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const toolDirty =
    !!editingTool &&
    (isCreatingNewTool || JSON.stringify(editingTool) !== savedTool);
  const docDirty = !!selectedDocName && editingDocContent !== savedDoc;
  const dirty = toolDirty || docDirty;
  const canDiscard = (hasChanges: boolean) =>
    !isSaving && (!hasChanges || window.confirm("Discard unsaved changes?"));
  useEffect(() => {
    onDraftStateChange(dirty, isSaving);
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty || isSaving) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, isSaving, onDraftStateChange]);
  const switchWorkspace = (tab: "tools" | "docs") => {
    if (isSaving) return;
    setActiveTab(tab);
    setStatusMessage(null);
  };

  const headers = useMemo(() => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  // Load all tools from developer API
  const loadTools = async (selectInitial = true) => {
    setLoadingTools(true);
    try {
      const res = await fetch("/api/developer/tools", { headers });
      if (!res.ok) {
        throw new Error(`Failed to load tools: ${res.statusText}`);
      }
      const data: ToolEntryPayload[] = await res.json();
      setToolsList(data);
      if (selectInitial && data.length > 0 && !editingTool) {
        setSelectedToolId(data[0].id);
        setEditingTool(JSON.parse(JSON.stringify(data[0])));
        setSavedTool(JSON.stringify(data[0]));
      }
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Error loading tools",
      });
    } finally {
      setLoadingTools(false);
    }
  };

  // Load docs list from developer API
  const loadDocs = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/developer/docs", { headers });
      if (!res.ok) {
        throw new Error(`Failed to load docs: ${res.statusText}`);
      }
      const data: DocFile[] = await res.json();
      setDocsList(data);
      if (data.length > 0 && !selectedDocName) {
        loadSingleDoc(data[0].name);
      }
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Error loading docs",
      });
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadSingleDoc = async (docName: string) => {
    const request = ++docRequest.current;
    setLoadingDoc(true);
    try {
      const res = await fetch(
        `/api/developer/docs/${encodeURIComponent(docName)}`,
        { headers },
      );
      if (!res.ok) throw new Error("Failed to load document");
      const data = await res.json();
      if (request !== docRequest.current) return;
      setEditingDocContent(data.content || "");
      setSavedDoc(data.content || "");
      setSelectedDocName(docName);
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Error reading document",
      });
    } finally {
      if (request === docRequest.current) setLoadingDoc(false);
    }
  };

  useEffect(() => {
    loadTools();
    loadDocs();
  }, [headers]);

  useEffect(() => {
    setGuideLibraryFiles([]);
    if (!selectedToolId) { setGuideLibraryStatus("ready"); return; }
    setGuideLibraryStatus("loading");
    const controller = new AbortController();
    fetch(
      `/api/developer/guide-library/${encodeURIComponent(selectedToolId)}`,
      { headers, signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load guide library");
        return res.json();
      })
      .then((files: string[]) => {
        if (!Array.isArray(files) || files.some((file) => typeof file !== "string"))
          throw new Error("Invalid guide library response");
        if (!controller.signal.aborted) {
          setGuideLibraryFiles(files);
          setGuideLibraryStatus("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setGuideLibraryStatus("error");
      });
    return () => controller.abort();
  }, [headers, selectedToolId, guideLibraryRevision]);

  // Select tool
  const handleSelectTool = (tool: ToolEntryPayload) => {
    if (!canDiscard(toolDirty)) return;
    setIsCreatingNewTool(false);
    setSelectedToolId(tool.id);
    setEditingTool(JSON.parse(JSON.stringify(tool)));
    setSavedTool(JSON.stringify(tool));
    setSection("Overview");
    setStatusMessage(null);
  };

  // Select doc
  const handleSelectDoc = (docName: string) => {
    if (!canDiscard(docDirty)) return;
    loadSingleDoc(docName);
    setStatusMessage(null);
  };

  // Start new tool
  const handleStartNewTool = () => {
    if (!canDiscard(toolDirty)) return;
    setSection("Overview");
    const nextOrder =
      toolsList.reduce(
        (max, item) => Math.max(max, item.metadata.order || 0),
        0,
      ) + 1;
    const freshTool: ToolEntryPayload = JSON.parse(
      JSON.stringify(defaultNewTool),
    );
    freshTool.metadata.order = nextOrder;
    setIsCreatingNewTool(true);
    setSelectedToolId("");
    setEditingTool(freshTool);
    setStatusMessage(null);
  };

  // Save Tool Changes
  const handleSaveTool = async () => {
    if (!editingTool || isSaving) return;
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
      setSavedTool(JSON.stringify(editingTool));
      setIsCreatingNewTool(false);
      setSelectedToolId(editingTool.id);
      await loadTools(false);
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
    if (!selectedDocName || isSaving || loadingDoc) return;
    setIsSaving(true);
    setStatusMessage({ tone: "info", text: "Saving documentation..." });

    try {
      const res = await fetch(
        `/api/developer/docs/${encodeURIComponent(selectedDocName)}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ content: editingDocContent }),
        },
      );
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || `Failed to save ${selectedDocName}`);
      }
      setStatusMessage({
        tone: "success",
        text: `Successfully saved docs/${selectedDocName}!`,
      });
      setSavedDoc(editingDocContent);
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
            <h1 id="page-title" tabIndex={-1}>
              Developer Studio
            </h1>
            <p className="dev-header-copy">
              Maintain software and documentation.
            </p>
            <span className="dev-badge-connected">Local editing</span>
          </div>
        </div>
        <div className="dev-header-actions">
          <button
            className={`dev-tab-btn ${activeTab === "tools" ? "active" : ""}`}
            onClick={() => {
              switchWorkspace("tools");
            }}
          >
            <Icon name="catalog" size={16} /> Software Catalog (
            {toolsList.length})
          </button>
          <button
            className={`dev-tab-btn ${activeTab === "docs" ? "active" : ""}`}
            onClick={() => {
              switchWorkspace("docs");
            }}
          >
            <Icon name="book" size={16} /> System docs ({docsList.length})
          </button>
          <button
            className="dev-exit-btn"
            onClick={onExit}
            title="Exit Developer Studio"
          >
            <Icon name="close" size={16} /> Exit Studio
          </button>
        </div>
      </header>

      {/* Global Status Banner */}
      {statusMessage && (
        <aside
          ref={statusRef}
          tabIndex={-1}
          role={statusMessage.tone === "error" ? "alert" : "status"}
          aria-live={statusMessage.tone === "error" ? "assertive" : "polite"}
          className={`dev-status-banner tone-${statusMessage.tone}`}
        >
          <span>{statusMessage.text}</span>
          {statusMessage.tone === "error" && (
            <button
              className="dev-small-btn"
              onClick={() => {
                if (activeTab === "tools") void loadTools();
                else void loadDocs();
              }}
            >
              Reload list
            </button>
          )}
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
              <button
                className="dev-create-btn"
                disabled={isSaving || loadingTools}
                onClick={handleStartNewTool}
              >
                + Add Software
              </button>
            </div>

            <div className="dev-item-list">
              {loadingTools && (
                <p className="dev-list-message" role="status">
                  Loading software…
                </p>
              )}
              {!loadingTools && filteredTools.length === 0 && (
                <p className="dev-list-message">
                  {toolSearch
                    ? "No matching software. Try another search."
                    : "No software yet. Add your first tool."}
                </p>
              )}
              {filteredTools.map((tool) => {
                const isSelected =
                  !isCreatingNewTool && tool.id === selectedToolId;
                return (
                  <button
                    key={tool.id}
                    aria-current={isSelected ? "true" : undefined}
                    className={`dev-item-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectTool(tool)}
                  >
                    <ToolGlyph tool={tool.metadata} />
                    <div className="dev-item-info">
                      <strong className="dev-item-name">
                        {tool.metadata.name}
                      </strong>
                      <small className="dev-item-sub">
                        {tool.metadata.category} &bull;{" "}
                        {tool.metadata.lifecycle}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Right Column: Tool Editor Form & Markdown Guide */}
          <div className="dev-editor-main">
            {editingTool ? (
              <div className="dev-editor-container">
                {/* Editor Top Bar */}
                <div className="dev-editor-bar">
                  <div>
                    <h2>
                      {isCreatingNewTool
                        ? "New Software Entry"
                        : editingTool.metadata.name}
                    </h2>
                    <span className="dev-record-detail">
                      {editingTool.metadata.company}
                    </span>
                  </div>
                  <div className="dev-action-group">
                    <span className="dev-save-state" role="status">
                      {isSaving
                        ? "Saving…"
                        : toolDirty
                          ? "Unsaved changes"
                          : "All changes saved"}
                    </span>
                    <button
                      className="dev-save-btn"
                      onClick={handleSaveTool}
                      disabled={isSaving || !toolDirty}
                    >
                      {isSaving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </div>

                <nav className="dev-section-nav" aria-label="Tool sections">
                  {["Overview", "Releases", "Guides", "Support"].map((name) => (
                    <button
                      key={name}
                      type="button"
                      aria-current={section === name ? "true" : undefined}
                      className={section === name ? "active" : ""}
                      onClick={() => setSection(name)}
                    >
                      {name}
                    </button>
                  ))}
                </nav>
                <fieldset className="dev-form-body" disabled={isSaving}>
                  <div className="dev-form-sections">
                    {/* Section: Metadata */}
                    <OverviewEditor
                      section={section}
                      editingTool={editingTool}
                      setEditingTool={setEditingTool}
                      isCreatingNewTool={isCreatingNewTool}
                    />

                    {/* Section: Support Owner */}
                    <SupportEditor
                      section={section}
                      editingTool={editingTool}
                      setEditingTool={setEditingTool}
                    />

                    {/* Section: Releases */}
                    <ReleasesEditor
                      section={section}
                      editingTool={editingTool}
                      setEditingTool={setEditingTool}
                    />

                    <GuidesEditor
                      section={section}
                      editingTool={editingTool}
                      setEditingTool={setEditingTool}
                      guideLibraryFiles={guideLibraryFiles}
                      guideLibraryStatus={guideLibraryStatus}
                      refreshGuideLibrary={() => setGuideLibraryRevision((revision) => revision + 1)}
                      guideViewMode={guideViewMode}
                      setGuideViewMode={setGuideViewMode}
                    />
                  </div>
                </fieldset>
                <p className="dev-local-note">
                  Saves to your local working tree. Review changes before
                  publishing.
                </p>
              </div>
            ) : (
              <div className="dev-placeholder">
                <p>
                  Select a software record from the list or click "+ Add
                  Software" to begin.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Documentation Files Tab */
        <div className="dev-workspace">
          {/* Docs Left Sidebar */}
          <nav aria-label="Documentation Files" className="dev-sidebar">
            <div className="dev-sidebar-tools">
              <label className="dev-search-box">
                <Icon name="search" size={16} />
                <input
                  aria-label="Search system docs"
                  placeholder="Search documents…"
                  value={docSearch}
                  onChange={(event) => setDocSearch(event.target.value)}
                />
              </label>
            </div>
            <div className="dev-item-list">
              {loadingDocs && (
                <p className="dev-list-message" role="status">
                  Loading documents…
                </p>
              )}
              {!loadingDocs &&
                !docsList.some((doc) =>
                  doc.name.toLowerCase().includes(docSearch.toLowerCase()),
                ) && (
                  <p className="dev-list-message">
                    {docSearch
                      ? "No matching documents."
                      : "No system documents available."}
                  </p>
                )}
              {docsList
                .filter((doc) =>
                  doc.name.toLowerCase().includes(docSearch.toLowerCase()),
                )
                .map((doc) => {
                  const isSelected = doc.name === selectedDocName;
                  return (
                    <button
                      key={doc.name}
                      aria-current={isSelected ? "true" : undefined}
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
          <div className="dev-editor-main" aria-busy={loadingDoc}>
            {loadingDoc && (
              <p role="status" className="dev-list-message">
                Loading document…
              </p>
            )}
            {selectedDocName ? (
              <div className="dev-editor-container">
                <div className="dev-editor-bar">
                  <div>
                    <h2>{selectedDocName}</h2>
                    <span className="dev-filename">docs/{selectedDocName}</span>
                  </div>
                  <div className="dev-action-group">
                    <span className="dev-save-state" role="status">
                      {isSaving
                        ? "Saving…"
                        : docDirty
                          ? "Unsaved changes"
                          : "All changes saved"}
                    </span>
                    <button
                      className="dev-save-btn"
                      onClick={handleSaveDoc}
                      disabled={isSaving || !docDirty || loadingDoc}
                    >
                      {isSaving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </div>

                <div className="dev-form-sections">
                  <fieldset
                    className="dev-section"
                    aria-labelledby="studio-doc-title"
                  >
                    <div className="dev-section-header">
                      <h3 id="studio-doc-title">Markdown document</h3>
                      <div className="dev-mode-toggle">
                        <button
                          type="button"
                          className={docViewMode === "edit" ? "active" : ""}
                          aria-pressed={docViewMode === "edit"}
                          onClick={() => setDocViewMode("edit")}
                        >
                          Editor
                        </button>
                        <button
                          type="button"
                          className={`dev-split-toggle ${docViewMode === "split" ? "active" : ""}`}
                          aria-pressed={docViewMode === "split"}
                          onClick={() => setDocViewMode("split")}
                        >
                          Split
                        </button>
                        <button
                          type="button"
                          className={docViewMode === "preview" ? "active" : ""}
                          aria-pressed={docViewMode === "preview"}
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
                          aria-label="Document Markdown"
                          disabled={isSaving || loadingDoc}
                          value={editingDocContent}
                          onChange={(e) => setEditingDocContent(e.target.value)}
                          placeholder="Write markdown documentation here..."
                          rows={22}
                        />
                      )}
                      {(docViewMode === "preview" ||
                        docViewMode === "split") && (
                        <div className="dev-preview-pane markdown">
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
          </div>
        </div>
      )}
    </div>
  );
}
