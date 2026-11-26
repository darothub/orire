"use client";

import { PlanPanel } from "@/components/PlanPanel";
import { V4Shell } from "./V4Shell";

/**
 * Plan and billing inside v4: subscribe, switch, cancel, resume and update the card, using the
 * same panel and server actions as the current app. Stripe sends people back to `/?billing=...`;
 * the home page forwards those visits here, and the panel shows the result.
 */
export function V4Plan() {
  return (
    <V4Shell active="plan" label="Plan and billing">
      <div className="v4-scroll">
      <header className="v4-head">
        <div>
          <h1>Plan &amp; billing</h1>
          <p>Choose a plan, change it or cancel any time. Your limits come back at the start of each month.</p>
        </div>
      </header>
      <PlanPanel />
      </div>
    </V4Shell>
  );
}
