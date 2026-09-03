# Pre-1.x fork feature notes

This is a design record, not a claim about the current implementation. On 2026-09-03 the
`hongmono/collie` fork restarted `main` from `AltanS/collie` at `856808c` (the 1.2.0 line).
The former 0.41.1 tree remains recoverable on
`archive/pre-upstream-1.2.0-20260903` at `cc845c0`.

The notes below preserve the intent of changes that were unique to the old fork. Reimplement a
feature against the current architecture and its ADRs; do not cherry-pick the old UI code blindly.

## Features worth reevaluating

### Use the full phone viewport

- Let dashboard, space, settings, and terminal surfaces use all available width.
- Keep fixed overlays aligned with their route content; do not fix one route in isolation.
- Source: `9e69fd1` (`fix(ui): use the full viewport width`).

### Keep pane navigation in the header

- Put the tab switcher and new-tab action in the pane title band instead of spending a separate
  mobile row.
- Use the same compact header treatment at every viewport width so resizing does not move the
  primary navigation between two regions.
- Sources: `9a0159a`, corrected by `c891b08`.

### Accept images dropped on the composer

- Treat a dropped image like an image selected through Attach: upload it, then attach the returned
  host path to the draft.
- Reject unsupported or missing file data through the same validation and error path as the existing
  attachment flow.
- Source: `833d1d2` (`feat(composer): attach dropped images`).

### Preserve multiline replies until verified submission

- Typing a multiline draft must not let embedded line breaks submit the message early.
- Send the text without submission first, verify that the agent input contains the intended draft,
  and only then send the separate submit action.
- Codex composer detection must accept a small bounded number of blank paragraph rows while staying
  fail-closed when the gap is unbounded or foreign UI appears.
- Sources: `d680130` and `c2e6b12`.

### Keep completion rules visually atomic

- A terminal completion/rule separator should stay one clipped row. It must not wrap into multiple
  separators and distort the surrounding block layout.
- Source: `609dd7f` (`fix(terminal): keep completion rule on one row`).

### Offer explicit terminal side padding

- Let the operator adjust terminal-mirror side padding, with a compact default.
- Preserve the PTY's line breaks; padding must not trigger heuristic prose reflow or alter the chosen
  text size.
- Source: `0f1c2e8` (`feat(terminal): add adjustable side padding`).

## Historical PTY-fit feature

The old fork exposed an explicit action that resized the shared Herdr PTY to the phone viewport,
plus an opt-in browser-session mode that resized each pane once when opened. The automatic mode was
scoped to the pane-opening event, never polling, viewport changes, or keyboard changes. A supervised
bridge also resolved the Herdr executable from a minimal service `PATH`.

Sources: `a0732a5`, `7e0d9c6`, and `ff984d2`.

Do not port this as-is. Current ADR 0008 rejects terminal control because resizing changes the shared
PTY seen by every client. Reconsidering the feature requires a new ADR with current multiplexer
semantics, explicit operator consent, ownership/release behavior, and tests proving no background
event can resize a pane.

## Experiments that should not be replayed

- `4f2483d` briefly scaled narrow terminal grids to fill spare width; `98a81ac` backed that out to
  preserve the selected text size. Preserve the latter behavior.
- `77ba4f1` and part of `8453f85` heuristically reflowed hard-wrapped Codex prose. `0f1c2e8` later
  removed that behavior in favor of faithful PTY line breaks.
- `8453f85`, `023398c`, and `4ac8c74` iterated on overlaying or shelving Attach and Send inside a
  full-width composer. `0503e7e` deliberately restored the established composer. Treat those layout
  commits as research, not a desired final component.

## Recovery references

- Old fork tip: `cc845c02e35e6db18c9675442f008a47f1853fdd` (0.41.1)
- Last common pre-divergence commit: `85f777b7221dfe924e9066ba7177520aaead1fb9`
- Archived branch: `origin/archive/pre-upstream-1.2.0-20260903`
