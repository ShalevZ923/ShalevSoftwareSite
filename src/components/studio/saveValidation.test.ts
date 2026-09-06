import { describe, expect, it } from "vitest";
import { getToolValidationRecovery } from "./saveValidation";

describe("catalog save validation recovery", () => {
  it.each([
    ["releases[1].artifact version must match the release version", "Releases", "release-version-1"],
    ["resources.file extension must match resources.format", "Guides", "guide-resource"],
    ["support.email must be an email address", "Support", "support-email"],
    ["platforms must be a non-empty list of strings", "Overview", "platforms"],
  ])("routes %s to the relevant editor control", (message, section, field) => {
    expect(getToolValidationRecovery(message)).toMatchObject({ section, field });
  });
});
