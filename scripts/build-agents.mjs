import { readFile } from "node:fs/promises";
import { generatedAgentsPath, loadAgentEntries, renderGeneratedAgents, writeGeneratedAgents } from "./agents-content.mjs";

const expected = renderGeneratedAgents(await loadAgentEntries());
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = await readFile(generatedAgentsPath, "utf8");
  } catch {
    // The comparison below reports the actionable remediation.
  }
  if (current !== expected) {
    throw new Error("Agent catalog output is stale. Run: pnpm agents:build");
  }
  process.stdout.write("Agent catalog content is valid and generated output is current.\n");
} else {
  await writeGeneratedAgents();
  process.stdout.write("Agent catalog content validated and generated output updated.\n");
}
