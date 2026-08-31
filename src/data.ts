import { docs as generatedDocs, tools as generatedTools } from "./generated/catalog";

export type Platform = "Windows" | "Linux" | "macOS" | "Web";
export type Lifecycle = "Current" | "New" | "Legacy";

/** A small, non-sensitive fact shown in a tool's expanded catalog view. */
export type CatalogFact = {
  label: string;
  value: string;
};

/** A reviewed downloadable software release, ordered newest to oldest. */
export type ToolRelease = {
  version: string;
  download: string;
};

/** A local image placed under public/. It is decorative in catalog lists. */
export type ToolImage = {
  src: string;
  alt: string;
};

export type Tool = {
  id: string;
  name: string;
  company: string;
  category: string;
  platforms: Platform[];
  lifecycle: Lifecycle;
  description: string;
  support: { name: string; team: string; initials: string; email: string };
  releases: ToolRelease[];
  updated: string;
  icon: string;
  tags: string[];
  image?: ToolImage;
  facts?: CatalogFact[];
};

// The generator validates every field before emitting this JSON-shaped module.
export const tools: Tool[] = generatedTools as Tool[];
export const docs: Record<string, string> = generatedDocs;

const toolsById = new Map(tools.map((tool) => [tool.id, tool]));

export function getToolById(id: string) {
  return toolsById.get(id);
}
