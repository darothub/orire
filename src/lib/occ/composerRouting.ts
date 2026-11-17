import type { OccAgentId } from "./agents";

export type OccSendAction = "review" | "interview-question" | "interview-answer" | "improve" | "memory" | "missing";
export type OccSendDecision = {
  action: OccSendAction;
  reply?: string;
  jobDescription?: string;
};

/** Explicit composer agent wins over keywords in the typed message. No model calls here. */
export function planOccAgentSend(input: {
  agent: OccAgentId;
  message: string;
  hasCv: boolean;
  hasJobDescription: boolean;
  interviewPhase: "idle" | "question" | "feedback";
}): OccSendDecision {
  const message = input.message.trim();
  const looksLikeRole = !input.hasJobDescription && message.length >= 80 &&
    /(?:responsibilit|requirement|qualifications|experience with|we are looking|the role|you will|hiring)/i.test(message);
  const role = input.hasJobDescription || looksLikeRole;
  if (input.agent === "interview") {
    if (input.interviewPhase === "question")
      return { action: "interview-answer" };
    return role
      ? { action: "interview-question", ...(looksLikeRole ? { jobDescription: message.slice(0, 15000) } : {}) }
      : { action: "missing", reply: "Add a target job description to start your interview. Your CV is optional." };
  }
  if (input.agent === "improve") return { action: "improve" };
  if (input.agent === "memory") return { action: "memory" };
  const missing = [!input.hasCv ? "CV" : "", !role ? "job description" : ""].filter(Boolean);
  if (missing.length) return {
    action: "missing",
    ...(looksLikeRole ? { jobDescription: message.slice(0, 15000) } : {}),
    reply: "To review your CV, please attach " + missing.join(" and ") + " using the composer. Nothing will be analysed until you press Send again.",
  };
  return { action: "review", ...(looksLikeRole ? { jobDescription: message.slice(0, 15000) } : {}) };
}
