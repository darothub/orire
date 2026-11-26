import { describe, expect, it } from "vitest";
import { ASK_SHORTCUTS, chatMeta } from "./copilot";

describe("v4 copilot panel", () => {
  it("offers one quick action per intent, each with a label to send", () => {
    expect(new Set(ASK_SHORTCUTS.map((a) => a.intent)).size).toBe(ASK_SHORTCUTS.length);
    expect(ASK_SHORTCUTS.every((a) => a.label.length > 0 && a.hint.length > 0)).toBe(true);
  });

  it("says whether a chat is saved, and that saved chats keep text only", () => {
    expect(chatMeta(false)).toBe("Not saved");
    expect(chatMeta(true)).toBe("Saved, text only");
  });
});
