import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { trackNewSignup } from "./signup";
import { funnel } from "./funnel";
import { privateAnalyticsEvent } from "./privacy";
import { analytics } from "./events";
import { consentedTrack } from "./consentedTrack";
import { metaTrack } from "./meta";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics", () => ({ track }));

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { localStorage: storage(), sessionStorage: storage(), fbq: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
function consent(choice: string) { window.localStorage.setItem("orire-consent", choice); }

describe("anonymous consented conversion funnel", () => {
  it.each([null, "denied", "invalid"])("does not send or queue events with consent %s", (choice) => {
    if (choice) consent(choice);
    funnel.landingViewed(); funnel.landingCta("hero"); funnel.signupStarted();
    funnel.templateChosen("aurora"); funnel.firstEdit(); funnel.firstExport("pdf");
    analytics.signupCompleted(); analytics.cvUploaded(1, "rebrand");
    expect(track).not.toHaveBeenCalled();
    consent("granted"); funnel.landingViewed();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("landing_viewed", {});
  });
  it("does not consume signup completion before consent and dedupes without sending the account ID", () => {
    expect(trackNewSignup(true, "synthetic-private-user")).toBe(false);
    expect(window.localStorage.getItem("orire-signup-tracked")).toBeNull();
    consent("granted");
    expect(trackNewSignup(false, "synthetic-private-user")).toBe(false);
    expect(trackNewSignup(true, null)).toBe(false);
    expect(trackNewSignup(true, "synthetic-private-user")).toBe(true);
    expect(trackNewSignup(true, "synthetic-private-user")).toBe(false);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("signup_completed", undefined);
    expect(JSON.stringify(track.mock.calls)).not.toContain("synthetic-private-user");
  });
  it("initializes the SDK queue only after consent, even before Analytics mounts", () => {
    expect(consentedTrack("test_event")).toBe(false);
    expect(window.va).toBeUndefined();
    consent("granted");
    // Model the real SDK's optional va call, which otherwise silently drops events.
    track.mockImplementationOnce((name, data) => window.va?.("event", { name, data }));
    funnel.landingViewed();
    expect(window.vaq).toEqual([["beforeSend", privateAnalyticsEvent], ["event", { name: "landing_viewed", data: {} }]]);
    funnel.landingViewed();
    expect(window.vaq).toHaveLength(2);
  });
  it("deduplicates stages and CTA placements, including remount/reload calls", () => {
    consent("granted");
    for (let i = 0; i < 3; i++) {
      funnel.landingViewed(); funnel.landingCta("hero"); funnel.landingCta("footer");
      funnel.signupStarted(); funnel.templateChosen(i ? "noir" : "aurora");
      funnel.firstEdit(); funnel.firstExport(i ? "docx" : "pdf");
    }
    expect(track.mock.calls).toEqual([
      ["landing_viewed", {}], ["landing_cta_clicked", { placement: "hero" }],
      ["landing_cta_clicked", { placement: "footer" }], ["signup_started", {}],
      ["template_chosen", { template: "aurora" }], ["first_cv_edited", {}],
      ["first_cv_exported", { format: "pdf" }],
    ]);
  });
  it("stops Vercel and already-loaded Meta functions immediately after withdrawal", () => {
    consent("granted"); funnel.landingViewed();
    consent("denied"); funnel.firstEdit(); analytics.signupCompleted();
    metaTrack("PageView");
    expect(track).toHaveBeenCalledTimes(1);
    expect((window as unknown as { fbq: ReturnType<typeof vi.fn> }).fbq).not.toHaveBeenCalled();
  });
  it("fails closed when consent or deduplication storage is unavailable", () => {
    window.localStorage.getItem = () => { throw new Error("blocked"); };
    funnel.firstEdit(); expect(track).not.toHaveBeenCalled();
    vi.stubGlobal("window", { localStorage: storage(), sessionStorage: storage() });
    consent("granted");
    window.sessionStorage.setItem = () => { throw new Error("blocked"); };
    funnel.firstExport("txt"); expect(track).not.toHaveBeenCalled();
  });
  it("accepts catalog/enum properties only and never arbitrary CV/job/user strings", () => {
    consent("granted");
    funnel.templateChosen("someone@example.com");
    funnel.landingCta("secret-token" as "hero"); funnel.firstExport("private CV" as "pdf");
    expect(track).not.toHaveBeenCalled();
  });
  it("does not let analytics failures break an editor/export action", () => {
    consent("granted"); track.mockImplementationOnce(() => { throw new Error("blocked"); });
    expect(() => funnel.firstEdit()).not.toThrow();
  });
  it("removes URL query/fragment secrets and shared-CV tokens from SDK events", () => {
    consent("granted");
    expect(privateAnalyticsEvent({ type: "event", url: "https://orire.app/cv/secret?email=private#token" }))
      .toEqual({ type: "event", url: "https://orire.app/cv/shared" });
    expect(privateAnalyticsEvent({ type: "pageview", url: "https://orire.app/reset?token=private" }))
      .toEqual({ type: "pageview", url: "https://orire.app/reset" });
    expect(privateAnalyticsEvent({ type: "pageview", url: "https://orire.app/api/auth/secret" })).toBeNull();
    consent("denied");
    expect(privateAnalyticsEvent({ type: "event", url: "https://orire.app/" })).toBeNull();
  });
});
