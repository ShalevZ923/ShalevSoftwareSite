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
