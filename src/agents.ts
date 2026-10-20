import { agents as generatedAgents } from "./generated/agents";
import type { AgentPackage } from "./agentTypes";
export type * from "./agentTypes";

export const agents: AgentPackage[] = generatedAgents;
const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
export function getAgentById(id: string) { return agentsById.get(id); }
