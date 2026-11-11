import type { CVData, SectionKey } from "@/lib/cv/schema";
import { SECTION_LABELS } from "@/lib/cv/schema";
import type { TargetMatch } from "@/lib/ai/simulate";
import type { RankedSection, RankedSkill } from "@/lib/ai/simulateImpact";

/** The first line of the user's CV that mentions the skill, or null. */
export function skillEvidence(cv: CVData, skill: string): string | null {
  const needle = skill.toLowerCase();
  const lines = [
    ...cv.experience.flatMap((e) => e.highlights.map((h) => `${e.role || e.company}: ${h}`)),
    ...cv.projects.flatMap((p) => p.highlights.map((h) => `${p.name}: ${h}`)),
    cv.basics.summary,
    ...cv.skills.map((g) => g.items.join(", ")),
  ];
  const hit = lines.find((l) => l && l.toLowerCase().includes(needle));
  if (!hit) return null;
  return hit.length > 140 ? `${hit.slice(0, 137)}…` : hit;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export interface GapReportInput {
  label: string;
  match: TargetMatch;
  baseScore: number;
  rankedSkills: RankedSkill[];
  rankedSections: RankedSection[];
}

/** Print-ready HTML for the gap report (user saves it as PDF from the print dialog). */
export function buildGapReportHtml(r: GapReportInput): string {
  const li = (t: string, extra = "") => `<li>${escapeHtml(t)}${extra}</li>`;
  const skills = r.rankedSkills.map((s) => li(s.skill, s.impact > 0 ? ` <b>+${s.impact}%</b>` : "")).join("");
  const sections = r.rankedSections.map((s) => li(SECTION_LABELS[s.key as SectionKey], s.impact > 0 ? ` <b>+${s.impact}%</b>` : "")).join("");
  const signals = r.match.metrics.map((m) => li(`${m.label}: ${m.score}%`)).join("");
  const matched = r.match.gap.matchedSkills.map((s) => li(s)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Gap report – ${escapeHtml(r.label)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:720px;margin:32px auto;color:#111}h1{font-size:22px;margin:0}h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;margin:24px 0 6px;color:#555}ul{margin:0;padding-left:20px}p.note{color:#666;font-size:12px}</style></head><body>
<h1>Gap report: ${escapeHtml(r.label)}</h1>
<p>Simulated match <b>${r.match.score}%</b> (baseline ${r.baseScore}%)</p>
<h2>Signals</h2><ul>${signals}</ul>
<h2>Skills to add (by estimated impact)</h2><ul>${skills || "<li>None</li>"}</ul>
<h2>Sections to add</h2><ul>${sections || "<li>None</li>"}</ul>
<h2>Skills already matched</h2><ul>${matched || "<li>None</li>"}</ul>
<p class="note">Illustrative benchmark against an AI-generated example, not an employer or ATS assessment. Add only skills you genuinely have.</p>
</body></html>`;
}
