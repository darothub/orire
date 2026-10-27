/** Owner-confirmed public policy details, 27 October 2026.
 * These values describe policy; they are not evidence of retention-job execution.
 * Porto is the supplied public location, not a registered-office street address.
 */
export const COMPANY = {
  shortName: "Orire",
  legalEntity: "Bogini",
  registrationNumber: "",
  address: "Porto, Portugal",
  contactUrl: "https://www.instagram.com/orire.app/",
  contactLabel: "@orire.app",

  /** Existing mail transport fallback, not an owner-verified public contact. */
  supportEmail: "support@orire.app",
  jurisdiction: "Portugal",
  minimumAge: "16",
  aiProviders: "OpenAI and Anthropic",
  paymentProvider: "Stripe",

  /** Existing retention policy explicitly adopted by the owner. */
  retention: {
    account: "30 days",
    billingYears: "10 years",
    logs: "90 days",
  },
  lastUpdated: "27 October 2026",
} as const;
