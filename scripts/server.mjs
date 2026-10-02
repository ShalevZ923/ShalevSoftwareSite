import { createServer } from "node:http";
import { mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  contentDirectory,
  catalogEntryDirectory,
  loadCatalogEntries,
  loadTaxonomy,
  nextCatalogOrder,
  renderCatalogEntryFiles,
  writeGeneratedCatalog,
} from "./catalog-content.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(rootDir, "dist");
const docsDir = join(rootDir, "docs");
const packagesDir = join(rootDir, "packages");
const guideLibraryDir = join(rootDir, "guide-library");

const PORT = parseInt(process.env.PORT || "8080", 10);
const HOST = process.env.HOST || "127.0.0.1";
const guideLinkHosts = new Set((process.env.TOOL_ATLAS_GUIDE_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));

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
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const safeDownloadRegex =
  /^\/downloads\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:exe|msi|msix|zip|dmg|pkg|deb|rpm))$/;
const safeGuideRegex = /^\/guides\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:pdf|pptx))$/;

async function verifyGuideLibraryResources(toolId, resources = []) {
  for (const resource of resources) {
    if (!resource.file) continue;
    const [resourceToolId, filename] = resource.file.split("/");
    if (resourceToolId !== toolId || !filename) throw new Error("guide resource file must belong to its tool");
    const expected = join(guideLibraryDir, resourceToolId, filename);
    if (!existsSync(expected) || !(await stat(expected)).isFile()) {
      throw new Error(`guide resource file is not present in the approved library: ${resource.file}`);
    }
    const [realRoot, realFile] = await Promise.all([realpath(guideLibraryDir), realpath(expected)]);
    if (!isPathInside(realRoot, realFile)) throw new Error("guide resource file escapes the approved library");
  }
}

async function verifyGuideLinks(resources = []) {
  for (const resource of resources) {
    if (!resource.url) continue;
    const target = new URL(resource.url);
    if (!guideLinkHosts.has(target.hostname.toLowerCase())) {
      throw new Error(`guide link host is not allowlisted: ${target.hostname}. Configure TOOL_ATLAS_GUIDE_HOSTS`);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(target, { method: "HEAD", redirect: "manual", signal: controller.signal });
      // 401/403 commonly means the endpoint is reachable but relies on the
      // reader's own SharePoint or intranet SSO session.
      if (response.status >= 400 && response.status !== 401 && response.status !== 403) {
        throw new Error(`guide link check returned HTTP ${response.status}`);
      }
    } catch (error) {
      throw new Error(`guide link check failed for ${target.hostname}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function verifyToken(req) {
  let candidate = "";

  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    candidate = authHeader.slice("Bearer ".length).trim();
  }

  if (!candidate && req.headers["x-developer-token"]) {
    candidate = String(req.headers["x-developer-token"]).trim();
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
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  if (isAsset) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "no-store");
  }
}

const maxJsonBodyBytes = 2 * 1024 * 1024;

function payloadTooLargeError() {
  const error = new Error("Payload too large");
  error.statusCode = 413;
  return error;
}

async function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxJsonBodyBytes) {
        // Stop retaining data immediately. Resume drains the socket so the
        // process can return 413 without accumulating an unbounded body.
        settled = true;
        req.resume();
        rejectBody(payloadTooLargeError());
      }
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      if (!body.trim()) return resolveBody({});
      try {
        resolveBody(JSON.parse(body));
      } catch (err) {
        rejectBody(new Error(`Invalid JSON: ${err.message}`));
      }
    });
    req.on("error", (error) => {
      if (!settled) {
        settled = true;
        rejectBody(error);
      }
    });
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

function isPathInside(root, candidate) {
  const relativePath = relative(root, candidate);
  return (
    relativePath === "" ||
    (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
  );
}

function isLoopbackHost(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

async function categoryIdForLabel(label) {
  const category = (await loadTaxonomy()).find((item) => item.label === label);
  if (!category) throw new Error(`Unknown catalog category: ${label}`);
  return category.id;
}

async function writeCatalogEntry(metadata, guide) {
  const categoryId = await categoryIdForLabel(metadata.category);
  const { files } = renderCatalogEntryFiles(metadata, guide, categoryId);
  const vendorFile = files[0];
  try {
    const existingVendor = JSON.parse(await readFile(vendorFile.path, "utf8"));
    if (existingVendor.name !== metadata.company) throw new Error(`Vendor directory already belongs to ${existingVendor.name}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const file of files) {
    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, file.content, "utf8");
  }
  await writeGeneratedCatalog();
}

export function assertSafeBindHost(host, behindTlsProxy = false) {
  if (!isLoopbackHost(host) && !behindTlsProxy) {
    throw new Error(
      "Refusing a non-loopback bind without TOOL_ATLAS_BEHIND_TLS_PROXY=true. " +
        "Terminate TLS at a trusted reverse proxy before exposing Developer Studio.",
    );
  }
}

export function createToolAtlasServer({
  distDirectory = distDir,
  packagesDirectory = packagesDir,
  guideLibraryDirectory = guideLibraryDir,
} = {}) {
  const server = createServer(async (req, res) => {
    let pathname;
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      pathname = decodeURIComponent(url.pathname);
    } catch (error) {
      if (error instanceof URIError || error instanceof TypeError) {
        return sendJson(res, 400, { error: "Malformed request URL" });
      }
      throw error;
    }

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
        } catch (error) {
          if (error.statusCode === 413) {
            return sendJson(res, 413, { valid: false, error: error.message });
          }
          // Invalid JSON is equivalent to an invalid credential here and does
          // not reveal parsing details.
        }
        if (
          body === null || typeof body !== "object" || Array.isArray(body) ||
          (body.token !== undefined && typeof body.token !== "string")
        ) {
          return sendJson(res, 401, { valid: false, error: "Invalid developer token" });
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
        if (!verifyToken(req)) {
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

          const categoryId = await categoryIdForLabel(metadata.category);
          const targetDirectory = catalogEntryDirectory(categoryId, metadata.company, metadata.id);
          if (existsSync(targetDirectory)) {
            return sendJson(res, 409, { error: `Tool ${metadata.id} already exists` });
          }

          if (!metadata.order) {
            metadata.order = await nextCatalogOrder();
          }

          try {
            await verifyGuideLibraryResources(metadata.id, metadata.resources);
            await verifyGuideLinks(metadata.resources);
            await writeCatalogEntry(metadata, guide);
          } catch (error) {
            return sendJson(res, 400, {
              error: error instanceof Error ? error.message : "Catalog validation failed",
            });
          }
          return sendJson(res, 201, { success: true, tool: metadata });
        }

        // Single tool operations: /api/developer/tools/:id
        const toolMatch = /^\/api\/developer\/tools\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
        if (toolMatch) {
          const toolId = toolMatch[1];
          if (req.method === "GET") {
            const entries = await loadCatalogEntries(contentDirectory);
            const entry = entries.find((item) => item.metadata.id === toolId);
            if (!entry) return sendJson(res, 404, { error: `Tool ${toolId} not found` });
            return sendJson(res, 200, { metadata: entry.metadata, guide: entry.guide });
          }

          if (req.method === "PUT") {
            const { metadata, guide } = await readJsonBody(req);
            if (!metadata || !guide) {
              return sendJson(res, 400, { error: "metadata and guide are required" });
            }
            if (metadata.id !== toolId) {
              return sendJson(res, 400, { error: "metadata.id cannot be changed" });
            }

            const entries = await loadCatalogEntries(contentDirectory);
            const current = entries.find((item) => item.metadata.id === toolId);
            if (!current) return sendJson(res, 404, { error: `Tool ${toolId} not found` });
            if (metadata.company !== current.metadata.company || metadata.category !== current.metadata.category) {
              return sendJson(res, 400, { error: "metadata.company and metadata.category cannot be changed through Developer Studio" });
            }
            try {
              await verifyGuideLibraryResources(toolId, metadata.resources);
              await verifyGuideLinks(metadata.resources);
              await writeCatalogEntry(metadata, guide);
            } catch (error) {
              return sendJson(res, 400, {
                error: error instanceof Error ? error.message : "Catalog validation failed",
              });
            }
            return sendJson(res, 200, { success: true, tool: metadata });
          }
        }

        // List documentation files: /api/developer/docs
        const guideLibraryMatch = /^\/api\/developer\/guide-library\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
        if (guideLibraryMatch && req.method === "GET") {
          const toolId = guideLibraryMatch[1];
          const directory = join(guideLibraryDir, toolId);
          if (!existsSync(directory)) return sendJson(res, 200, []);
          const files = (await readdir(directory, { withFileTypes: true }))
            .filter((entry) => entry.isFile() && /\.(?:pdf|pptx)$/iu.test(entry.name))
            .map((entry) => `${toolId}/${entry.name}`)
            .sort();
          return sendJson(res, 200, files);
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
        const filePath = join(packagesDirectory, toolId, version, filename);

        if (!existsSync(filePath)) {
          return sendText(res, 404, "Download not found");
        }

        // Package directories can be host-mounted. Resolve both ends before
        // streaming so an accidental or malicious symlink cannot escape the
        // approved package root.
        const [realPackagesDirectory, realFilePath] = await Promise.all([
          realpath(packagesDirectory),
          realpath(filePath),
        ]);
        if (!isPathInside(realPackagesDirectory, realFilePath)) {
          return sendText(res, 403, "Forbidden");
        }

        const fileStats = await stat(realFilePath);
        if (!fileStats.isFile()) {
          return sendText(res, 404, "Download not found");
        }

        applySecurityHeaders(res, false);
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Length", fileStats.size);
        res.setHeader("Cache-Control", "private, no-store");

        if (req.method === "HEAD") {
          res.writeHead(200);
          return res.end();
        }

        res.writeHead(200);
        return createReadStream(realFilePath).pipe(res);
      }

      const guideMatch = safeGuideRegex.exec(pathname);
      if (guideMatch) {
        if (req.method !== "GET" && req.method !== "HEAD") return sendText(res, 405, "Method Not Allowed");
        const [, toolId, filename] = guideMatch;
        const filePath = join(guideLibraryDirectory, toolId, filename);
        if (!existsSync(filePath) || !(await stat(filePath)).isFile()) return sendText(res, 404, "Guide not found");
        const [realRoot, realFile] = await Promise.all([realpath(guideLibraryDirectory), realpath(filePath)]);
        if (!isPathInside(realRoot, realFile)) return sendText(res, 403, "Forbidden");
        applySecurityHeaders(res, false);
        res.setHeader("Content-Type", mimeTypes[extname(realFile).toLowerCase()] || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${basename(realFile)}"`);
        res.setHeader("Cache-Control", "private, no-store");
        if (req.method === "HEAD") { res.writeHead(200); return res.end(); }
        res.writeHead(200);
        return createReadStream(realFile).pipe(res);
      }

      // 6. Static File Serving from dist/
      if (req.method !== "GET" && req.method !== "HEAD") {
        return sendText(res, 405, "Method Not Allowed");
      }

      if (pathname === "/_headers") {
        return sendText(res, 404, "Not Found");
      }

      let candidatePath = resolve(distDirectory, `.${pathname}`);
      let isFile = false;

      // Prevent directory traversal
      if (!isPathInside(distDirectory, candidatePath)) {
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
        const fallbackIndex = join(distDirectory, "index.html");
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

      // stat() and createReadStream() follow symlinks. Validate the real path
      // as well as the lexical path so a link inside dist cannot escape it.
      const [realDistDirectory, realCandidatePath] = await Promise.all([
        realpath(distDirectory),
        realpath(candidatePath),
      ]);
      if (!isPathInside(realDistDirectory, realCandidatePath)) {
        return sendText(res, 403, "Forbidden");
      }
      candidatePath = realCandidatePath;

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
      sendJson(res, error.statusCode || 500, { error: error.message });
    }
  });
  // Developer Studio is an optional authoring server. Bound request and header
  // durations limit slow clients when an operator deliberately puts it behind
  // a trusted TLS proxy; production static deployments do not run this server.
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    assertSafeBindHost(HOST, process.env.TOOL_ATLAS_BEHIND_TLS_PROXY === "true");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }

  if (process.exitCode !== 1) {
    const server = createToolAtlasServer();
    server.listen(PORT, HOST, () => {
      const displayHost = HOST === "::1" ? "[::1]" : HOST;
      const localUrl = `http://${displayHost}:${PORT}/`;
      const developerAccess = isLoopbackHost(HOST)
        ? `Developer Studio Access Link (Ephemeral startup token):\n  ${localUrl}?page=developer#token=${developerToken}`
        : `Developer Studio Token (paste only through the configured HTTPS proxy):\n  ${developerToken}`;

      process.stdout.write(`
========================================================================
  🚀 Tool Atlas Server is Running
  ----------------------------------------------------------------------
  Bound URL:             ${localUrl}

  🔑 ${developerAccess}
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
}
