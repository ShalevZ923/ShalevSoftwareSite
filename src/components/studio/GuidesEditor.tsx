import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { nextGuideId, parseGuideVersions } from "./guideEditing";
import {
  getReleaseSource,
  getServerFilename,
  makeDefaultRelease,
  withReleaseSource,
  withReleaseVersion,
  withServerFilename,
} from "./releaseEditing";
import type { ValidationRecovery } from "./saveValidation";
import type { GuideResource, Lifecycle, Platform, ToolRelease } from "../../data";
import { Field } from "../ui";
import { MarkdownDocument } from "../../markdown";
import type { ToolEntryPayload } from "./types";

type EditorProps = {
  section: string;
  editingTool: ToolEntryPayload;
  setEditingTool: Dispatch<SetStateAction<ToolEntryPayload | null>>;
  validation?: ValidationRecovery | null;
};
type ViewMode = "edit" | "split" | "preview";

function GuideVersionsInput({
  versions,
  onChange,
}: {
  versions: string[];
  onChange: (versions: string[]) => void;
}) {
  const [text, setText] = useState(() => versions.join(", "));
  useEffect(() => {
    if (JSON.stringify(parseGuideVersions(text)) !== JSON.stringify(versions))
      setText(versions.join(", "));
  }, [versions, text]);
  return (
    <input
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange(parseGuideVersions(event.target.value));
      }}
    />
  );
}

export function GuidesEditor({
  section,
  editingTool,
  setEditingTool,
  guideLibraryFiles,
  guideLibraryStatus,
  refreshGuideLibrary,
  guideViewMode,
  setGuideViewMode,
  validation,
}: EditorProps & {
  guideLibraryFiles: string[];
  guideLibraryStatus: "loading" | "ready" | "error";
  refreshGuideLibrary: () => void;
  guideViewMode: ViewMode;
  setGuideViewMode: Dispatch<SetStateAction<ViewMode>>;
}) {
  const hasValidationError = validation?.section === "Guides";
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(null);
  useEffect(() => setExpandedGuideId(null), [editingTool.id]);
  return (
    <>
      <fieldset
        className={`dev-section${hasValidationError ? " dev-section-invalid" : ""}`}
        hidden={section !== "Guides"}
        aria-labelledby="studio-resources-title"
        tabIndex={hasValidationError ? -1 : undefined}
        data-validation-section="Guides"
      >
        <div className="dev-section-header">
          <div>
            <h3 id="studio-resources-title">Guides &amp; files</h3>
            <p className="dev-section-help">
              Attach an approved SharePoint/intranet link or select a PDF or PowerPoint already
              placed in this tool&apos;s server guide library.
            </p>
          </div>
          <button
            type="button"
            className="dev-small-btn"
            onClick={() => {
              const resource: GuideResource = {
                id: nextGuideId(editingTool.metadata.resources || []),
                title: "New guide",
                kind: "internal-guide",
                format: "pdf",
                url: "https://",
                appliesTo: [editingTool.metadata.releases[0]?.version || "Current"],
                owner: editingTool.metadata.support.team,
                reviewedOn: new Date().toISOString().slice(0, 10),
              };
              setExpandedGuideId(resource.id);
              setEditingTool((prev) =>
                prev
                  ? {
                      ...prev,
                      metadata: {
                        ...prev.metadata,
                        resources: [...(prev.metadata.resources || []), resource],
                      },
                    }
                  : null,
              );
            }}
          >
            + Add guide
          </button>
        </div>
        <p role={guideLibraryStatus === "error" ? "alert" : "status"} className="dev-section-help">
          {guideLibraryStatus === "loading"
            ? "Loading server guide library…"
            : guideLibraryStatus === "error"
              ? "Could not load server files. Refresh to try again."
              : guideLibraryFiles.length === 0
                ? "No server files available. Ask an administrator to place a PDF or PowerPoint in this tool's guide library, then refresh. For a new tool, save it first."
                : `${guideLibraryFiles.length} server files available.`}
        </p>
        <button
          type="button"
          className="dev-small-btn"
          disabled={guideLibraryStatus === "loading"}
          onClick={refreshGuideLibrary}
        >
          Refresh server files
        </button>
        {(editingTool.metadata.resources || []).map((resource, idx) => {
          const update = (change: Partial<GuideResource>) =>
            setEditingTool((prev) => {
              if (!prev) return null;
              const resources = [...(prev.metadata.resources || [])];
              resources[idx] = { ...resources[idx], ...change };
              return { ...prev, metadata: { ...prev.metadata, resources } };
            });
          const isFile = resource.file !== undefined;
          return (
            <details
              className={
                validation?.field === "guide-resource"
                  ? "dev-resource-card dev-field-invalid"
                  : "dev-resource-card"
              }
              key={`${resource.id}-${idx}`}
              data-validation-field="guide-resource"
              open={expandedGuideId === resource.id}
              onToggle={(event) =>
                setExpandedGuideId(event.currentTarget.open ? resource.id : null)
              }
            >
              <summary>
                <span>
                  <strong>{resource.title || "Untitled guide"}</strong>
                  <small>
                    {resource.format.toUpperCase()} ·{" "}
                    {resource.appliesTo.join(", ") || "No versions selected"}
                  </small>
                </span>
                <span>Edit</span>
              </summary>
              <div className="dev-resource-form">
                <div className="dev-grid-3">
                  <Field label="Title">
                    <input
                      value={resource.title}
                      onChange={(e) => update({ title: e.target.value })}
                    />
                  </Field>
                  <Field label="Type">
                    <select
                      value={resource.kind}
                      onChange={(e) => update({ kind: e.target.value as GuideResource["kind"] })}
                    >
                      <option value="official-manual">Official manual</option>
                      <option value="internal-guide">Internal guide</option>
                      <option value="training">Training</option>
                    </select>
                  </Field>
                  <Field label="Format">
                    <select
                      value={resource.format}
                      onChange={(e) =>
                        update({
                          format: e.target.value as GuideResource["format"],
                        })
                      }
                    >
                      <option value="pdf">PDF</option>
                      <option value="pptx">PowerPoint</option>
                      <option value="web">Web page</option>
                    </select>
                  </Field>
                </div>
                <div className="dev-grid-3">
                  <Field label="Source">
                    <select
                      value={isFile ? "file" : "url"}
                      onChange={(e) => {
                        const file = e.target.value === "file";
                        update(
                          file
                            ? {
                                file:
                                  guideLibraryFiles.find((file) =>
                                    file.endsWith(`.${resource.format}`),
                                  ) || "",
                                url: undefined,
                              }
                            : { url: "https://", file: undefined },
                        );
                      }}
                    >
                      <option value="url">Approved HTTPS link</option>
                      <option
                        value="file"
                        disabled={
                          resource.format === "web" ||
                          guideLibraryStatus !== "ready" ||
                          !guideLibraryFiles.some((file) => file.endsWith(`.${resource.format}`))
                        }
                      >
                        Server guide library
                      </option>
                    </select>
                  </Field>
                  {isFile ? (
                    <Field label="Server file">
                      <select
                        value={resource.file}
                        onChange={(e) => update({ file: e.target.value })}
                      >
                        {!guideLibraryFiles.some(
                          (file) => file === resource.file && file.endsWith(`.${resource.format}`),
                        ) && (
                          <option value={resource.file || ""}>
                            {resource.file
                              ? `${resource.file} — unavailable`
                              : "Select a server file"}
                          </option>
                        )}
                        {guideLibraryFiles
                          .filter((file) => file.endsWith(`.${resource.format}`))
                          .map((file) => (
                            <option key={file} value={file}>
                              {file}
                            </option>
                          ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="SharePoint or intranet HTTPS URL">
                      <input
                        value={resource.url || ""}
                        onChange={(e) => update({ url: e.target.value })}
                      />
                    </Field>
                  )}
                  <Field label="Applies to versions">
                    <GuideVersionsInput
                      key={`${editingTool.id}-${resource.id}`}
                      versions={resource.appliesTo}
                      onChange={(appliesTo) => update({ appliesTo })}
                    />
                  </Field>
                </div>
                <div className="dev-grid-3">
                  <Field label="Owner">
                    <input
                      value={resource.owner}
                      onChange={(e) => update({ owner: e.target.value })}
                    />
                  </Field>
                  <Field label="Reviewed on">
                    <input
                      type="date"
                      value={resource.reviewedOn}
                      onChange={(e) => update({ reviewedOn: e.target.value })}
                    />
                  </Field>
                  <div className="dev-resource-remove">
                    <button
                      type="button"
                      className="dev-danger-btn"
                      onClick={() =>
                        setEditingTool((prev) =>
                          prev
                            ? {
                                ...prev,
                                metadata: {
                                  ...prev.metadata,
                                  resources: (prev.metadata.resources || []).filter(
                                    (_, position) => position !== idx,
                                  ),
                                },
                              }
                            : null,
                        )
                      }
                    >
                      Remove guide
                    </button>
                  </div>
                </div>
              </div>
            </details>
          );
        })}
      </fieldset>

      {/* Section: Markdown Documentation Guide */}
      <fieldset
        className={`dev-section${hasValidationError ? " dev-section-invalid" : ""}`}
        hidden={section !== "Guides"}
        aria-labelledby="studio-guide-title"
        tabIndex={hasValidationError ? -1 : undefined}
      >
        <div className="dev-section-header">
          <h3 id="studio-guide-title">Markdown guide</h3>
          <div className="dev-mode-toggle">
            <button
              type="button"
              className={guideViewMode === "edit" ? "active" : ""}
              aria-pressed={guideViewMode === "edit"}
              onClick={() => setGuideViewMode("edit")}
            >
              Editor
            </button>
            <button
              type="button"
              className={`dev-split-toggle ${guideViewMode === "split" ? "active" : ""}`}
              aria-pressed={guideViewMode === "split"}
              onClick={() => setGuideViewMode("split")}
            >
              Split
            </button>
            <button
              type="button"
              className={guideViewMode === "preview" ? "active" : ""}
              aria-pressed={guideViewMode === "preview"}
              onClick={() => setGuideViewMode("preview")}
            >
              Preview
            </button>
          </div>
        </div>

        <p id="studio-guide-help" className="dev-section-help">
          Include Install and Support headings in the guide.
        </p>
        <div className={`dev-guide-editor mode-${guideViewMode}`}>
          {(guideViewMode === "edit" || guideViewMode === "split") && (
            <textarea
              className="dev-textarea"
              aria-label="Guide Markdown"
              data-validation-field="guide-markdown"
              aria-invalid={validation?.field === "guide-markdown" || undefined}
              value={editingTool.guide}
              onChange={(e) => {
                const guide = e.target.value;
                setEditingTool((prev) => (prev ? { ...prev, guide } : null));
              }}
              placeholder="Write the guide in markdown. Include ## Install and ## Support..."
              aria-describedby="studio-guide-help"
              rows={14}
            />
          )}
          {(guideViewMode === "preview" || guideViewMode === "split") && (
            <div className="dev-preview-pane markdown">
              <MarkdownDocument content={editingTool.guide} />
            </div>
          )}
        </div>
      </fieldset>
    </>
  );
}
