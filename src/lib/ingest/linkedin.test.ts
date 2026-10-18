import { describe, expect, it } from "vitest";
import { parseLinkedInZip } from "./linkedin";
import JSZip from "jszip";

describe("parseLinkedInZip", () => {
  it("reads a minimal LinkedIn export zip and maps profile + experience", async () => {
    const zip = new JSZip();
    zip.file("Profile.csv", "First Name,Last Name,Headline,Email Address\nJoao,Oliveira,Senior Engineer,joao@example.com\n");
    zip.file(
      "Experience.csv",
      "Title,Company Name,Description,Started On,Finished On\nSenior Engineer,Acme,Led the onboarding redesign,2021-01-01,2024-01-01\n"
    );
    const parsed = await parseLinkedInZip(await zip.generateAsync({ type: "arraybuffer" }));
    expect(parsed).not.toBeNull();
    expect(parsed?.basics.fullName).toBe("Joao Oliveira");
    expect(parsed?.experience[0]?.company).toBe("Acme");
    expect(parsed?.experience[0]?.role).toBe("Senior Engineer");
  });
});
