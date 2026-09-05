import type { Tool } from "../../data";

export type ToolEntryPayload = {
  id: string;
  metadata: Tool & { order: number };
  guide: string;
};
