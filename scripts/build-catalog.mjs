import { readFile } from "node:fs/promises";
import { generatedCatalogPath, renderGeneratedCatalog, loadCatalogEntries, writeGeneratedCatalog } from "./catalog-content.mjs";

const expected = renderGeneratedCatalog(await loadCatalogEntries());
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = await readFile(generatedCatalogPath, "utf8");
  } catch {
    // The comparison below reports the actionable remediation.
  }
  if (current !== expected) {
    throw new Error("Catalog output is stale. Run: pnpm catalog:build");
  }
  process.stdout.write("Catalog content is valid and generated output is current.\n");
} else {
  await writeGeneratedCatalog();
  process.stdout.write("Catalog content validated and generated output updated.\n");
}
