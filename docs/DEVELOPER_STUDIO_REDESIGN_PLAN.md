# Developer Studio redesign proposal

Status: implemented and merged; verification evidence is recorded below.

Primary-screen visual proposal: [Developer Studio concept](./design/developer-studio-concept.png), generated with the built-in Image Gen tool. Brief: match Tool Atlas's navy navigation, white surface, Newsreader heading and Inter controls; show a searchable software list, Overview / Releases / Guides / Support sections, and a persistent save action. This is the approved primary-screen direction reference. Generated logos, tag chips, and the disclosure's invented “color, sort name, and weight” text are illustrative; retain actual repository controls and supported fields. The gate, guide editor, and mobile layouts extend the same typography, colors, and controls.

## Direction

Make Studio feel like the authoring view of Tool Atlas: the same navy navigation, white content surface, editorial page heading, restrained blue actions, and compact, readable controls. Keep the workspace practical for long editing sessions.

The current implementation has a separate dark top bar, cyan tabs, green save buttons, a glowing session indicator, gray editor background, and repeated bordered fieldsets. This competes with the public site's simpler visual hierarchy. The main editor is also one long form, making releases and guides harder to reach.

## Proposed layout

- Reuse the public navigation shell and its mobile behavior, with Developer Studio selected while authorized. Preserve the existing `?page=developer` route and token gate. All navigation away from an edited record must participate in the unsaved-change guard.
- Use a white header with “Developer Studio”, a short description, and a quiet “Exit Studio” action. Keep a small “Local editing” status; remove token implementation details from the workspace header.
- Place “Software catalog” and “System docs” tabs below the header.
- Use a searchable record list beside the editor: approximately 240px for the list, remaining width for editing. Rows use the existing tool glyph language, a name, and secondary category text. Show explicit loading, empty, no-results, and retry states.
- Give the editor a sticky action bar: record name, saved/unsaved/saving state, and one blue “Save changes” button. Keep errors adjacent to the relevant action or field and announce results accessibly.

## Editor organization

Use four sections with persistent draft state when switching between them:

1. **Overview:** name, vendor, category, description, lifecycle, platforms, and tags. Put ID, icon initials, update label, and catalog order under an “Appearance and ordering” disclosure. Preserve existing ID edit constraints.
2. **Releases:** version and download target rows, add/remove actions, and clear first-release default indication. Preserve the existing ordered release contract. Avoid introducing drag-and-drop in this pass.
3. **Guides:** group guide-resource records separately from the Markdown guide. Preserve all resource fields, bundled-file selection, HTTPS links, version applicability, owner, and review date. Retain Edit / Split / Preview; use the existing safe Markdown renderer for preview.
4. **Support:** owner name, team, initials, and contact email with existing validation.

System docs use the same record-list and action-bar pattern, with document search and an editor/preview workspace. Document names remain visible; filesystem paths move to secondary details. Remove the current hardcoded `content/tools/<id>.md` display, which does not match the current catalog hierarchy; show a source path only when reliably derived from actual source metadata.

## Visual system

- White content background; navy navigation `#071d39`; heading text `#102744`; secondary text `#526882`; blue primary actions `#1764ec`; divider `#e2e8ee`.
- Reuse Newsreader for the page heading, Inter for controls and body text, and DM Mono only for source paths or Markdown.
- Use 4–6px control radii, subtle separators, 40px control heights, 14px form text, and a consistent 8px spacing scale. Avoid glow effects and stacked decorative cards.
- Reserve red for destructive actions and errors; exit is a neutral navigation action. Status must include text, not color alone.
- Include textarea and all new interactive controls in the shared visible-focus treatment.

## Interaction details

- Track a saved baseline per active draft. Show “Unsaved changes” only when content differs. Disable repeated saves while pending and show success only after server confirmation.
- Guard record changes, creating a new record, changing workspace tabs, exiting Studio, public navigation, and browser unload when edits could be lost. Internal editor-section switches retain edits without prompting.
- A failed save retains the draft. Validation identifies its section and moves focus to actionable feedback; the server remains authoritative.
- Do not add autosave, publishing, account management, or new backend endpoints. Saving still changes the local working tree for normal review.
- Restyle the access gate with the same white surface, typography, and blue button. Keep token masking, fragment handling, verification, session clearing, and authentication boundaries intact.

## Responsive behavior

- Wide desktop: navigation rail, record list, editor; split preview only when each pane has useful width.
- Small laptop/tablet: compact or collapsible record picker; editor gets priority. Collapse multi-column forms before fields become cramped.
- Phone: reuse mobile navigation, show a searchable record picker above a single-column editor, keep save reachable without covering fields, and replace split view with Edit / Preview.
- Verify at 1440, 1024, 768, and 390px, plus 200% zoom. No page-wide horizontal scrolling; code blocks may scroll within their container.

## Implementation sequence

1. Review the visual concept and settle the workspace layout, including gate, guide editor, and narrow-screen treatments before implementation.
2. Extract shared shell/header/control styles, update `src/App.tsx` integration, and replace Studio's competing visual rules. Keep public pages visually stable.
3. Split `src/components/DeveloperStudio.tsx` into focused workspace, record-list, editor, and form-section components under a Studio directory. Keep request and draft ownership explicit; reuse `Field`, `Icon`, `ToolGlyph`, and `MarkdownDocument` where applicable.
4. Add draft-state feedback and navigation guards; preserve existing tool/doc API payloads, release ordering, and guide validation.
5. Restyle `src/components/DeveloperLockGate.tsx`, implement responsive states, and update the Studio operating guide with navigation and save behavior.
6. Run verification and browser acceptance checks, record results, and save desktop/mobile screenshots for review.

## Acceptance checks

- `pnpm verify` passes. Add focused tests for draft preservation, unsaved-navigation decisions, failed saves, and tab/keyboard behavior rather than tests of static styling.
- In a disposable checkout, exercise unlock, search/select, create a tool, edit every section, add/remove releases and resources, Markdown preview, save/reload, document editing, rejected save, and exit. Verify resulting files and discard only fixture changes.
- Check loading, no results, no selection, API failure, expired authorization, saving, success, and invalid input states.
- Confirm public navigation and pages remain intact, approved release selection is unchanged, safe link/Markdown handling remains active, and a static-only deployment does not gain authoring access.
- Compare actual browser screenshots with the agreed concept for typography, colors, layout, control geometry, and information hierarchy. Complete keyboard navigation and focus checks at each responsive layout.

## Boundaries

This is a UI and editing-experience redesign within the existing local Studio. It does not turn Studio into a hosted or multi-user administration system. Saving, authentication, catalog validation, and publication boundaries retain the existing local-only behavior.


## Implementation and verification — 2026-09-05

- Shared the existing App navigation shell with Studio and its access gate. Studio uses white surfaces, the existing Newsreader/Inter typography, blue primary controls, horizontal desktop Overview fields, a persistent editor action bar, and the four proposed sections.
- Extracted the form sections into `src/components/studio/ToolSections.tsx` and the API payload type into `studio/types.ts`. Retained the existing API request shapes and safe Markdown renderer.
- Added saved baselines, error focus, document search/loading/no-results states, draft-preserving workspace switches, discard checks for record replacement and navigation, and an unload warning. Saving blocks edits to the submitted draft. Document reads use a request sequence; guide-library reads are canceled on selection changes.
- Replaced the stale hardcoded tool source path with vendor context. Kept the real catalog glyphs, taxonomy input, comma-separated tags, existing navigation labels and supported fields instead of the generated concept's illustrative logos and invented secondary fields. Added real catalog/document counts and a quiet Local editing label. These are intentional adaptations to the existing product.
- Compared the concept and actual browser screenshots for navigation, white/navy/blue colors, heading typography, field layout/spacing, section navigation, and save placement. Page heading and supporting copy match the concept. Initial save is disabled until a draft changes. Desktop uses the existing 232px navigation rail and a 230px record list; mobile stacks the record list and editor.
- Used headless Playwright Chromium because the computer/browser inventory returned no available browser. All 15 browser-flow checks passed. Live browser tests used a disposable copy of the site, catalog, and docs; test writes did not touch branch content. Covered unlock/token removal, search/no results, section draft retention, canceled record/public navigation, save/reload, rejected validation with retained draft, release/resource add/remove, Markdown preview, document draft/save, tool creation, mobile keyboard navigation, simulated expired authorization, browser-history cancellation, public documentation navigation, and exit/session clearing.
- Checked widths 1536, 1440, 1024, 768, and 390px with no horizontal page overflow. Checked a 720px layout for the equivalent CSS viewport of a 1440px window at 200% zoom; this is a viewport check, not a native browser zoom test. Desktop and phone screenshots were visually inspected. No application runtime errors were observed in the browser flows.
- `pnpm verify`: 41 existing tests passed; TypeScript, Vite production build, catalog consistency, and static artifact/header verification passed. Browser-flow checks are additional local evidence, not a replacement for release or deployment acceptance.

The operating guide now describes section navigation, both drafts, save behavior, failure recovery, and mobile use. No dependency, backend endpoint, token, or publication workflow changes were required.

Clean local screenshots (ignored QA output): [desktop](../output/studio-redesign/desktop.png), [mobile](../output/studio-redesign/mobile.png), [guide editor](../output/studio-redesign/guides.png), and [access screen](../output/studio-redesign/access.png). The approved concept and final screenshots were opened with `view_image`; the implementation was visually verified against the approved direction with the intentional product adaptations above. Temporary fixture servers were stopped; port 8080 was confirmed free.

The placeholder sidebar user name, role, avatar, and account arrow were subsequently removed because the website has no connected accounts.
