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
  return {
    matchedTerms: found.slice(0, 30),
    unverifiedTerms: notFound.slice(0, 30),
    checked: requirements.length,
    disclaimer: "Keyword presence is not proof of experience. Missing terms do not prove a skills gap. This is an initial text comparison, not an ATS or hiring prediction.",
  };
}
