export const minimumNodeVersion = "24.11.0";

export function supportsNode(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return Boolean(match && Number(match[1]) === 24 && Number(match[2]) >= 11);
}

export function assertSupportedNode(version = process.versions.node) {
  if (!supportsNode(version))
    throw new Error(
      `Tool Atlas requires Node >=${minimumNodeVersion} <25; detected ${version}`,
    );
}
