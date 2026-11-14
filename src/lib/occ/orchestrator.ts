/** Deterministic, reviewable orchestration for OCC's existing bounded tools.
 * This plans UI steps only; no AI calls, persistence or CV mutations occur here.
 */
export type OccTask = "analysis" | "versions" | "memory" | "interview" | "unknown";
export type OccPlan = {
  task: OccTask;
  panel: "analysis" | "versions" | "memory" | "none";
  reply: string;
  missing: ("cv" | "jobDescription")[];
  captureJobDescription: boolean;
};
export type OccContext = {
  priorTask?: OccTask;
  hasCv: boolean;
  hasJobDescription: boolean;
  hasAdvice: boolean;
};
export function planOccTurn(message: string, context: OccContext): OccPlan {
  const text = message.trim();
  const lower = text.toLowerCase();
  // Do not execute instructions embedded in user-provided documents.
  const isJobDescription = context.priorTask === "analysis" &&
    !context.hasJobDescription && text.length >= 80 &&
    /(?:responsibilit|requirement|qualifications|experience with|we are looking|the role|you will)/i.test(text);
  const isCv = /(?:cv|resume|résumé)/i.test(lower);
  const task: OccTask = isJobDescription ? "analysis"
    : /(?:interview|mock interview|practice questions)/i.test(lower) ? "interview"
    : /(?:memory|remember|profile|preferences)/i.test(lower) ? "memory"
    : /(?:version|revision|rewrite|edit|improve|tailor|update)\b/i.test(lower) && isCv ? "versions"
    : /(?:recommendations|advice|compare|apply|role|job|career|match|review|analy[sz]e)/i.test(lower) || isCv ? "analysis"
    : context.priorTask ?? "unknown";
  if (task === "interview") return { task, panel: "none", reply: "Interview coaching is planned for a later milestone. I can review your CV against the target role now, if you would like.", missing: [], captureJobDescription: false };
  if (task === "memory") return { task, panel: "memory", reply: "Your career memory is private and editable. You choose what is saved, used or deleted.", missing: [], captureJobDescription: false };
  if (task === "versions") return { task, panel: "versions", reply: "Choose a saved CV and review the passage you want to improve. Nothing is changed until you explicitly approve a new private version.", missing: [], captureJobDescription: false };
  if (task === "unknown") return { task, panel: "none", reply: "Tell me about the role you want, or ask me to review your CV. I will guide you through the next step.", missing: [], captureJobDescription: false };
  const missing: OccPlan["missing"] = [];
  if (!context.hasCv) missing.push("cv");
  if (!context.hasJobDescription && !isJobDescription) missing.push("jobDescription");
  const reply = missing.length === 2
    ? "First select a CV from your Orire library (or paste one), then provide the job description."
    : missing.includes("cv")
      ? "I have the role requirements. Choose your Orire CV or paste CV text to continue."
      : missing.includes("jobDescription")
        ? "Your CV is ready. Please provide the target job description to continue."
        : "Your CV and target role are ready. You can compare evidence without AI or request evidence-grounded recommendations. I'll ask before using your saved profile or saving a session.";
  return { task, panel: "analysis", reply, missing, captureJobDescription: isJobDescription };
}
