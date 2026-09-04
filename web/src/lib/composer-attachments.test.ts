import { describe, expect, it } from "vitest";

import { composerDraftPreview, joinComposerDraft, splitComposerDraft } from "./composer-attachments";

const image = "/home/operator/.local/state/collie/uploads/w1_p1-mtmkz6v6-4dcce381.png";

describe("composer attachments", () => {
  it("round-trips Collie upload paths outside visible draft text", () => {
    const stored = joinComposerDraft("봐줘", [{ path: image }]);
    expect(stored).toBe(`${image}\n\n봐줘`);
    expect(splitComposerDraft(stored)).toEqual({ text: "봐줘", attachments: [{ path: image }] });
  });

  it("migrates the old inline-path draft shape", () => {
    expect(splitComposerDraft(`다끝나면 ${image} 봐줘`)).toEqual({
      text: "다끝나면 봐줘",
      attachments: [{ path: image }],
    });
  });

  it("does not hide ordinary image paths", () => {
    expect(splitComposerDraft("review /tmp/screenshot.png")).toEqual({
      text: "review /tmp/screenshot.png",
      attachments: [],
    });
  });

  it("uses Codex-style labels in the pending-send preview", () => {
    expect(composerDraftPreview("봐줘", [{ path: image }])).toBe("[Image #1] 봐줘");
  });
});
