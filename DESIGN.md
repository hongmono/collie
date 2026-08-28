# Collie Design System

## Product posture

Collie is a compact mobile command surface for monitoring and driving remote terminal panes. It
prioritises legibility, honest system state, and thumb-reachable controls over decorative UI.

## Tokens

- Theme colours and radii come exclusively from `web/src/index.css`.
- App chrome uses `background`, `muted`, `border`, and status tokens.
- Terminal output always uses `MIRROR_SPACE` and `MIRROR_INVERT`; never apply root-theme `dark:`
  variants inside the mirror.
- Typography uses the system sans stack for app content and `--font-mono` for terminal content.

## Layout

- The app shell is bounded to the dynamic viewport.
- Header, pane strips, status chrome, and composer stay fixed.
- `ChatMessageList` is the pane's only vertical scroll owner.
- For session-bearing panes, that scroll contains the transcript first and the live terminal at the
  tail. Transcript history grows upward without moving the content currently being read.
- No nested vertical scroller is allowed inside the pane scroll region.

## Primitives

- `AppHeader`: persistent pane identity and connection/status actions.
- `ChatMessageList`: continuous pane scroll, tail following, and jump-to-latest control.
- `TranscriptView`: role-labelled persisted conversation turns.
- `AnsiOutput`: faithful live terminal mirror.
- `Composer`: fixed reply and terminal-control surface.

## Interaction states

- Opening or sending lands at the live terminal tail.
- Scrolling upward freezes live-follow and reveals progressively older transcript turns.
- Returning to latest resumes live-follow.
- Transcript fetch failure leaves the terminal usable; it never replaces the live pane with an error
  screen.
- Read-only devices may inspect the full session but cannot drive the terminal.

## Accessibility

- Interactive controls retain visible focus states and minimum touch targets from existing
  primitives.
- Transcript and terminal strings remain React text nodes; no untrusted HTML enters the DOM.
- Reduced-motion and theme behavior follow `web/src/index.css`.
