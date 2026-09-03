# 0035 — The last active device sizes the shared PTY

Status: **Accepted** (2026-09-03)

Amends: [ADR 0008](./0008-collie-does-not-run-a-terminal-emulator.md). Its mirror-only rendering
decision remains accepted; this ADR supersedes only its blanket prohibition on using Herdr terminal
control.

## Context

Collie mirrors the grid Herdr already rendered. If no attached terminal tells Herdr the phone's
character grid, the shared PTY keeps the dimensions of some earlier client. The browser can wrap or
clip those cells, but it cannot recover the rows and columns the process never received. On a phone
that leaves visible space unused and makes the mirror look narrower or shorter than the screen.

PTY geometry is shared state, not a per-client presentation preference. A persistent controller would
make devices fight continuously and would turn Collie into the terminal owner. However, sizing only
when a pane first opens leaves the PTY stale after a phone rotates, browser chrome changes the visible
viewport, or the operator changes the terminal font.

## Decision

When a writable device opens a pane, Collie waits for the browser layout to settle, measures the
visible mirror scrollport in the terminal's rendered font, and sends `{cols, rows}` for that pane.
While the pane remains open, Collie measures again after any of these signals:

- the mirror scrollport's border box changes (`ResizeObserver`),
- the window, orientation, or visual viewport reports a resize,
- the terminal font size or family preference changes, or
- the browser finishes loading a font.

Two animation frames coalesce browser events and let layout and font styles settle. Collie compares
the result with the last attempted grid for the pane and sends nothing when rows and columns are
unchanged. A changed grid is a new ownership claim, so the most recently opened or resized writable
device wins. Read-only devices never resize the PTY.

For each changed grid, the bridge acquires Herdr terminal control without `--takeover`, applies the
grid, and releases control immediately with Herdr's NDJSON `terminal.release` command. No controller
persists between requests.

The operation is a declared mux capability, `resizeGrid`. Herdr declares it after a live CLI probe;
tmux and zellij decline it. Both browser and bridge gate the write on that declaration. A browser
waits until `/api/config` has actually answered before performing this automatic side effect — the
usual UI rule that an unknown capability fails open remains unchanged for visible controls.

Collie still does not emulate a terminal, consume frames, hold a controller, or synthesize cursor
state. Terminal control exists only as a short-lived resize transport.

## Consequences

- The phone uses its current mirror area instead of inheriting a stale desktop grid.
- Rotating the device, resizing the viewport, changing terminal font settings, and completing a font
  load automatically update `COLUMNS` and `LINES` when the resulting grid changes.
- A later device's changed grid intentionally resizes the shared process and becomes authoritative;
  this is visible to every mirror and is the meaning of “last active wins”.
- Duplicate resize signals that calculate the same grid do not open another controller.
- A failed resize is non-fatal: the mirror still renders, the failure is logged, and the next resize
  signal can try again.
- Herdr-backed installs require Herdr 0.8.2, whose `terminal session control --cols --rows`
  command was probed. The bridge resolves the binary from an explicit test override, `PATH`, and
  standard per-user locations such as `~/.local/bin`, so supervised services do not depend on an
  interactive shell's PATH.
