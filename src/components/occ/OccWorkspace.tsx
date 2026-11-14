"use client";
import { useState, type CSSProperties, type FormEvent } from "react";
import { CareerMemory } from "./CareerMemory";
import { OccDraftReview } from "./OccDraftReview";
import { OccVersionedCv } from "./OccVersionedCv";

type Advice = { summary: string; recommendations: { requirement: string; cvEvidence: string | null; assessment: "supported" | "needs-clarification" | "not-found"; suggestion: string; question: string | null }[]; nextSteps: string[]; disclaimer: string };
type Result = { matchedTerms: string[]; unverifiedTerms: string[]; checked: number; disclaimer: string };
type WorkspaceSection = "overview" | "analysis" | "recommendations" | "versions" | "memory";
const sections: { id: WorkspaceSection; label: string; description: string }[] = [
  { id: "overview", label: "Overview", description: "Start here" },
  { id: "analysis", label: "CV analysis", description: "Compare evidence" },
  { id: "recommendations", label: "Recommendations", description: "Review AI advice" },
  { id: "versions", label: "CV versions", description: "Approve revisions" },
  { id: "memory", label: "Career memory", description: "Manage your profile" },
];
export function OccWorkspace() {
  const [section, setSection] = useState<WorkspaceSection>("overview");
  const [cv, setCv] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [saveRun, setSaveRun] = useState(false);
  const [useSavedProfile, setUseSavedProfile] = useState(false);
  const [analyzedCv, setAnalyzedCv] = useState("");
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [profileUsed, setProfileUsed] = useState(false);
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setAdvice(null);
    setSavedRunId(null);
    setRunning(true);
    try {
      const response = await fetch("/api/occ/match", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, description }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not compare the documents.");
      setResult(data as Result);
      setSection("analysis");
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed."); }
    finally { setRunning(false); }
  }
  async function requestAdvice() {
    setRunning(true);
    setError("");
    setAdvice(null);
    setSavedRunId(null);
    try {
      const response = await fetch("/api/occ/advise", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, description, goal, saveRun, useSavedProfile }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message ?? "OCC could not analyze your CV.");
      setAdvice(data.advice as Advice);
      setSection("recommendations");
      setAnalyzedCv(cv);
      setAnalysisVersion(version => version + 1);
      setProfileUsed(data.usedSavedProfile === true);
      setSavedRunId(data.runId ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "OCC failed."); }
    finally { setRunning(false); }
  }
  const field: CSSProperties = { width: "100%", padding: 14, border: "1px solid #c8c1d9", borderRadius: 12, background: "transparent", color: "inherit", font: "inherit" };
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header>
        <p style={{ color: "#7953b3", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontSize: 12 }}>OCC · Career workspace preview</p>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 750 }}>Your career, with a copilot.</h1>
        <p style={{ maxWidth: 700, opacity: 0.8 }}>Start with your career goal, CV evidence and a target role. Compare evidence directly or ask OCC for AI-powered, evidence-grounded recommendations. No edits are applied automatically.</p>
      </header>
      <nav aria-label="Career Copilot sections" style={{ display: "flex", flexWrap: "wrap", gap: 10, borderBottom: "1px solid #c8c1d9", paddingBottom: 14 }}>
        {sections.map(item => <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined}
          onClick={() => setSection(item.id)}
          style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid #c8c1d9", background: section === item.id ? "#7251ae" : "transparent", color: section === item.id ? "#fff" : "inherit", fontWeight: section === item.id ? 750 : 600, cursor: "pointer" }}>
          {item.label}
        </button>)}
      </nav>
      {section === "overview" && <section aria-label="Career Copilot overview" style={{ display: "grid", gap: 18 }}>
        <div style={{ padding: "24px", border: "1px solid #c8c1d9", borderRadius: 18, display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 26, fontWeight: 750 }}>Your next career move, one step at a time</h2>
          <p style={{ opacity: .8 }}>Choose a task below. OCC will never apply an AI suggestion to your CV without your review and approval.</p>
          <button type="button" onClick={() => setSection("analysis")} style={{ justifySelf: "start", border: 0, borderRadius: 10, background: "#7251ae", color: "#fff", padding: "12px 18px", fontWeight: 700 }}>Start CV analysis</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 14 }}>
          {sections.filter(item => item.id !== "overview").map(item =>
            <button key={item.id} type="button" onClick={() => setSection(item.id)}
              style={{ textAlign: "left", display: "grid", gap: 8, padding: 20, border: "1px solid #c8c1d9", borderRadius: 16, background: "transparent", color: "inherit", cursor: "pointer" }}>
              <strong style={{ fontSize: 18 }}>{item.label}</strong>
              <span style={{ opacity: .75 }}>{item.description}</span>
            </button>)}
        </div>
        <p style={{ fontSize: 13, opacity: .75 }}>Your profile is only included in an AI request when you opt in. Saved CV revisions remain private and inactive until you choose otherwise.</p>
      </section>}
      {section === "analysis" && <section aria-label="CV analysis workspace" style={{ display: "grid", gap: 20 }}>
      <form onSubmit={run} style={{ display: "grid", gap: 18 }}>
        <label style={{ display: "grid", gap: 8, fontWeight: 600 }}>Your career goal (optional)
          <input style={field} value={goal} onChange={e => setGoal(e.target.value)} maxLength={300} placeholder="e.g. Remote backend engineer in Europe" />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18 }}>
          <label style={{ display: "grid", gap: 8, fontWeight: 600 }}>Your current CV text
            <textarea style={{ ...field, minHeight: 235, resize: "vertical" }} value={cv} onChange={e => setCv(e.target.value)} maxLength={30000} required minLength={30} placeholder="Paste the CV you want to evaluate…" />
          </label>
          <label style={{ display: "grid", gap: 8, fontWeight: 600 }}>Target job description
            <textarea style={{ ...field, minHeight: 235, resize: "vertical" }} value={description} onChange={e => setDescription(e.target.value)} maxLength={15000} required minLength={30} placeholder="Paste the role requirements…" />
          </label>
        </div>
        <p style={{ fontSize: 13, opacity: 0.75 }}>The comparison runs without an LLM. Requesting OCC recommendations sends the pasted CV, goal and job description to Orire’s configured AI provider; the saved career profile is only included if you select the opt-in checkbox. Neither action modifies your CV or saves a career profile.</p>
        <button type="submit" disabled={running || cv.trim().length < 30 || description.trim().length < 30}
          style={{ justifySelf: "start", padding: "12px 22px", border: 0, borderRadius: 12, background: "#7251ae", color: "white", fontWeight: 700, cursor: "pointer", opacity: running ? 0.6 : 1 }}>
          {running ? "Comparing…" : "Compare CV with role"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={useSavedProfile} onChange={e => setUseSavedProfile(e.target.checked)} /> Include my saved career profile in this AI analysis (optional, only if previously saved)</label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={saveRun} onChange={e => setSaveRun(e.target.checked)} /> Save this AI recommendation session to private OCC history (optional)</label>
        <button type="button" disabled={running || cv.trim().length < 30 || description.trim().length < 30}
          onClick={requestAdvice}
          style={{ justifySelf: "start", padding: "12px 22px", border: "1px solid #7251ae", borderRadius: 12, background: "transparent", color: "inherit", fontWeight: 700, cursor: "pointer" }}>
          {running ? "Working…" : "Ask OCC for recommendations"}
        </button>
      </form>
      {error && <p role="alert" style={{ color: "#b44444" }}>{error}</p>}
      {result && <section aria-live="polite" style={{ padding: 24, border: "1px solid #c8c1d9", borderRadius: 18, display: "grid", gap: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Initial evidence review</h2>
        <p>{result.checked} distinct job-description terms reviewed. This is not a ranking or match percentage.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          <div><h3 style={{ fontWeight: 700 }}>Mentioned in your CV ({result.matchedTerms.length})</h3><p>{result.matchedTerms.join(", ") || "No direct keyword overlap identified."}</p></div>
          <div><h3 style={{ fontWeight: 700 }}>Not found in CV text ({result.unverifiedTerms.length})</h3><p>{result.unverifiedTerms.join(", ") || "No additional keywords identified."}</p></div>
        </div>
        <p style={{ fontSize: 13, opacity: .8 }}>{result.disclaimer}</p>
        {goal.trim() && <p><strong>Your goal:</strong> {goal.trim()}</p>}
      </section>}
      </section>}
      {section === "recommendations" && <section aria-label="OCC recommendations workspace" style={{ display: "grid", gap: 16 }}>
        {!advice && <div style={{ padding: 24, border: "1px solid #c8c1d9", borderRadius: 18, display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Recommendations</h2>
          <p>Run an AI analysis to see grounded advice and safely review possible CV wording changes. Your original CV stays unchanged.</p>
          <button type="button" onClick={() => setSection("analysis")}>Go to CV analysis</button>
        </div>}
      {advice && <section aria-live="polite" style={{ padding: 24, border: "1px solid #c8c1d9", borderRadius: 18, display: "grid", gap: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>OCC career recommendations</h2>
        <p>{advice.summary}</p>
        <p style={{ fontSize: 13, opacity: .8 }}>Saved career profile used: {profileUsed ? "Yes" : "No"}.</p>
        <div style={{ display: "grid", gap: 12 }}>
          {advice.recommendations.map((item, i) => <article key={i} style={{ border: "1px solid #c8c1d9", borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontWeight: 700 }}>{item.requirement}</h3>
            <p style={{ fontSize: 13, opacity: .8 }}>Evidence status: {item.assessment}</p>
            {item.cvEvidence && <blockquote style={{ borderLeft: "3px solid #7953b3", paddingLeft: 12, margin: "12px 0" }}>{item.cvEvidence}</blockquote>}
            <p>{item.suggestion}</p>
            {item.question && <p><strong>To clarify:</strong> {item.question}</p>}
          </article>)}
        </div>
        {advice.nextSteps.length > 0 && <div><h3 style={{ fontWeight: 700 }}>Suggested next steps</h3><ul style={{ paddingLeft: 20 }}>{advice.nextSteps.map((step, i) => <li key={i}>{step}</li>)}</ul></div>}
        <p style={{ fontSize: 13, opacity: .8 }}>{advice.disclaimer}</p>
        <OccDraftReview key={analysisVersion} original={analyzedCv} recommendations={advice.recommendations} />
        <p style={{ fontSize: 13 }}>Recommendations are review-only. No CV changes have been made. {savedRunId ? "Session saved. You can accept or reject suggestions below." : "This session was not saved."}</p>
      </section>}
      </section>}
      {section === "versions" && <section aria-label="CV version workspace"><OccVersionedCv /></section>}
      {section === "memory" && <section aria-label="Career memory workspace"><CareerMemory /></section>}

    </div>
  );
}
