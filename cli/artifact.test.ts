import { describe, expect, test } from "bun:test";

import { mergeArtifactPolicy, mergeCodexArtifactHook } from "./artifact.ts";

describe("artifact agent policy", () => {
  test("preserves operator instructions and installs only one replaceable block", () => {
    const once = mergeArtifactPolicy("# Mine\n\nKeep this.\n");
    const twice = mergeArtifactPolicy(once);
    expect(twice).toContain("Keep this.");
    expect(twice.match(/collie-artifacts:start/gu)).toHaveLength(1);
    expect(twice).toBe(once);
  });
});

describe("Codex artifact hook", () => {
  test("preserves other hooks and replaces only its marked Stop entry", () => {
    const theirs = { hooks: [{ type: "command", command: "audit" }] };
    const once = mergeCodexArtifactHook({ hooks: { Stop: [theirs] }, theme: "dark" }, "/bin/collie");
    const twice = mergeCodexArtifactHook(once, "/new/collie");
    expect(twice.theme).toBe("dark");
    const text = JSON.stringify(twice.hooks);
    expect(text).toContain(JSON.stringify(theirs));
    expect(text).toContain("/new/collie artifact discover codex");
    expect(text.match(/collie-artifacts-hook/gu)).toHaveLength(1);
  });

  test("refuses malformed hook containers rather than replacing operator data", () => {
    expect(() => mergeCodexArtifactHook({ hooks: "off" }, "/bin/collie")).toThrow();
    expect(() => mergeCodexArtifactHook({ hooks: { Stop: "off" } }, "/bin/collie")).toThrow();
  });
});
