# Maintainer and developer checklist

Last reviewed: 13 October 2026. Reviewed application source: stable `867fd7d2494ca9d5da3a9317a85d5c0a2ede28cf`; experimental `9f071857bbb7a25054a333d5c31b0bc3ff3baa41`. Checklist edits after those commits do not change the reviewed runtime code.

Two independent reviews were repeated after documentation organization. The current maintainability assessment is **78/100 for both tracks**, revised from 81 because the deeper review uncovered recovery, test-isolation, runtime-contract and release-gate gaps. This is the same weighted engineering rubric; the application continues to pass the recorded normal-path verification. The original review was 63/100.

## Current verification

- Stable: 161 tests/27 files and 4 browser journeys passed.
- Experimental: 190 tests/37 files and 6 browser journeys passed.
- Formatting, lint, documentation references, application/script types, production builds and artifact checks passed.
- Repeated builds preserve 24 stable and 34 experimental generated/feed/production files under the current installed dependency graph.
- Independent focused documentation/correctness checks: 31 tests passed per track.
- Separate disposable reproductions confirmed inert index links, frontend-port drift, missing-next recovery behavior and malformed startup rejection.
- Native Windows/IIS acceptance remains pending. Remote CI and branch-protection settings were not inspected or triggered. Fresh npm/pnpm installations passed earlier in this cycle; this review used the existing installed dependencies. Docker acceptance for these reviewed commits was recorded in the documentation-organization evidence, rather than rerun here.

## Stable follow-up: recovery and fixture isolation

13 October 2026. Focused fixes verified at `23e8f7cfc4963a24a4c817baba71207eaee24297` on the stable 1.7.2 PR branch. The broader 78/100 score above remains the earlier full-review snapshot; these focused fixes do not constitute a new whole-app assessment.

- **M01/M18 fixed locally on stable:** complete journal/entry validation requires `previous` and `next` text-or-null values, rejects duplicate targets and unsafe prepared paths, and preflights every retained journal and prepared target before any restore. External edits and malformed journal bytes remain intact. Settled undo history from other authoring roots remains usable without reopening it.
- **M25 fixed locally on stable:** all server unit/contract/persistence/documentation fixtures and browser journeys use one disposable fixture factory with explicit catalog, documentation, output, state, package, guide-library and static-build paths. Guide validation/listing now honor the injected library. A prepared external canary and its private bytes remain untouched by fixture recovery and saves.
- **Startup rejection fixed locally:** recovery rejection is handled immediately. A child-process regression waits before sending its first request and proves the server stays alive, returns `503 RECOVERY_REQUIRED`, leaves malformed state intact and prints backup/inspection/restart instructions.
- **Verification:** `npm run verify` passed 182 tests/30 files (21 additional regressions), lint, documentation references, application/script types, build and static artifact checks. `npm run format:check` and all four browser journeys passed. Catalog, taxonomy, documentation, generated feeds and real authoring-state hashes remained unchanged by verification; the original dirty checkout's 252 protected files and status were preserved.
- **Scope:** experimental 1.8.0 has not received these follow-up fixes. M01/M18/M25 therefore remain open for that track. The new PR-head remote platform/container checks must pass before treating their evidence as current. Previous PR-head Linux/Windows npm/pnpm/browser and container checks passed; native launcher/IIS acceptance and the other checklist items remain separate.

## How to use this checklist

A checked item means its stated local scope is verified. Partial or reopened items retain completed sub-work, but require the acceptance below before full closure. P1 is an outstanding release acceptance gate; P2 is a concrete correctness/workflow/maintenance follow-up; P3 is a longer-term improvement. Effort S/M is a relative planning estimate, not a delivery promise. Owner labels name responsibilities, not assigned people. New review findings are tracked proposals; their code has not been changed in this review.

## Recommended next sequence

1. **Protect developer state and recovery first:** stable M25 fixture isolation and M18 journal/startup handling are verified in the follow-up above. Carry the same fixes and acceptance checks to experimental; keep their regressions in future changes.
2. **Make release evidence enforceable:** M19 shared exact-commit gates, M20 runtime floor/setup, M21 dual-lockfile policy, then M04 native Windows/IIS acceptance. Resolve these before treating the update cycle as complete or publishing it.
3. **Remove daily workflow friction:** M16 index navigation and M17 reliable configurable startup ports.
4. **Make local operation maintainable:** M22 inspection/retention/recovery tooling, M23 writer ownership, M24 documentation freshness/index checks, M26 onboarding and review responsibilities.
5. **Reduce change cost gradually:** M06 narrow editor/service boundaries, M07 contract/type parity, M08 declared validation fields, M13 CSS ownership and M15 real contribution-template fixtures. Avoid combining all of these into one broad rewrite.

## Original review items, updated

- [ ] **M01 — Rejected saves can leave the catalog invalid** (Stable fixed locally; experimental reopened; P2; Both).

  Stable now rejects malformed journals and preserves external bytes; see the focused follow-up above. Experimental still permits the previously reproduced missing-next case. Complete startup/recovery acceptance is tracked in M18.

  **Acceptance:** Require next:string|null, reject duplicate targets and malformed records before any restore; tests preserve external bytes and handle startup failure deterministically.

- [x] **M02 — Choosing the default software release does not persist** (Complete; P2; Both).

  Persisted release ordering/default selection continues to pass round-trip tests.

  **Acceptance:** Keep default selection tests green.

- [x] **M03 — Removed software releases reappear after saving** (Complete; P2; Both).

  Release removal/rename and guide references reconcile while binaries are retained.

  **Acceptance:** Keep source/feed and binary-preservation regressions green.

- [ ] **M04 — The supported developer platform contract is inconsistent** (Verification pending; P1; Both).

  Linux path/CRLF/runtime checks are in place; native Windows and experimental IIS acceptance remain unverified.

  **Acceptance:** Capture matching-commit Windows npm/pnpm/browser and launcher/filesystem evidence; verify IIS generation selection for experimental packages.

- [ ] **M05 — Tests cover helpers better than complete developer journeys** (Partial; P2; Both).

  161/190 tests and 4/6 browser journeys pass; some server fixtures still use real checkout recovery state. See M25.

  **Acceptance:** Make every server fixture override all source/output/state roots and cover new failure cases. Seed required browser cases explicitly and fail if default-release actions are absent; current IntelliJ fixture has two releases, but the test could otherwise skip this block.

- [ ] **M06 — UI state and responsibilities are concentrated in a few modules** (Partial; P2; Both).

  Feature sections, draft reducer and separate document model exist; broad server/tool-shell coordination and whole-record setters remain.

  **Acceptance:** Extract small route/service boundaries and narrow edit callbacks; preserve canonical save/conflict/navigation behavior.

- [ ] **M07 — Domain and API contracts can drift between layers** (Partial; P2; Both).

  Nested decoders and shared eligibility exist; schema/type/decoder parity is manual and only five script entry modules are checked with strict:false.

  **Acceptance:** Expand checkJs incrementally and add parity fixtures for public/private records and schema decisions.

- [ ] **M08 — Error handling is coupled to English messages** (Partial; P2; Both).

  Structured errors and guide focus are tested, but legacy field derivation still parses message wording.

  **Acceptance:** Declare code/field at validation source; use non-English-message tests for indexed controls.

- [ ] **M09 — Everyday development lacks a reliable fast path and guardrails** (Partial; P2; Both).

  Fast HMR/API workflow and preflight exist; fixed ports/startup link and broad Node-major check still cause setup gaps. See M17/M20.

  **Acceptance:** Test startup with occupied ports and supported runtime floor; preflight reports actionable dependency/browser/permission conditions.

- [x] **M10 — Live Agent Catalog metadata and guides use different sources** (Complete; P2; Experimental).

  Live guide creation/edit/failure and bounded availability requests remain verified.

  **Acceptance:** Keep live-guide and one-request-per-artifact browser cases green.

- [x] **M11 — Agent publication has a broad destructive scope and partial-update risk** (Complete locally; P2; Experimental).

  Immutable generations, pointer-failure preservation and withheld-download denial remain verified; native IIS evidence is part of M04.

  **Acceptance:** Keep publication faults/binary preservation and current-head host evidence separate.

- [x] **M12 — Builds rewrite tracked generated data, including timestamps** (Complete locally; P2; Both).

  Fresh consecutive builds preserve 24 stable/34 experimental generated/feed/dist files under the current installed graph.

  **Acceptance:** Keep no-op byte comparisons; state package-manager graph explicitly, see M21.

- [ ] **M13 — Global styling increases the reach of routine UI changes** (Partial; P3; Both).

  Studio/agent styles have owners, while shared CSS remains2099 lines and has further feature-specific rules.

  **Acceptance:** Move one coherent style group at a time; verify desktop/mobile/light/dark and focus behavior.

- [ ] **M14 — Documentation is extensive but mixes historical and current contracts** (Partial; P2; Both).

  Master/nested documentation is organized and linked; Studio preview links are inert and the Studio guide still contains an undated78-test validation claim.

  **Acceptance:** Fix M16 and label historical evidence with date/commit; align current command guidance and index.

- [ ] **M15 — Contribution adapters duplicate parsing and business mappings** (Partial; P2; Both).

  Shared mapper and transactional providers exist; paired tests still use synthetic bodies rather than checked-in submission templates.

  **Acceptance:** Generate GitHub/GitLab fixtures from actual templates and verify identical canonical records plus approval rejection.

## New maintainer/developer findings and opportunities

- [ ] **M16 — Make master-index navigation work inside Studio** (P2; New; effort M; proposed owner: Documentation frontend).

  **Evidence:** Browser reproduction: Developer guide in the index renders SPAN with no href and clicking leaves README selected. Repository links work; Studio uses the public catalog safe-link renderer.

  **Acceptance:** Resolve relative links against selected doc, restrict to known docs and use draft-guarded selection. Browser click opens a nested guide; cancelling discard retains dirty text.

  **Source:** [src/markdown.tsx:10](../../src/markdown.tsx), [src/components/DeveloperStudio.tsx:442](../../src/components/DeveloperStudio.tsx).

- [ ] **M17 — Make development startup ports and links reliable** (P2; New; effort M; proposed owner: Developer tooling).

  **Evidence:** Occupied5173 reproduction makes Vite choose5174; the authoring launcher still prints a5173 token-fragment link. API port8081 is fixed.

  **Acceptance:** Use shared configurable ports and either strict refusal or actual-URL discovery. Test occupied frontend/API ports and two distinct worktrees without token disclosure.

  **Source:** [scripts/dev-studio-server.mjs:1](../../scripts/dev-studio-server.mjs), [vite.config.ts:6](../../vite.config.ts).

- [ ] **M18 — Validate complete recovery journals and handle startup rejection** (P2; Stable fixed locally / experimental open; effort M; proposed owner: Recovery service).

  **Evidence:** The earlier disposable reproduction confirmed missing-next overwrite and malformed-startup rejection. Stable now passes regressions for both, malformed entries/JSON, duplicates, external edits, symlinks and whole-recovery preflight; experimental still needs the fixes. Generated journals include next.

  **Acceptance:** Validate full schema, uniqueness and allowed roots before restore; no malformed record changes files. Attach rejection handling immediately and expose a controlled startup/quarantine outcome with a clear recovery instruction.

  **Source:** [scripts/mutation-coordinator.mjs:131](../../scripts/mutation-coordinator.mjs), [scripts/mutation-coordinator.mjs:153](../../scripts/mutation-coordinator.mjs), [scripts/server.mjs:269](../../scripts/server.mjs).

- [ ] **M19 — Enforce the complete acceptance gates in release automation** (P2; New; effort M; proposed owner: Release maintainer).

  **Evidence:** Tag publishing needs only Linux pnpm verify; the fuller Windows/npm/browser/container jobs are elsewhere. Experimental tagged verification does not declare Python setup. Remote required-check settings were not inspected.

  **Acceptance:** Share reusable verification across PR/tag flows or require successful exact-commit acceptance evidence. Deliberately failing any required gate must prevent image publication; declare Python where the builder test runs.

  **Source:** [.github/workflows/publish-image.yml:18](../../.github/workflows/publish-image.yml), [.github/workflows/ci.yml:17](../../.github/workflows/ci.yml).

- [ ] **M20 — Align the supported runtime floor and all automated entry points** (P2; New; effort S; proposed owner: Developer tooling).

  **Evidence:** Repository declares>=24<25 and doctor checks major24, while locked Babel8 requires>=24.11. The issue-to-PR job has no setup-node before invoking Node/pnpm. Current Node24.13 checks pass; older Node execution was not tested.

  **Acceptance:** Set a supported floor consistent with all locked dependencies, test the floor and current supported version, and provision it in issue/PR/tag jobs. Preflight must reject unsupported minors.

  **Source:** [package.json:56](../../package.json), [scripts/doctor.mjs:4](../../scripts/doctor.mjs), [.github/workflows/catalog-issue-to-pr.yml:31](../../.github/workflows/catalog-issue-to-pr.yml).

- [ ] **M21 — Define a deliberate dual-lockfile parity policy** (P2; New; effort M; proposed owner: Dependency maintainer).

  **Evidence:** Comparison found30 package-name version-set differences in each track, including npm rolldown1.2.12 versus pnpm1.2.13 and Markdown parser differences. Different graphs alone do not prove a defect; previous installs passed separately.

  **Acceptance:** Choose canonical release graph, document permissible differences, update both locks in one reviewed dependency change, and test fresh npm/pnpm graphs with relevant parity fixtures and recorded build provenance.

  **Source:** [package-lock.json:1](../../package-lock.json), [pnpm-lock.yaml:1](../../pnpm-lock.yaml).

- [ ] **M22 — Provide journal inspection, recovery and settled-state archival tooling** (P2; New; effort M; proposed owner: Local operations).

  **Evidence:** Each publish scans/parses all retained undo JSON. Documentation says explicit operator cleanup but has no inspect/archive command or full RECOVERY_REQUIRED playbook. Long-run cost not benchmarked.

  **Acceptance:** Default to read-only inspect/dry-run, show status/size without exposing private content, preserve prepared journals, allow explicit archival of settled entries only with a backup/audit record, and test restoration from backup.

  **Source:** [scripts/mutation-coordinator.mjs:150](../../scripts/mutation-coordinator.mjs), [docs/development/DEVELOPER_GUIDE.md:24](../../docs/development/DEVELOPER_GUIDE.md).

- [ ] **M23 — Prevent accidental simultaneous authoring processes** (P2; New; effort M; proposed owner: Storage/tooling owner).

  **Evidence:** The mutation queue is process-local. Docs require one process, but host Studio, Docker Studio and CLI writers can share a checkout without an ownership lease. This unsupported concurrency case was not stress-tested.

  **Acceptance:** Acquire a checkout-scoped writer lease across all mutation entry points; second live writer fails clearly, stale-owner handling is explicit, and separate checkout writers remain independent.

  **Source:** [scripts/mutation-coordinator.mjs:5](../../scripts/mutation-coordinator.mjs), [docs/development/DEVELOPER_GUIDE.md:24](../../docs/development/DEVELOPER_GUIDE.md).

- [ ] **M24 — Keep documentation indexes, anchors and evidence current** (P3; New; effort S; proposed owner: Documentation owner).

  **Evidence:** Every current guide is reachable from its master index. docs:check validates target-file existence but does not enforce reachability/fragment anchors. A current Studio guide embeds undated78-test evidence.

  **Acceptance:** CI rejects a newly orphaned guide or broken local anchor; historical claims carry date/commit; current setup names dev:studio accurately. Maintain source-qualified verification records rather than replacing history.

  **Source:** [scripts/check-documentation-links.mjs:32](../../scripts/check-documentation-links.mjs), [docs/development/DEVELOPER_STUDIO.md:71](../../docs/development/DEVELOPER_STUDIO.md).

- [ ] **M25 — Fully isolate server test source and recovery roots** (P2; Stable fixed locally / experimental open; effort M; proposed owner: Test infrastructure).

  **Evidence:** Stable fixtures now override every mutable root through the shared factory. Protected external canaries and checkout-state hashes survive recovery, catalog/document saves and the full suites. The experimental fixture-agent and server suites still need conversion. No destructive reproduction against real developer state was run.

  **Acceptance:** Create one shared fixture factory overriding every source/output/docs/state root. Seed protected canary state outside the fixture and verify all bytes/status remain unchanged after suites; no journal entry targets a fixture outside its state root.

  **Source:** [scripts/server.test.mjs:23](../../scripts/server.test.mjs), [scripts/server.contract.test.mjs:27](../../scripts/server.contract.test.mjs), `scripts/agent-studio.test.mjs:144` (experimental track).

- [ ] **M26 — Make maintainer onboarding and ownership explicit** (P3; Opportunity; effort M; proposed owner: Project maintainer).

  **Evidence:** CODEOWNERS routes everything to one owner; docs describe directories but offer no first-change walkthrough, PR checklist or doctor coverage for browser/ports/write permissions. Single-owner approval is intentional, not a defect.

  **Acceptance:** Add a small first-change walkthrough and PR validation template, specify proposed domain/release responsibilities, improve read-only diagnostics, and document any explicit delegated approval policy while preserving unauthorized-actor rejection.

  **Source:** [.github/CODEOWNERS:1](../../.github/CODEOWNERS), [CONTRIBUTING.md:7](../../CONTRIBUTING.md), [scripts/doctor.mjs:6](../../scripts/doctor.mjs).

## Recurring maintenance and closure rules

For each future code change, run the applicable checks with fully isolated data roots, update both supported dependency graphs deliberately, and record the exact source revision and host. Exercise affected browser paths and relevant failure modes; do not replace a real acceptance check with a count of passing tests.

For dependency updates, align runtime requirements, capture graph differences and validate both fresh package-manager installations. For documentation changes, check references, index reachability and affected preview/navigation behavior. For releases, require the complete exact-source platform/browser/container gates and human publication authorization.

For authoring incidents, preserve source and journal backups, inspect pending state before recovery, and archive only settled records through an explicit audited operation. Do not run tests or a second authoring process against a developer's active state.

Close a checklist item only when its stated acceptance is met. Record the verification command or artifact, date, source revision and limitations. Preserve historical reports as snapshots; update this file and the master documentation index for current work.

## Score rubric

- Architecture: 7.5/10, weight 15%.
- Frontend: 8/10, weight 20%.
- Contracts: 7.5/10, weight 15%.
- Testability: 8/10, weight 20%.
- Developer workflow: 8/10, weight 15%.
- CI and reproducibility: 7.5/10, weight 10%.
- Documentation: 8/10, weight 5%.

Weighted total: 78/100. These ratings identify engineering friction; they are not coverage percentages or a security certification.
