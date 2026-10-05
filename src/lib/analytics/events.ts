import { track } from "@vercel/analytics";

/**
 * Thin, typed wrapper over Vercel Web Analytics custom events so event names
 * and property shapes stay consistent across the app. `track` is a no-op on the
 * server and when analytics isn't available, so these are safe to call from any
 * client code path. Property values must be string | number | boolean | null.
 */
export const analytics = {
  /** One or more CVs were uploaded for parsing (rebrand/refine ingest). */
  cvUploaded: (count: number, flow: "rebrand" | "refine") =>
    track("cv_uploaded", { count, flow }),
  /** An uploaded CV was restructured by an assistant (or fell back). */
  rebrandStructured: (provider: string, ok: boolean) =>
    track("rebrand_structured", { provider, ok }),
  /** A template was chosen for the re-branded CV. */
  templateSelected: (templateId: string) =>
    track("template_selected", { templateId }),
  /** A refine/compare run was started against a job description. */
  refineRun: (providers: number, mode: "single" | "compare") =>
    track("refine_run", { providers, mode }),
  /** The LLM judge was asked to pick the best candidate. */
  judgeRun: (judge: string) => track("judge_run", { judge }),
  /** The "ideal CV" simulation for a job description was started. */
  simulateRun: (provider: string) => track("simulate_run", { provider }),
  /** A signed-out visitor hit the paywall and was pushed to sign up. */
  paywallSignupPrompt: (plan: string) =>
    track("paywall_signup_prompt", { plan }),
  /** A paid-plan checkout was initiated. */
  checkoutStarted: (plan: string, mode: "embedded" | "hosted") =>
    track("checkout_started", { plan, mode }),
};
