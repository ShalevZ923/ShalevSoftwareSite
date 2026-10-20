# Release acceptance

PR #53 remains a maintenance candidate. This workflow does not authorize merging, deploying or publishing it.

## Shared source gates (M19/M20)

`ci.yml` and `publish-image.yml` call the same repository-local `acceptance.yml` workflow. Checkout uses the triggering revision: the PR merge candidate for pull requests and the tagged commit for publication. The matrix requires fresh npm and pinned pnpm installations on Linux and Windows, both Node 24.11.0 and the current supported Node 24, full verification, formatting and browser journeys. Python 3.12 is provisioned explicitly for experimental package-builder tests.

The container job builds and smoke-tests the static and optional Studio images. `acceptance-required` runs even after a failed or skipped dependency and fails unless the entire matrix and container job succeed. The publish job depends on tag identity verification, which depends on the completed reusable workflow. A failed matrix, browser or container gate therefore prevents publication. No tag is created by these checks.

Require `Complete acceptance required` through repository rules after reviewing the actual check name produced by the reusable workflow. Repository administration permissions are needed to inspect or change branch protection; a workflow file alone cannot enforce merge policy. Keep manual release approval in the maintainer's release process.

The supported runtime is Node >=24.11.0 <25, matching locked Babel 8 requirements. Package metadata and strict installation settings declare it; doctor, CI and the Windows launcher check it. Dependency resolution is unchanged by the runtime-floor edit.

## Windows evidence (M04, issue #32)

The stable loader already normalizes native separators and has an ordinary Windows-path regression. Existing PR #53 head `5f3c02e7c2feaae33a1e56613b7129764fa1e97d` passed GitHub run [38450910373](https://github.com/ShalevZ923/ShalevSoftwareSite/actions/runs/38450910373): Windows/Linux npm verification, Windows/Linux pnpm verification and browser journeys, plus static/Studio container smoke checks.

`windows/Test-ToolAtlasLauncher.ps1` adds native launcher acceptance to each Windows matrix leg. It runs `Start-ToolAtlas.ps1 -SkipBuild` from a disposable copy under a path containing spaces, requests health, catalog and static content, and terminates only its process tree. The original checkout and recovery data are not authoring targets. The ephemeral startup token is drained privately and never printed in CI.

This new launcher check still requires a successful run at the proposed revision. IIS installation, ACLs, rollback and experimental immutable-generation selection require separate Windows host evidence; the launcher check does not establish them. M04 stays open until that evidence exists. Never run IIS installation or package publication against a real authoring or production root to satisfy a test.

## Local verification limitations

19 October 2026: the isolated snapshot tree matches PR #53's Git tree `2235e3a048178868f0af2da041a442513e34bba5`. Git fetch and fresh npm installation were blocked by an unreachable environment proxy. The supplied dependency tree is older than the PR locks (Vitest 5.0.1), so its passing tests are supplemental, not fresh-lockfile acceptance.

Focused runtime, Windows-path, CRLF, recovery-validation and mutation regressions passed: 38 tests in six files. Doctor, catalog freshness, documentation references and patch whitespace checks passed. The baseline full suite produced 92 passes, 29 failures and 61 skips; HTTP failures report `listen EPERM` in this sandbox. `npm run verify` stopped at missing ESLint. Docker socket access is denied. Browser and native Windows execution are pending remote CI; these limitations must not be reported as passing acceptance.

## Suggested integration order

Review the focused gate/runtime changes into `maintenance/1.7.2`, require current acceptance evidence, then review the dual-lockfile policy and its parity evidence. Approve PR #53 separately after remaining Windows/IIS acceptance. Only after main contains the stabilized maintenance changes should the experimental catalog be rebased on a preserved copy, carrying over shared recovery validation and isolated fixtures. Leave PR #30 and its existing commits intact until that integration is reviewed. No issues are closed by this document.
