import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeBlindInterviewReviewPacket } from "./reviewerPacket";

/** Export synthetic candidate-visible cases only. Human assessments are NEVER generated. */
const PILOT_FAMILIES = new Set(["medicine", "nursing", "law", "agriculture"]);
const HEADERS = [
  "caseId", "profession", "question", "candidateAnswer", "suggestedWording",
  "clarity", "recognizability", "meaningPreserved", "fabricatedClaim", "notes",
] as const;
type Packet = ReturnType<typeof makeBlindInterviewReviewPacket>;
const encodeCsv = (value: unknown): string => {
  const string = value == null ? "" : String(value);
  const escaped = /^[=+@\-\t\r]/.test(string) ? "'" + string : string;
  return '"' + escaped.replace(/"/g, '""') + '"';
};
const renderCsv = (packet: Packet) =>
  [HEADERS.join(","), ...packet.map(item => HEADERS.map(key => encodeCsv(item[key])).join(","))].join("\n") + "\n";

/** Generate opaque, independent identifiers for one export batch.
 * Keep the mapping OUTSIDE source control and never share it with reviewers.
 * A/B reviewer packets MUST use the same map so completed reviews can reconcile.
 */
function blindIdentifiers(packet: Packet) {
  const mapping: Record<string, string> = {};
  const blinded = packet.map(item => {
    const neutralId = "R-" + randomUUID();
    mapping[neutralId] = item.caseId;
    return { ...item, caseId: neutralId };
  });
  if (new Set(blinded.map(item => item.caseId)).size !== packet.length) {
    throw new Error("Reviewer IDs must be unique");
  }
  return { blinded, mapping };
}

describe("OCC #241 independent reviewer pilot exports (synthetic only)", () => {
  it("exports opaque IDs while preserving a local-only, lossless mapping", () => {
    const source = makeBlindInterviewReviewPacket();
    const { blinded, mapping } = blindIdentifiers(source);
    const pilot = blinded.filter(item => PILOT_FAMILIES.has(item.profession));
    expect(source).toHaveLength(42);
    expect(pilot).toHaveLength(9);
    expect(new Set(pilot.map(item => item.profession))).toEqual(PILOT_FAMILIES);
    expect(Object.keys(mapping)).toHaveLength(source.length);
    expect(blinded.map(item => mapping[item.caseId])).toEqual(source.map(item => item.caseId));
    expect(new Set(blinded.map(item => item.caseId)).size).toBe(42);
    for (const item of blinded) {
      expect(Object.keys(item).sort()).toEqual([...HEADERS].sort());
      expect(item.caseId).toMatch(/^R-[0-9a-f-]{36}$/);
      expect(item.clarity).toBeNull();
      expect(item.recognizability).toBeNull();
      expect(item.meaningPreserved).toBeNull();
      expect(item.fabricatedClaim).toBeNull();
    }
    const pilotCsv = renderCsv(pilot);
    const fullCsv = renderCsv(blinded);
    expect(pilotCsv).toContain("caseId,profession,question,candidateAnswer,suggestedWording");
    expect(pilotCsv.split("\n", 1)[0].split(",")).toEqual([...HEADERS]);
    for (const item of source) {
      expect(pilotCsv).not.toContain(item.caseId);
      expect(fullCsv).not.toContain(item.caseId);
    }
    expect(pilotCsv).not.toContain("nursing-risk");
    expect(pilotCsv).not.toContain("medicine-safe");
    const requestedDir = process.env.OCC_REVIEW_EXPORT_DIR;
    if (requestedDir) {
      const dir = resolve(requestedDir);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      // A new directory is recommended per batch. Fail on collisions to avoid
      // losing the exact mapping required to restore original fixture IDs.
      const files = [
        ["pilot-reviewer-a.csv", pilotCsv],
        ["pilot-reviewer-b.csv", pilotCsv],
        ["full-reviewer-a.csv", fullCsv],
        ["full-reviewer-b.csv", fullCsv],
        ["reviewer-id-map.json", JSON.stringify({
          benchmarkVersion: "v1",
          createdAt: new Date().toISOString(),
          mapping,
        }, null, 2) + "\n"],
      ] as const;
      for (const [filename, content] of files) {
        writeFileSync(resolve(dir, filename), content, {
          encoding: "utf8", flag: "wx", mode: 0o600,
        });
      }
      console.info("[OCC #241] Blinded reviewer packets and PRIVATE ID mapping exported to", dir);
    }
  });
});
