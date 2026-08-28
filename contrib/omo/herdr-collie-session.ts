import { mkdir, rename, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";

const paneId = process.env.HERDR_PANE_ID;

function sessionPath(ctx: any): string | null {
  try {
    const value = ctx?.sessionManager?.getSessionFile?.();
    return typeof value === "string" && value.startsWith(sep) ? value : null;
  } catch {
    return null;
  }
}

async function writeClaim(ctx: any): Promise<void> {
  const path = sessionPath(ctx);
  if (!paneId || !path) return;
  const marker = `${sep}sessions${sep}`;
  const markerAt = path.indexOf(marker);
  if (markerAt < 0) return;

  const directory = join(path.slice(0, markerAt), "herdr-sessions");
  const target = join(directory, `${encodeURIComponent(paneId)}.json`);
  const temporary = `${target}.${process.pid}.tmp`;
  await mkdir(directory, { recursive: true });
  await writeFile(
    temporary,
    JSON.stringify({ paneId, pid: process.pid, sessionPath: path }),
    "utf8",
  );
  await rename(temporary, target);
}

export default function (pi: any): void {
  if (process.env.HERDR_ENV !== "1" || !paneId) return;
  pi.on("session_start", (_event: unknown, ctx: any) => {
    void writeClaim(ctx).catch((error: unknown) => {
      console.warn("[herdr-collie-session] claim write failed", error);
    });
  });
  pi.on("agent_start", (_event: unknown, ctx: any) => {
    void writeClaim(ctx).catch((error: unknown) => {
      console.warn("[herdr-collie-session] claim write failed", error);
    });
  });
}
