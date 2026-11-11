import { describe, it, expect } from "vitest";
import { buildGapReportHtml, escapeHtml, skillEvidence } from "@/lib/ai/simulateReport";
import { sampleCV } from "@/lib/cv/sample";
import { targetMatch } from "@/lib/ai/simulate";

describe("simulateReport", () => {
  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });

  it("finds evidence lines and returns null for absent skills", () => {
    expect(skillEvidence(sampleCV, "zzz-not-a-skill")).toBeNull();
    const first = sampleCV.skills[0]?.items[0];
    if (first) expect(skillEvidence(sampleCV, first)).toBeTruthy();
  });

  it("builds a report that escapes the label", () => {
    const match = targetMatch(sampleCV, sampleCV, "");
    const html = buildGapReportHtml({ label: "<script>", match, baseScore: 10, rankedSkills: [], rankedSections: [] });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
