import { describe, it, expect } from "vitest";
import { removableSkills } from "./skillCategory";

const g = (category: string, items: string[]) => ({ id: category, category, items });
const ideal = [{ category: "Backend", items: ["Java", "Spring Boot", "PostgreSQL"] }];

describe("removableSkills", () => {
  it("flags skills the ideal and JD don't mention", () => {
    const out = removableSkills([g("Skills", ["Java", "Photoshop", "spring boot"])], ideal, "Java role");
    expect(out).toEqual(["Photoshop"]);
  });
  it("keeps skills named in the JD", () => {
    expect(removableSkills([g("Skills", ["Kafka"])], ideal, "We use Kafka daily")).toEqual([]);
  });
  it("never flags languages or interests", () => {
    expect(removableSkills([g("Languages", ["French"]), g("Interests", ["Chess"])], ideal, "x")).toEqual([]);
  });
  it("is silent with no target", () => {
    expect(removableSkills([g("Skills", ["Photoshop"])], [], "")).toEqual([]);
  });
});
