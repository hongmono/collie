import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { inlineArtifacts, mentionedArtifactPaths } from "./artifact-discovery.ts";

describe("artifact discovery", () => {
  test("finds only user-facing files inside the working directory", () => {
    const cwd = mkdtempSync(join(tmpdir(), "collie-artifacts-"));
    try {
      mkdirSync(join(cwd, "out"), { recursive: true });
      writeFileSync(join(cwd, "out", "report.html"), "<h1>Report</h1>");
      writeFileSync(join(cwd, "source.ts"), "export {};");
      writeFileSync(join(cwd, "README.md"), "docs");
      expect(mentionedArtifactPaths("See `out/report.html`, `source.ts`, and `README.md`.", cwd)).toEqual([
        join(cwd, "out", "report.html"),
      ]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("extracts Mermaid and Markdown tables", () => {
    const message = "```mermaid\ngraph LR\nA-->B\n```\n\n| Name | Value |\n| --- | ---: |\n| A | 1 |\n";
    expect(inlineArtifacts(message).map((item) => item.title)).toEqual(["Mermaid diagrams", "Data tables"]);
  });

  test("turns a genuinely long answer into a report", () => {
    expect(inlineArtifacts("x".repeat(4_000)).map((item) => item.title)).toEqual(["Agent report"]);
  });
});
