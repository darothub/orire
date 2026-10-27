import { sampleCV } from "./sample";
import type { CVData } from "./schema";

/** Public examples use reserved destinations, never plausible personal profiles. */
export const publicSampleCV: CVData = {
  ...sampleCV,
  basics: {
    ...sampleCV.basics,
    links: [
      { id: "sample_portfolio", label: "Portfolio", url: "https://example.com/ada" },
      { id: "sample_profile", label: "Profile", url: "https://example.com/ada-profile" },
    ],
  },
  projects: sampleCV.projects.map((project, index) => ({
    ...project,
    url: `https://example.com/projects/${index + 1}`,
  })),
  certifications: sampleCV.certifications.map((certification) => ({
    ...certification,
    url: "",
  })),
};

export const PUBLIC_PDF_SAMPLE_URL = "/samples/orire-fictional-aurora-cv.pdf";
