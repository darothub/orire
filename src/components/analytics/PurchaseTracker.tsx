"use client";

import { useEffect } from "react";
import { analytics } from "@/lib/analytics/events";
import { PLANS } from "@/lib/plan/plan";
import { verifyCheckoutSession } from "@/app/actions/billing";

const KEY = "orire-purchase-tracked";

/**
 * Reports the Purchase conversion when Checkout returns to `/?billing=success`
 * (embedded flow via /checkout/return, hosted flow via success_url). It must
 * read the URL synchronously on mount — PlanPanel strips the params later,
 * after its async billing fetch. The Stripe session id de-duplicates reloads.
 */
export function PurchaseTracker() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("billing") !== "success") return;
    const sid = p.get("sid");
    if (!sid) return;

    // Already recorded this checkout? (one conversion per Stripe session id)
    try {
      const seen = new Set<string>(JSON.parse(window.localStorage.getItem(KEY) ?? "[]"));
      if (seen.has(sid)) return;
    } catch {
      // No storage — fall through; the server verification still prevents a
      // forged success URL from fabricating a conversion.
    }

    let cancelled = false;
    void (async () => {
      // Confirm with the server that this session was actually paid and belongs
      // to the signed-in user. The success-URL params alone can be forged.
      const v = await verifyCheckoutSession(sid);
      if (cancelled || !v.ok || !v.plan || v.plan === "free" || !(v.plan in PLANS)) return;

      try {
        const seen = new Set<string>(JSON.parse(window.localStorage.getItem(KEY) ?? "[]"));
        if (seen.has(sid)) return;
        seen.add(sid);
        window.localStorage.setItem(KEY, JSON.stringify([...seen].slice(-20)));
      } catch {
        // No storage: fire once on a best-effort basis.
      }

      const value = typeof v.amountTotal === "number" && v.amountTotal > 0 ? v.amountTotal : PLANS[v.plan].price;
      const currency = /^[a-z]{3}$/i.test(v.currency ?? "") ? (v.currency as string) : "usd";
      analytics.purchaseCompleted(v.plan, value, currency, sid);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
