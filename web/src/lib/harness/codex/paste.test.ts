import { describe, expect, it } from "vitest";

import { codexDraftCarriesSend } from "./paste";

describe("Codex large-paste evidence", () => {
  it("accepts only the exact Unicode character count", () => {
    const sent = "x".repeat(1001);
    expect(codexDraftCarriesSend(sent, "[Pasted Content 1001 chars]")).toBe(true);
    expect(codexDraftCarriesSend(sent, "[Pasted Content 1000 chars]")).toBe(false);
    expect(codexDraftCarriesSend(`${sent}🙂`, "[Pasted Content 1002 chars]")).toBe(true);
    expect(codexDraftCarriesSend("x".repeat(1000), "[Pasted Content 1000 chars]")).toBe(false);
    expect(codexDraftCarriesSend("", "[Pasted Content 0 chars]")).toBe(false);
  });

  it("accepts Codex's collision suffix but no surrounding or malformed text", () => {
    const sent = "y".repeat(1006);
    expect(codexDraftCarriesSend(sent, "[Pasted Content 1006 chars] #2")).toBe(true);
    expect(codexDraftCarriesSend(sent, "[Pasted Content 1006 chars] #10")).toBe(true);
    expect(codexDraftCarriesSend(sent, "prefix [Pasted Content 1006 chars]")).toBe(false);
    expect(codexDraftCarriesSend(sent, "[Pasted Content 01006 chars]")).toBe(false);
    expect(codexDraftCarriesSend(sent, "[Pasted Content 1006 chars] #1")).toBe(false);
  });
});

describe("Codex image-placeholder evidence", () => {
  const image = "/home/ubuntu/.local/state/collie/uploads/w2_p1-mtml05b9-8174194a.png";

  it("accepts the exact Collie upload after Codex renders it as an image token", () => {
    expect(codexDraftCarriesSend(`${image}\n\nplease inspect this`, "[Image #1] please inspect this")).toBe(true);
  });

  it("requires every image and all surrounding text", () => {
    expect(codexDraftCarriesSend(`${image} please inspect this`, "[Image #1] delete everything")).toBe(false);
    expect(codexDraftCarriesSend("/tmp/untrusted.png please inspect this", "[Image #1] please inspect this")).toBe(false);
    expect(codexDraftCarriesSend(`${image} ${image}`, "[Image #1]")).toBe(false);
  });
});
