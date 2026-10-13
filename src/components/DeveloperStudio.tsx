import { decodeToolEntry, studioResponse } from "./studio/api";
import { MarkdownDocument } from "../markdown";
import { OverviewEditor, SupportEditor, ReleasesEditor, GuidesEditor } from "./studio/ToolSections";
import { Icon, ToolGlyph } from "./ui";

import { useStudioModel } from "./studio/useStudioModel";
export function DeveloperStudio(props: Parameters<typeof useStudioModel>[0]) {
  const {
    activeTab,
    switchWorkspace,
    toolsList,
    docsList,
    onExit,
    statusMessage,
    statusRef,
    validationRecovery,
    loadTools,
    loadDocs,
    setStatusMessage,
    setValidationRecovery,
    conflictDraft,
    selectedToolId,
    headers,
    setConflictDraft,
    editingTool,
    toolSearch,
    setToolSearch,
    isSaving,
    loadingTools,
    handleStartNewTool,
    toolPickerOpen,
    setToolPickerOpen,
    filteredTools,
    isCreatingNewTool,
    handleSelectTool,
    toolDirty,
    handleSaveTool,
    section,
    setSection,
    setEditingTool,
    guideLibraryFiles,
    guideLibraryStatus,
    setGuideLibraryRevision,
    guideViewMode,
    setGuideViewMode,
    docSearch,
    setDocSearch,
    loadingDocs,
    selectedDocName,
    handleSelectDoc,
    loadingDoc,
    docDirty,
    handleSaveDoc,
    docViewMode,
    setDocViewMode,
    editingDocContent,
    setEditingDocContent,
  } = useStudioModel(props);
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
            <p className="dev-header-copy">Maintain software and documentation.</p>
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
            <Icon name="catalog" size={16} /> Software Catalog ({toolsList.length})
          </button>
          <button
            className={`dev-tab-btn ${activeTab === "docs" ? "active" : ""}`}
            onClick={() => {
              switchWorkspace("docs");
            }}
          >
            <Icon name="book" size={16} /> System docs ({docsList.length})
          </button>
          <button className="dev-exit-btn" onClick={onExit} title="Exit Developer Studio">
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
          {statusMessage.tone === "error" && !validationRecovery && (
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
            onClick={() => {
              setStatusMessage(null);
              setValidationRecovery(null);
            }}
            aria-label="Dismiss message"
            className="dev-dismiss-btn"
          >
            &times;
          </button>
        </aside>
      )}

      {conflictDraft && (
        <details className="dev-resource-card">
          <summary>Compare retained draft with the saved record</summary>
          <pre>{conflictDraft}</pre>
          <button
            className="dev-small-btn"
            type="button"
            onClick={async () => {
              const response = await fetch(`/api/developer/tools/${selectedToolId}`, { headers });
              const record = await response.json();
              setConflictDraft(JSON.stringify({ draft: editingTool, saved: record }, null, 2));
            }}
          >
            Load saved record for comparison
          </button>
          <p>
            Reload list replaces the editor only after confirmation. This comparison retains your
            previous draft.
          </p>
        </details>
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
              <button
                type="button"
                className="dev-picker-toggle"
                aria-expanded={toolPickerOpen}
                aria-controls="studio-tool-picker"
                onClick={() => setToolPickerOpen((open) => !open)}
              >
                {toolPickerOpen ? "Hide software" : `Choose software (${toolsList.length})`}
              </button>
            </div>

            <div
              id="studio-tool-picker"
              className="dev-item-list dev-tool-picker-list"
              data-open={toolPickerOpen}
            >
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
                const isSelected = !isCreatingNewTool && tool.id === selectedToolId;
                return (
                  <button
                    key={tool.id}
                    aria-current={isSelected ? "true" : undefined}
                    className={`dev-item-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectTool(tool)}
                  >
                    <ToolGlyph tool={tool.metadata} />
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
          <div className="dev-editor-main">
            {editingTool ? (
              <div className="dev-editor-container">
                {/* Editor Top Bar */}
                <div className="dev-editor-bar">
                  <div>
                    <h2>{isCreatingNewTool ? "New Software Entry" : editingTool.metadata.name}</h2>
                    <span className="dev-record-detail">{editingTool.metadata.company}</span>
                  </div>
                  <div className="dev-action-group">
                    <span className="dev-save-state" role="status">
                      {isSaving ? "Saving…" : toolDirty ? "Unsaved changes" : "All changes saved"}
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
                      validation={validationRecovery}
                    />

                    {/* Section: Support Owner */}
                    <SupportEditor
                      section={section}
                      editingTool={editingTool}
                      setEditingTool={setEditingTool}
                      validation={validationRecovery}
                    />

                    {/* Section: Releases */}
                    <ReleasesEditor
                      section={section}
                      editingTool={editingTool}
                      setEditingTool={setEditingTool}
                      validation={validationRecovery}
                    />

                    <GuidesEditor
                      section={section}
                      editingTool={editingTool}
                      setEditingTool={setEditingTool}
                      guideLibraryFiles={guideLibraryFiles}
                      guideLibraryStatus={guideLibraryStatus}
                      refreshGuideLibrary={() =>
                        setGuideLibraryRevision((revision) => revision + 1)
                      }
                      guideViewMode={guideViewMode}
                      setGuideViewMode={setGuideViewMode}
                      validation={validationRecovery}
                    />
                  </div>
                </fieldset>
                <p className="dev-local-note">
                  Saves to your local working tree. Review changes before publishing.
                </p>
              </div>
            ) : (
              <div className="dev-placeholder">
                <p>Select a software record from the list or click "+ Add Software" to begin.</p>
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
                    {docSearch ? "No matching documents." : "No system documents available."}
                  </p>
                )}
              {docsList
                .filter((doc) => doc.name.toLowerCase().includes(docSearch.toLowerCase()))
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
                      {isSaving ? "Saving…" : docDirty ? "Unsaved changes" : "All changes saved"}
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
                  <fieldset className="dev-section" aria-labelledby="studio-doc-title">
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
                      {(docViewMode === "preview" || docViewMode === "split") && (
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
