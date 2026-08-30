// Session-scoped opt-in for fitting panes as this browser tab opens them. This is deliberately
// sessionStorage rather than a display preference: closing the tab/PWA session ends mobile mode,
// and a desktop visit must never inherit it days later.

const MODE_PREFIX = "collie:terminal-fit-mode:v1:";
const FITTED_PREFIX = "collie:terminal-fit-panes:v1:";
const memoryMode = new Map<string, boolean>();
const memoryFitted = new Map<string, Set<string>>();

function scope(session?: string): string {
  return encodeURIComponent(session?.trim() || "default");
}

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Private/locked-down WebViews can deny storage. The module fallback still keeps the mode for
    // this mounted app process, which is the closest safe degradation to tab-session persistence.
  }
}

function fittedSet(session?: string): Set<string> {
  const s = scope(session);
  const cached = memoryFitted.get(s);
  if (cached) return cached;
  let values: string[] = [];
  try {
    const parsed = JSON.parse(readStorage(`${FITTED_PREFIX}${s}`) ?? "[]") as unknown;
    if (Array.isArray(parsed)) values = parsed.filter((value): value is string => typeof value === "string");
  } catch {
    // Corrupt tab-local state means no pane has been fitted; never guess that a write happened.
  }
  const set = new Set(values);
  memoryFitted.set(s, set);
  return set;
}

export function terminalFitModeEnabled(session?: string): boolean {
  const s = scope(session);
  return memoryMode.get(s) ?? readStorage(`${MODE_PREFIX}${s}`) === "1";
}

export function setTerminalFitMode(session: string | undefined, enabled: boolean): void {
  const s = scope(session);
  memoryMode.set(s, enabled);
  writeStorage(`${MODE_PREFIX}${s}`, enabled ? "1" : null);
  if (!enabled) {
    memoryFitted.delete(s);
    writeStorage(`${FITTED_PREFIX}${s}`, null);
  }
}

export function terminalPaneWasFitted(session: string | undefined, paneId: string): boolean {
  return fittedSet(session).has(paneId);
}

export function markTerminalPaneFitted(session: string | undefined, paneId: string): void {
  const s = scope(session);
  const panes = fittedSet(session);
  panes.add(paneId);
  writeStorage(`${FITTED_PREFIX}${s}`, JSON.stringify([...panes]));
}

/** Test-only reset for the in-memory fallback/cache; sessionStorage is cleared by global setup. */
export function __resetTerminalFitMode(): void {
  memoryMode.clear();
  memoryFitted.clear();
}
