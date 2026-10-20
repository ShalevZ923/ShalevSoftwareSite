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

export function SupportEditor({ section, editingTool, setEditingTool, validation }: EditorProps) {
  const hasValidationError = validation?.section === "Support";
  return (
    <fieldset
      className={`dev-section${hasValidationError ? " dev-section-invalid" : ""}`}
      hidden={section !== "Support"}
      tabIndex={hasValidationError ? -1 : undefined}
      data-validation-section="Support"
    >
      <legend>Support owner</legend>
      <div className="dev-grid-3">
        <Field label="Owner Name" invalid={validation?.field === "support-owner"}>
          <input
            type="text"
            data-validation-field="support-owner"
            aria-invalid={validation?.field === "support-owner" || undefined}
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
        <Field label="Support Email" invalid={validation?.field === "support-email"}>
          <input
            type="email"
            data-validation-field="support-email"
            aria-invalid={validation?.field === "support-email" || undefined}
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
