import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { createArtifact, listArtifacts } from "../bridge/artifacts.ts";
import type { JsonObject, JsonValue } from "../bridge/json.ts";
import { HerdrClient } from "../bridge/mux/herdr/client.ts";
import type { CliContext } from "./context.ts";
import { EXIT, type Io } from "./io.ts";

export interface ArtifactDeps {
  ctx: CliContext;
  io: Io;
  currentSpace?: () => Promise<string | null>;
}

const POLICY = `When you create a user-facing artifact such as an HTML preview, diagram, image, long report, table, dataset, dashboard, or downloadable file, publish it by running:\n\ncollie artifact publish <path> --title "<descriptive title>"\n\nDecide this yourself; do not wait for the user to ask. Do not publish source files, secrets, temporary files, dependency trees, or ordinary short textual answers. After publishing, include the artifact title in your final response.`;
const START = "<!-- collie-artifacts:start -->";
const END = "<!-- collie-artifacts:end -->";
const CODEX_HOOK_MARKER = "# collie-artifacts-hook v1";

export function mergeArtifactPolicy(existing: string): string {
  const block = `${START}\n## Collie artifacts\n\n${POLICY}\n${END}`;
  const from = existing.indexOf(START);
  const to = existing.indexOf(END);
  if (from >= 0 && to >= from) return `${existing.slice(0, from)}${block}${existing.slice(to + END.length)}`;
  const prefix = existing.trimEnd();
  return `${prefix}${prefix ? "\n\n" : ""}${block}\n`;
}

function object(value: JsonValue | undefined): JsonObject | null {
  return value instanceof Object && !Array.isArray(value) ? value : null;
}

export function mergeCodexArtifactHook(existing: JsonValue, binary: string): JsonObject {
  const root = object(existing);
  if (root === null) throw new Error("Codex hooks file is not a JSON object");
  const hooks = root.hooks === undefined ? {} : object(root.hooks);
  if (hooks === null) throw new Error("Codex hooks section is not a JSON object");
  if (hooks.Stop !== undefined && !Array.isArray(hooks.Stop)) {
    throw new Error("Codex Stop hooks are not a JSON array");
  }
  const stop = Array.isArray(hooks.Stop) ? hooks.Stop : [];
  const owned = (group: JsonValue): boolean => JSON.stringify(group).includes(CODEX_HOOK_MARKER);
  const ours = {
    hooks: [{
      type: "command",
      command: `${binary} artifact discover codex ${CODEX_HOOK_MARKER}`,
      timeout: 10,
      async: true,
    }],
  };
  const at = stop.findIndex(owned);
  const merged = at < 0 ? [...stop, ours] : stop.map((group, index) => index === at ? ours : group);
  return { ...root, hooks: { ...hooks, Stop: merged } };
}

function installCodexHook(deps: ArtifactDeps, binary: string): void {
  const path = join(deps.ctx.home, ".codex", "hooks.json");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`${path} is a symlink`);
  const previous = existsSync(path) ? readFileSync(path, "utf8") : "";
  // SAFETY: JSON.parse yields a JSON value, which mergeCodexArtifactHook traverses only through the
  // JsonValue-aware object/array gates above.
  const parsed = (previous.trim() === "" ? {} : JSON.parse(previous)) as JsonValue;
  const next = `${JSON.stringify(mergeCodexArtifactHook(parsed, binary), null, 2)}\n`;
  if (next === previous) return;
  if (previous !== "" && !existsSync(`${path}.collie-backup`)) {
    writeFileSync(`${path}.collie-backup`, previous, { mode: 0o600 });
  }
  const temp = `${path}.collie-tmp`;
  writeFileSync(temp, next, { mode: 0o600 });
  renameSync(temp, path);
  deps.io.out(`installed artifact hook: ${path}`);
}

function usage(deps: ArtifactDeps): number {
  deps.io.err("usage: collie artifact publish <file> [--title <title>]");
  deps.io.err("       collie artifact list");
  deps.io.err("       collie artifact setup");
  return EXIT.USAGE;
}

function setup(deps: ArtifactDeps): number {
  const targets = [join(deps.ctx.home, ".claude", "CLAUDE.md"), join(deps.ctx.home, ".codex", "AGENTS.md")];
  const binary = join(deps.ctx.root, "bin", "collie");
  for (const path of targets) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    writeFileSync(path, mergeArtifactPolicy(current).replaceAll("collie artifact", `${binary} artifact`), { mode: 0o600 });
    deps.io.out(`installed artifact policy: ${path}`);
  }
  installCodexHook(deps, binary);
  deps.io.out("Codex: open `/hooks` once to review and trust the installed hook.");
  deps.io.out("Claude: run `collie hooks install claude` to add artifact discovery to Stop.");
  return EXIT.OK;
}

export async function cmdArtifact(deps: ArtifactDeps, args: readonly string[]): Promise<number> {
  const [verb, ...rest] = args;
  if (verb === "setup" && rest.length === 0) return setup(deps);
  if (verb === "list" && rest.length === 0) {
    for (const item of listArtifacts(deps.ctx.stateDir)) deps.io.out(`${item.id}\t${item.status}\t${item.title}`);
    return EXIT.OK;
  }
  if (verb !== "publish" || rest.length === 0) return usage(deps);
  const source = rest[0]!;
  let title = "";
  if (rest.length > 1) {
    if (rest.length !== 3 || rest[1] !== "--title") return usage(deps);
    title = rest[2]!;
  }
  try {
    const currentSpace = deps.currentSpace ?? (async () => {
      try {
        return (await new HerdrClient(deps.ctx.socket).currentPane()).workspace_id;
      } catch {
        return null;
      }
    });
    const record = createArtifact(
      deps.ctx.stateDir,
      resolve(source),
      title,
      process.cwd(),
      await currentSpace(),
      deps.ctx.env.CODEX_SESSION_ID ?? null,
      deps.ctx.env.HERDR_PANE_ID ?? null,
    );
    deps.io.out(`artifact published: ${record.title}`);
    deps.io.out(`  ${record.id}`);
    return EXIT.OK;
  } catch (error) {
    deps.io.err(`error: ${error instanceof Error ? error.message : "could not publish artifact"}`);
    return EXIT.FAIL;
  }
}
