/**
 * Transparent, deterministic first-pass evidence review.
 * This is NOT an LLM, ATS score or hiring likelihood. Follow-up milestones
 * connect the agent to grounded CV tools and model reasoning.
 */
const STOP = new Set(["about","above","across","after","again","against","also","among","and","are","been","being","below","between","both","can","candidate","company","could","each","experience","from","have","into","job","looking","more","must","need","other","our","over","role","should","skills","team","that","their","them","there","these","they","this","those","through","using","want","were","what","when","where","which","while","will","with","work","would","years","your","you","for","the","has","its","not","all","any","but","who","how","per","via","new","senior","strong","excellent"]);
function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [])
    .map(t => t.replace(/[.,]$/g, ""))
    .filter(t => !STOP.has(t) && t.length >= 3);
}
export function analyzeEvidence(cv: string, description: string) {
  const mentioned = new Set(terms(cv));
  const requirements = [...new Set(terms(description))].slice(0, 80);
  const found = requirements.filter(t => mentioned.has(t));
  const notFound = requirements.filter(t => !mentioned.has(t));
  // Deterministic keyword-coverage signal: the share of distinct role terms
  // present in the CV. Explainable and reproducible — NOT a hiring probability
  // or ATS score. The disclaimer keeps that framing in every consumer.
  const coverage = requirements.length ? Math.round((found.length / requirements.length) * 100) : 0;
  return {
    coverage,
    matched: found.length,
    matchedTerms: found.slice(0, 30),
    unverifiedTerms: notFound.slice(0, 30),
    checked: requirements.length,
    disclaimer: "Keyword coverage measures which role terms appear in your CV. Missing terms do not prove a skills gap, and keyword presence is not proof of experience, an ATS score or a hiring prediction.",
  };
}
