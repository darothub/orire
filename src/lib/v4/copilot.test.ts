import { describe, expect, it } from "vitest";
import { ASK_SHORTCUTS, chatAccess, chatMeta } from "./copilot";

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

describe("chatAccess", () => {
  it("lets an unknown plan through so the server decides", () => {
    expect(chatAccess(undefined)).toBe("ok");
  });
  it("asks Free and Pro to upgrade", () => {
    expect(chatAccess("free")).toBe("upgrade");
    expect(chatAccess("pro", { cap: 10, used: 0 })).toBe("upgrade");
  });
  it("lets Career chat until the monthly runs are spent", () => {
    expect(chatAccess("career", { cap: 40, used: 39 })).toBe("ok");
    expect(chatAccess("career", { cap: 40, used: 40 })).toBe("no-runs");
    expect(chatAccess("career", { cap: null, used: 500 })).toBe("ok");
  });
});
