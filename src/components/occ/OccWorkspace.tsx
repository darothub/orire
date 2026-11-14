"use client";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import type { CVData } from "@/lib/cv/schema";
import { cvToPlainText } from "@/lib/export/plaintext";
import { CareerMemory } from "./CareerMemory";
import { OccDraftReview } from "./OccDraftReview";
import { OccVersionedCv } from "./OccVersionedCv";

type Advice = { summary: string; recommendations: { requirement: string; cvEvidence: string | null; assessment: "supported" | "needs-clarification" | "not-found"; suggestion: string; question: string | null }[]; nextSteps: string[]; disclaimer: string };
type Result = { matchedTerms: string[]; unverifiedTerms: string[]; checked: number; disclaimer: string };
type WorkspaceSection = "overview" | "analysis" | "recommendations" | "versions" | "memory";
type Turn = { role: "you" | "OCC"; text: string };
export function OccWorkspace() {
  const [section, setSection] = useState<WorkspaceSection>("overview");
  const [composer, setComposer] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  function ask(value: string) {
    const text = value.trim();
    if (!text) return;
    const lower = text.toLowerCase();
    const next: WorkspaceSection = /memory|remember|profile/.test(lower) ? "memory"
      : /version|revision|edit|rewrite|improve/.test(lower) ? "versions"
      : /recommendation|suggestion/.test(lower) && advice ? "recommendations" : "analysis";
    const reply = /interview/.test(lower)
      ? "Full interview coaching is planned for a later milestone. For now, I can compare your CV with the role requirements to help prepare."
      : next === "memory" ? "You control what OCC remembers. You can review or delete your saved career profile below."
      : next === "versions" ? "Let's review a specific passage in your saved CV. Nothing is overwritten, and saving requires approval."
      : next === "recommendations" ? "Here are your evidence-grounded recommendations and optional wording review."
      : "Let's look at your next role. You can compare your CV with a job description, then request grounded advice.";
    setTurns(current => [...current, { role: "you", text }, { role: "OCC", text: reply }]);
    setSection(next);
    setComposer("");
  }
  const [cv, setCv] = useState("");
  const [savedCvs, setSavedCvs] = useState<{ id: string; title: string; data: CVData }[]>([]);
  const [selectedCvId, setSelectedCvId] = useState("");
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/occ/versions", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Saved CVs unavailable");
      const data = await response.json();
      if (!cancelled) setSavedCvs(data.documents ?? []);
    }).catch(() => { /* Pasted CV remains available if library request fails. */ });
    return () => { cancelled = true; };
  }, []);
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
      setTurns(current => [...current, { role: "OCC", text: "Your evidence comparison is ready below. This is not a hiring score." }]);
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
      setTurns(current => [...current, { role: "OCC", text: "Here are grounded recommendations. No CV changes were made automatically." }]);
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
      <section aria-label="Career Copilot conversation" style={{ display: "grid", gap: 16, padding: "clamp(16px, 3vw, 28px)", border: "1px solid #c8c1d9", borderRadius: 18 }}>
        {turns.length === 0 && <>
          <h2 style={{ fontWeight: 750, fontSize: 26 }}>What would you like to achieve today?</h2>
          <p style={{ opacity: .8 }}>Tell OCC your goal. The appropriate tools appear only when needed.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
            {["Review my CV for a role", "Improve my CV", "Prepare for an interview", "Manage my career memory"].map(text =>
              <button type="button" key={text} onClick={() => ask(text)} style={{ padding: 18, textAlign: "left", background: "transparent", color: "inherit", border: "1px solid #c8c1d9", borderRadius: 12 }}>{text}</button>)}
          </div>
        </>}
        {turns.map((turn, index) => <div key={index} style={{ justifySelf: turn.role === "you" ? "end" : "start", maxWidth: "85%", padding: "12px 16px", borderRadius: 14, background: turn.role === "you" ? "#7251ae" : "rgba(114,81,174,.09)", color: turn.role === "you" ? "#fff" : "inherit" }}>
          <strong>{turn.role === "you" ? "You" : "OCC"}:</strong> {turn.text}
        </div>)}
        <form onSubmit={event => { event.preventDefault(); ask(composer); }} style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <textarea aria-label="Message your Career Copilot" style={{ ...field, flex: "1 1 250px", minHeight: 76 }} maxLength={1200} value={composer} onChange={event => setComposer(event.target.value)} placeholder="Tell OCC what you want to achieve..." />
          <button type="submit" disabled={!composer.trim()} style={{ padding: "12px 18px", border: 0, borderRadius: 12, color: "#fff", background: "#7251ae" }}>Send</button>
        </form>
      </section>
      {section !== "overview" && <button type="button" onClick={() => setSection("overview")} style={{ justifySelf: "start" }}>Hide tools</button>}
      {section === "analysis" && <section aria-label="CV analysis workspace" style={{ display: "grid", gap: 20 }}>
      <form onSubmit={run} style={{ display: "grid", gap: 18 }}>
        <label style={{ display: "grid", gap: 8, fontWeight: 600 }}>Your career goal (optional)
          <input style={field} value={goal} onChange={e => setGoal(e.target.value)} maxLength={300} placeholder="e.g. Remote backend engineer in Europe" />
        </label>
        {savedCvs.length > 0 && <label style={{ display: "grid", gap: 8, fontWeight: 600 }}>Select an existing Orire CV instead of pasting
          <select style={field} value={selectedCvId} onChange={event => {
            const id = event.target.value;
            setSelectedCvId(id);
            const document = savedCvs.find(item => item.id === id);
            if (document) setCv(cvToPlainText(document.data));
          }}>
            <option value="">I will paste my CV text</option>
            {savedCvs.map(document => <option key={document.id} value={document.id}>{document.title}</option>)}
          </select>
        </label>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18 }}>
          <label style={{ display: "grid", gap: 8, fontWeight: 600 }}>Your current CV text
            <textarea style={{ ...field, minHeight: 235, resize: "vertical" }} value={cv} onChange={e => { setCv(e.target.value); setSelectedCvId(""); }} maxLength={30000} required minLength={30} placeholder="Paste the CV you want to evaluate…" />
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
      {(section === "recommendations" || (section === "analysis" && advice)) && <section aria-label="OCC recommendations workspace" style={{ display: "grid", gap: 16 }}>
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
