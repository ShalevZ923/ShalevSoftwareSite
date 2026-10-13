import type { Tool } from "./data";
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid ${field}`);
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${field}`);
  return value;
}
function list(value: unknown, field: string, allowed?: readonly string[], nonempty = false) {
  if (!Array.isArray(value) || (nonempty && !value.length)) throw new Error(`Invalid ${field}`);
  for (const item of value) {
    const entry = text(item, field);
    if (allowed && !allowed.includes(entry)) throw new Error(`Invalid ${field}`);
  }
  return value as string[];
}
function owner(value: unknown) {
  const record = object(value, "owner");
  for (const key of ["name", "team", "initials", "email"]) text(record[key], "owner." + key);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email as string))
    throw new Error("Invalid owner.email");
}
function https(value: unknown) {
  const url = new URL(text(value, "url"));
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid url");
}
export function decodeTool(value: unknown): Tool {
  const record = object(value, "tool");
  for (const key of ["id", "name", "company", "category", "description", "updated", "icon"])
    text(record[key], key);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id as string)) throw new Error("Invalid id");
  list(record.platforms, "platforms", ["Windows", "Linux", "macOS", "Web"], true);
  list(record.tags, "tags", undefined, true);
  if (!["Current", "New", "Legacy"].includes(record.lifecycle as string))
    throw new Error("Invalid lifecycle");
  owner(record.support);
  if (!Array.isArray(record.releases) || !record.releases.length)
    throw new Error("Invalid releases");
  const versions = new Set();
  for (const [index, item] of record.releases.entries()) {
    const release = object(item, `releases[${index}]`);
    const version = text(release.version, `releases[${index}].version`);
    if (versions.has(version)) throw new Error("Duplicate release");
    versions.add(version);
    if ((release.download !== undefined) === (release.artifact !== undefined))
      throw new Error("Invalid release target");
    if (release.download !== undefined) https(release.download);
    else if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(
        text(release.artifact, "artifact"),
      )
    )
      throw new Error("Invalid artifact");
  }
  if (record.resources !== undefined) {
    if (!Array.isArray(record.resources)) throw new Error("Invalid resources");
    for (const item of record.resources) {
      const resource = object(item, "resource");
      for (const key of ["id", "title", "owner", "reviewedOn"])
        text(resource[key], "resource." + key);
      list(resource.appliesTo, "resource.appliesTo", undefined, true);
      if (
        !["official-manual", "internal-guide", "training"].includes(resource.kind as string) ||
        !["pdf", "pptx", "web"].includes(resource.format as string)
      )
        throw new Error("Invalid resource type");
      if ((resource.url !== undefined) === (resource.file !== undefined))
        throw new Error("Invalid resource target");
      if (resource.url !== undefined) https(resource.url);
      else text(resource.file, "resource.file");
    }
  }
  if (record.facts !== undefined) {
    if (!Array.isArray(record.facts)) throw new Error("Invalid facts");
    for (const item of record.facts) {
      const fact = object(item, "fact");
      text(fact.label, "fact.label");
      text(fact.value, "fact.value");
    }
  }
  if (record.notice !== undefined) {
    const notice = object(record.notice, "notice");
    text(notice.title, "notice.title");
    text(notice.message, "notice.message");
    if (!["info", "warning"].includes(notice.tone as string)) throw new Error("Invalid notice");
  }
  if (record.image !== undefined) {
    const image = object(record.image, "image");
    text(image.src, "image.src");
    text(image.alt, "image.alt");
  }
  return record as unknown as Tool;
}
export function decodeCatalog(value: unknown) {
  const result = object(value, "catalog");
  if (!Array.isArray(result.tools)) throw new Error("Invalid catalog tools");
  const docs = object(result.docs, "docs");
  if (Object.values(docs).some((value) => typeof value !== "string"))
    throw new Error("Invalid guides");
  return { tools: result.tools.map(decodeTool), docs: docs as Record<string, string> };
}
export function decodeDocList(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Invalid document list");
  return value.map((value) => {
    const item = object(value, "document");
    text(item.name, "name");
    text(item.modified, "modified");
    if (typeof item.sizeBytes !== "number" || item.sizeBytes < 0) throw new Error("Invalid size");
    return item as { name: string; modified: string; sizeBytes: number };
  });
}
