/**
 * orire — pure billing-summary helpers (Phase B polish).
 *
 * These turn the raw `BillingStatus` fields (Stripe subscription `status` and
 * period-end date) into the short, human lines the PlanPanel renders. Keeping
 * them pure makes the renewal/past-due logic unit-testable without React or
 * Stripe.
 */

export interface SubscriptionLine {
  text: string;
  tone: "ok" | "warn";
}

export interface BillingLike {
  status: string | null;
  renewsAt: string | null;
  hasSubscription: boolean;
}

/** Format an ISO date as a short, locale-stable label (e.g. "Jun 3, 2025"). */
export function formatBillingDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The subscription state line. Returns null when there is nothing meaningful to
 * show (no status on record). Active/trialing read as a renewal; past_due and
 * canceled read as warnings even after the plan has been dropped to free.
 */
export function subscriptionLine(b: BillingLike): SubscriptionLine | null {
  if (!b.status) return null;
  const date = formatBillingDate(b.renewsAt);
  switch (b.status) {
    case "active":
      return { text: date ? `Renews ${date}` : "Active subscription", tone: "ok" };
    case "trialing":
      return { text: date ? `Trial ends ${date}` : "On trial", tone: "ok" };
    case "past_due":
    case "unpaid":
      return { text: "Payment past due — update your card in the billing portal.", tone: "warn" };
    case "incomplete":
    case "incomplete_expired":
      return { text: "Payment didn’t complete — try subscribing again.", tone: "warn" };
    case "canceled":
      return { text: date ? `Access ends ${date}` : "Subscription canceled.", tone: "warn" };
    default:
      return { text: date ? `${titleCase(b.status)} · ${date}` : titleCase(b.status), tone: "warn" };
  }
}
