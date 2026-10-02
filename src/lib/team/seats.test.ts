import { describe, expect, it } from "vitest";
import { seatStatus } from "./seats";

describe("seatStatus", () => {
  it("is ok with comfortable headroom", () => {
    const s = seatStatus(2, 5);
    expect(s.level).toBe("ok");
    expect(s.message).toBeNull();
    expect(s.left).toBe(3);
    expect(s.ratio).toBeCloseTo(0.4);
  });

  it("warns when only one seat is left", () => {
    const s = seatStatus(4, 5);
    expect(s.level).toBe("warn");
    expect(s.left).toBe(1);
    expect(s.message).toBe("Only 1 seat left of 5.");
  });

  it("warns on high occupancy ratio even with >1 seat left", () => {
    const s = seatStatus(8, 10); // 80%, 2 left
    expect(s.level).toBe("warn");
    expect(s.message).toBe("Only 2 seats left of 10.");
  });

  it("reports full when seats are exhausted", () => {
    const s = seatStatus(5, 5);
    expect(s.level).toBe("full");
    expect(s.left).toBe(0);
    expect(s.message).toBe("All 5 seats are filled — remove a member or upgrade to invite more.");
  });

  it("clamps over-subscription to full with zero left", () => {
    const s = seatStatus(7, 5);
    expect(s.level).toBe("full");
    expect(s.left).toBe(0);
    expect(s.ratio).toBe(1);
  });

  it("handles a zero/invalid limit without dividing by zero", () => {
    const s = seatStatus(0, 0);
    expect(s.ratio).toBe(0);
    expect(s.level).toBe("full");
    expect(s.left).toBe(0);
  });

  it("floors fractional inputs", () => {
    const s = seatStatus(2.9, 5.9);
    expect(s.used).toBe(2);
    expect(s.limit).toBe(5);
  });
});
