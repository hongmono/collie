import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, posix, win32 } from "node:path";

export interface ClaimContext {
  sessionManager?: {
    getSessionFile?: () => unknown;
  };
}

type ClaimHandler = (event: unknown, ctx: ClaimContext) => Promise<void>;

export interface ClaimExtensionApi {
  on(event: "session_start" | "session_shutdown" | "agent_start", handler: ClaimHandler): void;
}

export interface ClaimFileOps {
  mkdir(path: string): Promise<void>;
  write(path: string, contents: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

const defaultClaimFiles: ClaimFileOps = {
  mkdir: async (path) => {
    await mkdir(path, { recursive: true });
  },
  write: async (path, contents) =>
    writeFile(path, contents, { encoding: "utf8", mode: 0o600 }),
  rename,
  remove: async (path) => rm(path, { force: true }),
};

function sessionPath(ctx: ClaimContext): string | null {
  try {
    const value = ctx?.sessionManager?.getSessionFile?.();
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function previousSessionPath(event: unknown): string | null {
  if (typeof event !== "object" || event === null) return null;
  const value = (event as { previousSessionFile?: unknown }).previousSessionFile;
  return typeof value === "string" ? value : null;
}

export function claimTargetForSession(path: string, paneId: string): string | null {
  const paths = posix.isAbsolute(path) ? posix : win32.isAbsolute(path) ? win32 : null;
  if (paths === null) return null;

  let directory = paths.dirname(path);
  while (true) {
    if (paths.basename(directory) === "sessions") {
      return paths.join(
        paths.dirname(directory),
        "herdr-sessions",
        `${encodeURIComponent(paneId)}.json`,
      );
    }
    const parent = paths.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

async function invalidateClaim(target: string, files: ClaimFileOps): Promise<void> {
  const temporary = `${target}.${process.pid}.invalid.tmp`;
  try {
    await files.mkdir(dirname(target));
    await files.write(temporary, "{}");
    await files.rename(temporary, target);
  } catch (tombstoneError) {
    try {
      await files.remove(target);
    } catch (removeError) {
      throw new AggregateError(
        [tombstoneError, removeError],
        `could not invalidate claim: ${target}`,
      );
    }
    try {
      await files.remove(temporary);
    } catch {
      // The valid target is gone; a leftover unreferenced temporary file is harmless.
    }
    return;
  }
  try {
    await files.remove(target);
  } catch {
    // The atomically-renamed tombstone is malformed and therefore already fails closed.
  }
}

export default function registerOmoClaim(
  pi: ClaimExtensionApi,
  paneId = process.env.HERDR_PANE_ID,
  files: ClaimFileOps = defaultClaimFiles,
): void {
  if (process.env.HERDR_ENV !== "1" || !paneId) return;

  let activeClaim: string | null = null;
  let cleanupPending = false;
  const clearClaim = async () => {
    if (activeClaim === null) return;
    const target = activeClaim;
    cleanupPending = true;
    await invalidateClaim(target, files);
    activeClaim = null;
    cleanupPending = false;
  };
  const replaceClaim = async (event: unknown, ctx: ClaimContext) => {
    const previousPath = previousSessionPath(event);
    const previousClaim = previousPath
      ? claimTargetForSession(previousPath, paneId)
      : null;
    const claimsToClear = new Set(
      [activeClaim, previousClaim].filter((target): target is string => target !== null),
    );
    for (const target of claimsToClear) {
      activeClaim = target;
      await clearClaim();
    }

    cleanupPending = true;
    const path = sessionPath(ctx);
    const target = path ? claimTargetForSession(path, paneId) : null;
    if (path === null || target === null) {
      cleanupPending = false;
      return;
    }

    await invalidateClaim(target, files);
    const temporary = `${target}.${process.pid}.tmp`;
    try {
      await files.write(
        temporary,
        JSON.stringify({ paneId, pid: process.pid, sessionPath: path }),
      );
      await files.rename(temporary, target);
      activeClaim = target;
      cleanupPending = false;
    } catch (error) {
      try {
        await files.remove(temporary);
      } catch {
        // The target is invalidated below; an unreferenced temporary file is harmless.
      }
      await invalidateClaim(target, files);
      throw error;
    }
  };

  pi.on("session_start", async (event, ctx) => {
    try {
      await replaceClaim(event, ctx);
    } catch (error: unknown) {
      console.warn("[herdr-collie-session] claim write failed", error);
      throw error;
    }
  });

  pi.on("agent_start", async (event, ctx) => {
    if (!cleanupPending) return;
    try {
      await replaceClaim(event, ctx);
    } catch (error: unknown) {
      console.warn("[herdr-collie-session] claim retry failed", error);
      throw error;
    }
  });

  pi.on("session_shutdown", async () => {
    try {
      await clearClaim();
    } catch (error: unknown) {
      console.warn("[herdr-collie-session] claim cleanup failed", error);
      throw error;
    }
  });
}
