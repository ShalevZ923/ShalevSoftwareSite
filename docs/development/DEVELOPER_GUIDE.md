# Developer guide: 1.7.2

## Runtime and commands

Use Node >=24.11.0 <25 and either `npm ci` or `pnpm install --frozen-lockfile`. Both lockfiles are maintained. `npm run doctor` checks the supported minor-version floor as well as prerequisites. Babel 8 in the locked dependency graphs requires this floor.

- `npm run dev:studio`: Vite with HMR on loopback 5173 plus the guarded authoring API on loopback 8081. Open the startup fragment link privately; do not copy token-bearing output into reports.
- `npm run dev:client`: frontend-only development; the API proxy expects the separate Studio server when authoring.
- `npm start`: rebuild then serve the production bundle locally.
- `npm run verify`: lint (no warnings), TypeScript, content freshness, tests, build and static artifact checks.
- `npm run format:check`: enforce first-party formatting.
- `npm run test:e2e`: Chrome browser journeys using disposable source/output fixtures. `PLAYWRIGHT_CHROMIUM_CHANNEL=chromium` selects installed Playwright Chromium on runners without Chrome.

## Ownership

`src/app` owns navigation. `src/features/software` owns catalog rendering. Studio draft transitions, API decoding, and each editor section live under `src/components/studio`. Shared styles precede feature styles so the original cascade is preserved. Server mutations use the coordinator and never bypass it.

## Edits and recovery

Private editor records include a SHA-256 revision. Updates require that revision; 428 requires a reload, and 409 indicates a newer saved record. Failed saves retain the draft. Reload list confirms replacing the draft.

Software `releaseOrder` contains every version exactly once; the first is the default. Legacy records keep their existing observed order. `npm run catalog:migrate -- --apply` persists ordering through validated transactions. Removal/rename reconciles release metadata; installer binaries are never removed. Renamed metadata that references a hosted binary must point to an actually published binary before deployment.

Recovery journals live in `content/.tool-atlas-state`, ignored by Git and Docker builds. Each transaction retains original text and records prepared/committed/rolled-back status. The server recovers prepared transactions before answering APIs; source and generated files are restored together. Keep the journal private and backed up with source while authoring. Completed journals are retained until explicit operator cleanup; do not remove a prepared journal. Studio Compose persists this state through its existing content mount. One authoring process owns a checkout.

### A quarantined startup

If a journal is malformed, has duplicate/unsafe targets, or a prepared target contains an external edit, the server handles startup failure immediately and returns `503` with code `RECOVERY_REQUIRED`. The terminal identifies the private state directory and explains the next steps. It does not delete the journal or overwrite external bytes. Validation of all retained records and prepared target bytes precedes any restore.

Stop the authoring process. Back up the catalog, generated outputs, internal documentation and complete recovery state to a private location. Inspect the affected journal's version, identity, status, target paths and `previous`/`next` values against that backup. Preserve external edits. Do not invent a missing `next` value from the current file or remove a prepared journal to bypass the check. Resolve the state against a trusted backup or an explicitly reviewed recovery decision, then restart and confirm `/api/health` succeeds before editing. Recovery inspection/archival tooling remains tracked in M22.

### Test data ownership

Server suites and browser journeys use `scripts/test-fixtures/server-fixture.mjs`. Pass its complete `options` object to the server; it supplies disposable source, documentation, output, recovery, download, library and static paths. The repository catalog/docs/build are copied only as read-only inputs. Close the server before cleaning its fixture. New server tests must use this factory so they cannot recover or write a developer's active authoring state.

## Release boundaries

See [release acceptance](RELEASE_ACCEPTANCE.md) for shared gates, runtime requirements, Windows evidence and outstanding limitations.

1.7.2 is the software-catalog maintenance candidate. Agent Catalog changes remain on experimental 1.8.0. The public image is static NGINX; authoring APIs and credentials remain in the optional local Studio. Tool Atlas MCP remains a separate project. Native Windows and container verification are release gates, not claims inferred from Linux tests.

## Contract decisions

Public catalog feeds retain schema version 1 and their public-field allowlist. Private errors retain `error` text and add stable `code` and optional `field`. Changed catalog payloads get a new feed timestamp; no-op generation retains bytes. Contribution providers share pure field parsing but retain separate approval and authentication adapters.

GitLab also runs formatting and browser journeys using a pinned Debian Node image. Air-gapped runners must mirror that image, Chromium, and its OS prerequisites before enabling this gate; the existing offline mirrors apply to dependencies.

Internal documentation is indexed in [the master README](../README.md). `npm run docs:check` validates local Markdown links and runs as part of `npm run verify`. System docs supports nested paths while preserving revision checks.

Use the [current maintainer/developer checklist](MAINTENANCE_CHECKLIST.md) for reviewed remaining work and closure criteria. Review findings are proposals until their acceptance evidence is recorded.
