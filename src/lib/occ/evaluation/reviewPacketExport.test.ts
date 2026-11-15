import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeBlindInterviewReviewPacket } from "./reviewerPacket";

/** Export only synthetic, candidate-visible cases for genuine independent reviewers.
 * Never include ground-truth expectations or actual private candidate records.
 * Files are written ONLY when explicitly requested with OCC_REVIEW_EXPORT_DIR.
 */
const PILOT_FAMILIES = new Set(["medicine", "nursing", "law", "agriculture"]);
const HEADERS = [
  "caseId", "profession", "question", "candidateAnswer", "suggestedWording",
  "clarity", "recognizability", "meaningPreserved", "fabricatedClaim", "notes",
] as const;
const encodeCsv = (value: unknown): string => {
  const string = value == null ? "" : String(value);
  // Quote every field to preserve punctuation/newlines and prevent spreadsheet
  // formula execution when a synthetic fixture is opened in a spreadsheet app.
  const escaped = /^[=+@\-\t\r]/.test(string) ? "'" + string : string;
  return '"' + escaped.replace(/"/g, '""') + '"';
};
const renderCsv = (packet: ReturnType<typeof makeBlindInterviewReviewPacket>) =>
  [HEADERS.join(","), ...packet.map(item => HEADERS.map(key => encodeCsv(item[key])).join(","))].join("\n") + "\n";

describe("OCC #241 real reviewer handoff (synthetic-only)", () => {
  it("builds an initial high-priority pilot plus complete independent scoring packets", () => {
    const packet = makeBlindInterviewReviewPacket();
    const pilot = packet.filter(item => PILOT_FAMILIES.has(item.profession));
    expect(packet).toHaveLength(42);
    expect(pilot.length).toBeGreaterThanOrEqual(8);
    expect(new Set(pilot.map(item => item.profession))).toEqual(PILOT_FAMILIES);
    for (const item of packet) {
      expect(Object.keys(item).sort()).toEqual([...HEADERS].sort());
      expect(item.clarity).toBeNull();
      expect(item.recognizability).toBeNull();
      expect(item.meaningPreserved).toBeNull();
      expect(item.fabricatedClaim).toBeNull();
    }
    const file = renderCsv(pilot);
    expect(file).toContain("caseId,profession,question,candidateAnswer,suggestedWording");
    expect(file).not.toContain("expected");
    expect(file).not.toContain("risk");
    const requestedDir = process.env.OCC_REVIEW_EXPORT_DIR;
    if (requestedDir) {
      const dir = resolve(requestedDir);
      mkdirSync(dir, { recursive: true });
      // Reviewer A and B get independent blank copies; no scores are prefilled.
      for (const [name, selected] of [
        ["pilot-reviewer-a.csv", pilot],
        ["pilot-reviewer-b.csv", pilot],
        ["full-reviewer-a.csv", packet],
        ["full-reviewer-b.csv", packet],
      ] as const) {
        writeFileSync(resolve(dir, name), renderCsv(selected), { encoding: "utf8", flag: "w" });
      }
      console.info("[OCC #241] Exported blank, synthetic-only reviewer files to", dir);
    }
  });
});
