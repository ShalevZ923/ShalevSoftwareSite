# Open-source readiness

This is a publication checklist for Tool Atlas. It is deliberately separate
from deployment instructions: publishing source is irreversible for copied or
forked material.

## Decision to make first

Recommended default: license the software, build tooling, configuration, and
first-party documentation under **Apache-2.0**. It is permissive while adding
an express patent grant and preserving notices. Use a separate `LICENSE` file
with the copyright holder confirmed by the owner.

Do not automatically license catalog records, vendor names, logos, installers,
or other third-party material. Before publishing them, verify that each item is
either first-party material or has a redistribution-compatible permission. If
the catalog's original prose is intentionally reusable, place only those
first-party content files under a clearly labelled **CC-BY-4.0** content
license. Keep logos and trademarks excluded unless written permission says
otherwise.

## Before changing visibility

- [ ] Confirm who owns every file and whether customer, employee, licence,
  contract, internal host, contact, or procurement data exists in current files
  or untracked directories.
- [ ] Keep `content/catalog/` public-only. Never add licence keys, activation
  codes, private contacts, contract terms, personal data, or installer files.
- [ ] Inspect the final staged tree with a secret scanner and a manual review;
  `.env`, `.env.*`, package binaries, logs, output, and `deliverables/` must
  remain intentionally excluded or reviewed before staging.
- [ ] Rotate any credential that was ever placed in the repository, a commit,
  an issue, an Actions log, or an artifact. Removing a current file does not
  remove a copied or historical secret.
- [ ] Add `LICENSE`, `NOTICE` if required, `SECURITY.md`, a contribution guide,
  and a code of conduct after the licensing and ownership decisions are made.

## GitHub configuration

- [ ] Make `main` a ruleset-protected branch: pull requests only, at least one
  independent approval, stale-approval dismissal, required CI, no force pushes,
  no branch deletion, and restrict direct pushes and tag creation to release
  maintainers.
- [ ] Restrict who can apply `catalog-approved`. That label starts a workflow
  holding branch/PR write permission; it must be limited to trusted maintainers.
- [ ] Require review of workflow, Docker, deployment, and catalog-validator
  changes by designated owners. A `CODEOWNERS` file only becomes enforcement
  when the ruleset requires code-owner review.
- [ ] Enable dependency graph, Dependabot alerts/security updates, secret
  scanning and push protection, and dependency review for pull requests.
- [ ] Set Actions' default `GITHUB_TOKEN` to read-only. Keep exceptional write
  permissions scoped to the catalog-issue and package-publishing workflows.
- [ ] Allow Actions only from GitHub or explicitly allowlisted publishers, pin
  third-party actions to full commit SHAs, and review pin updates.
- [ ] Keep package visibility deliberate. Publish immutable image digests and
  verify the provenance attestation before deployment.

## Environment variables and secrets

| Location | Values | Publication rule |
| --- | --- | --- |
| `.env.example` | `SITE_DOMAIN`, `ACME_EMAIL`, HTTP/S ports, optional image reference | Public configuration examples only; no credentials. |
| Host `.env` | Deployment hostname/contact and optional image digest | Git-ignored; restrict file permissions; do not paste into tickets or logs. |
| `VITE_*` | None are currently required | Never use for secrets: Vite embeds them in browser JavaScript at build time. |
| Developer Studio | Process-random bearer token | Local-only by default; never deploy with the static site, log the startup URL, or share terminal output. Restart immediately to rotate after exposure. |
| GitHub Actions | Platform-managed `GITHUB_TOKEN` | Never copy to repository variables or browser code; retain minimum per-workflow permissions. |
| GitLab CI | `GITLAB_CATALOG_MR_TOKEN` | Protected, masked, hidden, short-lived, least-privilege CI variable only; never provide it as a manual pipeline input. |

## Publication sequence

1. Make a clean publication branch from the intended commit. Do not reuse a
   workstation tree with unrelated untracked material.
2. Complete the ownership/third-party-material review, choose the license, add
   the governance files, and run `pnpm verify` plus a production dependency and
   secret scan.
3. Configure the GitHub ruleset and security features before switching the
   repository public. Verify them using a non-maintainer test account or a test
   pull request.
4. Publish source only after the final staged diff and generated catalog have
   been reviewed. Treat tags, releases, images, website deployment, and package
   downloads as separate, explicit decisions.
5. After publication, monitor Dependabot/secret alerts, protect and rotate CI
   credentials, review approver access periodically, and publish security fixes
   through `SECURITY.md`'s private reporting route.
