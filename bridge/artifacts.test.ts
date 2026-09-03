import { describe, expect, test } from "bun:test";

import { artifactForWire, artifactMime, artifactSpace, type ArtifactRecord } from "./artifacts.ts";

describe("artifacts", () => {
  test("classifies previews and safe unknown downloads", () => {
    expect(artifactMime("report.HTML")).toBe("text/html; charset=utf-8");
    expect(artifactMime("data.csv")).toBe("text/csv; charset=utf-8");
    expect(artifactMime("archive.bin")).toBe("application/octet-stream");
  });

  test("never exposes the agent's local working directory to the browser", () => {
    const record: ArtifactRecord = {
      id: "art_00000000-0000-0000-0000-000000000000",
      title: "Report",
      filename: "report.html",
      mime: "text/html; charset=utf-8",
      size: 10,
      createdAt: "2026-09-03T00:00:00.000Z",
      cwd: "/secret/customer/project",
      status: "hosted",
    };
    expect(artifactForWire(record)).not.toHaveProperty("cwd");
  });

  test("assigns a publish cwd to the most-specific containing Herdr space", () => {
    const spaces = [
      { workspaceId: "parent", repoRoot: "/work" },
      { workspaceId: "project", repoRoot: "/work/project" },
    ];
    expect(artifactSpace("/work/project/reports", spaces)).toBe("project");
    expect(artifactSpace("/work/project-two", spaces)).toBe("parent");
    expect(artifactSpace("/tmp", spaces)).toBeNull();
  });
});
