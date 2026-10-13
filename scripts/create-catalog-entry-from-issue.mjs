import { readFile } from "node:fs/promises";
import { loadTaxonomy, nextCatalogOrder } from "./catalog-content.mjs";
import { saveCatalogEntry } from "./catalog-persistence.mjs";
import { parseCatalogSubmission } from "./catalog-submission.mjs";
const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath)
  throw new Error("GITHUB_EVENT_PATH is required when creating an entry from an issue");
const event = JSON.parse(await readFile(eventPath, "utf8"));
const entry = parseCatalogSubmission({
  body: event.issue?.body,
  updatedAt: event.issue?.updated_at ?? new Date().toISOString(),
  order: await nextCatalogOrder(),
  taxonomy: await loadTaxonomy(),
  source: `issue #${event.issue.number}`,
});
await saveCatalogEntry(entry.metadata, entry.guide, { create: true });
console.log(`Created catalog entry ${entry.metadata.id} from issue #${event.issue.number}.`);
