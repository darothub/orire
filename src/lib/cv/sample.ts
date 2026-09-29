import type { CVData } from "./schema";

/** Realistic seed data so the editor + preview feel alive on first load. */
export const sampleCV: CVData = {
  basics: {
    fullName: "Ada Okonkwo",
    title: "Senior Product Designer",
    email: "ada.okonkwo@example.com",
    phone: "+44 20 7946 0958",
    location: "London, UK",
    summary:
      "Product designer with 8+ years shaping data-dense fintech and healthcare products. I turn ambiguous problems into calm, usable systems — pairing rigorous research with a strong craft bar. Comfortable leading end-to-end from discovery to shipped, measured outcomes.",
    links: [
      { id: "lnk_site", label: "Portfolio", url: "adaok.design" },
      { id: "lnk_li", label: "LinkedIn", url: "linkedin.com/in/adaok" },
    ],
  },
  experience: [
    {
      id: "exp_1",
      company: "Monzo",
      role: "Senior Product Designer",
      location: "London",
      startDate: "2021",
      endDate: "",
      current: true,
      highlights: [
        "Led the redesign of the shared-tabs experience, lifting weekly active use of the feature by 34%.",
        "Built and documented the accessibility patterns now used across three squads.",
        "Mentored two mid-level designers, both promoted within the year.",
      ],
    },
    {
      id: "exp_2",
      company: "Babylon Health",
      role: "Product Designer",
      location: "London",
      startDate: "2018",
      endDate: "2021",
      current: false,
      highlights: [
        "Owned the triage flow used by 1.2M patients, reducing drop-off at symptom entry by 21%.",
        "Ran a fortnightly research cadence that fed a prioritised, evidence-backed backlog.",
      ],
    },
  ],
  education: [
    {
      id: "edu_1",
      institution: "University College London",
      degree: "BSc",
      field: "Human Sciences",
      startDate: "2011",
      endDate: "2014",
      details: "First-class honours. Dissertation on decision-making under uncertainty.",
    },
  ],
  skills: [
    {
      id: "skl_1",
      category: "Design",
      items: ["Product strategy", "Interaction design", "Prototyping", "Design systems"],
    },
    {
      id: "skl_2",
      category: "Research",
      items: ["Usability testing", "Interviews", "Survey design"],
    },
    {
      id: "skl_3",
      category: "Tools",
      items: ["Figma", "Framer", "Maze", "Dovetail"],
    },
  ],
  projects: [
    {
      id: "prj_1",
      name: "Open Banking Design Kit",
      role: "Creator & maintainer",
      url: "github.com/adaok/ob-kit",
      startDate: "2022",
      endDate: "",
      highlights: [
        "Published an accessible component library adopted by 4 fintech teams.",
        "Documented usage patterns with live, testable examples.",
      ],
    },
    {
      id: "prj_2",
      name: "Calm Money — concept app",
      role: "Design & research",
      url: "adaok.design/calm-money",
      startDate: "2021",
      endDate: "2022",
      highlights: [
        "Explored anxiety-reducing spending flows validated with 30 users.",
      ],
    },
  ],
  certifications: [
    {
      id: "crt_1",
      name: "Certified Professional in Accessibility Core Competencies (CPACC)",
      issuer: "IAAP",
      date: "2023",
      url: "",
    },
    {
      id: "crt_2",
      name: "NN/g UX Certification",
      issuer: "Nielsen Norman Group",
      date: "2020",
      url: "",
    },
  ],
  order: ["summary", "experience", "projects", "education", "skills", "certifications"],
};
