import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AgentSessionRef } from "./types.ts";

interface OmoSessionClaim {
  paneId: string;
  pid: number;
  sessionPath: string;
}

function parseClaim(value: unknown): OmoSessionClaim | null {
  if (typeof value !== "object" || value === null) return null;
  const claim = value as Record<string, unknown>;
  if (
    typeof claim.paneId !== "string" ||
    !Number.isSafeInteger(claim.pid) ||
    typeof claim.sessionPath !== "string" ||
    !claim.sessionPath.endsWith(".jsonl")
  ) {
    return null;
  }
  return {
    paneId: claim.paneId,
    pid: claim.pid as number,
    sessionPath: claim.sessionPath,
  };
}

/**
 * Resolve the exact session claim written by the OmO process currently occupying this pane.
 *
 * A stale claim cannot attach to a reused pane: its reporter pid must still be one of Herdr's
 * foreground processes. The journal adapter applies its normal realpath containment check before
 * reading the returned path.
 */
export async function resolveOmoClaim(
  sessionRoots: readonly string[],
  paneId: string,
  foregroundPids: ReadonlySet<number>,
): Promise<AgentSessionRef | null> {
  const claimName = `${encodeURIComponent(paneId)}.json`;
  for (const root of sessionRoots) {
    try {
      const raw = await readFile(join(dirname(root), "herdr-sessions", claimName), "utf8");
      const claim = parseClaim(JSON.parse(raw));
      if (
        claim !== null &&
        claim.paneId === paneId &&
        foregroundPids.has(claim.pid)
      ) {
        return { kind: "path", value: claim.sessionPath };
      }
    } catch {
      // Missing, partial, or malformed claims fail closed.
    }
  }
  return null;
}
