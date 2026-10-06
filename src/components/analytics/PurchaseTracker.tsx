"use client";

import { useEffect } from "react";
import { analytics } from "@/lib/analytics/events";
import { PLANS, type PlanId } from "@/lib/plan/plan";

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
    const plan = p.get("plan") as PlanId | null;
    if (!sid || !plan || plan === "free" || !(plan in PLANS)) return;

    const fromUrl = Number(p.get("value"));
    const value = Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : PLANS[plan].price;
    const currency = /^[a-z]{3}$/i.test(p.get("cur") ?? "") ? (p.get("cur") as string) : "usd";

    try {
      const seen = new Set<string>(JSON.parse(window.localStorage.getItem(KEY) ?? "[]"));
      if (seen.has(sid)) return;
      seen.add(sid);
      window.localStorage.setItem(KEY, JSON.stringify([...seen].slice(-20)));
    } catch {
      return;
    }
    analytics.purchaseCompleted(plan, value, currency, sid);
  }, []);

  return null;
}
