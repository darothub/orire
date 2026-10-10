/**
 * Single source of truth for the legal entity + contact details rendered on the
 * Privacy Policy and Terms of Service pages.
 *
 * TODO (before launch): replace every value still wrapped in [BRACKETS] with the
 * real registered details, and have a lawyer review both pages. These are the
 * only places to edit — both /privacy and /terms read from here.
 */
export const COMPANY = {
  legalName: "[COMPANY LEGAL NAME], Sociedade Unipessoal, Lda.",
  shortName: "Orire",
  registrationNumber: "[NIF / COMMERCIAL REGISTRATION NUMBER]",
  address: "[REGISTERED ADDRESS, PORTUGAL]",
  privacyEmail: "[privacy@orire.app]",
  supportEmail: "[support@orire.app]",
  jurisdiction: "Portugal",
  courts: "[Porto / JUDICIAL DISTRICT], Portugal",
  minimumAge: "[16 / 18]",
  // Providers that actually process data on Orire's behalf.
  aiProviders: "OpenAI and Anthropic",
  paymentProvider: "Stripe",
  // Keep in sync with the "Last updated" line shown to users.
  lastUpdated: "10 October 2026",
} as const;
