# Developer guide: 1.7.2

## Runtime and commands

Use Node 24 and either `npm ci` or `pnpm install --frozen-lockfile`. Both lockfiles are maintained. `npm run doctor` checks prerequisites.

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

## Release boundaries

1.7.2 is the software-catalog maintenance candidate. Agent Catalog changes remain on experimental 1.8.0. The public image is static NGINX; authoring APIs and credentials remain in the optional local Studio. Tool Atlas MCP remains a separate project. Native Windows and container verification are release gates, not claims inferred from Linux tests.

## Contract decisions

Public catalog feeds retain schema version 1 and their public-field allowlist. Private errors retain `error` text and add stable `code` and optional `field`. Changed catalog payloads get a new feed timestamp; no-op generation retains bytes. Contribution providers share pure field parsing but retain separate approval and authentication adapters.
