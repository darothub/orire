/**
 * orire — landing "AI studio" hero demo data.
 *
 * Fictional, illustrative role tailoring examples. The match figures are
 * demo values, not measurements, and the UI labels them as such.
 */

export interface AiStudioRole {
  id: string;
  label: string;
  /** Short job-description snippet the AI "reads". */
  jd: string;
  before: string;
  after: string;
  keywords: string[];
  /** Illustrative role-match percentage, 0-100. */
  match: number;
}

const ROLES: AiStudioRole[] = [
  {
    id: "product-designer",
    label: "Product designer",
    jd: "Own end-to-end flows for a fintech app, partnering with research and engineering.",
    before: "Helped the design team with various projects.",
    after: "Designed end-to-end onboarding and checkout flows with research and engineering, and prepared developer-ready handoffs.",
    keywords: ["end-to-end flows", "research", "handoff"],
    match: 86,
  },
  {
    id: "marketing-lead",
    label: "Marketing lead",
    jd: "Plan multi-channel campaigns and report on engagement to leadership.",
    before: "Responsible for managing the company's social media.",
    after: "Planned multi-channel campaigns, reviewed engagement trends, and summarised results for leadership.",
    keywords: ["campaigns", "engagement", "reporting"],
    match: 81,
  },
  {
    id: "support-specialist",
    label: "Support specialist",
    jd: "Resolve customer issues and feed recurring problems back to the product team.",
    before: "Did customer support and answered tickets.",
    after: "Resolved customer requests, documented recurring issues, and shared findings with the product team.",
    keywords: ["resolution", "documentation", "product feedback"],
    match: 78,
  },
];

export function aiStudioRoles(): AiStudioRole[] {
  return ROLES.map((r) => ({ ...r, keywords: [...r.keywords] }));
}
