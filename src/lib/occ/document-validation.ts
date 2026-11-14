/** Lightweight content checks for documents uploaded to OCC.
 * These checks are intentionally conservative: a supported file extension alone
 * does not make arbitrary text a curriculum vitae. No model calls or persistence.
 */
export function looksLikeCV(text: string): boolean {
  const source = text.slice(0, 30_000);
  if (source.trim().length < 30) return false;
  const sectionSignals = [
    /\b(?:professional|work|employment)\s+(?:experience|history|summary)\b/i,
    /\b(?:education|qualifications|certifications?|technical skills|core skills|projects)\b/i,
    /\b(?:skills|experience|experienced|expertise|responsibilities|achievements)\b/i,
  ].filter(pattern => pattern.test(source)).length;
  const role = /\b(?:engineer|developer|designer|analyst|manager|nurse|doctor|teacher|consultant|accountant|specialist|architect|officer|technician|scientist|administrator|director|coordinator|researcher|intern|student|graduate|executive|recruiter|lawyer|sales|marketing|product|operations)\b/i.test(source);
  const skill = /\b(?:java|kotlin|python|javascript|typescript|react|sql|cloud|api|testing|leadership|communication|patient care|customer service|financial reporting|project management|healthcare|payments|authentication)\b/i.test(source);
  const structured = /(?:^|\n)\s*(?:work experience|professional experience|employment history|education|skills|certifications?|projects)\s*:?\s*(?:\n|$)/im.test(source);
  // Structured resumes, or concise summaries with a role, career evidence and skill.
  return (structured && (role || sectionSignals >= 2)) || (role && skill && sectionSignals >= 1);
}
export function looksLikeJobDescription(text: string): boolean {
  return text.trim().length >= 30 && /\b(?:requirements?|responsibilities|qualifications|experience|we are looking|job|position|role|candidate|you will|must have|duties)\b/i.test(text);
}
