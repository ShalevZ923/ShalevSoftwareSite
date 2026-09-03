import { createHash, timingSafeEqual } from "node:crypto";

const sha256Pattern = /^[a-f0-9]{64}$/u;

export function descriptionSha256(description) {
  if (typeof description !== "string") throw new Error("Issue description is unavailable");
  return createHash("sha256").update(description, "utf8").digest("hex");
}

export function requireApprovedDescription(description, expectedDigest) {
  const normalizedDigest = expectedDigest?.trim().toLowerCase();
  if (!normalizedDigest || !sha256Pattern.test(normalizedDigest)) {
    throw new Error("CATALOG_APPROVED_DESCRIPTION_SHA256 must be a 64-character SHA-256 digest");
  }

  const actualDigest = descriptionSha256(description);
  if (!timingSafeEqual(Buffer.from(actualDigest, "hex"), Buffer.from(normalizedDigest, "hex"))) {
    throw new Error("Issue description changed after review; review it again and provide its new SHA-256 digest");
  }
}

function repositoryRemoteHost(remoteUrl) {
  try {
    const url = new URL(remoteUrl);
    if (url.protocol !== "https:") throw new Error("Repository origin must use HTTPS");
    return url.host;
  } catch (error) {
    if (error instanceof TypeError) {
      const scpStyleRemote = /^(?:[^@]+@)?([^:]+):.+$/u.exec(remoteUrl);
      if (scpStyleRemote) return scpStyleRemote[1];
    }
    throw error;
  }
}

export function trustedGitLabApiBase(apiBase, repositoryRemote) {
  let apiUrl;
  try {
    apiUrl = new URL(apiBase);
  } catch {
    throw new Error("CI_API_V4_URL must be a valid HTTPS URL");
  }
  if (apiUrl.protocol !== "https:" || apiUrl.username || apiUrl.password) {
    throw new Error("CI_API_V4_URL must be a credential-free HTTPS URL");
  }
  if (apiUrl.host !== repositoryRemoteHost(repositoryRemote)) {
    throw new Error("CI_API_V4_URL must use the checked-out repository origin");
  }
  if (!apiUrl.pathname.replace(/\/+$/u, "").endsWith("/api/v4")) {
    throw new Error("CI_API_V4_URL must end with /api/v4");
  }
  return apiUrl.toString().replace(/\/+$/u, "");
}
