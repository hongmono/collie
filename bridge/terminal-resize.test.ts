import { describe, expect, test } from "bun:test";

import { parseTerminalGrid, resizeTerminal, type TerminalControlSpawn } from "./terminal-resize.ts";

function stream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe("parseTerminalGrid", () => {
  test("accepts a bounded integer grid", () => {
    expect(parseTerminalGrid({ cols: 48, rows: 32 })).toEqual({ cols: 48, rows: 32 });
  });

  test("rejects missing, fractional, zero, and excessive dimensions", () => {
    expect(parseTerminalGrid({ cols: 48 })).toBeNull();
    expect(parseTerminalGrid({ cols: 48.5, rows: 32 })).toBeNull();
    expect(parseTerminalGrid({ cols: 0, rows: 32 })).toBeNull();
    expect(parseTerminalGrid({ cols: 48, rows: 1001 })).toBeNull();
  });
});

describe("resizeTerminal", () => {
  test("targets the resolved socket, attaches without takeover, and releases immediately", async () => {
    let argv: string[] = [];
    let env: Record<string, string | undefined> = {};
    let input = "";
    const spawn: TerminalControlSpawn = (nextArgv, opts) => {
      argv = nextArgv;
      env = opts.env;
      return {
        stdin: {
          write(value) {
            input += value;
            return value.length;
          },
          end() {},
        },
        stdout: stream('{"reason":"detached","type":"terminal.closed"}\n'),
        stderr: stream(""),
        exited: Promise.resolve(0),
        kill() {},
      };
    };

    await resizeTerminal("/tmp/sessions/phone/herdr.sock", "w1:p2", { cols: 52, rows: 31 }, spawn);

    expect(argv).toEqual([
      "herdr", "terminal", "session", "control", "w1:p2",
      "--cols", "52", "--rows", "31",
    ]);
    expect(argv).not.toContain("--takeover");
    expect(env.HERDR_SOCKET_PATH).toBe("/tmp/sessions/phone/herdr.sock");
    expect(env.HERDR_ENV).toBeUndefined();
    expect(input).toBe('{"type":"terminal.release"}\n');
  });

  test("surfaces a non-zero Herdr exit", async () => {
    const spawn: TerminalControlSpawn = () => ({
      stdin: { write: (value) => value.length, end() {} },
      stdout: stream(""),
      stderr: stream("controller refused"),
      exited: Promise.resolve(1),
      kill() {},
    });
    await expect(
      resizeTerminal("/tmp/herdr.sock", "w1:p1", { cols: 40, rows: 20 }, spawn),
    ).rejects.toThrow("controller refused");
  });
});
