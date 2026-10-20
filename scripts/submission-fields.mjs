export function section(body, label, required = true) {
  const heading = `### ${label}`;
  const start = body.indexOf(heading);
  if (start < 0) {
    if (required) throw new Error(`Issue template is missing: ${label}`);
    return "";
  }
  const afterHeading = body.slice(start + heading.length).replace(/^\r?\n/, "");
  const nextHeading = afterHeading.search(/^### /mu);
  const value = (nextHeading < 0 ? afterHeading : afterHeading.slice(0, nextHeading))
    .replace(/<!--[\s\S]*?-->/gu, "")
    .trim();
  if (value === "_No response_" || !value) {
    if (required) throw new Error(`Issue template is missing: ${label}`);
    return "";
  }
  return value;
}

export function selectedPlatforms(value) {
  return ["Windows", "Linux", "macOS", "Web"].filter((platform) =>
    new RegExp(`- \\[x\\] ${platform}`, "iu").test(value),
  );
}

export function optionalFacts(value) {
  if (!value.trim()) return undefined;
  return value
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator < 1) throw new Error("Optional facts must use one Label: value pair per line");
      return { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
    });
}
