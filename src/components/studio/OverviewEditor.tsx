import { availabilityLabel } from "../../catalog";
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

export function OverviewEditor({
  section,
  editingTool,
  setEditingTool,
  isCreatingNewTool,
  validation,
}: EditorProps & { isCreatingNewTool: boolean }) {
  const hasValidationError = validation?.section === "Overview";
  return (
    <fieldset
      className={`dev-section dev-overview${hasValidationError ? " dev-section-invalid" : ""}`}
      hidden={section !== "Overview"}
      tabIndex={hasValidationError ? -1 : undefined}
      data-validation-section="Overview"
    >
      <legend className="sr-only">Overview</legend>
      <div className="dev-grid-2">
        <Field label="Tool name" invalid={validation?.field === "tool-name"}>
          <input
            type="text"
            data-validation-field="tool-name"
            aria-invalid={validation?.field === "tool-name" || undefined}
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
        <Field label="Category" invalid={validation?.field === "category"}>
          <input
            type="text"
            data-validation-field="category"
            aria-invalid={validation?.field === "category" || undefined}
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
        <Field label="Availability">
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
            <option value="Current">{availabilityLabel.Current}</option>
            <option value="New">{availabilityLabel.New}</option>
            <option value="Legacy">{availabilityLabel.Legacy}</option>
          </select>
        </Field>
      </div>

      <Field label="Short description" invalid={validation?.field === "description"}>
        <textarea
          rows={3}
          data-validation-field="description"
          aria-invalid={validation?.field === "description" || undefined}
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

      <div className={validation?.field === "platforms" ? "field field-invalid" : "field"}>
        <span id="studio-platforms-label">Platforms</span>
        <div
          className="dev-checkbox-row"
          data-validation-field="platforms"
          tabIndex={validation?.field === "platforms" ? -1 : undefined}
          role="group"
          aria-labelledby="studio-platforms-label"
        >
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
      </div>

      <Field label="Tags (comma-separated)" invalid={validation?.field === "tags"}>
        <input
          type="text"
          data-validation-field="tags"
          aria-invalid={validation?.field === "tags" || undefined}
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
                const id = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
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
