import { describe, expect, it } from "vitest";
import { PLANS, PLAN_ORDER } from "@/lib/plan/plan";
import { landingPlans, RECOMMENDED_PLAN } from "@/components/landing/pricing";

describe("landingPlans", () => {
  it("emits one row per plan, in canonical order", () => {
    const rows = landingPlans();
    expect(rows.map((r) => r.id)).toEqual(PLAN_ORDER);
  });

  it("formats the free plan as 'Free … forever' with a start CTA", () => {
    const free = landingPlans().find((r) => r.id === "free")!;
    expect(free.priceLabel).toBe("Free");
    expect(free.cadence).toBe("forever");
    expect(free.cta).toBe("Start free");
  });

  it("formats paid plans with a dollar price and monthly cadence", () => {
    for (const row of landingPlans().filter((r) => r.id !== "free")) {
      expect(row.priceLabel).toBe(`$${PLANS[row.id].price}`);
      expect(row.cadence).toBe("/ month");
      expect(row.cta).toBe(`Choose ${PLANS[row.id].label}`);
    }
  });

  it("highlights exactly the recommended plan", () => {
    const highlighted = landingPlans().filter((r) => r.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].id).toBe(RECOMMENDED_PLAN);
  });

  it("carries the real perks and blurb from the plan policy (no drift)", () => {
    for (const row of landingPlans()) {
      expect(row.perks).toEqual(PLANS[row.id].perks);
      expect(row.blurb).toBe(PLANS[row.id].blurb);
    }
  });
});
