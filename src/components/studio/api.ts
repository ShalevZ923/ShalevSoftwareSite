import { decodeTool } from "../../contracts";
export class StudioApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly field?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
export async function studioResponse<T>(
  response: Response,
  decode: (value: unknown) => T,
): Promise<T> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new StudioApiError("The server returned an invalid response.", "INVALID_RESPONSE");
  }
  if (!response.ok) {
    const error = value as { error?: unknown; code?: string; field?: string };
    throw new StudioApiError(
      typeof error?.error === "string" ? error.error : `Request failed (${response.status})`,
      error?.code,
      error?.field,
      response.status,
    );
  }
  return decode(value);
}
export function decodeToolEntries(value: unknown) {
  if (!Array.isArray(value)) throw new StudioApiError("Invalid tool list", "INVALID_RESPONSE");
  return value.map(decodeToolEntry);
}
export function decodeToolEntry(value: unknown): import("./types").ToolEntryPayload {
  if (!value || typeof value !== "object")
    throw new StudioApiError("Invalid tool record", "INVALID_RESPONSE");
  const record = value as import("./types").ToolEntryPayload;
  if (
    typeof record.id !== "string" ||
    typeof record.revision !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.revision) ||
    typeof record.guide !== "string" ||
    !record.metadata ||
    record.id !== record.metadata.id ||
    typeof record.metadata.name !== "string" ||
    !Array.isArray(record.metadata.releases) ||
    !record.metadata.releases.length ||
    !Array.isArray(record.metadata.platforms) ||
    !record.metadata.support ||
    typeof record.metadata.support.email !== "string"
  )
    throw new StudioApiError("Invalid tool record", "INVALID_RESPONSE");
  decodeTool(record.metadata);
  if (!Number.isSafeInteger(record.metadata.order) || record.metadata.order < 1)
    throw new StudioApiError("Invalid order", "INVALID_RESPONSE");
  return record;
}
