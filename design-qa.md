# Design QA — terminal spacing and full-width composer

- Source visual truth: `/Users/hongmono/.local/state/collie/uploads/w16_p1-mtdu1rj5-093ba57a.png`
- Browser implementation capture: `/tmp/expect-artifacts/screenshot-1787975772132.png`
- Combined comparison: `/tmp/expect-artifacts/comparison-width-spacing.png`
- Source pixels: 1848 × 2307 (capture density unknown)
- Implementation: 390 × 844 pixels, 390 × 844 CSS viewport, device scale factor 1
- State: live `w16:p1` Codex pane; Wrap enabled; long unsent Korean draft in the implementation capture

**Full-view comparison evidence**

- The source shows large terminal-padding gaps inserted at reconstructed row boundaries and a reply field shortened by a separate Send column.
- The implementation uses the full composer width for the textarea border. Attach and Send are overlaid inside its trailing edge.
- The pane contents changed while the live agent continued working, so prose identity is not a pixel-for-pixel comparison. The boundary behavior is covered by the focused fixture below.

**Focused region comparison evidence**

- Composer: at a 390px viewport, the textarea and its parent measure the same width; both action buttons remain within that rectangle.
- Long draft: four repeated Korean sentences wrap without document-level horizontal overflow. The textarea reserves 96px of right padding, keeping text clear of both actions.
- Terminal prose: `ansi-output.test.tsx` covers leading and trailing PTY padding, Korean syllable splits, hyphenated word splits, structural rows, and raw-terminal fidelity.

**Findings**

- Earlier P1 — artificial spaces in reconstructed prose: fixed by trimming only padding adjacent to a joined PTY boundary and using no invented separator inside Korean or hyphenated words.
- Earlier P2 — reply field did not own the entire composer width: fixed by overlaying Attach and Send inside the full-width field.
- No remaining actionable P0/P1/P2 findings in the requested regions.

**Required fidelity surfaces**

- Fonts and typography: existing Collie and terminal font tokens are unchanged; Korean joins no longer introduce visible synthetic word gaps.
- Spacing and layout rhythm: field spans the available row; controls stay within its right edge and retain their original sizes.
- Colors and visual tokens: unchanged.
- Image quality and asset fidelity: no image or icon assets were added or replaced.
- Copy and content: unchanged; the browser QA draft was cleared after capture.

**Interaction and technical evidence**

- Browser path: live Tailscale pane route at 390 × 844.
- Tested: normal composer, long unsent draft, action containment, horizontal overflow, and console output.
- Console errors: none.
- Automated checks: 3,441 frontend tests passed (18 todo); 712 bridge/script tests passed; typecheck and production build passed.

**Comparison history**

1. Source: trailing and leading PTY padding rendered as large gaps; Send occupied a sibling width column.
2. Fix: trim joined-edge padding, preserve raw offsets, join Korean/hyphen word splits without a blank, and overlay composer actions.
3. Post-fix: targeted fixtures pass and the live 390px capture shows a full-width field with a long draft clear of both actions.

final result: passed
