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

export function ReleasesEditor({ section, editingTool, setEditingTool, validation }: EditorProps) {
  const hasValidationError = validation?.section === "Releases";
  return (
    <fieldset
      className={`dev-section${hasValidationError ? " dev-section-invalid" : ""}`}
      hidden={section !== "Releases"}
      aria-labelledby="studio-releases-title"
      tabIndex={hasValidationError ? -1 : undefined}
      data-validation-section="Releases"
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
      {editingTool.metadata.releases.map((rel, idx) => {
        const versionField = `release-version-${idx}`;
        const targetField = `release-target-${idx}`;
        return (
          <div key={idx} className="dev-release-row">
            <div style={{ width: "120px" }}>
              <Field label="Version" invalid={validation?.field === versionField}>
                <input
                  type="text"
                  data-validation-field={versionField}
                  aria-invalid={validation?.field === versionField || undefined}
                  value={rel.version}
                  onChange={(e) => {
                    const releases = [...editingTool.metadata.releases];
                    releases[idx] = withReleaseVersion(rel, e.target.value, editingTool.id);
                    setEditingTool((prev) =>
                      prev
                        ? {
                            ...prev,
                            metadata: {
                              ...prev.metadata,
                              releases,
                              resources: prev.metadata.resources?.map((resource) => ({
                                ...resource,
                                appliesTo: resource.appliesTo.map((version) =>
                                  version === rel.version ? e.target.value : version,
                                ),
                              })),
                            },
                          }
                        : null,
                    );
                  }}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Source">
                <select
                  value={getReleaseSource(rel)}
                  onChange={(e) => {
                    const releases = [...editingTool.metadata.releases];
                    releases[idx] = withReleaseSource(
                      rel,
                      e.target.value as "url" | "server-file",
                      editingTool.id,
                    );
                    setEditingTool((prev) =>
                      prev ? { ...prev, metadata: { ...prev.metadata, releases } } : null,
                    );
                  }}
                >
                  <option value="url">Approved HTTPS URL</option>
                  <option value="server-file">Server file</option>
                </select>
              </Field>
            </div>
            <div style={{ flex: 2 }}>
              {getReleaseSource(rel) === "url" ? (
                <Field
                  label="Approved HTTPS download URL"
                  invalid={validation?.field === targetField}
                >
                  <input
                    type="url"
                    data-validation-field={targetField}
                    aria-invalid={validation?.field === targetField || undefined}
                    value={"download" in rel ? rel.download : ""}
                    onChange={(e) => {
                      const releases = [...editingTool.metadata.releases];
                      releases[idx] = { version: rel.version, download: e.target.value.trim() };
                      setEditingTool((prev) =>
                        prev ? { ...prev, metadata: { ...prev.metadata, releases } } : null,
                      );
                    }}
                  />
                </Field>
              ) : (
                <Field label="Server file name" invalid={validation?.field === targetField}>
                  <input
                    type="text"
                    data-validation-field={targetField}
                    aria-invalid={validation?.field === targetField || undefined}
                    value={getServerFilename(rel)}
                    placeholder="tool-installer.msi"
                    onChange={(e) => {
                      const releases = [...editingTool.metadata.releases];
                      releases[idx] = withServerFilename(rel, e.target.value, editingTool.id);
                      setEditingTool((prev) =>
                        prev ? { ...prev, metadata: { ...prev.metadata, releases } } : null,
                      );
                    }}
                  />
                </Field>
              )}
            </div>
            {idx === 0 ? (
              <span className="dev-release-default" aria-label="Default download">
                Default download
              </span>
            ) : (
              <button
                type="button"
                className="dev-small-btn"
                onClick={() =>
                  setEditingTool((prev) =>
                    prev
                      ? {
                          ...prev,
                          metadata: {
                            ...prev.metadata,
                            releases: makeDefaultRelease(prev.metadata.releases, idx),
                          },
                        }
                      : null,
                  )
                }
              >
                Make default
              </button>
            )}
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
        );
      })}
    </fieldset>
  );
}
