// One-shot PTY sizing through Herdr's terminal controller. Collie remains a mirror (ADR 0008): it
// does not keep a terminal session or render frames. The controller is acquired only long enough for
// Herdr to apply the requested grid, then released immediately.

import { accessSync, constants } from "node:fs";
import { join } from "node:path";
import type { JsonObject } from "./json.ts";

export const MAX_TERMINAL_COLS = 1000;
export const MAX_TERMINAL_ROWS = 1000;
const CONTROL_TIMEOUT_MS = 5000;

export interface TerminalGrid {
  cols: number;
  rows: number;
}

export interface TerminalResizeEnvironment {
  COLLIE_HERDR_BIN?: string;
  HOME?: string;
  PATH?: string;
}


interface SpawnedProcess {
  stdin: { write(data: string): number | Promise<number>; end(): void };
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exited: Promise<number>;
  kill(): void;
}

export type TerminalControlSpawn = (
  argv: string[],
  opts: { env: NodeJS.ProcessEnv },
) => SpawnedProcess;

type ExecutableProbe = (path: string) => boolean;

const isExecutable: ExecutableProbe = (path) => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

function terminalResizeEnvironment(): TerminalResizeEnvironment {
  return {
    COLLIE_HERDR_BIN: process.env.COLLIE_HERDR_BIN,
    HOME: process.env.HOME,
    PATH: process.env.PATH,
  };
}

/** Resolve Herdr even under systemd/launchd's minimal PATH. */
export function resolveHerdrBin(
  env: TerminalResizeEnvironment = terminalResizeEnvironment(),
  executable: ExecutableProbe = isExecutable,
): string {
  const candidates: string[] = [];
  const configured = env.COLLIE_HERDR_BIN?.trim();
  if (configured) candidates.push(configured);
  for (const dir of (env.PATH ?? "").split(":")) {
    if (dir) candidates.push(join(dir, "herdr"));
  }
  const home = env.HOME?.trim();
  if (home) {
    candidates.push(join(home, ".local", "bin", "herdr"));
    candidates.push(join(home, ".cargo", "bin", "herdr"));
  }
  candidates.push("/usr/local/bin/herdr", "/opt/homebrew/bin/herdr", "/usr/bin/herdr");
  return candidates.find(executable) ?? "herdr";
}

export function parseTerminalGrid(body: JsonObject): TerminalGrid | null {
  const { cols, rows } = body;
  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    Number(cols) < 1 ||
    Number(rows) < 1 ||
    Number(cols) > MAX_TERMINAL_COLS ||
    Number(rows) > MAX_TERMINAL_ROWS
  ) {
    return null;
  }
  return { cols: Number(cols), rows: Number(rows) };
}

const realSpawn: TerminalControlSpawn = (argv, opts) =>
  Bun.spawn(argv, {
    env: opts.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

export async function resizeTerminal(
  socketPath: string,
  paneId: string,
  grid: TerminalGrid,
  spawn: TerminalControlSpawn = realSpawn,
  herdrBin = resolveHerdrBin(),
): Promise<void> {
  // Select the exact session socket already resolved by SessionRegistry. Drop HERDR_ENV because this
  // is a short-lived control client, not a nested interactive Herdr app.
  const env: NodeJS.ProcessEnv = { ...process.env, HERDR_SOCKET_PATH: socketPath };
  delete env.HERDR_ENV;
  const proc = spawn(
    [
      herdrBin,
      "terminal",
      "session",
      "control",
      paneId,
      "--cols",
      String(grid.cols),
      "--rows",
      String(grid.rows),
    ],
    { env },
  );

  // Herdr applies --cols/--rows while attaching. Release immediately and drain both pipes so a
  // diagnostic or frame can never block the short-lived process.
  proc.stdin.write('{"type":"terminal.release"}\n');
  proc.stdin.end();
  const stdout = new Response(proc.stdout).text();
  const stderr = new Response(proc.stderr).text();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`herdr terminal control timed out after ${CONTROL_TIMEOUT_MS}ms`));
    }, CONTROL_TIMEOUT_MS);
  });

  try {
    const code = await Promise.race([proc.exited, timedOut]);
    const [out, err] = await Promise.all([stdout, stderr]);
    if (code !== 0) {
      const detail = err.trim() || out.trim() || `exit ${code}`;
      throw new Error(`herdr terminal control failed: ${detail}`);
    }
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
