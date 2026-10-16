import { describe, it, expect } from "vitest";
import { Packer } from "docx";
import { buildCvDocx } from "@/lib/export/docx";
import { sampleCV } from "@/lib/cv/sample";
import type { CVData } from "@/lib/cv/schema";

describe("buildCvDocx", () => {
  it("packs the sample CV into a valid .docx (zip) buffer", async () => {
    const buf = await Packer.toBuffer(buildCvDocx(sampleCV));
    expect(buf.length).toBeGreaterThan(1000);
    // .docx is a zip — must start with the PK\x03\x04 local-file-header magic.
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it("handles an empty CV without throwing", async () => {
    const empty: CVData = {
      basics: { fullName: "", title: "", email: "", phone: "", location: "", summary: "", links: [] },
      experience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: [],
      order: ["summary", "experience", "education", "skills", "projects", "certifications"],
    };
    const buf = await Packer.toBuffer(buildCvDocx(empty));
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});
