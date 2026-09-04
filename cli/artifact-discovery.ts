import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";

import { createArtifact, listArtifacts } from "../bridge/artifacts.ts";
import type { JsonObject, JsonValue } from "../bridge/json.ts";
import type { CliContext } from "./context.ts";
import { EXIT } from "./io.ts";

const FILE_EXTENSIONS = new Set([
  ".html", ".htm", ".md", ".txt", ".log", ".csv", ".json", ".pdf", ".png", ".jpg",
  ".jpeg", ".gif", ".webp", ".svg", ".zip",
]);
const BORING_NAMES = new Set(["README.md", "AGENTS.md", "CLAUDE.md", "CHANGELOG.md", "package.json"]);
const PATH_TOKEN = /(?:`([^`\n]+)`|\[[^\]]+\]\(([^)\n]+)\)|(?<![\w/])((?:\.\.?\/|\/)?[\w@%+.,=~/-]+\.[A-Za-z0-9]{2,5}))/gu;
const MERMAID = /```mermaid\s*\n[\s\S]*?```/giu;
const TABLE = /(?:^|\n)(\|[^\n]+\|\n\|(?:\s*:?-{3,}:?\s*\|)+\n(?:\|[^\n]+\|(?:\n|$))+)/gu;
const LONG_REPORT_CHARS = 4_000;

export interface ArtifactDiscoverDeps {
  readonly ctx: CliContext;
  readStdin(): Promise<string>;
}

function jsonObject(value: JsonValue): JsonObject | null {
  return value instanceof Object && !Array.isArray(value) ? value : null;
}

function stringField(row: JsonObject, key: string): string | null {
  const value = row[key];
  if (value === undefined || value === null || value instanceof Object) return null;
  const text = String(value);
  return text === "" ? null : text;
}

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function mentionedArtifactPaths(message: string, cwd: string): string[] {
  let root: string;
  try {
    root = realpathSync(cwd);
  } catch {
    return [];
  }
  const found = new Set<string>();
  for (const match of message.matchAll(PATH_TOKEN)) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? "").trim().replace(/[.,:;!?]+$/u, "");
    if (raw === "" || raw.includes("\n") || raw.startsWith("http://") || raw.startsWith("https://")) continue;
    const candidate = resolve(cwd, raw);
    try {
      const path = realpathSync(candidate);
      const info = statSync(path);
      if (!inside(root, path) || !info.isFile() || !FILE_EXTENSIONS.has(extname(path).toLowerCase())) continue;
      if (BORING_NAMES.has(basename(path)) || path.includes("/node_modules/") || path.includes("/.git/")) continue;
      found.add(path);
    } catch {
      // A path in prose that is not a file is not an artifact.
    }
  }
  return [...found];
}

export function inlineArtifacts(message: string): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  const diagrams = [...message.matchAll(MERMAID)].map((match) => match[0]);
  if (diagrams.length > 0) out.push({ title: "Mermaid diagrams", body: `${diagrams.join("\n\n")}\n` });
  const tables = [...message.matchAll(TABLE)].map((match) => match[1]!);
  if (tables.length > 0) out.push({ title: "Data tables", body: `${tables.join("\n\n")}\n` });
  if (message.length >= LONG_REPORT_CHARS) out.push({ title: "Agent report", body: `${message.trim()}\n` });
  return out;
}

function alreadyPublished(ctx: CliContext, hash: string, sessionId: string | null): boolean {
  return listArtifacts(ctx.stateDir).some(
    (record) => record.contentHash === hash && (record.sessionId ?? null) === sessionId,
  );
}

function publishFile(ctx: CliContext, path: string, cwd: string, spaceId: string | null, sessionId: string | null, paneId: string | null): void {
  const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (!alreadyPublished(ctx, hash, sessionId)) createArtifact(ctx.stateDir, path, basename(path), cwd, spaceId, sessionId, paneId);
}

function publishText(ctx: CliContext, item: { title: string; body: string }, cwd: string, spaceId: string | null, sessionId: string | null, paneId: string | null): void {
  const hash = createHash("sha256").update(item.body).digest("hex");
  if (alreadyPublished(ctx, hash, sessionId)) return;
  const staging = join(ctx.stateDir, "artifact-hook");
  mkdirSync(staging, { recursive: true, mode: 0o700 });
  const path = join(staging, `${hash}.md`);
  try {
    writeFileSync(path, item.body, { mode: 0o600 });
    createArtifact(ctx.stateDir, path, item.title, cwd, spaceId, sessionId, paneId);
  } finally {
    if (existsSync(path)) unlinkSync(path);
  }
}

/** Hook entrypoint: silent, non-blocking, and best-effort on every input and filesystem failure. */
export async function cmdArtifactDiscover(deps: ArtifactDiscoverDeps): Promise<number> {
  try {
    // SAFETY: JSON.parse yields a JSON value; every field crosses into the hook domain through the
    // object and scalar parsers immediately below.
    const payload = jsonObject(JSON.parse(await deps.readStdin()) as JsonValue);
    if (payload === null || stringField(payload, "hook_event_name") !== "Stop" || payload.agent_id != null) return EXIT.OK;
    const cwd = stringField(payload, "cwd");
    const message = stringField(payload, "last_assistant_message");
    if (cwd === null || message === null) return EXIT.OK;
    const sessionId = stringField(payload, "session_id");
    const spaceId = deps.ctx.env.HERDR_WORKSPACE_ID?.trim() || null;
    const paneId = deps.ctx.env.HERDR_PANE_ID?.trim() || null;
    for (const path of mentionedArtifactPaths(message, cwd)) {
      publishFile(deps.ctx, path, cwd, spaceId, sessionId, paneId);
    }
    for (const item of inlineArtifacts(message)) {
      publishText(deps.ctx, item, cwd, spaceId, sessionId, paneId);
    }
  } catch {
    // A hook must never block or add output to the agent turn.
  }
  return EXIT.OK;
}
