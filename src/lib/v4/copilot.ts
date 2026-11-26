/** Shared bits of the Copilot panel: the quick actions and how a chat is described. */

export type AskIntent = "review" | "match" | "refine" | "cover" | "interview";

export interface AskShortcut {
  intent: AskIntent;
  /** Shown on the button and sent as the user's message. */
  label: string;
  hint: string;
  /** SVG path data (24x24, stroked). */
  icon: string;
}

export const ASK_SHORTCUTS: readonly AskShortcut[] = [
  { intent: "review", label: "Review my CV", hint: "Check your CV against the job and see what to fix.", icon: "M6 3h9l4 4v14H6zM9 13l2 2 4-4" },
  { intent: "match", label: "Match me to a job", hint: "Score your keyword coverage for the role.", icon: "M12 20a8 8 0 100-16 8 8 0 000 16zM12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" },
  { intent: "refine", label: "Rewrite for a role", hint: "Refine your whole CV for this job.", icon: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" },
  { intent: "cover", label: "Draft a cover letter", hint: "A letter tailored to the role, using only your real experience.", icon: "M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM3 7l9 6 9-6" },
  { intent: "interview", label: "Practise an interview", hint: "Five questions with feedback on your answers.", icon: "M9 3h6v11H9zM5 11a7 7 0 0014 0M12 18v3" },
];

export const chatMeta = (saved: boolean) => (saved ? "Saved, text only" : "Not saved");
