// Codex replaces a sufficiently large paste with one atomic token while keeping the full payload
// internally: `[Pasted Content N chars]` (optionally suffixed ` #2`, ` #3`, … when equal-sized
// placeholders coexist). This is public, documented Codex TUI behavior. The reply guard cannot find
// the original text on screen in that state, so the exact Unicode character count is supplemental
// evidence that THIS send reached the composer. It never accepts surrounding text or a mismatched
// count, and it only widens evidence after a real Codex composer has already been located.

const LARGE_PASTE_CHAR_THRESHOLD = 1000;
const PASTED_CONTENT = /^\[Pasted Content ([1-9]\d*) chars\](?: #(?:[2-9]|[1-9]\d+))?$/;
const COLLIE_UPLOAD = /(?:^|\s)(\/\S*\/collie(?:-[^/\s]+)?\/uploads\/[A-Za-z0-9_-]+-[a-z0-9]+-[a-f0-9]{8}\.(?:png|jpg|gif|webp))(?=\s|$)/giu;
const CODEX_IMAGE = /\[Image #\d+\]/gu;

function imageDraftCarriesSend(sent: string, draft: string): boolean {
  const uploads = [...sent.matchAll(COLLIE_UPLOAD)];
  const images = [...draft.matchAll(CODEX_IMAGE)];
  if (uploads.length === 0 || uploads.length !== images.length) return false;
  const normalizedSent = sent.replace(COLLIE_UPLOAD, " __COLLIE_IMAGE__");
  const normalizedDraft = draft.replace(CODEX_IMAGE, "__COLLIE_IMAGE__");
  return normalizedSent.trim().replace(/\s+/gu, " ") === normalizedDraft.trim().replace(/\s+/gu, " ");
}

export function codexDraftCarriesSend(sent: string, draft: string): boolean {
  if (imageDraftCarriesSend(sent, draft)) return true;
  const match = PASTED_CONTENT.exec(draft.trim());
  if (match === null) return false;
  const count = Number(match[1]);
  return count > LARGE_PASTE_CHAR_THRESHOLD && count === [...sent].length;
}
