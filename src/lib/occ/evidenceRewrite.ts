/** Conservative post-provider guard for optional candidate-visible CV rewrites.
 * A rewrite may reorder evidence words and add function words, but may not
 * add new substantive terms, identifiers, quantities or change negation.
 * Passing this guard is NOT independent evidence of factual accuracy.
 */
const connective = new Set([
  "a","an","and","as","at","be","been","being","by","for","from","i","in",
  "into","is","it","its","my","of","on","or","our","that","the","their",
  "these","this","those","to","using","via","was","were","we","which",
  "while","with","within","through","have","has","had",
]);
const negations = new Set(["not","never","no","without","none","neither","nor"]);
const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+(?:[+.#-][\p{L}\p{N}]+)*/gu) ?? [];

export function validateEvidenceRewrite(evidence: string, proposed: unknown): string | null {
  if (typeof proposed !== "string") return null;
  const replacement = proposed.trim();
  if (evidence.trim().length < 10 || replacement.length < 10 || replacement.length > 250 ||
      /[{}<>]/.test(replacement)) return null;
  const sourceTokens = new Set(words(evidence));
  const replacementTokens = words(replacement);
  if (replacementTokens.length < 3) return null;
  // Any novel key term, credential, medication, percentage or metric is unsafe.
  if (replacementTokens.some(w => !sourceTokens.has(w) && !connective.has(w))) return null;
  for (const n of negations) {
    if (sourceTokens.has(n) !== replacementTokens.includes(n)) return null;
  }
  return replacement;
}
