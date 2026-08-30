// One-shot PTY sizing through Herdr's terminal controller. Collie remains a mirror (ADR 0008): it
// does not keep a terminal session or render frames. The controller is acquired only long enough for
// Herdr to apply the requested grid, then released immediately; in headless mode the pane keeps that
// PTY size until another real Herdr client changes it.

export const MAX_TERMINAL_COLS = 1000;
export const MAX_TERMINAL_ROWS = 1000;
const CONTROL_TIMEOUT_MS = 5000;

export interface TerminalGrid {
  cols: number;
  rows: number;
}

interface SpawnedProcess {
  stdin: { write(data: string): number; end(): void };
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exited: Promise<number>;
  kill(): void;
}

export type TerminalControlSpawn = (
  argv: string[],
  opts: { env: Record<string, string | undefined> },
) => SpawnedProcess;

export function parseTerminalGrid(body: { cols?: unknown; rows?: unknown }): TerminalGrid | null {
  const { cols, rows } = body;
  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    (cols as number) < 1 ||
    (rows as number) < 1 ||
    (cols as number) > MAX_TERMINAL_COLS ||
    (rows as number) > MAX_TERMINAL_ROWS
  ) {
    return null;
  }
  return { cols: cols as number, rows: rows as number };
}

const realSpawn: TerminalControlSpawn = (argv, opts) =>
  Bun.spawn(argv, {
    env: opts.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  }) as unknown as SpawnedProcess;

export async function resizeTerminal(
  socketPath: string,
  paneId: string,
  grid: TerminalGrid,
  spawn: TerminalControlSpawn = realSpawn,
  herdrBin = process.env.COLLIE_HERDR_BIN?.trim() || "herdr",
): Promise<void> {
  // HERDR_SOCKET_PATH selects the exact session socket already resolved by SessionRegistry. Drop
  // HERDR_ENV so a bridge launched from inside Herdr is not rejected as a nested interactive app;
  // this command is a short-lived control client, not another Herdr TUI.
  const env: Record<string, string | undefined> = { ...process.env, HERDR_SOCKET_PATH: socketPath };
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

  // Sending release immediately is intentional: Herdr applies --cols/--rows while attaching, then
  // closes this controller. Drain both pipes concurrently so a diagnostic/frame can never block it.
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
