import { createServer } from "node:http";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { networkInterfaces } from "node:os";
import {
  contentDirectory,
  loadCatalogEntries,
  nextCatalogOrder,
  renderCatalogFile,
  validateCatalogEntry,
  writeGeneratedCatalog,
} from "./catalog-content.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(rootDir, "dist");
const docsDir = join(rootDir, "docs");
const packagesDir = join(rootDir, "packages");

const PORT = parseInt(process.env.PORT || "8080", 10);
const HOST = process.env.HOST || "0.0.0.0";

// Ephemeral single-session developer token generated on process startup
export const developerToken = randomBytes(32).toString("hex");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const safeDownloadRegex =
  /^\/downloads\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:exe|msi|msix|zip|dmg|pkg|deb|rpm))$/;

function verifyToken(req, url) {
  let candidate = "";

  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    candidate = authHeader.slice("Bearer ".length).trim();
  }

  if (!candidate && req.headers["x-developer-token"]) {
    candidate = String(req.headers["x-developer-token"]).trim();
  }

  if (!candidate && url.searchParams.has("token")) {
    candidate = url.searchParams.get("token") || "";
  }

  if (!candidate) return false;

  const expectedBuffer = Buffer.from(developerToken, "utf8");
  const candidateBuffer = Buffer.from(candidate, "utf8");
  if (expectedBuffer.length !== candidateBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, candidateBuffer);
}

function applySecurityHeaders(res, isAsset = false) {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  if (isAsset) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "no-store");
  }
}

async function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        // 2MB payload cap
        rejectBody(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) return resolveBody({});
      try {
        resolveBody(JSON.parse(body));
      } catch (err) {
        rejectBody(new Error(`Invalid JSON: ${err.message}`));
      }
    });
    req.on("error", rejectBody);
  });
}

function sendJson(res, statusCode, data) {
  applySecurityHeaders(res, false);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text) {
  applySecurityHeaders(res, false);
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

export function createToolAtlasServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);

    try {
      // 1. Health check
      if (pathname === "/api/health" && req.method === "GET") {
        return sendJson(res, 200, { status: "ok" });
      }

      // 2. Public Live Catalog API
      if (pathname === "/api/catalog" && req.method === "GET") {
        const entries = await loadCatalogEntries(contentDirectory);
        const tools = entries.map(({ metadata }) => {
          const { order, ...tool } = metadata;
          return tool;
        });
        const docs = Object.fromEntries(entries.map(({ metadata, guide }) => [metadata.id, guide]));
        return sendJson(res, 200, { tools, docs });
      }

      // 3. Developer Token Verification
      if (pathname === "/api/developer/verify" && req.method === "POST") {
        let body = {};
        try {
          body = await readJsonBody(req);
        } catch {
          // ignore
        }
        let token = body.token || "";
        if (!token) {
          const authHeader = req.headers["authorization"];
          if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.slice("Bearer ".length).trim();
          }
        }
        const expectedBuffer = Buffer.from(developerToken, "utf8");
        const candidateBuffer = Buffer.from(token || "", "utf8");
        const isValid =
          expectedBuffer.length === candidateBuffer.length &&
          timingSafeEqual(expectedBuffer, candidateBuffer);

        if (isValid) {
          return sendJson(res, 200, { valid: true });
        }
        return sendJson(res, 401, { valid: false, error: "Invalid developer token" });
      }

      // 4. Protected Developer APIs
      if (pathname.startsWith("/api/developer/")) {
        if (!verifyToken(req, url)) {
          return sendJson(res, 401, { error: "Unauthorized: Invalid or missing developer token" });
        }

        // List all tools (with metadata and raw markdown guide)
        if (pathname === "/api/developer/tools" && req.method === "GET") {
          const entries = await loadCatalogEntries(contentDirectory);
          return sendJson(
            res,
            200,
            entries.map(({ metadata, guide }) => ({
              id: metadata.id,
              metadata,
              guide,
            })),
          );
        }

        // Create a new tool
        if (pathname === "/api/developer/tools" && req.method === "POST") {
          const { metadata, guide } = await readJsonBody(req);
          if (!metadata || !guide) {
            return sendJson(res, 400, { error: "metadata and guide are required" });
          }

          const targetFile = join(contentDirectory, `${metadata.id}.md`);
          if (existsSync(targetFile)) {
            return sendJson(res, 409, { error: `Tool ${metadata.id} already exists` });
          }

          if (!metadata.order) {
            metadata.order = await nextCatalogOrder();
          }

          validateCatalogEntry(targetFile, metadata, guide);
          await writeFile(targetFile, renderCatalogFile(metadata, guide), "utf8");
          await writeGeneratedCatalog();
          return sendJson(res, 201, { success: true, tool: metadata });
        }

        // Single tool operations: /api/developer/tools/:id
        const toolMatch = /^\/api\/developer\/tools\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
        if (toolMatch) {
          const toolId = toolMatch[1];
          const targetFile = join(contentDirectory, `${toolId}.md`);

          if (req.method === "GET") {
            if (!existsSync(targetFile)) {
              return sendJson(res, 404, { error: `Tool ${toolId} not found` });
            }
            const content = await readFile(targetFile, "utf8");
            const entries = await loadCatalogEntries(contentDirectory);
            const entry = entries.find((item) => item.metadata.id === toolId);
            if (!entry) return sendJson(res, 404, { error: `Tool ${toolId} not found` });
            return sendJson(res, 200, { metadata: entry.metadata, guide: entry.guide, raw: content });
          }

          if (req.method === "PUT") {
            const { metadata, guide } = await readJsonBody(req);
            if (!metadata || !guide) {
              return sendJson(res, 400, { error: "metadata and guide are required" });
            }
            if (metadata.id !== toolId) {
              return sendJson(res, 400, { error: "metadata.id cannot be changed" });
            }

            validateCatalogEntry(targetFile, metadata, guide);
            await writeFile(targetFile, renderCatalogFile(metadata, guide), "utf8");
            await writeGeneratedCatalog();
            return sendJson(res, 200, { success: true, tool: metadata });
          }
        }

        // List documentation files: /api/developer/docs
        if (pathname === "/api/developer/docs" && req.method === "GET") {
          const files = (await readdir(docsDir)).filter((name) => name.endsWith(".md")).sort();
          const list = await Promise.all(
            files.map(async (name) => {
              const fileStats = await stat(join(docsDir, name));
              return { name, sizeBytes: fileStats.size, modified: fileStats.mtime.toISOString() };
            }),
          );
          return sendJson(res, 200, list);
        }

        // Single doc operations: /api/developer/docs/:name
        const docMatch = /^\/api\/developer\/docs\/([A-Za-z0-9_.-]+\.md)$/.exec(pathname);
        if (docMatch) {
          const docName = docMatch[1];
          const targetFile = join(docsDir, docName);

          if (req.method === "GET") {
            if (!existsSync(targetFile)) {
              return sendJson(res, 404, { error: `Document ${docName} not found` });
            }
            const content = await readFile(targetFile, "utf8");
            return sendJson(res, 200, { name: docName, content });
          }

          if (req.method === "PUT") {
            const { content } = await readJsonBody(req);
            if (typeof content !== "string") {
              return sendJson(res, 400, { error: "content string is required" });
            }
            await writeFile(targetFile, content, "utf8");
            return sendJson(res, 200, { success: true, name: docName });
          }
        }

        return sendJson(res, 404, { error: "Developer endpoint not found" });
      }

      // 5. Download Packages handling (/downloads/...)
      const downloadMatch = safeDownloadRegex.exec(pathname);
      if (downloadMatch) {
        if (req.method !== "GET" && req.method !== "HEAD") {
          return sendText(res, 405, "Method Not Allowed");
        }
        const [_, toolId, version, filename] = downloadMatch;
        const filePath = join(packagesDir, toolId, version, filename);

        if (!existsSync(filePath)) {
          return sendText(res, 404, "Download not found");
        }

        const fileStats = await stat(filePath);
        if (!fileStats.isFile()) {
          return sendText(res, 404, "Download not found");
        }

        applySecurityHeaders(res, false);
        res.setHeader("Content-Disposition", `attachment; filename="${basename(filePath)}"`);
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Length", fileStats.size);
        res.setHeader("Cache-Control", "private, no-store");

        if (req.method === "HEAD") {
          res.writeHead(200);
          return res.end();
        }

        res.writeHead(200);
        return createReadStream(filePath).pipe(res);
      }

      // 6. Static File Serving from dist/
      if (req.method !== "GET" && req.method !== "HEAD") {
        return sendText(res, 405, "Method Not Allowed");
      }

      if (pathname === "/_headers") {
        return sendText(res, 404, "Not Found");
      }

      let candidatePath = join(distDir, pathname);
      let isFile = false;

      // Prevent directory traversal
      if (!candidatePath.startsWith(distDir)) {
        return sendText(res, 403, "Forbidden");
      }

      if (existsSync(candidatePath)) {
        const candidateStats = await stat(candidatePath);
        if (candidateStats.isFile()) {
          isFile = true;
        } else if (candidateStats.isDirectory()) {
          const indexFile = join(candidatePath, "index.html");
          if (existsSync(indexFile)) {
            candidatePath = indexFile;
            isFile = true;
          }
        }
      }

      // SPA Fallback: if not found, serve dist/index.html
      if (!isFile) {
        const fallbackIndex = join(distDir, "index.html");
        if (existsSync(fallbackIndex)) {
          candidatePath = fallbackIndex;
          isFile = true;
        } else {
          return sendText(
            res,
            503,
            "Application dist directory not found. Please run: pnpm build",
          );
        }
      }

      const ext = extname(candidatePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";
      const isImmutableAsset = pathname.startsWith("/assets/");
      const fileStats = await stat(candidatePath);

      applySecurityHeaders(res, isImmutableAsset);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", fileStats.size);

      if (req.method === "HEAD") {
        res.writeHead(200);
        return res.end();
      }

      res.writeHead(200);
      createReadStream(candidatePath).pipe(res);
    } catch (error) {
      process.stderr.write(`Server error: ${error.message}\n`);
      sendJson(res, 500, { error: error.message });
    }
  });
}

function getNetworkIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createToolAtlasServer();
  server.listen(PORT, HOST, () => {
    const networkIp = getNetworkIp();
    const localUrl = `http://localhost:${PORT}/`;
    const networkUrl = `http://${networkIp}:${PORT}/`;
    const devUrl = `http://localhost:${PORT}/?page=developer&token=${developerToken}`;
    const devNetworkUrl = `http://${networkIp}:${PORT}/?page=developer&token=${developerToken}`;

    process.stdout.write(`
========================================================================
  🚀 Tool Atlas Server is Running
  ----------------------------------------------------------------------
  Local Public URL:      ${localUrl}
  Network Public URL:    ${networkUrl}

  🔑 Developer Studio Access Link (Ephemeral startup token):
  ${devUrl}

  Network Developer Link:
  ${devNetworkUrl}
========================================================================
`);
  });

  const handleShutdown = () => {
    process.stdout.write("\nShutting down Tool Atlas Server...\n");
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
}
