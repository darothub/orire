/**
 * Single source of truth for the contact details + policy values rendered on
 * the Privacy Policy, Terms of Service and Support pages.
 *
 * Orire operates under the "Orire" trading name by default — no legal-entity
 * placeholder is shown. If you later want to disclose the registered company
 * (recommended once incorporated, for full EU trader-identification), fill
 * `legalEntity` (and optionally `registrationNumber` / `address`); the legal
 * pages then show it automatically. The retention periods and minimum age are
 * sensible defaults — adjust them to your actual policy.
 */
export const COMPANY = {
  shortName: "Orire",

  /** Registered-entity disclosure. Blank = operate under the "Orire" name. */
  legalEntity: "", // e.g. "Orire, Unipessoal, Lda."
  registrationNumber: "", // NIF / commercial registration (shown only if set)
  address: "", // registered office (shown only if set)

  /** Working contact addresses on the orire.app domain. */
  privacyEmail: "privacy@orire.app",
  supportEmail: "support@orire.app",

  jurisdiction: "Portugal",
  minimumAge: "16",

  /** Providers that actually process data on Orire's behalf. */
  aiProviders: "OpenAI and Anthropic",
  paymentProvider: "Stripe",

  /** Data-retention periods (sensible defaults — confirm against your policy). */
  retention: {
    account: "30 days",
    billingYears: "10 years",
    logs: "90 days",
  },

  /** Keep in sync with the "Last updated" line shown to users. */
  lastUpdated: "11 October 2026",
} as const;
