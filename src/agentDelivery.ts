import type { AgentPackage, AgentRelease } from "./agentTypes";
import { agentReleaseSha256, isZipDownloadTarget } from "./agentInstall";
import { getReleaseDownloadTarget, type ReleaseDownloadTarget } from "./downloads";

export function agentDownloadTarget(agent: AgentPackage, release?: AgentRelease): ReleaseDownloadTarget | undefined {
  if (!["supported", "evaluation"].includes(agent.status) || !agent.source?.revision || !agent.license || agent.riskLevel === "Unknown" ||
    !release?.artifact || !release.review?.date || !release.review.evidence || !release.archiveRoot || !release.contents?.length || !agentReleaseSha256(release.sha256)) return undefined;
  if (agent.review.status !== "reviewed" || !agent.review.date || !agent.review.evidence || agent.review.version !== agent.currentVersion) return undefined;
  const target = getReleaseDownloadTarget({ version: release.version, artifact: release.artifact });
  return target && !target.external && isZipDownloadTarget(target) ? target : undefined;
}

export function canInstallMcpInVsCode(agent: AgentPackage) {
  return agent.packageType === "MCP Server" && agent.status === "supported" && agent.review.status === "reviewed" &&
    agent.review.version === agent.currentVersion && !!agent.install?.mcp &&
    agent.compatibility.some((item) => item.target === "vscode" && item.status === "verified" && item.version === agent.currentVersion);
}

export type ArtifactAvailability = "checking" | "available" | "unavailable" | "unknown";

export async function checkArtifactAvailability(href: string, signal?: AbortSignal): Promise<{ status: ArtifactAvailability; bytes?: number }> {
  try {
    const response = await fetch(href, { method: "HEAD", signal, cache: "no-store" });
    if (!response.ok) return { status: response.status === 404 ? "unavailable" : "unknown" };
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const disposition = response.headers.get("content-disposition")?.toLowerCase() ?? "";
    if (!disposition.includes("attachment") && !contentType.includes("application/zip") && !contentType.includes("application/octet-stream")) {
      return { status: "unavailable" };
    }
    const length = Number(response.headers.get("content-length"));
    return { status: "available", ...(Number.isSafeInteger(length) && length > 0 ? { bytes: length } : {}) };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "unknown" };
  }
}
