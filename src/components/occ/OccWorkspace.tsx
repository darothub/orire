"use client";
import { useState, type CSSProperties, type FormEvent } from "react";

type Result = { matchedTerms: string[]; unverifiedTerms: string[]; checked: number; disclaimer: string };
export function OccWorkspace() {
  const [cv, setCv] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setRunning(true);
    try {
      const response = await fetch("/api/occ/match", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, description }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not compare the documents.");
      setResult(data as Result);
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed."); }
    finally { setRunning(false); }
  }
  const field: CSSProperties = { width: "100%", padding: 14, border: "1px solid #c8c1d9", borderRadius: 12, background: "transparent", color: "inherit", font: "inherit" };
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header>
        <p style={{ color: "#7953b3", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontSize: 12 }}>OCC · Career workspace preview</p>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 750 }}>Your career, with a copilot.</h1>
        <p style={{ maxWidth: 700, opacity: 0.8 }}>Start with your career goal, CV evidence and a target role. This first release offers a transparent evidence comparison; an LLM-powered task agent is a subsequent milestone.</p>
      </header>
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
        <p style={{ fontSize: 13, opacity: 0.75 }}>Your pasted content is submitted only to Orire for this comparison; this preview does not save it as a career profile or send it to a model.</p>
        <button type="submit" disabled={running || cv.trim().length < 30 || description.trim().length < 30}
          style={{ justifySelf: "start", padding: "12px 22px", border: 0, borderRadius: 12, background: "#7251ae", color: "white", fontWeight: 700, cursor: "pointer", opacity: running ? 0.6 : 1 }}>
          {running ? "Comparing…" : "Compare CV with role"}
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
    </div>
  );
}
