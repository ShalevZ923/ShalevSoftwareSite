import type { GuideResource, ToolRelease } from "./data";

const artifactPointerPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const guideFilePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:pdf|pptx)$/;

export function getTrustedHttpsUrl(href?: string) {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export type ReleaseDownloadTarget = {
  href: string;
  external: boolean;
  filename?: string;
};

export function getGuideResourceTarget(resource: GuideResource): ReleaseDownloadTarget | undefined {
  if (resource.file !== undefined) {
    if (!guideFilePattern.test(resource.file)) return undefined;
    return { href: `/guides/${resource.file}`, external: false, filename: resource.file.split("/").at(-1) };
  }
  const href = getTrustedHttpsUrl(resource.url);
  return href ? { href, external: true } : undefined;
}

/** Resolves validated release metadata without accepting arbitrary local paths. */
export function getReleaseDownloadTarget(
  release: ToolRelease,
): ReleaseDownloadTarget | undefined {
  if (release.artifact !== undefined) {
    if (!artifactPointerPattern.test(release.artifact)) return undefined;
    const filename = release.artifact.split("/").at(-1);
    return {
      href: `/downloads/${release.artifact}`,
      external: false,
      filename,
    };
  }

  const href = getTrustedHttpsUrl(release.download);
  return href ? { href, external: true } : undefined;
}
