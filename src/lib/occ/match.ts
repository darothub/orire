/**
 * Transparent, deterministic first-pass evidence review.
 * This is NOT an LLM, ATS score or hiring likelihood. It extracts the
 * substantive terms a role actually asks for and checks which appear in the CV.
 *
 * The hard part is ignoring boilerplate: a job post is mostly common English and
 * employer-brand marketing ("shaping the future", "every day", "worldwide"),
 * none of which is a skill requirement. We filter those with a large common-word
 * + boilerplate stoplist, then rank what's left by signal (how often it recurs,
 * whether it's a distinctively-cased or tech-shaped token like PostgreSQL or
 * CI/CD) so real requirements float to the top. Fully deterministic and
 * explainable — the same inputs always produce the same terms and score.
 */

// Function words, the most common English words, and generic hiring/marketing
// boilerplate. Everything here is noise for keyword coverage, never a skill.
const STOP = new Set([
  // articles, pronouns, prepositions, conjunctions, auxiliaries
  "a","an","the","and","or","nor","but","so","yet","for","of","to","in","on","at","by","as","is","are","was","were","be","been","being","am","do","does","did","done","have","has","had","having","will","would","shall","should","can","could","may","might","must","it","its","this","that","these","those","they","them","their","theirs","there","then","than","we","our","ours","us","you","your","yours","he","she","him","his","her","hers","i","me","my","mine","who","whom","whose","which","what","when","where","why","how","if","else","while","because","about","above","below","under","over","between","among","through","during","before","after","again","further","here","from","with","within","without","into","onto","out","off","up","down","per","via","not","no","nor","only","own","same","such","too","very","just","also","any","all","both","each","few","more","most","other","some","many","much",
  // common verbs / adverbs / filler
  "get","got","make","makes","making","made","use","used","using","help","helps","helping","need","needs","needed","want","wants","like","work","works","working","worked","join","joining","build","building","built","drive","driving","driven","grow","growing","growth","lead","leads","leading","led","manage","manages","managing","run","running","ensure","ensures","ensuring","deliver","delivers","delivering","support","supports","supporting","enable","enables","enabling","provide","provides","providing","create","creates","creating","bring","brings","take","takes","keep","keeps","stay","staying","go","going","doing","done","day","days","daily","today","every","everyone","everything","always","really","around","across","together","ahead","behind","rapidly","quickly","closely","close","seamlessly","efficiently","effectively","smarter","faster","better","best","great","good","strong","excellent","world","worldwide","global","globally","future","shaping","leading","mission","vision","passion","passionate","company","companies","customer","customers","client","clients","user","users","people","person","industry","industries","market","markets","miles","mobility",
  // generic job-post scaffolding
  "job","jobs","role","roles","position","positions","candidate","candidates","team","teams","experience","experienced","skill","skills","ability","abilities","responsibility","responsibilities","requirement","requirements","qualification","qualifications","looking","seeking","hire","hiring","opportunity","opportunities","environment","culture","values","driven","motivated","ideal","new","senior","junior","lead","year","years","plus","etc","including","include","includes","included","across","within","level","role","based","remote","hybrid","office","benefits","salary","apply","applicants","location",
]);

// Tokens whose casing marks them as a name/technology rather than prose:
// an uppercase after the first letter (PostgreSQL, GitLab, JUnit, OpenShift) or
// all-caps of length >= 2 (AWS, SQL, API). First-letter-only capitals are not
// distinctive — they may just be a sentence start.
function distinctiveCase(token: string): boolean {
  if (/[A-Z]/.test(token.slice(1))) return true;
  return token.length >= 2 && token === token.toUpperCase() && /[A-Z]/.test(token);
}
// Tech-shaped: carries a digit or tooling punctuation (ci/cd, c++, k8s, .net, s3).
function techShaped(token: string): boolean {
  return /[0-9+#./]/.test(token);
}
// Keep original case; allow internal tech punctuation; trim trailing dots/commas.
function tokenize(text: string): string[] {
  return (text.match(/[A-Za-z][A-Za-z0-9+#./-]*/g) ?? []).map((t) => t.replace(/[-./]+$/g, ""));
}
const MAX_TERMS = 60;

export function analyzeEvidence(cv: string, description: string) {
  const mentioned = new Set(tokenize(cv).map((t) => t.toLowerCase()));

  // Score each distinct JD term by how much it looks like a real requirement.
  const freq = new Map<string, number>();
  const order = new Map<string, number>();
  const score = new Map<string, number>();
  let i = 0;
  for (const tok of tokenize(description)) {
    const key = tok.toLowerCase();
    if (STOP.has(key)) continue;
    if (key.length < 3 && !techShaped(tok)) continue;
    if (/^[0-9]+$/.test(key)) continue; // bare numbers aren't skills
    if (!order.has(key)) order.set(key, i++);
    freq.set(key, (freq.get(key) ?? 0) + 1);
    const base =
      (techShaped(tok) ? 3 : 0) +
      (distinctiveCase(tok) ? 2 : 0) +
      (key.length >= 8 ? 1 : 0);
    score.set(key, Math.max(score.get(key) ?? 0, base));
  }
  // Final score adds recurrence; rank by score, then by first appearance for a
  // stable, deterministic order.
  const requirements = [...freq.keys()]
    .sort((a, b) => {
      const sa = (score.get(a) ?? 0) + (freq.get(a) ?? 0);
      const sb = (score.get(b) ?? 0) + (freq.get(b) ?? 0);
      return sb - sa || (order.get(a)! - order.get(b)!);
    })
    .slice(0, MAX_TERMS);

  const found = requirements.filter((t) => mentioned.has(t));
  const notFound = requirements.filter((t) => !mentioned.has(t));
  // Deterministic keyword-coverage signal: the share of distinct role terms
  // present in the CV. Explainable and reproducible — NOT a hiring probability
  // or ATS score. The disclaimer keeps that framing in every consumer.
  const coverage = requirements.length ? Math.round((found.length / requirements.length) * 100) : 0;
  return {
    coverage,
    matched: found.length,
    // Surface the strongest terms first (requirements is already score-ranked).
    matchedTerms: found.slice(0, 30),
    unverifiedTerms: notFound.slice(0, 30),
    checked: requirements.length,
    disclaimer: "Keyword coverage measures which role terms appear in your CV. Missing terms do not prove a skills gap, and keyword presence is not proof of experience, an ATS score or a hiring prediction.",
  };
}
