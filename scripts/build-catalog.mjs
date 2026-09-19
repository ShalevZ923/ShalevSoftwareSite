import { readFile } from "node:fs/promises";
import {
  generatedCatalogPath,
  loadCatalogEntries,
  machineCatalogIndexPath,
  machineCatalogIsCurrent,
  machineCatalogToolsPath,
  renderGeneratedCatalog,
  writeGeneratedCatalog,
} from "./catalog-content.mjs";

const entries = await loadCatalogEntries();
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = await readFile(generatedCatalogPath, "utf8");
  } catch {
    // The comparison below reports the actionable remediation.
  }
  if (current !== renderGeneratedCatalog(entries)) {
    throw new Error("Catalog output is stale. Run: pnpm catalog:build");
  }

  let currentIndex = "";
  let currentTools = "";
  try {
    currentIndex = await readFile(machineCatalogIndexPath, "utf8");
    currentTools = await readFile(machineCatalogToolsPath, "utf8");
  } catch {
    throw new Error("Machine catalog feed is missing. Run: pnpm catalog:build");
  }
  if (!machineCatalogIsCurrent(currentIndex, currentTools, entries)) {
    throw new Error("Machine catalog feed is stale. Run: pnpm catalog:build");
  }
  process.stdout.write("Catalog content is valid and generated output is current.\n");
} else {
  await writeGeneratedCatalog();
  process.stdout.write("Catalog content validated and generated output updated.\n");
}
