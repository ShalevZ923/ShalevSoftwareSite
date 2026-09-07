export type StudioSection = "Overview" | "Releases" | "Guides" | "Support";

export type ValidationRecovery = {
  section: StudioSection;
  field: string;
  guidance: string;
};

/** Maps catalog-validator terms to the editor control most likely to fix them. */
export function getToolValidationRecovery(message: string): ValidationRecovery {
  const error = message.toLocaleLowerCase();
  const releaseIndex = error.match(/releases\[(\d+)\]/u)?.[1] ?? "0";
  if (error.includes("resource") || error.includes("guide")) {
    return {
      section: "Guides",
      field: error.includes("guide must") ? "guide-markdown" : "guide-resource",
      guidance: "Review the guide source, metadata, and version applicability in Guides.",
    };
  }
  if (error.includes("support.email")) {
    return {
      section: "Support",
      field: "support-email",
      guidance: "Enter a valid support email address in Support.",
    };
  }
  if (error.includes("support.")) {
    return {
      section: "Support",
      field: "support-owner",
      guidance: "Complete the support owner details in Support.",
    };
  }
  if (error.includes("release") || error.includes("download") || error.includes("artifact")) {
    return {
      section: "Releases",
      field: error.includes("version") ? `release-version-${releaseIndex}` : `release-target-${releaseIndex}`,
      guidance: "Check the release version and its approved download source in Releases.",
    };
  }
  if (error.includes("category")) {
    return { section: "Overview", field: "category", guidance: "Choose a valid catalog category in Overview." };
  }
  if (error.includes("platform")) {
    return { section: "Overview", field: "platforms", guidance: "Select at least one supported platform in Overview." };
  }
  if (error.includes("tag")) {
    return { section: "Overview", field: "tags", guidance: "Add at least one catalog tag in Overview." };
  }
  if (error.includes("description")) {
    return { section: "Overview", field: "description", guidance: "Add a short description in Overview." };
  }
  if (error.includes("name")) {
    return { section: "Overview", field: "tool-name", guidance: "Complete the tool name in Overview." };
  }
  return { section: "Overview", field: "overview", guidance: "Review the required details in Overview." };
}
