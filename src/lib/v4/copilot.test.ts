import { describe, expect, it } from "vitest";
import { ASK_SHORTCUTS, actionLock, chatAccess, chatMeta } from "./copilot";

describe("v4 copilot panel", () => {
  it("offers one quick action per intent, each with a label to send", () => {
    expect(new Set(ASK_SHORTCUTS.map((a) => a.intent)).size).toBe(ASK_SHORTCUTS.length);
    expect(ASK_SHORTCUTS.every((a) => a.label.length > 0 && a.hint.length > 0)).toBe(true);
  });

  it("says whether a chat is saved, and that saved chats keep text only", () => {
    expect(chatMeta(false)).toBe("Not saved");
    expect(chatMeta(true)).toBe("Saved with its CV and job");
  });
});

describe("chatAccess", () => {
  it("lets chat through until the plan's replies are spent", () => {
    expect(chatAccess(undefined)).toBe("ok");
    expect(chatAccess({ cap: 5, used: 4 })).toBe("ok");
    expect(chatAccess({ cap: 5, used: 5 })).toBe("no-replies");
    expect(chatAccess({ cap: null, used: 900 })).toBe("ok");
  });
});

describe("actionLock", () => {
  it("never locks Career, or an unknown plan", () => {
    expect(actionLock("career", "interview")).toBeNull();
    expect(actionLock(undefined, "review")).toBeNull();
  });
  it("keeps review and match behind Career, like the Studio", () => {
    for (const intent of ["review", "match"] as const) {
      expect(actionLock("free", intent)).toBe("career");
      expect(actionLock("pro", intent)).toBe("career");
    }
  });
  it("opens interview practice to Pro (with its allowance) and keeps Free out", () => {
    expect(actionLock("free", "interview")).toBe("pro");
    expect(actionLock("pro", "interview")).toBeNull();
  });
  it("opens Refine to every plan and the cover letter to paid plans", () => {
    expect(actionLock("free", "refine")).toBeNull();
    expect(actionLock("free", "cover")).toBe("pro");
    expect(actionLock("pro", "cover")).toBeNull();
  });
});
