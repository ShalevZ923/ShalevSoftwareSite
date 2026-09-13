# Tool Atlas operating model meeting notes

**Meeting purpose:** Agree how users obtain software, how administrators publish changes, and how the organization maintains and stores the catalog and software packages.

**Prepared:** 4 September 2026

## Executive bullet points

- Tool Atlas currently operates as a static React/Vite catalog. It has no backend, account system, database, or application secrets.
- Users can search and filter approved tools, compare lifecycle and platform information, select an approved version, open maintained documentation, identify the support owner, and save tools in their own browser.
- The current release model stores a version and one trusted HTTPS download URL. Supporting three fulfillment choices requires an explicit delivery mode per release.
- Proposed delivery modes are a locally hosted package, an external repository link such as Artifactory, and a contact or guide route for assisted or restricted installation.
- The managed external repository should be considered the default when it already exists. Local hosting adds scanning, checksum, capacity, retention, backup, and recovery responsibilities.
- The contact or guide path stores no binary, but it still needs a current owner, usable instructions, a response expectation, and an outage or absence fallback.
- The repository already contains an interactive `pnpm catalog:add` command and approval-gated GitHub/GitLab issue workflows.
- A hidden developer page is a proposed feature. Hiding a URL does not authorize a user and cannot protect a token embedded in browser code.
- If the site remains static, the developer page should create an issue or export a validated submission. A token-backed page requires an authenticated server-side service with secret storage, narrow permissions, rotation, rate limits, audit logs, and incident response.
- All contribution channels should produce the same catalog source structure and use one validator, generator, test suite, approval boundary, and pull or merge request process.
- Maintenance must cover catalog accuracy, delivery destinations, hosting, credentials, support ownership, backups, and restore testing.
- CI validation and live verification are separate gates. Passing tests does not prove that a package, external link, or support route works for an employee.

## Current-state summary

Tool Atlas builds public catalog records from `content/catalog/<category>/<vendor>/<tool>/`. Each entry contains product metadata, a maintained guide, and a separate record for each approved release. The build validates the source and generates `src/generated/catalog.ts`, which the frontend reads.

The production-oriented deployment uses Caddy as the public HTTPS edge. The static application remains on an internal container network behind unprivileged NGINX. Caddy certificate state persists in named volumes. Saved tools remain in each visitor's browser and do not create an administrative database.

### Current capabilities

- Search by tool, vendor, or tag.
- Filter by category, platform, and lifecycle.
- Open a tool record and choose an approved version.
- Follow a trusted HTTPS destination.
- Read installation and support guidance.
- Identify the support owner and team.
- Save a private browser-local list of tools.
- Add catalog content through the interactive command-line helper.
- Submit content through GitHub or GitLab issues, followed by maintainer approval and a reviewable pull or merge request.

### Proposed capabilities discussed in this meeting

- Three explicit delivery modes per release.
- Local package storage and delivery.
- Contact or guide actions as first-class fulfillment paths.
- A hidden internal developer submission page.
- A private server-side submission service, only if the team chooses token-backed automation.

## Target employee flow

1. The employee searches or filters the software catalog.
2. The employee opens a tool and confirms platform, lifecycle, support owner, and approved version.
3. Tool Atlas reads the selected release's delivery mode.
4. Tool Atlas presents one explicit action:
   - **Download package** for locally hosted software.
   - **Open repository** for Artifactory or another approved external service.
   - **Contact support** or **Open installation guide** for assisted fulfillment.
5. The employee follows the guide and completes the installation.
6. If the action fails, the employee uses the named support route and provides the software version, operating system, and error information.

### Required user-facing information

- Software name and approved version.
- Supported platforms and lifecycle status.
- Delivery action that matches the selected release.
- Installation guidance.
- Named support owner and team.
- Warnings for legacy, retired, unavailable, or maintenance-affected releases.
- Clear failure guidance when a package, repository, or contact route is unavailable.

## Target administration flow

1. A contributor submits a new tool, release, correction, or retirement request.
2. A maintainer confirms the request belongs in the public catalog and contains no confidential operational information.
3. The maintainer verifies category, ownership, lifecycle, delivery mode, release version, destination, guide, and support route.
4. Automation validates the same schema regardless of whether the submission came from the developer page, CLI, GitHub, or GitLab.
5. An authorized maintainer approves publication. The approval creates or allows a reviewable branch and pull or merge request.
6. A reviewer checks the source files, generated catalog, destination, and guide.
7. CI runs the complete verification gate.
8. The reviewed change merges and deploys.
9. An operator verifies the live employee journey for the changed release.
10. The team records any follow-up, expiry, retirement, or owner-review date.

## Contribution channels

### Hidden developer page

**Recommended role:** An authenticated internal form that submits structured data into the same review workflow.

**Security boundary:** The browser must not receive a reusable GitHub, GitLab, Artifactory, or deployment token. A hidden route offers no access control.

Two viable patterns:

1. **Static-site pattern:** Validate fields in the browser, then open a prefilled issue or allow the user to copy or download a validated payload. Existing provider automation handles approval and the pull or merge request.
2. **Private-service pattern:** An authenticated backend validates the user and payload, rate limits requests, stores audit context, and uses a narrowly scoped service credential to create a branch or review request.

The meeting must choose one pattern before implementation.

### Interactive command-line form

The existing `pnpm catalog:add` command asks for visible metadata, validates the category, creates the catalog source directory, adds release records, writes a guide template, regenerates the catalog, and instructs the contributor to run the full verification suite.

Recommended use: maintainers and code-capable contributors working in a normal Git branch.

Required follow-up: extend the prompts and generated release records to capture the selected delivery mode and its mode-specific fields.

### GitHub and GitLab issue workflow

Recommended use: non-code contributors and distributed teams.

The issue never publishes directly. A trusted maintainer reviews it and applies the approval marker. Automation validates the entry and creates a branch plus pull or merge request. Normal review and merge rules remain in force.

Required follow-up: extend both issue templates and both conversion scripts whenever the delivery schema changes. Keep GitHub and GitLab behavior equivalent.

## Storage options

### Option 1: Local package storage

Use when the organization owns redistribution rights, requires internal-only distribution, and accepts direct responsibility for the binary lifecycle.

Required controls:

- Keep packages outside normal Git history.
- Prefer a dedicated package volume or service instead of baking changing binaries into the website container.
- Record cryptographic checksums for every version.
- Scan packages before approval and after security tooling changes.
- Restrict write access and log administrative changes.
- Define capacity thresholds, quotas, and alerting.
- Define retention and retirement rules for superseded versions.
- Back up packages off host and test restoration.
- Define what the site displays when package storage is unavailable.

### Option 2: External repository link

Use when Artifactory or another approved repository already owns binary storage and access control.

Required controls:

- Allow only approved HTTPS origins.
- Point to an immutable version or repository coordinate where possible.
- Store and verify a checksum when the repository supports it.
- Identify the repository owner and support escalation route.
- Monitor link and authorization health without exposing credentials.
- Define behavior during repository outages.
- Confirm the repository's retention, backup, restore, and malware-scanning policy.

### Option 3: Contact or installation guide

Use for licensed, restricted, assisted, manually provisioned, or environment-specific software.

Required controls:

- Display an explicit **Contact support** or **Open installation guide** action.
- Identify the owning team and a backup route.
- Define the information the requester must provide.
- Set a response expectation or service target.
- Review the guide and contact route on a defined schedule.
- Provide a fallback when the owner is unavailable.

## Maintenance model

### Weekly

- Review new submissions and changes awaiting approval.
- Investigate failed automation.
- Address reported broken links or installation failures.
- Publish urgent notices for unavailable or unsafe releases.

### Monthly

- Check external links and sample local package downloads.
- Review stale versions, lifecycle labels, and support ownership.
- Review local storage growth and backup completion.
- Confirm contact and guide routes remain usable.

### Quarterly

- Patch and review application, base image, proxy, and dependency updates.
- Review who can approve catalog entries and manage secrets.
- Rotate credentials that are expiring or whose policy requires rotation.
- Restore the website and a sample locally stored package in a recovery test.
- Verify the live flow for one example of each delivery mode.

### Annually

- Review redistribution and licence constraints.
- Review retention, recovery objectives, and storage capacity.
- Review taxonomy, supported delivery modes, and public data policy.
- Confirm every operating role has a primary and backup owner.

## Proposed ownership model

| Role | Responsibility | Suggested evidence |
| --- | --- | --- |
| Catalog product owner | Public data policy, delivery-mode rules, roadmap, and exception decisions | Approved policy and decision log |
| Content maintainers | Submission triage, metadata review, approvals, and retirement | Pull or merge request record |
| Platform owner | Hosting, deployment, monitoring, TLS, backups, and recovery | Deployment and restore records |
| Repository owner | Artifactory access, retention, scanning, backup, and availability | Repository policy and health report |
| Software owner | Version accuracy, guide quality, support route, and lifecycle | Scheduled ownership review |
| Security reviewer | Token model, permissions, origin allowlist, incident response, and audit requirements | Access review and threat assessment |

## Decisions required in the meeting

| Decision | Options | Owner | Due date | Result |
| --- | --- | --- | --- | --- |
| Default delivery mode | External repository / local package / case by case |  |  |  |
| Local package architecture | Separate package service / mounted volume / inside deployment image |  |  |  |
| Developer page pattern | Static issue handoff / private authenticated service |  |  |  |
| User authentication for private service | Existing corporate identity option to be confirmed |  |  |  |
| Service credential model | GitHub App or equivalent / short-lived project token / other |  |  |  |
| Binary retention | Versions retained, retirement period, legal constraints |  |  |  |
| Backup and restore targets | Frequency, off-host copies, recovery time, recovery point |  |  |  |
| Contact path target | Owning queue, response expectation, fallback |  |  |  |
| Approval separation | Who approves catalog content and who merges |  |  |  |
| Live verification owner | Team responsible after deployment |  |  |  |

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Token leaks from a hidden browser page | Keep provider credentials server-side or use the existing issue workflow |
| Local package storage grows without control | Quotas, alerts, retention rules, and a named storage owner |
| External repository links drift or lose authorization | Allowlist origins, monitor destinations, and assign a repository owner |
| Contact route becomes a dead end | Primary and backup owner, response target, and scheduled review |
| Contribution channels behave differently | One schema, validator, generator, test suite, and approval pipeline |
| CI passes but the live action fails | Post-deployment live verification for the changed release |
| Binary or certificate recovery is untested | Scheduled restore exercises with recorded evidence |
| Sensitive licence or operational data enters the public catalog | Public-field allowlist and maintainer review before publication |

## Action items

| Action | Owner | Due date | Status |
| --- | --- | --- | --- |
| Approve delivery-mode schema and required fields |  |  | Open |
| Select local binary architecture or rule it out for the first release |  |  | Open |
| Select the developer-page security pattern |  |  | Open |
| Update CLI prompts, issue forms, converters, tests, and guide together |  |  | Open |
| Define storage retention, backup, restore, and monitoring |  |  | Open |
| Define contact-route service target and fallback |  |  | Open |
| Name catalog, platform, repository, software, and security owners |  |  | Open |
| Run acceptance tests for one example of each approved delivery mode |  |  | Open |

## Suggested acceptance criteria for the future implementation

- Every release declares exactly one valid delivery mode.
- The UI presents the correct action label and never treats a contact route as a direct download.
- Local package records require an approved file reference, checksum, scan status, and retention metadata.
- External repository records require an allowlisted credential-free HTTPS destination and repository ownership.
- Contact or guide records require an owner, user instructions, and fallback route.
- The developer page exposes no repository or deployment credential to the browser.
- CLI, GitHub, GitLab, and developer-page submissions produce equivalent catalog source.
- Validation rejects unsafe destinations, missing instructions, unknown modes, sensitive public facts, and stale generated output.
- A reviewable pull or merge request remains mandatory for publication.
- Deployment verification confirms the live action for the changed release.
- Backup restoration succeeds for the website, certificate state, and a representative local package when local storage is enabled.
