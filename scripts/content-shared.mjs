import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
export const artifactPointerPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const localImagePattern = /^\/tool-images\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
export const sensitiveFactPattern = /key|activation|password|token/i;
export const noticeTones = new Set(["info", "warning"]);

export function fail(source, message) {
  throw new Error(`${source}: ${message}`);
}

export function requiredString(value, field, source) {
  if (typeof value !== "string" || !value.trim()) fail(source, `${field} must be a non-empty string`);
  return value.trim();
}

export function requireStringList(value, field, source) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
    fail(source, `${field} must be a non-empty list of strings`);
  }
  return value.map((item) => item.trim());
}

export function requiredHttpsUrl(value, field, source) {
  const download = requiredString(value, field, source);
  try {
    const url = new URL(download);
    if (url.protocol !== "https:" || url.username || url.password) fail(source, `${field} must be a credential-free HTTPS URL`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${source}:`)) throw error;
    fail(source, `${field} must be a valid HTTPS URL`);
  }
  return download;
}

export function requiredArtifactPointer(value, field, source) {
  const artifact = requiredString(value, field, source);
  if (!artifactPointerPattern.test(artifact)) {
    fail(source, `${field} must use tool-id/version/filename with safe path characters`);
  }
  return artifact;
}

export function requiredVersion(value, source, field = "releases.version") {
  const version = requiredString(value, field, source);
  if (!versionPattern.test(version)) fail(source, `${field} must be filename-safe`);
  return version;
}

export function requiredId(value, field, source) {
  const id = requiredString(value, field, source);
  if (!idPattern.test(id)) fail(source, `${field} must be lowercase kebab-case`);
  return id;
}

export function parseReleaseList(value, source) {
  const releases = value
    .split(/\r?\n|;/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("|");
      if (separator < 1) {
        fail(source, "each approved release must use: version | HTTPS URL or artifact:tool-id/version/filename");
      }
      const version = requiredVersion(line.slice(0, separator), source);
      const target = requiredString(line.slice(separator + 1), "releases.target", source);
      if (target.startsWith("artifact:")) {
        return {
          version,
          artifact: requiredArtifactPointer(target.slice("artifact:".length), "releases.artifact", source),
        };
      }
      return {
        version,
        download: requiredHttpsUrl(target, "releases.download", source),
      };
    });
  if (releases.length === 0) fail(source, "releases must contain at least one approved release");
  if (new Set(releases.map((release) => release.version)).size !== releases.length) fail(source, "releases must not repeat a version");
  return releases;
}

export function slugifyId(value) {
  return value.toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function readJson(path, source = path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(source, `must contain valid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}

export async function findFiles(directory, filename) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findFiles(path, filename);
    return entry.isFile() && entry.name === filename ? [path] : [];
  }));
  return nested.flat();
}

export function validateOptionalFacts(facts, source) {
  if (facts === undefined) return undefined;
  if (!Array.isArray(facts)) fail(source, "facts must be a list when supplied");
  return facts.map((fact) => {
    if (!fact || typeof fact !== "object" || Array.isArray(fact)) fail(source, "each fact must be an object");
    const label = requiredString(fact.label, "facts.label", source);
    const value = requiredString(fact.value, "facts.value", source);
    if (sensitiveFactPattern.test(label)) fail(source, "fact labels cannot describe credentials or activation material");
    return { label, value };
  });
}

export function validateOptionalNotice(notice, source) {
  if (notice === undefined) return undefined;
  if (!notice || typeof notice !== "object" || Array.isArray(notice)) fail(source, "notice must be an object when supplied");
  if (!noticeTones.has(notice.tone)) fail(source, "notice.tone must be info or warning");
  return {
    tone: notice.tone,
    title: requiredString(notice.title, "notice.title", source),
    message: requiredString(notice.message, "notice.message", source),
  };
}

export function validateOptionalImage(image, source) {
  if (image === undefined) return undefined;
  if (!image || typeof image !== "object" || Array.isArray(image)) fail(source, "image must be an object when supplied");
  const imagePath = requiredString(image.src, "image.src", source);
  const alt = requiredString(image.alt, "image.alt", source);
  if (!localImagePattern.test(imagePath) || imagePath.includes("..")) fail(source, "image.src must be a local /tool-images/ path");
  return { src: imagePath, alt };
}

export function validateOwner(owner, field, source) {
  if (!owner || typeof owner !== "object" || Array.isArray(owner)) fail(source, `${field} must be an object`);
  const name = requiredString(owner.name, `${field}.name`, source);
  const team = requiredString(owner.team, `${field}.team`, source);
  const initials = requiredString(owner.initials, `${field}.initials`, source);
  const email = requiredString(owner.email, `${field}.email`, source);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) fail(source, `${field}.email must be an email address`);
  return { name, team, initials, email };
}

export function validateReleaseRecords(releases, source, id) {
  if (!Array.isArray(releases)) fail(source, "releases must be a list");
  const releaseVersions = new Set();
  const normalized = [];
  for (const [releaseIndex, release] of releases.entries()) {
    const releaseField = `releases[${releaseIndex}]`;
    if (!release || typeof release !== "object" || Array.isArray(release)) fail(source, "each release must be an object");
    const version = requiredVersion(release.version, source, `${releaseField}.version`);
    if (releaseVersions.has(version)) fail(source, `${releaseField}.version must not repeat a version`);
    releaseVersions.add(version);
    const hasDownload = release.download !== undefined;
    const hasArtifact = release.artifact !== undefined;
    if (hasDownload === hasArtifact) {
      fail(source, "each release must define exactly one download or artifact target");
    }
    if (hasDownload) {
      normalized.push({ version, download: requiredHttpsUrl(release.download, `${releaseField}.download`, source) });
      continue;
    }
    const artifact = requiredArtifactPointer(release.artifact, `${releaseField}.artifact`, source);
    const [artifactToolId, artifactVersion] = artifact.split("/");
    if (artifactToolId !== id) fail(source, `${releaseField}.artifact tool-id must match the catalog id`);
    if (artifactVersion !== version) fail(source, `${releaseField}.artifact version must match the release version`);
    normalized.push({ version, artifact });
  }
  if (releaseVersions.size === 0) fail(source, "releases must contain at least one approved release");
  return normalized;
}

export function requireInstallOrGuideSections(guide, source) {
  if (!/^## Install\b/mu.test(guide) || !/^## Support\b/mu.test(guide)) {
    fail(source, "guide must include ## Install and ## Support sections");
  }
}
