import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { resolveOmoClaim } from "./omo-claim.ts";

describe("resolveOmoClaim", () => {
  test("returns the exact journal only when its reporter pid is still in the pane", async () => {
    const agentRoot = `${tmpdir()}/collie-omo-claim-${Math.floor(performance.now() * 1000)}`;
    const sessionsRoot = `${agentRoot}/sessions`;
    const claimDir = `${agentRoot}/herdr-sessions`;
    await mkdir(claimDir, { recursive: true });
    const sessionPath = `${sessionsRoot}/--repo--/session.jsonl`;
    await Bun.write(
      `${claimDir}/${encodeURIComponent("wA:p1")}.json`,
      JSON.stringify({ paneId: "wA:p1", pid: 42, sessionPath }),
    );

    expect(await resolveOmoClaim([sessionsRoot], "wA:p1", new Set([42]))).toEqual({
      kind: "path",
      value: sessionPath,
    });
    expect(await resolveOmoClaim([sessionsRoot], "wA:p1", new Set([99]))).toBeNull();

    await rm(agentRoot, { recursive: true, force: true });
  });

  test("rejects a malformed or mismatched pane claim", async () => {
    const agentRoot = `${tmpdir()}/collie-omo-claim-${Math.floor(performance.now() * 1000)}`;
    const sessionsRoot = `${agentRoot}/sessions`;
    const claimDir = `${agentRoot}/herdr-sessions`;
    await mkdir(claimDir, { recursive: true });
    await Bun.write(
      `${claimDir}/${encodeURIComponent("wA:p1")}.json`,
      JSON.stringify({ paneId: "wB:p1", pid: 42, sessionPath: "/tmp/wrong.jsonl" }),
    );

    expect(await resolveOmoClaim([sessionsRoot], "wA:p1", new Set([42]))).toBeNull();

    await rm(agentRoot, { recursive: true, force: true });
  });
});
