import { basename, join } from "node:path";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";

export const ARTIFACT_MAX_BYTES = 50 * 1024 * 1024;
const ID = /^art_[a-f0-9-]{36}$/u;

export interface ArtifactRecord {
  id: string;
  title: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
  cwd: string;
  status: "hosted";
}

export type ArtifactWire = Omit<ArtifactRecord, "cwd">;

export function artifactForWire(record: ArtifactRecord): ArtifactWire {
  const wire: ArtifactWire = {
    id: record.id,
    title: record.title,
    filename: record.filename,
    mime: record.mime,
    size: record.size,
    createdAt: record.createdAt,
    status: record.status,
  };
  return wire;
}

/** Assign an artifact to the most-specific Herdr space whose repository contains its publish cwd. */
export function artifactSpace(cwd: string, spaces: readonly { workspaceId: string; repoRoot: string }[]): string | null {
  const roots = spaces
    .filter((space) => cwd === space.repoRoot || cwd.startsWith(`${space.repoRoot}/`))
    .toSorted((a, b) => b.repoRoot.length - a.repoRoot.length);
  return roots[0]?.workspaceId ?? null;
}

const MIME = new Map<string, string>([
  ["html", "text/html; charset=utf-8"],
  ["htm", "text/html; charset=utf-8"],
  ["md", "text/markdown; charset=utf-8"],
  ["txt", "text/plain; charset=utf-8"],
  ["log", "text/plain; charset=utf-8"],
  ["csv", "text/csv; charset=utf-8"],
  ["json", "application/json; charset=utf-8"],
  ["pdf", "application/pdf"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["svg", "image/svg+xml"],
  ["zip", "application/zip"],
]);

export function artifactMime(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME.get(extension) ?? "application/octet-stream";
}

export const artifactsRoot = (stateDir: string): string => join(stateDir, "artifacts");
const recordPath = (stateDir: string, id: string): string => join(artifactsRoot(stateDir), id, "record.json");

export function createArtifact(stateDir: string, source: string, title: string, cwd: string): ArtifactRecord {
  const info = statSync(source);
  if (!info.isFile()) throw new Error("artifact source is not a regular file");
  if (info.size > ARTIFACT_MAX_BYTES) throw new Error("artifact is larger than 50 MB");
  const filename = basename(source);
  if (filename === "" || filename === "." || filename === "..") throw new Error("artifact has no filename");
  const id = `art_${crypto.randomUUID()}`;
  const dir = join(artifactsRoot(stateDir), id);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  copyFileSync(source, join(dir, filename));
  const record: ArtifactRecord = {
    id,
    title: title.trim() || filename,
    filename,
    mime: artifactMime(filename),
    size: info.size,
    createdAt: new Date().toISOString(),
    cwd,
    status: "hosted",
  };
  writeArtifactRecord(stateDir, record);
  return record;
}

export function writeArtifactRecord(stateDir: string, record: ArtifactRecord): void {
  const path = recordPath(stateDir, record.id);
  writeFileSync(`${path}.tmp`, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}

function parseRecord(text: string): ArtifactRecord | null {
  try {
    // SAFETY: JSON.parse returns a JSON value; every field used below is checked before the record
    // crosses this disk boundary into the artifact domain.
    const value = JSON.parse(text) as Partial<ArtifactRecord>;
    if (!ID.test(value.id ?? "") || typeof value.title !== "string" || typeof value.filename !== "string") return null;
    if (basename(value.filename) !== value.filename || typeof value.mime !== "string") return null;
    if (typeof value.size !== "number" || typeof value.createdAt !== "string" || typeof value.cwd !== "string") return null;
    if (value.status !== "hosted") return null;
    // SAFETY: the required record fields and closed status vocabulary were checked immediately
    // above; optional strings are never trusted for filesystem resolution.
    return value as ArtifactRecord;
  } catch {
    return null;
  }
}

export function listArtifacts(stateDir: string): ArtifactRecord[] {
  let ids: string[];
  try {
    ids = readdirSync(artifactsRoot(stateDir));
  } catch {
    return [];
  }
  const records: ArtifactRecord[] = [];
  for (const id of ids) {
    if (!ID.test(id)) continue;
    try {
      const record = parseRecord(readFileSync(recordPath(stateDir, id), "utf8"));
      if (record) records.push(record);
    } catch {
      // A half-written or removed artifact is absent from this read.
    }
  }
  return records.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function artifactFile(stateDir: string, id: string): { record: ArtifactRecord; path: string } | null {
  if (!ID.test(id)) return null;
  try {
    const record = parseRecord(readFileSync(recordPath(stateDir, id), "utf8"));
    if (!record) return null;
    const path = join(artifactsRoot(stateDir), id, record.filename);
    if (!statSync(path).isFile()) return null;
    return { record, path };
  } catch {
    return null;
  }
}
