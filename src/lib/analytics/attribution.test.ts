import { describe, expect, it } from "vitest";
import { parseAttribution } from "./attribution";

describe("parseAttribution", () => {
  it("keeps only known campaign params", () => {
    expect(parseAttribution("?utm_source=facebook&utm_campaign=launch&fbclid=abc&foo=bar")).toEqual({
      utm_source: "facebook",
      utm_campaign: "launch",
      fbclid: "abc",
    });
  });

  it("ignores empty values and caps length", () => {
    const out = parseAttribution(`?utm_source=%20&utm_term=${"x".repeat(500)}`);
    expect(out.utm_source).toBeUndefined();
    expect(out.utm_term).toHaveLength(200);
  });
});
