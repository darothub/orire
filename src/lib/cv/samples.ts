import type { CVData } from "./schema";
import { sampleCV } from "./sample";

/**
 * A spread of believable CVs across continents, names and professions — used to
 * animate the auth showcase and anywhere we want the product to feel lived-in
 * rather than tailored to a single "Senior Product Designer" persona.
 *
 * `sampleCV` (Ada Okonkwo, London) stays the canonical editor seed; these are
 * additional personas layered on top for variety.
 */

const hiroshi: CVData = {
  basics: {
    fullName: "Hiroshi Tanaka",
    title: "Staff Software Engineer",
    email: "hiroshi.tanaka@example.com",
    phone: "+81 3 5511 0200",
    location: "Tokyo, Japan",
    summary:
      "Backend-leaning engineer with 11 years building high-throughput payment and logistics platforms. I care about clear interfaces, measured latency and systems that stay calm under load.",
    links: [
      { id: "ht_gh", label: "GitHub", url: "github.com/htanaka" },
      { id: "ht_li", label: "LinkedIn", url: "linkedin.com/in/htanaka" },
    ],
  },
  experience: [
    {
      id: "ht_e1",
      company: "Mercari",
      role: "Staff Software Engineer",
      location: "Tokyo",
      startDate: "2020",
      endDate: "",
      current: true,
      highlights: [
        "Led a re-architecture of the settlement pipeline, cutting end-to-end latency from 900ms to 120ms.",
        "Introduced load-shedding and backpressure that held p99 flat through a 6x traffic spike.",
        "Mentored five engineers; established the service's on-call and incident-review practice.",
      ],
    },
    {
      id: "ht_e2",
      company: "Rakuten",
      role: "Senior Software Engineer",
      location: "Tokyo",
      startDate: "2016",
      endDate: "2020",
      current: false,
      highlights: [
        "Built the idempotent order-fulfilment service handling 2M events/day.",
        "Migrated a monolith module to Go, halving infra cost for that workload.",
      ],
    },
  ],
  education: [
    {
      id: "ht_ed1",
      institution: "University of Tokyo",
      degree: "BEng",
      field: "Information Science",
      startDate: "2009",
      endDate: "2013",
      details: "",
    },
  ],
  skills: [
    { id: "ht_s1", category: "Languages", items: ["Go", "Java", "TypeScript", "SQL"] },
    { id: "ht_s2", category: "Systems", items: ["Kafka", "gRPC", "PostgreSQL", "Kubernetes"] },
  ],
  projects: [
    {
      id: "ht_p1",
      name: "ratelimit-go",
      role: "Author",
      url: "github.com/htanaka/ratelimit-go",
      startDate: "2021",
      endDate: "",
      highlights: ["Open-source token-bucket limiter used in several production services."],
    },
  ],
  certifications: [
    { id: "ht_c1", name: "Certified Kubernetes Administrator", issuer: "CNCF", date: "2022", url: "" },
  ],
  order: ["summary", "experience", "skills", "projects", "education", "certifications"],
};

const sofia: CVData = {
  basics: {
    fullName: "Sofía Herrera",
    title: "Data Scientist",
    email: "sofia.herrera@example.com",
    phone: "+52 55 4160 3000",
    location: "Mexico City, Mexico",
    summary:
      "Data scientist with 6 years turning messy operational data into decisions. I pair rigorous experimentation with clear storytelling so non-technical teams can act with confidence.",
    links: [
      { id: "sh_site", label: "Portfolio", url: "sofiaherrera.io" },
      { id: "sh_li", label: "LinkedIn", url: "linkedin.com/in/sofiaherrera" },
    ],
  },
  experience: [
    {
      id: "sh_e1",
      company: "Kavak",
      role: "Senior Data Scientist",
      location: "Mexico City",
      startDate: "2021",
      endDate: "",
      current: true,
      highlights: [
        "Built the pricing model for used-car inventory, improving margin accuracy by 18%.",
        "Shipped an uplift model that raised lead-to-sale conversion by 9%.",
        "Set up the team's experimentation framework and metric review.",
      ],
    },
    {
      id: "sh_e2",
      company: "Clip",
      role: "Data Analyst",
      location: "Mexico City",
      startDate: "2018",
      endDate: "2021",
      current: false,
      highlights: [
        "Modelled merchant churn, informing a retention programme that recovered 12% of at-risk accounts.",
      ],
    },
  ],
  education: [
    {
      id: "sh_ed1",
      institution: "UNAM",
      degree: "BSc",
      field: "Applied Mathematics",
      startDate: "2013",
      endDate: "2017",
      details: "",
    },
  ],
  skills: [
    { id: "sh_s1", category: "Modelling", items: ["Regression", "Causal inference", "Forecasting", "A/B testing"] },
    { id: "sh_s2", category: "Tools", items: ["Python", "SQL", "dbt", "scikit-learn"] },
  ],
  projects: [],
  certifications: [
    { id: "sh_c1", name: "Professional Data Engineer", issuer: "Google Cloud", date: "2022", url: "" },
  ],
  order: ["summary", "experience", "skills", "education", "certifications", "projects"],
};

const priya: CVData = {
  basics: {
    fullName: "Priya Nair",
    title: "Product Manager",
    email: "priya.nair@example.com",
    phone: "+91 80 4710 2200",
    location: "Bengaluru, India",
    summary:
      "Product manager with 7 years across consumer fintech and B2B SaaS. I find the smallest change that unlocks the biggest outcome, and I keep teams honest about what the data actually says.",
    links: [
      { id: "pn_li", label: "LinkedIn", url: "linkedin.com/in/priyanair" },
      { id: "pn_site", label: "Writing", url: "priyanair.substack.com" },
    ],
  },
  experience: [
    {
      id: "pn_e1",
      company: "Razorpay",
      role: "Senior Product Manager",
      location: "Bengaluru",
      startDate: "2021",
      endDate: "",
      current: true,
      highlights: [
        "Launched a smart-routing layer that lifted payment success rates by 4.2 points.",
        "Grew the subscriptions product from pilot to ₹40Cr annualised volume in a year.",
        "Ran discovery with 40+ merchants to reshape the onboarding flow.",
      ],
    },
    {
      id: "pn_e2",
      company: "Freshworks",
      role: "Product Manager",
      location: "Chennai",
      startDate: "2017",
      endDate: "2021",
      current: false,
      highlights: [
        "Owned the reporting module, doubling weekly active usage through a rebuilt query UX.",
      ],
    },
  ],
  education: [
    {
      id: "pn_ed1",
      institution: "BITS Pilani",
      degree: "BE",
      field: "Computer Science",
      startDate: "2010",
      endDate: "2014",
      details: "",
    },
  ],
  skills: [
    { id: "pn_s1", category: "Product", items: ["Discovery", "Roadmapping", "Experimentation", "Pricing"] },
    { id: "pn_s2", category: "Craft", items: ["SQL", "Figma", "Amplitude", "Notion"] },
  ],
  projects: [],
  certifications: [],
  order: ["summary", "experience", "skills", "education", "projects", "certifications"],
};

const noah: CVData = {
  basics: {
    fullName: "Noah Williams",
    title: "DevOps Engineer",
    email: "noah.williams@example.com",
    phone: "+61 2 8015 4400",
    location: "Sydney, Australia",
    summary:
      "Platform and reliability engineer with 8 years keeping fleets healthy. I automate the boring parts, make deploys boring too, and give developers fast, safe paths to production.",
    links: [
      { id: "nw_gh", label: "GitHub", url: "github.com/noahw" },
      { id: "nw_li", label: "LinkedIn", url: "linkedin.com/in/noahw" },
    ],
  },
  experience: [
    {
      id: "nw_e1",
      company: "Atlassian",
      role: "Senior DevOps Engineer",
      location: "Sydney",
      startDate: "2020",
      endDate: "",
      current: true,
      highlights: [
        "Cut mean deploy time from 28 to 6 minutes by rebuilding the CI pipeline.",
        "Introduced progressive delivery, reducing change-failure rate by a third.",
        "Owned the Terraform modules used by 20+ service teams.",
      ],
    },
    {
      id: "nw_e2",
      company: "Canva",
      role: "Site Reliability Engineer",
      location: "Sydney",
      startDate: "2016",
      endDate: "2020",
      current: false,
      highlights: [
        "Built autoscaling and alerting that held uptime at 99.98% through rapid growth.",
      ],
    },
  ],
  education: [
    {
      id: "nw_ed1",
      institution: "University of New South Wales",
      degree: "BSc",
      field: "Computer Science",
      startDate: "2011",
      endDate: "2015",
      details: "",
    },
  ],
  skills: [
    { id: "nw_s1", category: "Platform", items: ["AWS", "Terraform", "Kubernetes", "Datadog"] },
    { id: "nw_s2", category: "Automation", items: ["Go", "Python", "GitHub Actions", "ArgoCD"] },
  ],
  projects: [],
  certifications: [
    { id: "nw_c1", name: "AWS Solutions Architect – Professional", issuer: "Amazon Web Services", date: "2021", url: "" },
  ],
  order: ["summary", "experience", "skills", "education", "certifications", "projects"],
};

const fatima: CVData = {
  basics: {
    fullName: "Fatima Al-Mansouri",
    title: "UX Researcher",
    email: "fatima.almansouri@example.com",
    phone: "+971 4 390 5500",
    location: "Dubai, United Arab Emirates",
    summary:
      "Mixed-methods researcher with 6 years making complex products legible. I turn interviews and behavioural data into decisions teams trust, across Arabic and English audiences.",
    links: [
      { id: "fa_site", label: "Portfolio", url: "fatima.ux" },
      { id: "fa_li", label: "LinkedIn", url: "linkedin.com/in/fatimaalmansouri" },
    ],
  },
  experience: [
    {
      id: "fa_e1",
      company: "Careem",
      role: "Senior UX Researcher",
      location: "Dubai",
      startDate: "2021",
      endDate: "",
      current: true,
      highlights: [
        "Led the research that reshaped the rider app's booking flow, lifting completion by 15%.",
        "Built a reusable usability-benchmark that the whole product org now runs quarterly.",
        "Ran bilingual studies across six markets in the region.",
      ],
    },
    {
      id: "fa_e2",
      company: "noon",
      role: "UX Researcher",
      location: "Dubai",
      startDate: "2018",
      endDate: "2021",
      current: false,
      highlights: [
        "Mapped the returns journey end to end, informing a redesign that cut support tickets by 22%.",
      ],
    },
  ],
  education: [
    {
      id: "fa_ed1",
      institution: "American University of Sharjah",
      degree: "BA",
      field: "Psychology",
      startDate: "2011",
      endDate: "2015",
      details: "",
    },
  ],
  skills: [
    { id: "fa_s1", category: "Research", items: ["Interviews", "Usability testing", "Surveys", "Diary studies"] },
    { id: "fa_s2", category: "Analysis", items: ["Thematic analysis", "Dovetail", "Maze", "SQL"] },
  ],
  projects: [],
  certifications: [],
  order: ["summary", "experience", "skills", "education", "projects", "certifications"],
};

const lucas: CVData = {
  basics: {
    fullName: "Lucas Almeida",
    title: "Growth Marketing Lead",
    email: "lucas.almeida@example.com",
    phone: "+55 11 3522 7000",
    location: "São Paulo, Brazil",
    summary:
      "Growth marketer with 9 years scaling consumer brands through disciplined experimentation. I connect creative, data and lifecycle so acquisition and retention compound.",
    links: [
      { id: "la_site", label: "Site", url: "lucasalmeida.co" },
      { id: "la_li", label: "LinkedIn", url: "linkedin.com/in/lucasalmeida" },
    ],
  },
  experience: [
    {
      id: "la_e1",
      company: "Nubank",
      role: "Growth Marketing Lead",
      location: "São Paulo",
      startDate: "2020",
      endDate: "",
      current: true,
      highlights: [
        "Scaled a referral programme to 1.4M activations with a 30% lower CAC than paid.",
        "Built the lifecycle messaging system that lifted 90-day retention by 11 points.",
        "Led a team of eight across performance, lifecycle and creative.",
      ],
    },
    {
      id: "la_e2",
      company: "iFood",
      role: "Performance Marketing Manager",
      location: "São Paulo",
      startDate: "2016",
      endDate: "2020",
      current: false,
      highlights: [
        "Ran a 50-market paid-acquisition engine, improving blended ROAS by 24%.",
      ],
    },
  ],
  education: [
    {
      id: "la_ed1",
      institution: "USP – University of São Paulo",
      degree: "BBA",
      field: "Marketing",
      startDate: "2008",
      endDate: "2012",
      details: "",
    },
  ],
  skills: [
    { id: "la_s1", category: "Growth", items: ["Experimentation", "Lifecycle", "Paid acquisition", "Attribution"] },
    { id: "la_s2", category: "Tools", items: ["GA4", "Braze", "SQL", "Looker"] },
  ],
  projects: [],
  certifications: [],
  order: ["summary", "experience", "skills", "education", "projects", "certifications"],
};

const mei: CVData = {
  basics: {
    fullName: "Mei Lin",
    title: "Frontend Engineer",
    email: "mei.lin@example.com",
    phone: "+65 6908 1100",
    location: "Singapore",
    summary:
      "Frontend engineer with 7 years crafting fast, accessible interfaces. I obsess over perceived performance and the small interactions that make a product feel considered.",
    links: [
      { id: "ml_gh", label: "GitHub", url: "github.com/meilin" },
      { id: "ml_site", label: "Portfolio", url: "meilin.dev" },
    ],
  },
  experience: [
    {
      id: "ml_e1",
      company: "Grab",
      role: "Senior Frontend Engineer",
      location: "Singapore",
      startDate: "2021",
      endDate: "",
      current: true,
      highlights: [
        "Rebuilt the merchant dashboard, improving Largest Contentful Paint from 4.1s to 1.3s.",
        "Led adoption of a typed design-system library across eight product teams.",
        "Drove accessibility to WCAG 2.1 AA across the core flows.",
      ],
    },
    {
      id: "ml_e2",
      company: "Shopee",
      role: "Frontend Engineer",
      location: "Singapore",
      startDate: "2017",
      endDate: "2021",
      current: false,
      highlights: [
        "Built the checkout UI handling peak-sale traffic with zero client-side regressions.",
      ],
    },
  ],
  education: [
    {
      id: "ml_ed1",
      institution: "National University of Singapore",
      degree: "BComp",
      field: "Computer Science",
      startDate: "2010",
      endDate: "2014",
      details: "",
    },
  ],
  skills: [
    { id: "ml_s1", category: "Frontend", items: ["TypeScript", "React", "Next.js", "CSS architecture"] },
    { id: "ml_s2", category: "Quality", items: ["Testing Library", "Playwright", "Web performance", "a11y"] },
  ],
  projects: [
    {
      id: "ml_p1",
      name: "useviewport",
      role: "Author",
      url: "github.com/meilin/useviewport",
      startDate: "2022",
      endDate: "",
      highlights: ["A tiny, well-tested React hook for viewport-aware rendering."],
    },
  ],
  certifications: [],
  order: ["summary", "experience", "skills", "projects", "education", "certifications"],
};

/** Ada (the canonical seed) first, then a spread of personas for showcases. */
export const sampleVariants: CVData[] = [
  sampleCV,
  hiroshi,
  sofia,
  priya,
  noah,
  fatima,
  lucas,
  mei,
];
