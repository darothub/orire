/**
 * orire — landing "as seen in" / employer wall.
 *
 * Recognizable target-employer wordmarks that frame the kind of roles Orire
 * users aim for. These are aspirational target employers, not customers or
 * endorsers — the surrounding copy makes that explicit. Kept as pure data so
 * the list is reviewable in one place and unit-testable with no DOM.
 */

const EMPLOYERS: string[] = [
  "Google",
  "Stripe",
  "Spotify",
  "Figma",
  "Shopify",
  "Airbnb",
  "Notion",
  "Linear",
];

/** The ordered wordmarks shown in the "roles at teams like these" strip. */
export function employerLogos(): string[] {
  return [...EMPLOYERS];
}
