import { describe, it, expect } from "vitest";
import { parseCatalogSubmission } from "./catalog-submission.mjs";
import { loadTaxonomy } from "./catalog-content.mjs";
describe("paired provider submissions", () => {
  it("normalizes equivalent GitHub/GitLab fields", async () => {
    const taxonomy = await loadTaxonomy();
    const fields = {
      "Software name": "One",
      "Vendor or company": "Team",
      "Category ID": taxonomy[0].id,
      "Supported platforms": "- [x] Windows",
      Lifecycle: "Current",
      "Catalog tile": "ON",
      "Approved releases": "1.0 | https://example.com/one",
      "Short description": "One utility",
      "Support owner": "Owner Name",
      "Support team": "Team",
      "Support email": "owner@example.com",
      Tags: "One, Test",
      "Installation and support guide": "## Install\nInstall.\n## Support\nSupport.",
    };
    const body = Object.entries(fields)
      .map(([key, value]) => `### ${key}\n${value}`)
      .join("\n\n");
    const github = parseCatalogSubmission({ body, updatedAt: "2026-10-12", order: 99, taxonomy });
    const gitlab = parseCatalogSubmission({
      body: body.replace("### Software name", "### Software name\n<!-- hint -->"),
      updatedAt: "2026-10-12",
      order: 99,
      taxonomy,
    });
    expect(github).toEqual(gitlab);
  });
});
