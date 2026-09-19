# Developer Studio

Developer Studio is an optional local authoring interface. It runs `scripts/server.mjs`, reads catalog and documentation files, and can write reviewed changes into the working tree. It does not replace the approval-gated pull-request and merge-request contribution workflows.

## Safe local setup

1. Start from a trusted checkout and review any existing uncommitted changes.
2. Install dependencies and validate the current tree:

   ```bash
   pnpm install --frozen-lockfile
   pnpm verify
   ```

3. Start the Studio development server:

   ```bash
   pnpm dev
   ```

4. Open the Developer Studio link printed by the process. It uses a URL fragment such as `?page=developer#token=...`; fragments are not sent in HTTP requests or Referer headers. The app removes the token from the address bar before verification and stores it only for the current browser session. `pnpm dev:client` remains available for a Vite-only public-catalog UI session; it deliberately does not expose Developer Studio or issue a token.
5. After editing, inspect `git diff`, run `pnpm verify`, and submit the change through normal review. Do not publish directly from Developer Studio.
6. Select **Exit Studio** when finished. This clears the browser session token. Restarting the Node.js process invalidates the old token and creates a new one.

By default the server listens only on `127.0.0.1`. Treat anyone with the startup link or token as able to read and modify the supported catalog and documentation files.
The terminal output is therefore secret-bearing: do not send it to centralized logs, paste it into support tickets, or include it in screenshots.

## Using the redesigned workspace

- Use **Software Catalog** to search and select a tool, or **Add Software** to create one. Edit **Overview**, **Releases**, **Guides**, and **Support** without losing your current draft. The Overview disclosure contains the identifier, icon initials, update label, and catalog order.
- The first release remains the catalog's default download. Guide resources and the Markdown guide share the Guides section; use Editor, Split, or Preview on desktop, and Editor or Preview on a phone.
- **System docs** has its own searchable list and Markdown editor. Switching between software and system docs retains both current drafts in memory.
- **Save changes** writes the active record to the local working tree. The action stays available while scrolling; it is disabled when the active draft is unchanged or a save is running. “All changes saved” refers to that record, not the other workspace's draft, a Git commit, or publication.
- Selecting another record or creating a tool asks before replacing an unsaved draft. Exiting or navigating to a public page asks if either workspace has unsaved changes. Browser reload/close uses the browser's built-in unsaved-work warning. Drafts are not persisted across reloads.
- If saving fails, the error receives focus and the draft remains editable. Correct the reported issue and save again. **Reload list** retries loading the current workspace's list; it does not save a draft. For expired access, retain any needed draft text locally and restart the normal token-based access flow.
- On phones, the record list sits above the editor. Open the main navigation using the menu button; Escape closes it. Hidden navigation is excluded from keyboard focus.

## Windows launcher

Run the same loopback-only workflow from PowerShell:

```powershell
.\windows\Start-ToolAtlas.ps1
```

The launcher also defaults to `127.0.0.1`. `-SkipBuild` may be used only when `dist/` already contains the intended reviewed build.

## Network access

Do not expose the Node.js server directly over plaintext HTTP. A non-loopback bind is refused unless `TOOL_ATLAS_BEHIND_TLS_PROXY=true` is explicitly set; the Windows launcher sets it only when `-BehindTlsProxy` is supplied. That flag is an operator assertion, not a TLS implementation.

If network access is required, place the server behind a trusted TLS reverse proxy, restrict source networks at the firewall, keep the origin port private, and prevent proxy/access logs from recording authorization headers. In this mode the server cannot know the proxy's external hostname, so it prints the token separately: open the configured HTTPS Developer Studio URL and paste the token into the authentication gate. Never use the printed HTTP origin URL from another machine. The current token is a single-session bearer credential with no user identity, roles, audit trail, or per-change approval, so this mode is not suitable for public or multi-user production administration.

## Recovery and token rotation

- Stop the process immediately if the token is exposed. Restart it to rotate the ephemeral token, then close any browser tabs that held the old session.
- If an edit is wrong, inspect the working-tree diff and revert only the affected hunk or file through the normal Git workflow. Preserve unrelated uncommitted work.
- A `400 Malformed request URL` response means the request path had invalid percent encoding. A `403 Forbidden` response means the resolved static path escaped `dist/`.
- If startup refuses the bind, return to the default loopback host or finish the TLS proxy and firewall setup before using the explicit proxy assertion.

### Guide editor audit fixes

- New guides receive unique internal IDs automatically; administrators do not need to edit IDs.
- Server-library loading, failure, and empty states are distinct. Use **Refresh server files** after an administrator adds a PDF/PPTX to `guide-library/<tool-id>/`. Save a new tool before attaching its server files. Only available files matching the selected format can be selected; missing existing references remain visible as unavailable.
- **Applies to versions** accepts comma-separated versions without removing separators while typing. Saved metadata trims whitespace and removes duplicate/empty items.

Validation: `pnpm verify` passed (78 tests, TypeScript, production build, artifact checks). Browser checks confirmed empty-library guidance, disabled unavailable source, and typing a comma/space followed by a second version with the value retained after Refresh. These focused checks do not replace deployment acceptance.
