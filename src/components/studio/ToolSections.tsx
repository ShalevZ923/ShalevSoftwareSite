import type { Dispatch, SetStateAction } from "react";
import type {
  GuideResource,
  Lifecycle,
  Platform,
  ToolRelease,
} from "../../data";
import { Field } from "../ui";
import { MarkdownDocument } from "../../markdown";
import type { ToolEntryPayload } from "./types";

type EditorProps = {
  section: string;
  editingTool: ToolEntryPayload;
  setEditingTool: Dispatch<SetStateAction<ToolEntryPayload | null>>;
};
type ViewMode = "edit" | "split" | "preview";

export function OverviewEditor({
  section,
  editingTool,
  setEditingTool,
  isCreatingNewTool,
}: EditorProps & { isCreatingNewTool: boolean }) {
  return (
    <fieldset
      className="dev-section dev-overview"
      hidden={section !== "Overview"}
    >
      <legend className="sr-only">Overview</legend>
      <div className="dev-grid-2">
        <Field label="Tool name">
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
      </div>

      <div className="dev-grid-3">
        <Field label="Vendor">
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
      </div>

      <div className="dev-grid-3">
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
      </div>

      <Field label="Short description">
        <textarea
          rows={3}
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

      <div className="field">
        <span id="studio-platforms-label">Platforms</span>
        <div
          className="dev-checkbox-row"
          role="group"
          aria-labelledby="studio-platforms-label"
        >
          {(["Windows", "Linux", "macOS", "Web"] as Platform[]).map(
            (platform) => {
              const checked = editingTool.metadata.platforms.includes(platform);
              return (
                <label key={platform} className="dev-check-label">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const platforms = e.target.checked
                        ? [...editingTool.metadata.platforms, platform]
                        : editingTool.metadata.platforms.filter(
                            (p) => p !== platform,
                          );
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
            },
          )}
        </div>
      </div>

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
      <details className="dev-appearance">
        <summary>Appearance and ordering</summary>
        <div className="dev-grid-2">
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
      </details>
    </fieldset>
  );
}

export function SupportEditor({
  section,
  editingTool,
  setEditingTool,
}: EditorProps) {
  return (
    <fieldset className="dev-section" hidden={section !== "Support"}>
      <legend>Support owner</legend>
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
  );
}

export function ReleasesEditor({
  section,
  editingTool,
  setEditingTool,
}: EditorProps) {
  return (
    <fieldset
      className="dev-section"
      hidden={section !== "Releases"}
      aria-labelledby="studio-releases-title"
    >
      <div className="dev-section-header">
        <h3 id="studio-releases-title">Approved releases</h3>
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

      <p className="dev-section-help">
        The first release is the default download shown in the catalog.
      </p>
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
                value={
                  rel.download ||
                  (rel.artifact ? `artifact:${rel.artifact}` : "")
                }
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
              const releases = editingTool.metadata.releases.filter(
                (_, i) => i !== idx,
              );
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
  );
}

export function GuidesEditor({
  section,
  editingTool,
  setEditingTool,
  guideLibraryFiles,
  guideViewMode,
  setGuideViewMode,
}: EditorProps & {
  guideLibraryFiles: string[];
  guideViewMode: ViewMode;
  setGuideViewMode: Dispatch<SetStateAction<ViewMode>>;
}) {
  return (
    <>
      <fieldset
        className="dev-section"
        hidden={section !== "Guides"}
        aria-labelledby="studio-resources-title"
      >
        <div className="dev-section-header">
          <div>
            <h3 id="studio-resources-title">Guides &amp; files</h3>
            <p className="dev-section-help">
              Attach an approved SharePoint/intranet link or select a PDF or
              PowerPoint already placed in this tool&apos;s server guide
              library.
            </p>
          </div>
          <button
            type="button"
            className="dev-small-btn"
            onClick={() => {
              const resource: GuideResource = {
                id: "new-guide",
                title: "New guide",
                kind: "internal-guide",
                format: "pdf",
                url: "https://",
                appliesTo: [
                  editingTool.metadata.releases[0]?.version || "Current",
                ],
                owner: editingTool.metadata.support.team,
                reviewedOn: new Date().toISOString().slice(0, 10),
              };
              setEditingTool((prev) =>
                prev
                  ? {
                      ...prev,
                      metadata: {
                        ...prev.metadata,
                        resources: [
                          ...(prev.metadata.resources || []),
                          resource,
                        ],
                      },
                    }
                  : null,
              );
            }}
          >
            + Add guide
          </button>
        </div>
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
            <div className="dev-resource-card" key={`${resource.id}-${idx}`}>
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
                    onChange={(e) =>
                      update({ kind: e.target.value as GuideResource["kind"] })
                    }
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
                                guideLibraryFiles[0] ||
                                `${editingTool.id}/guide.pdf`,
                              url: undefined,
                            }
                          : { url: "https://", file: undefined },
                      );
                    }}
                  >
                    <option value="url">Approved HTTPS link</option>
                    <option value="file" disabled={resource.format === "web"}>
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
                      {guideLibraryFiles.length ? (
                        guideLibraryFiles.map((file) => (
                          <option key={file} value={file}>
                            {file}
                          </option>
                        ))
                      ) : (
                        <option value={resource.file}>{resource.file}</option>
                      )}
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
                  <input
                    value={resource.appliesTo.join(", ")}
                    onChange={(e) =>
                      update({
                        appliesTo: e.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
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
                                resources: (
                                  prev.metadata.resources || []
                                ).filter((_, position) => position !== idx),
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
          );
        })}
      </fieldset>

      {/* Section: Markdown Documentation Guide */}
      <fieldset
        className="dev-section"
        hidden={section !== "Guides"}
        aria-labelledby="studio-guide-title"
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
