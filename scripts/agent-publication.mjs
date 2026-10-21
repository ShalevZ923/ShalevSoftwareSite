const sha256Pattern = /^[a-fA-F0-9]{64}$/u;

export function isDownloadableAgentRelease(metadata, release) {
  if (metadata?.catalogTier !== "experimental") return false;
  if (!["supported", "evaluation"].includes(metadata.status)) return false;
  if (!metadata.source?.revision || !metadata.license || metadata.riskLevel === "Unknown")
    return false;
  if (
    metadata.review?.status !== "reviewed" ||
    !metadata.review.date ||
    !metadata.review.evidence ||
    metadata.review.version !== metadata.currentVersion
  )
    return false;
  if (
    !release?.artifact ||
    !release.review?.date ||
    !release.review.evidence ||
    !release.archiveRoot ||
    !release.contents?.length
  )
    return false;
  return sha256Pattern.test(release.sha256 ?? "");
}

export function downloadableAgentArtifacts(entries) {
  const allowed = new Set();
  for (const { metadata } of entries) {
    for (const release of metadata.releases ?? []) {
      if (isDownloadableAgentRelease(metadata, release)) allowed.add(release.artifact);
    }
  }
  return allowed;
}
