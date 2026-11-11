/**
 * Trial runner for the CV coach against real models.
 *   npx vite-node -c vitest.config.ts scripts/coach-trial.ts [prefix…]
 * Reads .trial/NN-name.cv.txt + .trial/NN-name.jd.txt, runs the same loop the UI
 * drives (analyse → rewrite → critique ↔ rewrite), and writes .trial/NN-name.report.md.
 * Needs OPENAI_API_KEY (or ANTHROPIC_API_KEY) in the environment. Answers are NOT
 * invented: questions are recorded so a person can answer them in a second pass.
 */
import fs from "node:fs";
import path from "node:path";
import type { CVData } from "@/lib/cv/schema";
import { parseCVText } from "@/lib/ingest/parse";
import { runAnalysis, runCritique, runRewrite, type AgentCaller, type AgentName } from "@/lib/ai/server/agentPipeline";
import { DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { runRoutedWithFailover } from "@/lib/ai/server/failover";
import { MAX_CRITIC_ROUNDS, shouldContinue } from "@/lib/ai/agents";
import { isBetterDraft } from "@/lib/ai/coachLoop";
import { diffCv } from "@/lib/ai/cvDiff";

const DIR = path.resolve(".trial");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const task: Record<AgentName, "agent-analyze" | "agent-rewrite"> = {
  analyst: "agent-analyze",
  gap: "agent-analyze",
  elicitor: "agent-analyze",
  critic: "agent-analyze",
  rewriter: "agent-rewrite",
};

let calls = 0;
const call: AgentCaller = async (agent, system, user) => {
  calls += 1;
  const served = await runRoutedWithFailover(task[agent], { system, user, opts: { ...DETERMINISTIC, maxTokens: 2048 } });
  return served.call;
};

function toCV(text: string): CVData {
  const p = parseCVText(text);
  return {
    basics: { fullName: "", title: "", email: "", phone: "", location: "", summary: "", links: [], ...p.basics },
    experience: p.experience,
    education: p.education,
    skills: p.skills,
    projects: p.projects,
    certifications: p.certifications,
    order: ["summary", "experience", "education", "skills", "projects", "certifications"],
  };
}

const q = (s: unknown) => "```json\n" + JSON.stringify(s, null, 2) + "\n```";

async function trial(name: string): Promise<string> {
  const cvText = fs.readFileSync(path.join(DIR, `${name}.cv.txt`), "utf8");
  const jd = fs.readFileSync(path.join(DIR, `${name}.jd.txt`), "utf8");
  const cv = toCV(cvText);
  const out: string[] = [`# ${name}`, ``, `Parsed: ${cv.experience.length} roles, ${cv.experience.reduce((n, e) => n + e.highlights.length, 0)} bullets, ${cv.skills.length} skill groups, ${cv.education.length} education`, ``];
  const before = calls;

  const a = await runAnalysis(cv, jd, call);
  if (!a.ok) return out.concat(`**Analysis failed** (${a.agent}): ${a.message}`).join("\n");
  out.push(`## Ideal profile`, q(a.profile), `## Gap report`, q(a.report), `## Questions asked (${a.questions.length})`, q(a.questions));

  const base = await runRewrite(cv, jd, a.profile, a.report, [], call);
  if (!base.ok) return out.concat(`**Rewrite failed** (${base.agent}): ${base.message}`).join("\n");
  let best = base;
  const rounds: string[] = [];
  for (let round = 1; round <= MAX_CRITIC_ROUNDS; round++) {
    const rev = await runCritique(best.cv, jd, a.profile, call);
    if (!rev.ok) { rounds.push(`critic failed: ${rev.message}`); break; }
    rounds.push(`round ${round} critique: ${JSON.stringify(rev.critique)}`);
    if (!shouldContinue(rev.critique, round - 1)) break;
    const next = await runRewrite(cv, jd, a.profile, a.report, [], call, { critique: rev.critique, previousDraft: best.cv });
    if (!next.ok) { rounds.push(`rewrite failed: ${next.message}`); break; }
    const qual = (r: typeof best) => ({ warnings: r.warnings.length, atsScore: r.ats.after.score });
    const better = isBetterDraft(qual(best), qual(next));
    rounds.push(`round ${round} draft ${better ? "kept" : "discarded"}: warnings ${best.warnings.length}→${next.warnings.length}, ATS ${best.ats.after.score}→${next.ats.after.score}`);
    if (!better) break;
    best = next;
  }
  out.push(
    `## Result (no answers supplied)`,
    `ATS before ${base.ats.before.score}% → after ${best.ats.after.score}% · grounding ${JSON.stringify(best.grounding)}`,
    ``, `### Guard warnings (${best.warnings.length})`, ...best.warnings.map((w) => `- ${w}`),
    ``, `### Changes the user would review (${diffCv(cv, best.cv).length})`,
    ...diffCv(cv, best.cv).map((c) => `- ${JSON.stringify(c)}`),
    ``, `### Critic loop`, ...rounds.map((r) => `- ${r}`),
    ``, `Model calls: ${calls - before}`,
  );
  return out.join("\n");
}

async function main() {
  loadEnv();
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error("Set OPENAI_API_KEY (or ANTHROPIC_API_KEY) in the environment or .env.local.");
    process.exit(1);
  }
  const want = process.argv.slice(2);
  const names = fs.readdirSync(DIR).filter((f) => f.endsWith(".cv.txt")).map((f) => f.replace(".cv.txt", "")).filter((n) => want.length === 0 || want.some((w) => n.startsWith(w))).sort();
  for (const n of names) {
    if (!fs.existsSync(path.join(DIR, `${n}.jd.txt`))) { console.log(`skip ${n}: no jd`); continue; }
    process.stdout.write(`${n} … `);
    const t = Date.now();
    try {
      fs.writeFileSync(path.join(DIR, `${n}.report.md`), await trial(n));
      console.log(`done ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (e) {
      console.log(`error: ${(e as Error).message}`);
    }
  }
  console.log(`total model calls: ${calls}`);
}

void main();
