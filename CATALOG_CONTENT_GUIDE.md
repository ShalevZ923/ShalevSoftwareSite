# Maintaining the catalog

Every software record is one Markdown file in [`content/tools`](./content/tools). The file begins with JSON front matter for catalog-card data and continues with the guide shown in the documentation view. The UI itself reads the generated `src/generated/catalog.ts`; do not edit that generated file directly.

## Local contributor path

For a new tool, run:

```bash
pnpm catalog:add
```

The helper asks for the required visible metadata and creates one file with a safe guide template. Replace the placeholder installation text, then validate the complete app:

```bash
pnpm verify
```

For an existing tool, edit only its corresponding `content/tools/<id>.md` file and run:

```bash
pnpm catalog:build
pnpm verify
```

`pnpm catalog:build` validates all entries and regenerates `src/generated/catalog.ts`. `pnpm catalog:check`, which runs before unit tests, fails if generated output is stale.

## Content rules

- File names and `id` values use lowercase kebab-case and must match, for example `pycharm.md` and `"id": "pycharm"`.
- `order` is a unique positive integer that preserves the catalog's curated “recently updated” ordering. The helper assigns the next value automatically.
- Download links must be trusted HTTPS URLs without embedded credentials.
- Guides must include `## Install` and `## Support`.
- Product images must be local files below `public/tool-images/`, referenced as `/tool-images/...`. Remote guide images are deliberately ignored.
- Facts are small, non-sensitive `label`/`value` pairs. Never add license keys, activation codes, passwords, tokens, personal data, or contract documents.

## GitHub Issue Form path

Non-code contributors can use GitHub’s **Add software to the catalog** Issue Form. It collects the same validated fields and applies the `catalog-submission` label.

This form never changes the site on its own. A maintainer must verify the owner, download URL, guide, and absence of sensitive information, then apply the `catalog-approved` label. The repository workflow then:

1. Creates an isolated branch for that issue.
2. Converts the approved form into one `content/tools/<id>.md` file.
3. Regenerates the catalog, installs locked dependencies, and runs `pnpm verify`.
4. Opens a pull request for normal review and merge.

The approval label is the trust boundary: only people with repository label-management permission should apply it. If validation fails, the workflow does not create a PR; correct the issue and re-apply the label after review.

## GitLab path

GitLab users can select the **Add catalog software** description template from [`.gitlab/issue_templates`](./.gitlab/issue_templates). A maintainer reviews the issue, then applies the `catalog-approved` label.

GitLab CI does not have a pipeline event for an issue label, so the maintainer then starts a pipeline on the default branch with the non-secret variable `CATALOG_ISSUE_IID` set to the issue IID and runs the manual `create_catalog_merge_request` job. That job verifies the label again, creates an isolated branch through GitLab’s API, adds the content file and generated catalog, then opens a merge request.

Before enabling this path, create a short-lived, **Developer** project access token with the `api` scope and save it as the `GITLAB_CATALOG_MR_TOKEN` CI/CD variable. Mark the variable **masked**, **hidden**, and **protected**, and run the job only from the protected default branch. Never put this token in the issue, repository, or pipeline variables. GitLab.com project access tokens require Premium or Ultimate; use the local contributor path if that feature is unavailable.
