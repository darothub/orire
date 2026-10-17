import { describe, it, expect } from "vitest";
import { CHECKOUT_TAX_OPTS } from "./stripe";

/**
 * Guard the EU-VAT Checkout config: a regression that silently disables Stripe
 * Tax would ship untaxed EU sales, so assert the compliance-critical flags are
 * on and the session is set up to capture a tax location + VAT ID.
 */
describe("CHECKOUT_TAX_OPTS (EU VAT)", () => {
  it("enables automatic tax", () => {
    expect(CHECKOUT_TAX_OPTS.automatic_tax.enabled).toBe(true);
  });

  it("collects a billing address to tax against and persists it to the customer", () => {
    expect(CHECKOUT_TAX_OPTS.billing_address_collection).toBe("required");
    expect(CHECKOUT_TAX_OPTS.customer_update.address).toBe("auto");
  });

  it("collects VAT IDs for B2B reverse-charge", () => {
    expect(CHECKOUT_TAX_OPTS.tax_id_collection.enabled).toBe(true);
  });
});
