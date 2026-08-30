import { useCallback, useState } from "react";

// Terminal mirror display preferences, persisted in localStorage.
// Safe to call in SSR contexts (localStorage guarded throughout).

export interface DisplayPrefs {
  /** Whether the mirror wraps long lines (default: true). The mirror is mostly agent prose, and a
   *  phone shows ~45-50 columns against panes herdr spawns at desktop width (190 in one reporter's
   *  session), so panning was the common case, not the exception. Column-faithful no-wrap for TUI
   *  tables stays one tap away in View. */
  wrap: boolean;
  /** Font size in px for the mirror pre (default: 12, range: 9–16). */
  fontSize: number;
  /** Horizontal padding around the terminal mirror in px (default: 4, range: 0–16). */
  horizontalPadding: number;
  /**
   * Raw-terminal escape hatch (default: false). When on, the mirror renders the PLAIN terminal —
   * every Claude grammar (chrome stripping, native prompt-select buttons, the status strip) is
   * bypassed, so a misdetected/mis-rendered dialog can always be driven manually with the keys pad.
   * The universal fallback, made user-controllable.
   */
  rawTerminal: boolean;
  /**
   * Whether a tap on the terminal mirror focuses the composer (default: true).
   *
   * On, it is the fastest path from reading to replying — the whole mirror is one big "start typing"
   * target. Off, the mirror is a document: taps land on the text, so you can put a caret in it, and
   * the keyboard only appears when you tap the composer itself. Reported from the outside as the
   * mirror "absorbing the click", by someone expecting to interact with a line rather than reply to
   * it — which Collie cannot offer (herdr's `pane.read` strips the OSC 8 hyperlinks a terminal like
   * Termux makes tappable, so the link target never reaches us). Getting out of the way is the part
   * that IS ours to give.
   */
  tapToFocus: boolean;
}

// Not bumped when independently-defaulted fields are added: an older v4 payload keeps every choice
// it has and receives the new field's default instead of silently resetting all display preferences.
const STORAGE_KEY = "collie:display-prefs:v4";
export const FONT_MIN = 9;
export const FONT_MAX = 16;
export const HORIZONTAL_PADDING_MIN = 0;
export const HORIZONTAL_PADDING_MAX = 16;
export const HORIZONTAL_PADDING_STEP = 2;
const DEFAULTS: DisplayPrefs = {
  wrap: true,
  fontSize: 12,
  horizontalPadding: 4,
  rawTerminal: false,
  tapToFocus: true,
};

function clampFont(n: number): number {
  return Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(n)));
}

function clampHorizontalPadding(n: number): number {
  return Math.max(HORIZONTAL_PADDING_MIN, Math.min(HORIZONTAL_PADDING_MAX, Math.round(n)));
}

function loadPrefs(): DisplayPrefs {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
    const p = parsed as Record<string, unknown>;
    return {
      wrap: typeof p.wrap === "boolean" ? p.wrap : DEFAULTS.wrap,
      fontSize: typeof p.fontSize === "number" ? clampFont(p.fontSize) : DEFAULTS.fontSize,
      horizontalPadding:
        typeof p.horizontalPadding === "number"
          ? clampHorizontalPadding(p.horizontalPadding)
          : DEFAULTS.horizontalPadding,
      rawTerminal: typeof p.rawTerminal === "boolean" ? p.rawTerminal : DEFAULTS.rawTerminal,
      tapToFocus: typeof p.tapToFocus === "boolean" ? p.tapToFocus : DEFAULTS.tapToFocus,
    };
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(prefs: DisplayPrefs): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    }
  } catch {
    // Ignore quota / SSR write errors.
  }
}

export interface UseDisplayPrefsReturn {
  prefs: DisplayPrefs;
  /** Toggle or explicitly set line-wrap. */
  setWrap: (wrap: boolean) => void;
  /** Set font size, clamped to 9–16. */
  setFontSize: (size: number) => void;
  /** Step font size by delta (positive = larger), clamped to 9–16. */
  stepFontSize: (delta: number) => void;
  /** Step terminal side padding by delta, clamped to 0–16px. */
  stepHorizontalPadding: (delta: number) => void;
  /** Toggle or explicitly set the raw-terminal escape hatch. */
  setRawTerminal: (raw: boolean) => void;
  /** Toggle or explicitly set whether a mirror tap focuses the composer. */
  setTapToFocus: (tapToFocus: boolean) => void;
}

export function useDisplayPrefs(): UseDisplayPrefsReturn {
  const [prefs, setPrefs] = useState<DisplayPrefs>(loadPrefs);

  const setWrap = useCallback((wrap: boolean) => {
    setPrefs((p) => {
      const next: DisplayPrefs = { ...p, wrap };
      savePrefs(next);
      return next;
    });
  }, []);

  const setFontSize = useCallback((size: number) => {
    setPrefs((p) => {
      const next: DisplayPrefs = { ...p, fontSize: clampFont(size) };
      savePrefs(next);
      return next;
    });
  }, []);

  const stepFontSize = useCallback((delta: number) => {
    setPrefs((p) => {
      const next: DisplayPrefs = { ...p, fontSize: clampFont(p.fontSize + delta) };
      savePrefs(next);
      return next;
    });
  }, []);

  const stepHorizontalPadding = useCallback((delta: number) => {
    setPrefs((p) => {
      const next: DisplayPrefs = {
        ...p,
        horizontalPadding: clampHorizontalPadding(p.horizontalPadding + delta),
      };
      savePrefs(next);
      return next;
    });
  }, []);

  const setRawTerminal = useCallback((rawTerminal: boolean) => {
    setPrefs((p) => {
      const next: DisplayPrefs = { ...p, rawTerminal };
      savePrefs(next);
      return next;
    });
  }, []);

  const setTapToFocus = useCallback((tapToFocus: boolean) => {
    setPrefs((p) => {
      const next: DisplayPrefs = { ...p, tapToFocus };
      savePrefs(next);
      return next;
    });
  }, []);

  return {
    prefs,
    setWrap,
    setFontSize,
    stepFontSize,
    stepHorizontalPadding,
    setRawTerminal,
    setTapToFocus,
  };
}
