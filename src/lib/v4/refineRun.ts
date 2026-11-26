import { authorizeRefineRun } from "@/app/actions/refine";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { parseModelJSON, factGround } from "@/lib/ai/guardrails";
import { diffCv, type CvChange } from "@/lib/ai/cvDiff";
import type { CVData } from "@/lib/cv/schema";
import { useSettingsStore } from "@/lib/store/settingsStore";

export type RefineOutcome =
  | { kind: "changes"; before: CVData; after: CVData; changes: CvChange[] }
  | { kind: "none"; message: string }
  | { kind: "stopped"; message: string };

export const REFINE_NO_CHANGES = "Your CV already reads well for this role. Refine suggested no changes.";

/**
 * The one Refine run, used by the CV Studio and the Copilot: authorizeRefineRun
 * spends one refine and mints the run token /api/ai/refine requires, then the
 * result is fact-grounded and diffed against the CV as it was when Refine ran.
 */
export async function runRefine(before: CVData, jobDescription: string): Promise<RefineOutcome> {
  try {
    const { provider, models } = useSettingsStore.getState();
    const model = models[provider] ?? "";
    const authz = await authorizeRefineRun([{ provider, model }]);
    if (!authz.ok || !authz.token) {
      return { kind: "stopped", message: authz.block ? `${authz.block.title}: ${authz.block.body}` : "Refine isn’t available on your plan." };
    }
    const response = await fetch("/api/ai/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, jobDescription, cv: before, runToken: authz.token, facts: [] }),
      cache: "no-store",
    });
    const data = await response.json();
    if (!data?.ok || !data.raw) {
      return { kind: "stopped", message: typeof data?.error?.message === "string" ? data.error.message : "Couldn’t refine the CV. Try again in a moment." };
    }
    const after = factGround(before, applyRefinePatch(before, parseModelJSON(data.raw))).cv;
    const changes = diffCv(before, after);
    return changes.length === 0 ? { kind: "none", message: REFINE_NO_CHANGES } : { kind: "changes", before, after, changes };
  } catch {
    return { kind: "stopped", message: "Couldn’t run Refine. Try again in a moment." };
  }
}
