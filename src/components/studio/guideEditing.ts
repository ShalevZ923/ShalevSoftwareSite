import type { GuideResource } from "../../data";

export function nextGuideId(resources: Pick<GuideResource, "id">[]) {
  const ids = new Set(resources.map((resource) => resource.id));
  let suffix = 1;
  while (ids.has(`guide-${suffix}`)) suffix += 1;
  return `guide-${suffix}`;
}

export function parseGuideVersions(text: string) {
  return [...new Set(text.split(",").map((version) => version.trim()).filter(Boolean))];
}
