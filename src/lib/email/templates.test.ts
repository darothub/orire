import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email/mailer", () => ({ appUrl: () => "https://orire.app" }));

import { activationNudgeEmail, emailVerificationEmail, magicLinkEmail, passwordResetEmail } from "./templates";

describe("email templates", () => {
  it("share the v4 look and keep the link in html and text", () => {
    const mails = [
      [magicLinkEmail("tok en"), "https://orire.app/magic?token=tok%20en"],
      [passwordResetEmail("abc"), "https://orire.app/reset?token=abc"],
      [emailVerificationEmail("abc"), "https://orire.app/api/auth/verify?token=abc"],
    ] as const;
    for (const [m, link] of mails) {
      expect(m.html).toContain("#14121C");
      expect(m.html).toContain("#F5C56B");
      expect(m.html).toContain(`href="${link}"`);
      expect(m.text).toContain(link);
    }
  });

  it("the nudge has a button but no raw-link fallback, and says it is sent once", () => {
    const m = activationNudgeEmail("both");
    expect(m.html).toContain("https://orire.app/");
    expect(m.html).not.toContain("Or paste this link");
    expect(m.text).toContain("We'll only send this once.");
  });

  it("states the sign-in link rules", () => {
    expect(magicLinkEmail("t").html).toContain("15 minutes");
    expect(magicLinkEmail("t").html).toContain("only the newest one works");
  });
});
