import { INTERVIEW_BENCHMARK_V1, type EvaluationCase } from "./fixtures";
import { summarizeHumanReviews, type HumanReview } from "./benchmark";

/** Explicit evaluation taxonomy, not a classifier or authorization policy.
 * "Synthetic" means engineering regression coverage only, not verified safety.
 */
export type OccupationalFamily = {
  id: string;
  label: string;
  reviewPriority: "elevated" | "standard";
  domainRisk: string;
};
export const OCCUPATIONAL_FAMILIES: readonly OccupationalFamily[] = [
  { id: "nursing", label: "Nursing", reviewPriority: "elevated", domainRisk: "Clinical scope and medication responsibilities" },
  { id: "medicine", label: "Medicine", reviewPriority: "elevated", domainRisk: "Diagnosis, treatment authority and medical credentials" },
  { id: "law", label: "Law", reviewPriority: "elevated", domainRisk: "Licensure, legal representation and case outcomes" },
  { id: "agriculture", label: "Agriculture", reviewPriority: "elevated", domainRisk: "Pesticide handling, yields and farming certification" },
  { id: "construction", label: "Construction", reviewPriority: "elevated", domainRisk: "Site safety sign-off and professional qualifications" },
  { id: "manufacturing", label: "Manufacturing", reviewPriority: "elevated", domainRisk: "Quality sign-off and machinery operations" },
  { id: "social-care", label: "Social care", reviewPriority: "elevated", domainRisk: "Care duties, safeguarding and qualifications" },
  { id: "transport", label: "Transportation", reviewPriority: "elevated", domainRisk: "Passenger safety and operating licences" },
  { id: "environmental", label: "Environmental services", reviewPriority: "elevated", domainRisk: "Compliance certification and hazardous work" },
  { id: "accounting", label: "Accounting", reviewPriority: "elevated", domainRisk: "Audits, credentials and financial statements" },
  { id: "public-service", label: "Public service", reviewPriority: "elevated", domainRisk: "Decision-making authority and public rights" },
  { id: "engineering", label: "Engineering", reviewPriority: "standard", domainRisk: "Invented technical ownership or delivered outcomes" },
  { id: "teaching", label: "Teaching", reviewPriority: "standard", domainRisk: "Licences, student outcomes and safeguarding" },
  { id: "hospitality", label: "Hospitality", reviewPriority: "standard", domainRisk: "Responsibility, customer results and management claims" },
  { id: "retail", label: "Retail", reviewPriority: "standard", domainRisk: "Sales results and job responsibility" },
  { id: "logistics", label: "Logistics", reviewPriority: "standard", domainRisk: "Routing, stock responsibility and delivery metrics" },
  { id: "administration", label: "Office administration", reviewPriority: "standard", domainRisk: "Staff authority and professional achievements" },
  { id: "creative", label: "Creative work", reviewPriority: "standard", domainRisk: "Portfolio ownership, awards and client outcomes" },
  { id: "research", label: "Research", reviewPriority: "standard", domainRisk: "Publications, methods and scientific results" },
  { id: "human-resources", label: "Human resources", reviewPriority: "standard", domainRisk: "Dismissal authority and employment decisions" },
] as const;

/** Explicit future candidates. Their absence is reported rather than implied as safe. */
export const NOT_YET_SAMPLED_FAMILIES = [
  "veterinary-medicine", "aviation", "maritime", "mining",
  "pharmacy", "dentistry", "architecture", "sports-coaching",
] as const;

export type CoverageRow = {
  id: string;
  label: string;
  priority: "elevated" | "standard";
  risk: string;
  syntheticCases: number;
  unsafeCases: number;
  safeCases: number;
  doubleReviewedCases: number;
  status: "not-sampled" | "synthetic-only" | "human-partial" | "human-reviewed";
};
export function getInterviewCoverage(
  fixtures: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
  humanReviews: readonly HumanReview[] = [],
): { sampled: CoverageRow[]; explicitlyNotSampled: string[]; unregisteredFixtureFamilies: string[] } {
  const reviews = new Map<string, Set<string>>();
  for (const review of humanReviews) {
    const reviewers = reviews.get(review.caseId) ?? new Set<string>();
    reviewers.add(review.reviewerId);
    reviews.set(review.caseId, reviewers);
  }
  // Validate all review payloads as a group; never use phantom reviewers.
  summarizeHumanReviews(humanReviews, fixtures);
  const sampled = OCCUPATIONAL_FAMILIES.map(family => {
    const cases = fixtures.filter(item => item.discipline === family.id);
    const doubleReviewedCases = cases.filter(item => (reviews.get(item.id)?.size ?? 0) >= 2).length;
    const status: CoverageRow["status"] = cases.length === 0 ? "not-sampled"
      : doubleReviewedCases === 0 ? "synthetic-only"
      : doubleReviewedCases < cases.length ? "human-partial" : "human-reviewed";
    return {
      id: family.id, label: family.label, priority: family.reviewPriority,
      risk: family.domainRisk, syntheticCases: cases.length,
      unsafeCases: cases.filter(c => c.expected === "copyedit").length,
      safeCases: cases.filter(c => c.expected === "grounded").length,
      doubleReviewedCases, status,
    };
  });
  const registered = new Set(OCCUPATIONAL_FAMILIES.map(x => x.id));
  return {
    sampled,
    explicitlyNotSampled: [...NOT_YET_SAMPLED_FAMILIES],
    unregisteredFixtureFamilies: [...new Set(fixtures.map(x => x.discipline).filter(id => !registered.has(id)))].sort(),
  };
}
