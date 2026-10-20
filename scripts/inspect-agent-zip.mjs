import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { createInflateRaw } from "node:zlib";

const maxArchiveBytes = 512 * 1024 * 1024;
const maxCentralBytes = 16 * 1024 * 1024;
const maxEntries = 10000;
const maxEntryBytes = 256 * 1024 * 1024;
const maxExpandedBytes = 1024 * 1024 * 1024;
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(previous, chunk) {
  let value = previous;
  for (const byte of chunk) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return value >>> 0;
}

async function readExactly(handle, length, position) {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(buffer, offset, length - offset, position + offset);
    if (!bytesRead) throw new Error("ZIP is truncated");
    offset += bytesRead;
  }
  return buffer;
}

function safeEntryName(bytes) {
  let name;
  try { name = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("ZIP entry name is not UTF-8"); }
  if (!name || name.startsWith("/") || /[\\<>:"|?*\x00-\x1f\x7f]/u.test(name) ||
    name.split("/").some((part, index, all) => part === "." || part === ".." ||
      (part === "" && index !== all.length - 1) || /[. ]$/u.test(part) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part))) {
    throw new Error(`unsafe ZIP entry path: ${JSON.stringify(name)}`);
  }
  return name;
}

async function verifyEntryData(path, entry) {
  if (entry.directory && entry.expandedSize !== 0) throw new Error(`directory contains data: ${entry.name}`);
  let expanded = 0;
  let crc = 0xffffffff;
  if (entry.compressedSize > 0) {
    const source = createReadStream(path, { start: entry.dataStart, end: entry.dataStart + entry.compressedSize - 1 });
    const content = entry.method === 8 ? source.pipe(createInflateRaw()) : source;
    for await (const chunk of content) {
      expanded += chunk.length;
      if (expanded > entry.expandedSize || expanded > maxEntryBytes) {
        content.destroy();
        throw new Error(`ZIP entry expands beyond declared size: ${entry.name}`);
      }
      crc = crc32(crc, chunk);
    }
  }
  if (expanded !== entry.expandedSize || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) {
    throw new Error(`ZIP entry is corrupt: ${entry.name}`);
  }
}

export async function inspectAgentZip(path, archiveRoot, listedContents) {
  const size = (await stat(path)).size;
  if (size < 22 || size > maxArchiveBytes) throw new Error("ZIP size is outside the supported range (up to 512 MiB)");
  const handle = await open(path, "r");
  try {
    const tailLength = Math.min(size, 65557);
    const tail = await readExactly(handle, tailLength, size - tailLength);
    let end = -1;
    for (let position = tail.length - 22; position >= 0; position -= 1) {
      if (tail.readUInt32LE(position) === 0x06054b50 && position + 22 + tail.readUInt16LE(position + 20) === tail.length) { end = position; break; }
    }
    if (end < 0) throw new Error("ZIP end record is missing");
    const count = tail.readUInt16LE(end + 10);
    const centralSize = tail.readUInt32LE(end + 12);
    const centralOffset = tail.readUInt32LE(end + 16);
    if (tail.readUInt16LE(end + 4) !== 0 || tail.readUInt16LE(end + 6) !== 0 ||
      tail.readUInt16LE(end + 8) !== count || count === 0 || count === 0xffff || count > maxEntries ||
      centralSize > maxCentralBytes || centralSize === 0xffffffff || centralOffset === 0xffffffff ||
      centralOffset + centralSize > size - tailLength + end) throw new Error("unsupported or malformed ZIP directory");
    const central = await readExactly(handle, centralSize, centralOffset);
    const entries = [];
    const names = new Set();
    let cursor = 0;
    let expandedTotal = 0;
    for (let index = 0; index < count; index += 1) {
      if (cursor + 46 > central.length || central.readUInt32LE(cursor) !== 0x02014b50) throw new Error("malformed ZIP directory entry");
      const flags = central.readUInt16LE(cursor + 8);
      const method = central.readUInt16LE(cursor + 10);
      const crc = central.readUInt32LE(cursor + 16);
      const compressedSize = central.readUInt32LE(cursor + 20);
      const expandedSize = central.readUInt32LE(cursor + 24);
      const nameLength = central.readUInt16LE(cursor + 28);
      const extraLength = central.readUInt16LE(cursor + 30);
      const commentLength = central.readUInt16LE(cursor + 32);
      const external = central.readUInt32LE(cursor + 38);
      const localOffset = central.readUInt32LE(cursor + 42);
      const next = cursor + 46 + nameLength + extraLength + commentLength;
      if (next > central.length || compressedSize === 0xffffffff || expandedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error("unsupported ZIP64 or malformed entry");
      const name = safeEntryName(central.subarray(cursor + 46, cursor + 46 + nameLength));
      const directory = name.endsWith("/");
      const canonicalName = (directory ? name.slice(0, -1) : name).toLocaleLowerCase("en-US");
      const fileType = (external >>> 16) & 0xf000;
      if (names.has(canonicalName)) throw new Error(`duplicate ZIP entry: ${name}`);
      names.add(canonicalName);
      if (flags & ~0x80e || central.readUInt16LE(cursor + 34) !== 0 || ![0, 8].includes(method) || ![0, 0x4000, 0x8000].includes(fileType) ||
        (fileType === 0x4000 && !directory) || (fileType === 0x8000 && directory)) throw new Error(`unsupported ZIP entry: ${name}`);
      if (expandedSize > maxEntryBytes || (expandedTotal += expandedSize) > maxExpandedBytes) throw new Error("ZIP expands beyond the supported limit");
      const local = await readExactly(handle, 30, localOffset);
      if (local.readUInt32LE(0) !== 0x04034b50 || local.readUInt16LE(6) !== flags || local.readUInt16LE(8) !== method) {
        throw new Error(`ZIP local header does not match: ${name}`);
      }
      if (!(flags & 8) && (local.readUInt32LE(14) !== crc || local.readUInt32LE(18) !== compressedSize || local.readUInt32LE(22) !== expandedSize)) {
        throw new Error(`ZIP local checksum or size does not match: ${name}`);
      }
      const localName = safeEntryName(await readExactly(handle, local.readUInt16LE(26), localOffset + 30));
      if (localName !== name) throw new Error(`ZIP local filename does not match: ${name}`);
      const dataStart = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      if (dataStart + compressedSize > centralOffset) throw new Error(`ZIP entry overlaps directory: ${name}`);
      entries.push({ name, directory, method, crc, compressedSize, expandedSize, localOffset, dataStart });
      cursor = next;
    }
    if (cursor !== central.length) throw new Error("ZIP directory contains trailing data");
    const ranges = entries.map((entry) => [entry.localOffset, entry.dataStart + entry.compressedSize]).sort((a, b) => a[0] - b[0]);
    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index][0] < ranges[index - 1][1]) throw new Error("ZIP entries overlap");
    }
    for (const entry of entries.filter((item) => !item.directory)) {
      if (entries.some((other) => other !== entry && other.name.toLocaleLowerCase("en-US").startsWith(`${entry.name.toLocaleLowerCase("en-US")}/`))) {
        throw new Error(`ZIP file conflicts with a child path: ${entry.name}`);
      }
    }
    const prefix = `${archiveRoot}/`;
    const files = entries.filter((entry) => !entry.directory);
    if (files.length === 0) throw new Error("ZIP has no package files");
    for (const entry of entries) {
      if (entry.name !== prefix && !entry.name.startsWith(prefix)) throw new Error(`ZIP entry is outside ${archiveRoot}/: ${entry.name}`);
    }
    for (const item of listedContents) {
      const listed = `${prefix}${item.path}`;
      if (!files.some((entry) => entry.name === listed || entry.name.startsWith(`${listed}/`))) {
        throw new Error(`listed content is missing from ZIP: ${item.path}`);
      }
    }
    for (const entry of files) {
      if (!listedContents.some((item) => entry.name === `${prefix}${item.path}` || entry.name.startsWith(`${prefix}${item.path}/`))) {
        throw new Error(`unlisted ZIP file: ${entry.name}`);
      }
    }
    for (const entry of entries) await verifyEntryData(path, entry);
    return { files: files.length, expandedBytes: expandedTotal };
  } finally { await handle.close(); }
}
