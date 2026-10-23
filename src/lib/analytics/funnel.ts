import { consentedTrack } from "./consentedTrack";
import { readConsent } from "@/lib/consent/consent";
import { TEMPLATE_CATALOG } from "@/lib/templates/catalog";

/** Session-scoped, anonymous milestones. No account/document identifiers or input values. */
type Stage = "landing_viewed" | "landing_cta_clicked" | "signup_started" | "template_chosen" | "first_cv_edited" | "first_cv_exported";
type Properties = Record<string, string>;
function once(stage: Stage, properties: Properties = {}, suffix = ""): boolean {
  if (readConsent() !== "granted") return false;
  try {
    const key = `orire-funnel:v1:${stage}${suffix}`;
    if (window.sessionStorage.getItem(key)) return false;
    // Skip rather than emit undeduplicated events when storage is unavailable.
    window.sessionStorage.setItem(key, "1");
    if (consentedTrack(stage, properties)) return true;
    window.sessionStorage.removeItem(key);
    return false;
  } catch {
    return false;
  }
}

export type CtaPlacement = "header" | "hero" | "pricing" | "footer";
export const funnel = {
  landingViewed: () => once("landing_viewed"),
  landingCta: (placement: CtaPlacement) => {
    if (!["header", "hero", "pricing", "footer"].includes(placement)) return;
    once("landing_cta_clicked", { placement }, `:${placement}`);
  },
  signupStarted: () => once("signup_started"),
  templateChosen: (id: string) => {
    if (TEMPLATE_CATALOG.some((t) => t.id === id)) once("template_chosen", { template: id });
  },
  firstEdit: () => once("first_cv_edited"),
  firstExport: (format: "pdf" | "docx" | "txt") => {
    if (["pdf", "docx", "txt"].includes(format)) once("first_cv_exported", { format });
  },
};

