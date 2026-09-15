# Tool Atlas 1.6.0 — Presenter notes

English slides for a 15–30 minute discussion in Hebrew.

## Suggested timing

For 15 minutes, cover slides 1–4, show one employee example from slides 5–7, present Developer Studio on slides 8–10, and finish with slides 11–16. For 20 minutes, present all 16 main slides. For 30 minutes, add a short demo and leave time for questions. Slides 17–18 are backup material.

## Core message

The old catalog was hard to use and hard to keep current. Tool Atlas connects supported software with guides and support ownership. Developer Studio makes routine maintenance easier, while the static website remains flexible to deploy and extend.

## Demonstration

1. Find a tool and identify its release, guide and support owner.
2. Open Developer Studio and show Add Software.
3. Show Releases and the default download choice.
4. Show Guides with editing and preview.
5. Switch to System docs. Avoid saving a demonstration draft.

## Security wording

Keep the statement brief: the project owner reports reviews with Artifactory and ChatGPT Daybreak Blue. No scan reports or findings were supplied for this presentation. Static on-premises delivery limits runtime complexity; normal hosting and dependency upkeep still applies.

## Slide notes

### 1. Why we needed a new catalog

Opening, 90 seconds. Explain the cause before describing the product. The old catalog looked dated, was poorly organized and was not maintained consistently. People had to ask for a link, ask how to navigate and ask who owned support. The replacement must solve both finding information and maintaining it. Describe this as the team’s reported experience, not a measured study.

Source: User account of the old catalog.

### 2. A catalog people can use and maintain

Allow 1 minute. The idea has two equal parts: a useful catalog for employees and a workable maintenance process for the people behind it. Developer Studio matters because maintainers should not have to navigate folders and hand-edit catalog records for routine changes. The source remains structured and reviewable underneath the interface.

Source: README.md; docs/DEVELOPER_STUDIO.md; src/App.tsx.

### 3. Top 10 features: finding the right software

Features 1–5, allow 1 minute. These answer the first questions an employee has: what can I use, does it fit my platform, which release should I choose, and who supports it? Recently updated is a sorting option over catalog data. Legacy remains visible and clearly labeled rather than mixed into the current supported set without explanation. Approved refers to maintained catalog metadata, not automatic vendor certification.

Source: src/App.tsx; src/catalog.ts; src/downloads.ts.

### 4. Top 10 features: using and maintaining it

Features 6–10, allow 1 minute. Guides can include approved links and references to supported documents. Updates include filtering for New, Releases and Notices. This is a catalog feed, not automated vendor monitoring or push notifications. Saved tools are browser-local and do not require an account. Share links can retain the selected tool/release. Developer Studio is the main mechanism for making routine content maintenance approachable.

Source: README.md; src/components/UpdatesPage.tsx; src/catalogStorage.ts; src/toolLinks.ts; docs/DEVELOPER_STUDIO.md.

### 5. The software catalog

Allow 1 minute. Show the search field, the filters, the sort control and the support column. Use a simple example such as finding IntelliJ or identifying a legacy tool. Do not read all the rows. The screenshot shows the actual local 1.6.0 interface and example catalog data.

Source: Screenshot catalog.png, captured 14 September 2026; src/App.tsx.

### 6. Versions and support in one record

Allow 1 minute. Show the version selector, download action, documentation button and support contact. Explain that maintainers can set a default release and keep more than one approved release. The screenshot is a close-up of the real record. The displayed atlas.local contact is example content and must be replaced or confirmed for organizational rollout. The catalog guides the user to a download; it does not install or patch software itself.

Source: Screenshot tool-detail-crop.png, cropped from the 14 September 2026 capture; src/App.tsx; src/downloads.ts.

### 7. Documentation beside the software

Allow 1 minute. Point to the guide selector, Install section and support area. The tool and its instructions are connected, so users do not have to reconstruct setup from old messages. Direct navigation retains the chosen release when returning to the catalog. The guide itself is shared tool documentation, not an archived guide revision for every release.

Source: Screenshot documentation.png, captured 14 September 2026; README.md, Sharing a tool.

### 8. Developer Studio makes maintenance easier

Allow 2 minutes. This is a central part of the proposal. Show Add Software and the Overview, Releases, Guides and Support sections. Routine catalog work happens in an interface instead of requiring maintainers to find folders and edit catalog files manually. A new record starts with a draft. Validation and the saved/unsaved status help the maintainer finish the change. The screenshot shows a demonstration draft that was not saved. Local Studio saves changes for review; it does not directly publish the production website.

Source: Screenshot studio-new-software.png, captured 14 September 2026; src/components/DeveloperStudio.tsx; docs/DEVELOPER_STUDIO.md.

### 9. New versions use the same workspace

Allow 1 minute. Show Add Release, the source selector and Make default. The same record can hold multiple approved releases. Maintainers can point to an approved HTTPS location or a reviewed file on the server. This makes routine version updates a repeatable task. A person still decides which release the organization supports. Publishing installer files remains a separate administrator operation.

Source: Screenshot studio-releases.png, captured 14 September 2026; src/components/studio/ToolSections.tsx; docs/DEVELOPER_STUDIO.md.

### 10. Guides are easier to write and keep current

Allow 90 seconds. Show the text editor and preview. Maintainers can edit installation and support instructions, attach approved guide links, and maintain existing system documentation from Studio. The Guides & files area can reference approved SharePoint/intranet links or PDFs and PowerPoints already in the server library. Current Studio does not upload arbitrary binary files into that library; an administrator places those files first. Keep the explanation focused on easier routine content work.

Source: Screenshot studio-guide-editor.png, captured 15 September 2026; docs/DEVELOPER_STUDIO.md; src/components/studio/ToolSections.tsx.

### 11. A simple architecture for daily operation

Allow 90 seconds. Read the diagram as the path from a maintainer’s change to what an employee sees. Studio manages the local source. Reviewed changes produce static files, which the chosen on-premises web server serves. The browser handles the user interface. This keeps reading and editing separate. Underneath, the source uses category/vendor/tool organization with tool metadata, release records and Markdown guides. Saved-tools preferences remain in the user’s browser.

Source: README.md; docs/PROJECT_STRUCTURE.md; docs/DEVELOPER_STUDIO.md; Dockerfile; docs/WINDOWS_DEPLOYMENT.md.

### 12. Flexible to improve as needs change

Allow 1 minute. Credit ChatGPT-assisted development as the project owner requested. Explain flexibility with concrete examples: adjust a page, extend filtering, add catalog metadata or improve a guide workflow. Content changes use Studio, while new product capabilities still require code changes and testing. Do not promise a fixed number of hours for every request. The benefit is the ability to make focused iterations on a small, modular application. The static runtime has no ChatGPT integration or AI service requirement.

Source: User statement that the project was built with ChatGPT; src/components; README.md; package.json.

### 13. Flexible deployment, limited runtime complexity

Allow about 1 minute. Keep this brief. The documented deployment choices include IIS on Windows and a Linux container with NGINX, optionally behind the documented HTTPS proxy. Internal access policy belongs to the selected hosting/network boundary. No application login is built into the reading catalog; this does not mean all organizational content should be publicly accessible. The project owner reports reviews using Artifactory and ChatGPT Daybreak Blue. Scan reports, dates, exact scanned revisions and remaining findings were not supplied for this deck, so do not claim certification or zero vulnerabilities. Normal host, web-server and dependency upkeep remains. External vendor or SharePoint links can require their normal network access even when the catalog is hosted internally.

Source: User confirmation of Artifactory and ChatGPT Daybreak Blue reviews; docs/SECURITY_REPORT.md; docs/PRODUCTION_DEPLOYMENT.md; docs/WINDOWS_DEPLOYMENT.md.

### 14. Keeping the catalog useful over time

Allow 1 minute. The old catalog was not consistently managed. The new interface reduces the effort of everyday maintenance, but named people must still own the information. Confirm the catalog owner, tool support owners and deployment operator. Propose a regular content check and immediate updates when an owner, download or supported release changes. Do not claim that a review reminder or automatic vendor monitoring is implemented. Local edits remain reviewable, and the deployment process provides a recovery path.

Source: docs/DEVELOPER_STUDIO.md; docs/PROJECT_STRUCTURE.md; docs/PRODUCTION_DEPLOYMENT.md; proposed operating responsibilities.

### 15. The value of approving Tool Atlas

Allow 1 minute. Present these as expected benefits, not measured savings. The strongest proof is a completed employee task plus a completed maintainer task. Ask a new user to find a tool, its version, guide and support contact. Ask a maintainer to update a release or guide through Studio. Record where help is needed and what should improve. This evaluates both adoption and the cost of keeping the catalog alive.

Source: Proposed benefits based on the user’s reported problems and the demonstrated implementation.

### 16. Proposed next step

Closing, about 1 minute. Ask for approval to move ahead with a controlled rollout and named responsibilities. The initial preparation includes real support contacts, approved releases, usable guides and a discoverable internal address. The pilot should test both the reading catalog and Developer Studio. No specific budget or launch date has been agreed. Leave the remaining meeting time for questions and the optional demonstrations in the appendix.

Source: Proposed approval request.

### 17. Appendix: recent updates and notices

Optional, 1 minute. Show the New, Releases and Notices filters. These are categories in the maintained catalog feed. The page does not automatically discover vendor releases or send alerts. Current screenshot dates and relative labels are example catalog metadata. Use this slide if leadership asks how users discover what changed.

Source: Screenshot updates.png, captured 14 September 2026; src/components/UpdatesPage.tsx; src/catalog.ts.

### 18. Appendix: system documentation in Studio

Optional, 1 minute. Show the document list and edit/preview workspace. This makes existing operational documentation easier to maintain alongside the catalog. Current Studio lists existing system Markdown documents; do not present this screen as an arbitrary file-upload or new-system-document creation facility. Demo sequence: find a software record, open Releases, open Guides and its preview, then switch to System docs. Do not save a demonstration change into live content.

Source: Screenshot studio-docs.png, captured 14 September 2026; src/components/DeveloperStudio.tsx; docs/DEVELOPER_STUDIO.md.