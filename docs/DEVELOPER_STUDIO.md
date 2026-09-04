# Developer Studio proof of concept

Developer Studio is an optional local authoring interface. It runs `scripts/server.mjs`, reads catalog and documentation files, and can write reviewed changes into the working tree. It does not replace the approval-gated pull-request and merge-request contribution workflows.

## Safe local setup

1. Start from a trusted checkout and review any existing uncommitted changes.
2. Install dependencies and validate the current tree:

   ```bash
   pnpm install --frozen-lockfile
   pnpm verify
   ```

3. Start the server:

   ```bash
   pnpm serve
   ```

4. Open the Developer Studio link printed by the process. It uses a URL fragment such as `?page=developer#token=...`; fragments are not sent in HTTP requests or Referer headers. The app removes the token from the address bar before verification and stores it only for the current browser session.
5. After editing, inspect `git diff`, run `pnpm verify`, and submit the change through normal review. Do not publish directly from Developer Studio.
6. Select **Exit Studio** when finished. This clears the browser session token. Restarting the Node.js process invalidates the old token and creates a new one.

By default the server listens only on `127.0.0.1`. Treat anyone with the startup link or token as able to read and modify the supported catalog and documentation files.
The terminal output is therefore secret-bearing: do not send it to centralized logs, paste it into support tickets, or include it in screenshots.

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
