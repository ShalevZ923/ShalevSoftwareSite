import { describe, expect, it } from "vitest";
import {
  descriptionSha256,
  requireApprovedDescription,
  trustedGitLabApiBase,
} from "./gitlab-catalog-security.mjs";

describe("GitLab catalog approval", () => {
  it("binds approval to the exact issue description", () => {
    const description = "Reviewed catalog submission\nwith multiple lines.";
    const digest = descriptionSha256(description);

    expect(() => requireApprovedDescription(description, digest)).not.toThrow();
    expect(() => requireApprovedDescription(`${description}\nedited`, digest)).toThrow(
      "Issue description changed after review",
    );
    expect(() => requireApprovedDescription(description, "not-a-digest")).toThrow(
      "64-character SHA-256 digest",
    );
  });

  it("keeps the API token on the checked-out repository origin", () => {
    expect(
      trustedGitLabApiBase(
        "https://gitlab.example.com/root/api/v4/",
        "https://gitlab.example.com/root/tool-atlas.git",
      ),
    ).toBe("https://gitlab.example.com/root/api/v4");
    expect(() =>
      trustedGitLabApiBase(
        "https://attacker.example/api/v4",
        "https://gitlab.example.com/root/tool-atlas.git",
      ),
    ).toThrow("checked-out repository origin");
    expect(() =>
      trustedGitLabApiBase(
        "http://gitlab.example.com/api/v4",
        "https://gitlab.example.com/root/tool-atlas.git",
      ),
    ).toThrow("credential-free HTTPS URL");
  });
});
