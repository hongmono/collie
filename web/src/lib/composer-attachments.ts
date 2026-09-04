export interface ComposerAttachment {
  path: string;
}

export interface ComposerDraftParts {
  text: string;
  attachments: ComposerAttachment[];
}

// A path the operator typed themselves is message text, not hidden UI state.
const COLLIE_UPLOAD = /(?:^|\s)(\/[^\s]*\/collie\/uploads\/[^\s]+\.(?:png|jpe?g|gif|webp))(?:$|(?=\s))/gi;

export function splitComposerDraft(stored: string): ComposerDraftParts {
  const attachments: ComposerAttachment[] = [];
  const withoutAttachments = stored
    .replace(COLLIE_UPLOAD, (_match, path: string) => {
      attachments.push({ path });
      return " ";
    });
  if (attachments.length === 0) return { text: stored, attachments };
  const text = withoutAttachments
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, attachments };
}

/** The terminal receives real host paths; only Collie's composer replaces them with visual chips. */
export function joinComposerDraft(text: string, attachments: ComposerAttachment[]): string {
  const paths = attachments.map(({ path }) => path).join("\n");
  return paths && text.trim() ? `${paths}\n\n${text}` : paths || text;
}

export function composerDraftPreview(text: string, attachments: ComposerAttachment[]): string {
  const labels = attachments.map((_, index) => `[Image #${index + 1}]`).join(" ");
  const message = text.trim();
  return labels && message ? `${labels} ${message}` : labels || message;
}
