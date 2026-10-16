import { describe, it, expect } from "vitest";
import { diffCv, applyReviewed } from "@/lib/ai/cvDiff";
import type { CVData } from "@/lib/cv/schema";

function base(): CVData {
  return {
    basics: { fullName: "Ada", title: "Engineer", email: "", phone: "", location: "", summary: "Old summary.", links: [] },
    experience: [
      { id: "e0", company: "Acme", role: "Dev", highlights: ["Did a thing."] },
      { id: "e1", company: "Globex", role: "Lead", highlights: ["Led a team."] },
    ],
    education: [],
    skills: [{ id: "s0", category: "Languages", items: ["TypeScript"] }],
    projects: [{ id: "p0", name: "Orire", highlights: ["Built it."] }],
    certifications: [],
    order: ["summary", "experience", "education", "skills", "projects", "certifications"],
  };
}

function refined(): CVData {
  const cv = base();
  cv.basics.title = "Senior Engineer";
  cv.basics.summary = "Tailored summary.";
  cv.experience[0].highlights = ["Shipped a thing that moved a metric."];
  // experience[1] unchanged
  cv.projects[0].highlights = ["Built and launched it."];
  cv.skills = [{ id: "s9", category: "Languages", items: ["TypeScript", "Go"] }];
  return cv;
}

describe("diffCv", () => {
  it("surfaces exactly the changed pieces, by stable id", () => {
    const ids = diffCv(base(), refined()).map((c) => c.id).sort();
    expect(ids).toEqual(["exp:0", "prj:0", "skills", "summary", "title"].sort());
  });

  it("ignores unchanged experiences", () => {
    const changes = diffCv(base(), refined());
    expect(changes.find((c) => c.id === "exp:1")).toBeUndefined();
  });

  it("returns no changes for identical CVs", () => {
    expect(diffCv(base(), base())).toEqual([]);
  });
});

describe("applyReviewed", () => {
  it("accepting everything == the full refined CV", () => {
    const out = applyReviewed(base(), refined(), []);
    expect(out.basics.summary).toBe("Tailored summary.");
    expect(out.basics.title).toBe("Senior Engineer");
    expect(out.experience[0].highlights).toEqual(["Shipped a thing that moved a metric."]);
    expect(out.skills[0].items).toEqual(["TypeScript", "Go"]);
  });

  it("rejecting a change restores just that piece", () => {
    const out = applyReviewed(base(), refined(), ["summary", "exp:0"]);
    expect(out.basics.summary).toBe("Old summary."); // reverted
    expect(out.basics.title).toBe("Senior Engineer"); // still accepted
    expect(out.experience[0].highlights).toEqual(["Did a thing."]); // reverted
    expect(out.projects[0].highlights).toEqual(["Built and launched it."]); // still accepted
  });

  it("does not mutate the inputs", () => {
    const b = base();
    const a = refined();
    applyReviewed(b, a, ["skills"]);
    expect(a.skills[0].items).toEqual(["TypeScript", "Go"]); // after untouched
    expect(b.skills[0].items).toEqual(["TypeScript"]); // before untouched
  });
});
