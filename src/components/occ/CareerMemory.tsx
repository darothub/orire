"use client";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

type Profile = { targetRole: string; location: string; workMode: string; salaryGoal: string; careerGoal: string; verifiedNotes: string };
const EMPTY: Profile = { targetRole: "", location: "", workMode: "", salaryGoal: "", careerGoal: "", verifiedNotes: "" };
type Run = {
  id: string; summary: string; createdAt: string;
  recommendations: Array<{ requirement: string; suggestion: string; decision?: string }>;
};

export function CareerMemory() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const field: CSSProperties = { width: "100%", padding: 12, border: "1px solid #c8c1d9", borderRadius: 10, background: "transparent", color: "inherit" };

  async function refresh() {
    const [p, r] = await Promise.all([
      fetch("/api/occ/profile", { cache: "no-store" }),
      fetch("/api/occ/runs", { cache: "no-store" }),
    ]);
    if (!p.ok || !r.ok) throw new Error("Could not load your OCC memory.");
    const [profileData, runsData] = await Promise.all([p.json(), r.json()]);
    setProfile(profileData.profile ? Object.fromEntries(Object.keys(EMPTY).map(k => [k, profileData.profile[k] ?? ""])) as Profile : EMPTY);
    setSaved(Boolean(profileData.profile));
    setRuns(runsData.runs);
  }
  useEffect(() => {
    // Initial load updates React state only after asynchronous I/O completes.
    // Keep this separate from the event-driven refresh() that sets loading state.
    let cancelled = false;
    void Promise.all([
      fetch("/api/occ/profile", { cache: "no-store" }),
      fetch("/api/occ/runs", { cache: "no-store" }),
    ]).then(async ([p, r]) => {
      if (!p.ok || !r.ok) throw new Error("Could not load OCC memory.");
      const [profileData, runsData] = await Promise.all([p.json(), r.json()]);
      if (cancelled) return;
      setProfile(profileData.profile
        ? Object.fromEntries(Object.keys(EMPTY).map(k => [k, profileData.profile[k] ?? ""])) as Profile
        : EMPTY);
      setSaved(Boolean(profileData.profile));
      setRuns(runsData.runs);
    }).catch(() => {
      if (!cancelled) setError("Could not load your OCC memory.");
    });
    return () => { cancelled = true; };
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const res = await fetch("/api/occ/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      if (!res.ok) throw new Error("Could not save career memory.");
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    finally { setPending(false); }
  }
  async function erase() {
    if (!window.confirm("Delete your saved OCC career profile? Recommendation history is unaffected.")) return;
    setPending(true); setError("");
    try {
      const res = await fetch("/api/occ/profile", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete profile.");
      setProfile(EMPTY); setSaved(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
    finally { setPending(false); }
  }
  async function deleteRun(id: string) {
    if (!window.confirm("Permanently delete this saved OCC recommendation session?")) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/occ/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete saved session.");
      setRuns(current => current.filter(run => run.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
    finally { setPending(false); }
  }
  async function decide(id: string, index: number, decision: "accepted" | "rejected") {
    setPending(true); setError("");
    try {
      const res = await fetch(`/api/occ/runs/${encodeURIComponent(id)}/decision`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, decision }),
      });
      if (!res.ok) throw new Error("Could not save your decision.");
      const data = await res.json();
      setRuns(old => old.map(run => run.id === id ? { ...run, recommendations: data.recommendations } : run));
    } catch (e) { setError(e instanceof Error ? e.message : "Decision failed."); }
    finally { setPending(false); }
  }
  return <section style={{ border: "1px solid #c8c1d9", padding: 24, borderRadius: 18, display: "grid", gap: 20 }}>
    <header>
      <h2 style={{ fontWeight: 750, fontSize: 24 }}>Your career memory</h2>
      <p style={{ opacity: .8 }}>Private, optional, and editable. Only information you explicitly save is retained here. Notes are user-provided, not independently verified.</p>
    </header>
    <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12 }}>
      {(["targetRole", "location", "workMode", "salaryGoal", "careerGoal"] as const).map(key => <label key={key} style={{ display: "grid", gap: 5 }}>
        <span style={{ fontWeight: 600 }}>{({ targetRole: "Target role", location: "Preferred location", workMode: "Work arrangement", salaryGoal: "Compensation goal", careerGoal: "Career goal" })[key]}</span>
        <input style={field} value={profile[key]} maxLength={key === "careerGoal" ? 300 : key === "workMode" ? 60 : key === "salaryGoal" ? 100 : 120} onChange={e => setProfile(prev => ({ ...prev, [key]: e.target.value }))} />
      </label>)}
      <label style={{ display: "grid", gap: 5, gridColumn: "1 / -1" }}>
        <span style={{ fontWeight: 600 }}>Experience notes to remember</span>
        <textarea style={{ ...field, minHeight: 90 }} value={profile.verifiedNotes} maxLength={2500} onChange={e => setProfile(prev => ({ ...prev, verifiedNotes: e.target.value }))} />
      </label>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", gridColumn: "1 / -1" }}>
        <button disabled={pending} type="submit" style={{ background: "#7251ae", color: "#fff", border: 0, borderRadius: 10, padding: "12px 18px" }}>Save career memory</button>
        {saved && <button disabled={pending} type="button" onClick={erase} style={{ border: "1px solid #c8c1d9", borderRadius: 10, padding: "12px 18px" }}>Delete saved profile</button>}
        <span role="status" style={{ fontSize: 13 }}>{saved ? "Profile saved. Edit and save to update." : "No saved profile yet."}</span>
      </div>
    </form>
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><h3 style={{ fontWeight: 700, fontSize: 20 }}>Saved recommendations</h3><button type="button" disabled={pending} onClick={() => void refresh().catch(() => setError("Could not refresh OCC memory."))}>Refresh history</button></div>
      <p style={{ opacity: .8, fontSize: 13 }}>Accept or reject suggestions for your OCC review history. Accepting does not edit, export, or submit your CV.</p>
      {runs.length === 0 && <p>No saved recommendation sessions yet. Use the save option when asking OCC for advice.</p>}
      {runs.map(run => <article key={run.id} style={{ border: "1px solid #c8c1d9", padding: 16, borderRadius: 12, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <p><strong>{new Date(run.createdAt).toLocaleDateString()}</strong> — {run.summary}</p>
          <button type="button" disabled={pending} onClick={() => deleteRun(run.id)} aria-label="Delete this saved recommendation session">Delete session</button>
        </div>
        {run.recommendations.map((rec, i) => <div key={i} style={{ display: "grid", gap: 5, paddingTop: 8, borderTop: "1px solid #c8c1d9" }}>
          <strong>{rec.requirement}</strong><p>{rec.suggestion}</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13 }}>Decision: {rec.decision ?? "pending"}</span>
            <button disabled={pending} onClick={() => decide(run.id, i, "accepted")} type="button">Accept</button>
            <button disabled={pending} onClick={() => decide(run.id, i, "rejected")} type="button">Reject</button>
          </div>
        </div>)}
      </article>)}
    </div>
    {error && <p role="alert" style={{ color: "#b44444" }}>{error}</p>}
  </section>;
}
