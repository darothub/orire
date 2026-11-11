import { sampleCV } from "@/lib/cv/sample";
import type { CVData } from "@/lib/cv/schema";

/** Neutral example identity used on the public landing page. */
export const landingCV: CVData = {
  ...sampleCV,
  basics: {
    ...sampleCV.basics,
    fullName: "Lola Lee",
    email: "lola.lee@example.com",
    links: [
      { id: "lnk_site", label: "Portfolio", url: "lola-lee.design" },
      { id: "lnk_li", label: "LinkedIn", url: "linkedin.com/in/lola-lee" },
    ],
  },
};
