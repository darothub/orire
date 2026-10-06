/**
 * orire — embedded Checkout return handler (Phase B3).
 *
 * Stripe navigates the browser here after the embedded payment form finishes,
 * passing `?session_id={CHECKOUT_SESSION_ID}`. We read the session status
 * server-side and bounce back into the app with a flag the PlanPanel turns into
 * a notice. Entitlement itself is written by the webhook, not here.
 */

import { redirect } from "next/navigation";
import { checkoutSessionStatus } from "@/app/actions/billing";

export const dynamic = "force-dynamic";

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const { status, plan, amount, currency } = await checkoutSessionStatus(session_id ?? "");

  if (status === "complete") {
    // Plan/value/sid let the client report a de-duplicated Purchase conversion.
    const qs = new URLSearchParams({ billing: "success" });
    if (plan) qs.set("plan", plan);
    if (amount != null) qs.set("value", String(amount));
    if (currency) qs.set("cur", currency);
    if (session_id) qs.set("sid", session_id);
    redirect(`/?${qs.toString()}`);
  }
  // Open / expired / unknown — return home without claiming success.
  redirect("/?billing=cancelled");
}
