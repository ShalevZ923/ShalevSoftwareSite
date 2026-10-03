# Maintaining the catalog

Every software record is a small source directory in [`content/catalog`](./content/catalog), organized as `<category-id>/<vendor-id>/<tool-id>`. Each tool has a `tool.json` catalog record, `guide.md` documentation, and one `releases/<version>.json` file per approved version. The category ID must come from [`content/taxonomy/categories.json`](./content/taxonomy/categories.json); the vendor directory is derived from `vendor.json.name`. The UI reads the generated `src/generated/catalog.ts`; do not edit that generated file directly.

## Local contributor path

For a new tool, run:

```bash
pnpm catalog:add
```

The helper asks for the required visible metadata and creates one file with a safe guide template. Replace the placeholder installation text, then validate the complete app:

```bash
pnpm verify
```

For an existing tool, edit its `content/catalog/<category>/<vendor>/<tool>/` directory and run:

```bash
pnpm catalog:build
pnpm verify
```

`pnpm catalog:build` validates all entries and regenerates `src/generated/catalog.ts` plus the public machine feed at `public/catalog/v1/`. `pnpm catalog:check`, which runs before unit tests, fails if generated output is stale. The feed is documented in [the machine catalog contract](./docs/CATALOG_MACHINE_FEED.md).

## Content rules

- Category IDs are canonical hierarchical paths such as `development/ides-and-editors`. Add a category to the taxonomy only when it is broadly reusable; do not create one-off category names for a single product.
- Vendor and tool directories use lowercase kebab-case. `vendor.json.name` must map to its vendor directory and `tool.json.id` must equal its tool directory, for example `development/ides-and-editors/jetbrains/intellij/tool.json`.
- Keep product metadata in `tool.json`, support guidance in `guide.md`, and each approved release in `releases/<version>.json`. Release filenames must match their version exactly; add a new release file instead of replacing history unless a reviewed correction is needed.
- `order` is a unique positive integer that preserves the catalog's curated “recently updated” ordering. The helper assigns the next value automatically.
- `tool.json.releaseOrder` lists every approved release version exactly once; the first is the default. Developer Studio persists the submitted order. Older records without this field retain filename order until their next save. Missing, duplicate, or unknown versions in `releaseOrder` fail validation.
- Saving a release removal or rename reconciles obsolete release JSON files only; installer binaries are never deleted. Saves are serialized, validated in a staging tree, and published with rollback if any file replacement fails.
- Each release has a unique version and exactly one approved target:
  - A credential-free HTTPS URL in `download` for an external vendor download.
  - An `artifact` pointer in the exact form `tool-id/version/filename` for an installer published on the same server. The tool and version path segments must match the catalog entry and release. Example: `example-tool/26.1/example-tool-26.1-x64.msi`.
- Hosted artifact pointers are public catalog metadata, not secret or authorization controls. The web server maps them below `/downloads/`, forces attachment download, and disables directory browsing. See [Windows deployment](./docs/WINDOWS_DEPLOYMENT.md) for publishing, checksums, permissions, logging, and recovery.
- Guides must include `## Install` and `## Support`.
- Product images must be local files below `public/tool-images/`, referenced as `/tool-images/...`. Remote guide images are deliberately ignored.
- Facts are small, non-sensitive `label`/`value` pairs. Never add license keys, activation codes, passwords, tokens, personal data, or contract documents.
- A tool can optionally have a visible, tool-specific notice. Use it only for actionable information such as an approved retirement date or planned maintenance; it is omitted from every tool that does not define it:

  ```json
  "notice": {
    "tone": "warning",
    "title": "Retires 31 December 2026",
    "message": "Move to the supported replacement before this date."
  }
  ```

## GitHub Issue Form path

Non-code contributors can use GitHub’s **Add software to the catalog** Issue Form. It collects the same validated fields and applies the `catalog-submission` label.

This form never changes the site on its own. A maintainer must verify the owner, release target, guide, and absence of sensitive information, then apply the `catalog-approved` label. The repository workflow then:

1. Creates an isolated branch for that issue.
2. Converts the approved form into the category/vendor/tool directory and per-version release records.
3. Regenerates the catalog, installs locked dependencies, and runs `pnpm verify`.
4. Opens a pull request for normal review and merge.

The approval label is the trust boundary: only people with repository label-management permission should apply it. If validation fails, the workflow does not create a PR; correct the issue and re-apply the label after review.

## GitLab path

GitLab users can select the **Add catalog software** description template from [`.gitlab/issue_templates`](./.gitlab/issue_templates). A maintainer reviews the issue, then applies the `catalog-approved` label.

GitLab CI does not have a pipeline event for an issue label, so the maintainer then starts a pipeline on the default branch with the non-secret variables `CATALOG_ISSUE_IID` and `CATALOG_APPROVED_DESCRIPTION_SHA256` set to the issue IID and the exact reviewed description digest. The manual `create_catalog_merge_request` job verifies the label and digest again, creates an isolated branch through GitLab’s API, adds the content file and generated catalog, then opens a merge request.

Before enabling this path, create a short-lived, **Developer** project access token with the `api` scope and save it as the `GITLAB_CATALOG_MR_TOKEN` CI/CD variable. Mark the variable **masked**, **hidden**, and **protected**, restrict pipeline variables and the manual job to maintainers, and run the job only from the protected default branch. Never put this token in the issue, repository, or pipeline variables. GitLab.com project access tokens require Premium or Ultimate; use the local contributor path if that feature is unavailable. For the exact setup, digest command, approval, recovery, and rotation steps, see the [GitLab catalog contribution guide](./docs/GITLAB_CATALOG_CONTRIBUTION.md).
