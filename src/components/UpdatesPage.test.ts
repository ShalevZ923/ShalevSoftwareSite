import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { agents } from "../agents";
import { tools } from "../data";
import { UpdatesPage } from "./UpdatesPage";
describe("experimental update counts", () => {
  it("counts agent-only output and omits the contradictory empty state", () => {
    const html = renderToStaticMarkup(
      createElement(UpdatesPage, {
        tools: [],
        agents: [agents[0]],
        onCatalog() {},
        onAgent() {},
        onDocs() {},
      }),
    );
    expect(html).toContain("1 change");
    expect(html).toContain("1 experimental");
    expect(html).toContain(agents[0].name);
    expect(html).not.toContain("No matching updates");
    expect(html).toContain("Other includes experimental");
  });
  it("shows a real empty state when neither catalog has results", () => {
    const html = renderToStaticMarkup(
      createElement(UpdatesPage, {
        tools: [],
        agents: [],
        onCatalog() {},
        onAgent() {},
        onDocs() {},
      }),
    );
    expect(html).toContain("0 changes");
    expect(html).toContain("No matching updates");
  });
  it("counts software and experimental entries together", () => {
    const html = renderToStaticMarkup(
      createElement(UpdatesPage, {
        tools: [tools[0]],
        agents: [agents[0]],
        onCatalog() {},
        onAgent() {},
        onDocs() {},
      }),
    );
    expect(html).toContain("2 changes");
    expect(html).toContain("1 experimental");
    expect(html).toContain(tools[0].name);
    expect(html).toContain(agents[0].name);
    expect(html).not.toContain("No matching updates");
  });
});
