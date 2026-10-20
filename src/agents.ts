import {
  agentDocs as generatedAgentDocs,
  agents as generatedAgents,
} from "./generated/agents";
import type { CatalogFact, ToolImage, ToolNotice } from "./data";

export type AgentPackageType = "Skill" | "Agent Pack" | "Role Pack" | "MCP Server";
export type RiskLevel = "Low" | "Medium" | "High";
export type AgentContentKind = "skill" | "script" | "prompt" | "config" | "doc";

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
  unpack: AgentUnpack;
  mcp?: AgentMcpInstall;
};

export type AgentRelease = {
  version: string;
  artifact: string;
  sha256: string;
};

export type AgentMaintainer = {
  name: string;
  team: string;
  initials: string;
  email: string;
};

export type AgentPackage = {
  id: string;
  name: string;
  publisher: string;
  packageType: AgentPackageType;
  description: string;
  riskLevel: RiskLevel;
  permissions: string[];
  risks?: string[];
  contents: AgentContent[];
  maintainer: AgentMaintainer;
  releases: AgentRelease[];
  updated: string;
  icon: string;
  tags: string[];
  install: AgentInstall;
  image?: ToolImage;
  facts?: CatalogFact[];
  notice?: ToolNotice;
};

export const agents: AgentPackage[] = generatedAgents as AgentPackage[];
export const agentDocs: Record<string, string> = generatedAgentDocs;

const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

export function getAgentById(id: string) {
  return agentsById.get(id);
}
