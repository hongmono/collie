import { describe, expect, test } from "bun:test";

import { mergeArtifactPolicy } from "./artifact.ts";

describe("artifact agent policy", () => {
  test("preserves operator instructions and installs only one replaceable block", () => {
    const once = mergeArtifactPolicy("# Mine\n\nKeep this.\n");
    const twice = mergeArtifactPolicy(once);
    expect(twice).toContain("Keep this.");
    expect(twice.match(/collie-artifacts:start/gu)).toHaveLength(1);
    expect(twice).toBe(once);
  });
});
