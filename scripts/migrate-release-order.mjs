import { loadCatalogEntries } from "./catalog-content.mjs";
import { saveCatalogEntry } from "./catalog-persistence.mjs";
import { recordRevision } from "./mutation-coordinator.mjs";
const entries = await loadCatalogEntries();
if (!process.argv.includes("--apply"))
  console.log(
    `Validated ${entries.length} records; --apply persists their current release order transactionally.`,
  );
else
  for (const entry of entries)
    await saveCatalogEntry(entry.metadata, entry.guide, { revision: recordRevision(entry) });
