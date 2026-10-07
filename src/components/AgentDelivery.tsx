import { useEffect, useRef, useState } from "react";
import type { AgentPackage } from "../agentTypes";
import { armCopyFeedbackTimer, type CopyLinkState } from "../catalogChrome";
import { agentDownloadTarget, canInstallMcpInVsCode, checkArtifactAvailability, type ArtifactAvailability } from "../agentDelivery";
import { mcpInstallHref, unpackPathForScope, type InstallScope } from "../agentInstall";

export function AgentDelivery({ agent, version, onVersionChange }: {
  agent: AgentPackage; version?: string; onVersionChange: (version: string) => void;
}) {
  const selected = agent.releases.find((item) => item.version === version) ??
    agent.releases.find((item) => item.version === agent.currentVersion);
  const target = agentDownloadTarget(agent, selected);
  const [availability, setAvailability] = useState<{ href: string; status: ArtifactAvailability; bytes?: number }>({ href: "", status: "checking" });
  const [scope, setScope] = useState<InstallScope>("project");
  const [checksumState, setChecksumState] = useState<CopyLinkState>("idle");
  const checksumTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    setAvailability({ href: target.href, status: "checking" });
    checkArtifactAvailability(target.href, controller.signal).then((result) => setAvailability({ href: target.href, ...result })).catch(() => {});
    return () => controller.abort();
  }, [target?.href]);
  useEffect(() => () => { if (checksumTimerRef.current !== undefined) window.clearTimeout(checksumTimerRef.current); }, []);
  const copyChecksum = async (digest: string) => {
    try { await navigator.clipboard.writeText(digest); setChecksumState("copied"); }
    catch { setChecksumState("unavailable"); }
    checksumTimerRef.current = armCopyFeedbackTimer(
      checksumTimerRef.current,
      (id) => window.clearTimeout(id),
      (callback, ms) => window.setTimeout(callback, ms),
      () => setChecksumState("idle"),
    );
  };
  const digest = selected?.sha256;
  const availabilityStatus = target?.href === availability.href ? availability.status : "checking";
  const unpackPath = agent.install?.unpack && unpackPathForScope(agent.install, scope);
  const canConfigureMcp = canInstallMcpInVsCode(agent);
  const formattedSize = availability.bytes ? availability.bytes < 1024 * 1024
    ? `${(availability.bytes / 1024).toFixed(1)} KB`
    : `${(availability.bytes / 1024 / 1024).toFixed(1)} MB` : undefined;

  return <section className="agent-delivery" aria-label="Download this resource">
    <h2 className="agent-section-title">Download</h2>
    {agent.releases.length > 1 && <label className="agent-release-select">Version
      <select value={selected?.version ?? ""} onChange={(event) => onVersionChange(event.target.value)}>
        {agent.releases.map((item) => <option key={item.version} value={item.version}>{item.version}{item.version === agent.currentVersion ? " · current" : ""}</option>)}
      </select>
    </label>}
    {selected && selected.version !== agent.currentVersion && <p className="agent-delivery-archive-note">Archived release. This listing describes the current version; check this release's reviewed ZIP paths and record below.</p>}
    {target ? <>
      <p className="agent-delivery-status" role="status">
        {availabilityStatus === "checking" && "Checking ZIP…"}
        {availabilityStatus === "available" && `ZIP ready · v${selected?.version}${formattedSize ? ` · ${formattedSize}` : ""}`}
        {availabilityStatus === "unavailable" && "Package is not hosted here yet."}
        {availabilityStatus === "unknown" && "Package availability could not be confirmed."}
      </p>
      {availabilityStatus === "available" && <a className="primary-button agent-download" href={target.href} download={target.filename}>{agent.downloadButtonLabel ?? (agent.status === "evaluation" ? "Download ZIP for testing" : "Download complete ZIP")}</a>}
      {agent.status === "evaluation" && <p>Evaluation archive · host support unverified.</p>}
      <details className="agent-zip-contents"><summary>Package details &amp; checksum</summary>
        {selected?.notes && <p>{selected.notes}</p>}
        <p>Reviewed {selected?.review?.date} · {selected?.review?.evidence}. Scripts are not run by this site.</p>
        {selected?.contents && <ul>{selected.contents.map((item) => <li key={item.path}><code>{item.path}</code><span>{item.kind}</span>{item.note && <small>{item.note}</small>}</li>)}</ul>}
      {digest && <div className="agent-checksum"><span>SHA-256 · compare after download</span><code>{digest}</code><button type="button" onClick={() => copyChecksum(digest)}>{checksumState === "copied" ? "Checksum copied" : checksumState === "unavailable" ? "Could not copy the checksum" : "Copy checksum"}</button>{checksumState === "unavailable" && <span role="status">Copy the checksum from the text above.</span>}</div>}
      </details>
      {availabilityStatus === "available" && unpackPath && <details className="agent-unpack-toggle"><summary>Where to place it</summary><div className="agent-unpack"><p>Place the extracted <code>{selected?.archiveRoot}/</code> folder at:</p><label><input type="radio" name={`scope-${agent.id}`} checked={scope === "project"} onChange={() => setScope("project")} /> Project</label><label><input type="radio" name={`scope-${agent.id}`} checked={scope === "global"} onChange={() => setScope("global")} /> User</label><code>{unpackPath}</code><small>Choose the location supported by your agent host.</small></div></details>}
      {availabilityStatus === "available" && !agent.install?.unpack && <p>This archive has no fixed install folder. Read the usage guide after you compare the checksum.</p>}
    </> : !canConfigureMcp && <p>{agent.status === "example" ? "Example listing — no approved package is available." : "No reviewed ZIP has been published for this version."}</p>}
    {canConfigureMcp && <div className="agent-mcp-install"><h4>Configure in VS Code</h4><p>Opens VS Code's add-server flow for the reviewed current configuration. Check the server details and choose workspace or user scope in VS Code.</p><a href={mcpInstallHref(agent.install!.mcp!)}>Open in VS Code</a></div>}
  </section>;
}
