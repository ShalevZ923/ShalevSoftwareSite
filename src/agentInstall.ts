import type { AgentInstall, AgentMcpInstall } from "./agents";
import type { ReleaseDownloadTarget } from "./downloads";

export type InstallScope = "project" | "global";
export type McpInstallScheme = "vscode" | "vscode-insiders";

export function mcpInstallPayload(mcp: AgentMcpInstall) {
  return { name: mcp.name, ...mcp.config };
}

export function mcpInstallHref(mcp: AgentMcpInstall, scheme: McpInstallScheme = "vscode") {
  return `${scheme}:mcp/install?${encodeURIComponent(JSON.stringify(mcpInstallPayload(mcp)))}`;
}

export function unpackPathForScope(install: AgentInstall, scope: InstallScope) {
  return scope === "global" ? install.unpack?.global : install.unpack?.project;
}

export function agentReleaseSha256(sha256?: string) {
  return sha256 && /^[a-fA-F0-9]{64}$/u.test(sha256) ? sha256.toLocaleLowerCase() : undefined;
}

export function isZipDownloadTarget(target?: ReleaseDownloadTarget) {
  if (!target) return false;
  const filename = target.filename;
  if (filename) return /\.zip$/iu.test(filename);
  try {
    return /\.zip$/iu.test(new URL(target.href).pathname);
  } catch {
    return /\.zip(?:$|[?#])/iu.test(target.href);
  }
}
