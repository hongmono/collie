import { describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import registerOmoClaim, {
  claimTargetForSession,
  type ClaimContext,
  type ClaimExtensionApi,
} from "../../contrib/omo/herdr-collie-session.ts";

describe("claimTargetForSession", () => {
  test("uses the final sessions directory and supports Windows drive paths", () => {
    expect(
      claimTargetForSession(
        "/tmp/sessions/team/.omo/agent/sessions/--repo--/session.jsonl",
        "wA:p1",
      ),
    ).toBe("/tmp/sessions/team/.omo/agent/herdr-sessions/wA%3Ap1.json");
    expect(
      claimTargetForSession(
        "C:\\Users\\me\\.omo\\agent\\sessions\\--repo--\\session.jsonl",
        "wA:p1",
      ),
    ).toBe("C:\\Users\\me\\.omo\\agent\\herdr-sessions\\wA%3Ap1.json");
  });

  test("rejects relative paths and files outside a sessions tree", () => {
    expect(claimTargetForSession("sessions/repo/session.jsonl", "wA:p1")).toBeNull();
    expect(claimTargetForSession("/tmp/session.jsonl", "wA:p1")).toBeNull();
  });
});

describe("OmO claim extension lifecycle", () => {
  test("awaits replacement cleanup and leaves no stale claim for an ephemeral session", async () => {
    const agentRoot = join(
      tmpdir(),
      `collie-omo-extension-${Math.floor(performance.now() * 1000)}`,
    );
    const sessionFile = join(agentRoot, "sessions", "--repo--", "session.jsonl");
    const claimFile = join(agentRoot, "herdr-sessions", `${encodeURIComponent("wA:p1")}.json`);
    await mkdir(join(agentRoot, "sessions", "--repo--"), { recursive: true });

    const handlers = new Map<string, (event: unknown, ctx: ClaimContext) => Promise<void>>();
    const api: ClaimExtensionApi = {
      on(event, handler) {
        handlers.set(event, handler);
      },
    };
    const previousHerdrEnv = process.env.HERDR_ENV;
    process.env.HERDR_ENV = "1";
    try {
      registerOmoClaim(api, "wA:p1");

      await handlers.get("session_start")?.({}, context(sessionFile));
      expect(JSON.parse(await readFile(claimFile, "utf8")).sessionPath).toBe(sessionFile);

      await handlers.get("session_start")?.({}, context(null));
      await expect(readFile(claimFile, "utf8")).rejects.toThrow();

      await handlers.get("session_start")?.({}, context(sessionFile));
      await handlers.get("session_shutdown")?.({}, context(sessionFile));
      await expect(readFile(claimFile, "utf8")).rejects.toThrow();
    } finally {
      await rm(agentRoot, { recursive: true, force: true });
      if (previousHerdrEnv === undefined) delete process.env.HERDR_ENV;
      else process.env.HERDR_ENV = previousHerdrEnv;
    }
  });
});

function context(sessionFile: string | null) {
  return {
    sessionManager: {
      getSessionFile: () => sessionFile,
    },
  };
}
