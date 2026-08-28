import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, posix, win32 } from "node:path";

export interface ClaimContext {
  sessionManager?: {
    getSessionFile?: () => unknown;
  };
}

type ClaimHandler = (event: unknown, ctx: ClaimContext) => Promise<void>;

export interface ClaimExtensionApi {
  on(event: "session_start" | "session_shutdown", handler: ClaimHandler): void;
}

function sessionPath(ctx: ClaimContext): string | null {
  try {
    const value = ctx?.sessionManager?.getSessionFile?.();
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
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

async function invalidateClaim(target: string): Promise<void> {
  const temporary = `${target}.${process.pid}.invalid.tmp`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(temporary, "{}", { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  await rm(target, { force: true });
}

export default function registerOmoClaim(
  pi: ClaimExtensionApi,
  paneId = process.env.HERDR_PANE_ID,
): void {
  if (process.env.HERDR_ENV !== "1" || !paneId) return;

  let activeClaim: string | null = null;
  const clearClaim = async () => {
    if (activeClaim === null) return;
    const target = activeClaim;
    activeClaim = null;
    await invalidateClaim(target);
  };
  const replaceClaim = async (ctx: ClaimContext) => {
    await clearClaim();
    const path = sessionPath(ctx);
    const target = path ? claimTargetForSession(path, paneId) : null;
    if (path === null || target === null) return;

    await invalidateClaim(target);
    const temporary = `${target}.${process.pid}.tmp`;
    try {
      await writeFile(
        temporary,
        JSON.stringify({ paneId, pid: process.pid, sessionPath: path }),
        { encoding: "utf8", mode: 0o600 },
      );
      await rename(temporary, target);
      activeClaim = target;
    } catch (error) {
      await rm(temporary, { force: true });
      await invalidateClaim(target);
      throw error;
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    try {
      await replaceClaim(ctx);
    } catch (error: unknown) {
      console.warn("[herdr-collie-session] claim write failed", error);
    }
  });

  pi.on("session_shutdown", async () => {
    try {
      await clearClaim();
    } catch (error: unknown) {
      console.warn("[herdr-collie-session] claim cleanup failed", error);
    }
  });
}
