import { describe, expect, it } from "vitest";
import { sampleCV } from "./sample";
import { publicSampleCV } from "./publicSample";

describe("public export example", () => {
  it("uses reserved destinations for every public contact and project link", () => {
    const urls = [
      ...publicSampleCV.basics.links.map((link) => link.url),
      ...publicSampleCV.projects.map((project) => project.url),
      ...publicSampleCV.certifications.map((certification) => certification.url),
    ].filter((url): url is string => Boolean(url));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(new URL(url).hostname).toBe("example.com");
    expect(publicSampleCV.basics.email).toMatch(/@example\.com$/);
  });

  it("preserves the fictional CV facts without replacing the Studio seed's links", () => {
    expect(publicSampleCV.basics.fullName).toBe(sampleCV.basics.fullName);
    expect(publicSampleCV.experience).toEqual(sampleCV.experience);
    expect(publicSampleCV.basics.links).not.toBe(sampleCV.basics.links);
    expect(publicSampleCV.projects).not.toBe(sampleCV.projects);
    expect(sampleCV.basics.links[0].url).toBe("adaok.design");
    expect(sampleCV.projects[0].url).toBe("github.com/adaok/ob-kit");
  });
});
