import type { CatalogFact, ToolImage, ToolNotice } from "./data";

export type AgentPackageType = "Skill" | "Agent Pack" | "Role Pack" | "MCP Server";
export type RiskLevel = "Low" | "Medium" | "High" | "Unknown";
export type AgentContentKind = "skill" | "script" | "prompt" | "config" | "doc" | "asset";

export type AgentContent = {
  path: string;
  kind: AgentContentKind;
  note?: string;
};

export type AgentMcpInstall = {
  name: string;
  config: Record<string, unknown>;
};

export type AgentUnpack = {
  project: string;
  global: string;
};

export type AgentInstall = {
  unpack?: AgentUnpack;
  mcp?: AgentMcpInstall;
};

export type AgentRelease = {
  version: string;
  releasedAt: string;
  notes?: string;
  artifact?: string;
  sha256?: string;
  archiveRoot?: string;
  contents?: AgentContent[];
  review?: { date: string; evidence: string };
};

export type AgentMaintainer = {
  name: string;
  team: string;
  initials: string;
  email: string;
};

export type SupportStatus = "supported" | "evaluation" | "deprecated" | "example";
export type AgentCompatibility = {
  target: string;
  status: "verified" | "unverified";
  notes: string;
  version?: string;
  verifiedOn?: string;
  evidence?: string;
};
export type AgentMcp = {
  transport: "stdio" | "streamable-http" | "sse" | "custom" | "unknown";
  hosting: "local" | "remote" | "unknown";
  authentication: "none" | "oauth" | "token" | "unknown";
  tools: { name: string; description: string; effect: "read" | "write" | "execute" | "unknown" }[];
  resources: string[];
  prompts: string[];
};

export type AgentPackage = {
  schemaVersion: 1;
  guidePath: string;
  id: string;
  name: string;
  publisher: string;
  packageType: AgentPackageType;
  description: string;
  highlights: string[];
  downloadButtonLabel?: string;
  riskLevel: RiskLevel;
  permissions: string[];
  risks?: string[];
  contents: AgentContent[];
  maintainer: AgentMaintainer;
  releases: AgentRelease[];
  currentVersion?: string;
  updatedAt: string;
  status: SupportStatus;
  review: { status: "pending" | "reviewed"; date?: string; version?: string; evidence?: string };
  capabilities: string[];
  compatibility: AgentCompatibility[];
  requirements: string[];
  source?: { url: string; revision?: string };
  license?: string;
  mcp?: AgentMcp;
  icon: string;
  tags: string[];
  install?: AgentInstall;
  image?: ToolImage;
  facts?: CatalogFact[];
  notice?: ToolNotice;
};
