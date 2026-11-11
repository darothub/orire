import { describe, expect, it } from "vitest";
import { groupSuggestions, placeSkill } from "@/lib/cv/skillCategory";

const g = (id: string, category: string, items: string[]) => ({ id, category, items });
const source = [
  { category: "Cloud & DevOps", items: ["Docker", "Terraform", "Kubernetes"] },
  { category: "Languages", items: ["Kotlin", "TypeScript"] },
];

describe("placeSkill", () => {
  it("joins the CV group that already holds the skill's neighbours", () => {
    const groups = [g("a", "Infrastructure", ["Docker"]), g("b", "Code", ["TypeScript"])];
    expect(placeSkill(groups, source, "Terraform")).toEqual({ groupId: "a", category: "Infrastructure" });
    expect(placeSkill(groups, source, "Kotlin")).toEqual({ groupId: "b", category: "Code" });
  });
  it("falls back to a group with a matching name", () => {
    const groups = [g("a", "Languages", ["Go"])];
    expect(placeSkill(groups, source, "Kotlin")).toEqual({ groupId: "a", category: "Languages" });
  });
  it("asks to create the category when the CV has none, including after deletion", () => {
    expect(placeSkill([], source, "Terraform")).toEqual({ groupId: null, category: "Cloud & DevOps" });
    expect(placeSkill([g("a", "Design", ["Figma"])], source, "Kotlin")).toEqual({ groupId: null, category: "Languages" });
  });
  it("is null for a skill with no known category", () => {
    expect(placeSkill([], source, "Rust")).toBeNull();
  });
});

describe("groupSuggestions", () => {
  it("groups by destination and flags new categories", () => {
    const groups = [g("a", "Infrastructure", ["Docker"])];
    const out = groupSuggestions(groups, source, ["Terraform", "Kubernetes", "Kotlin", "Rust"]);
    expect(out).toEqual([
      { key: "a", category: "Infrastructure", isNew: false, skills: ["Terraform", "Kubernetes"] },
      { key: "new:languages", category: "Languages", isNew: true, skills: ["Kotlin"] },
      { key: "other", category: "Other", isNew: false, skills: ["Rust"] },
    ]);
  });
});
