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
  const { status } = await checkoutSessionStatus(session_id ?? "");

  if (status === "complete") redirect("/?billing=success");
  // Open / expired / unknown — return home without claiming success.
  redirect("/?billing=cancelled");
}
