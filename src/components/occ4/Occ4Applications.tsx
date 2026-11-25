"use client";

import { useEffect, useState } from "react";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/occ/applicationSave";
import { CopilotCard } from "@/components/ui/CopilotCard";
import { Button } from "@/components/ui/Button";

type App = {
  id: string; company: string; role: string; status: ApplicationStatus;
  link: string | null; notes: string; documentId: string | null; updatedAt: string;
};

const Spark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

/**
 * Applications board — Saved → Applied → Interview → Offer. Persisted to the
 * user's account via /api/occ/applications (no CV/JD text stored). Add, move
 * across stages, and remove, with optimistic updates.
 */
export function Occ4Applications({ seedRole = "" }: { seedRole?: string }) {
  const [apps, setApps] = useState<App[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState(seedRole);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/occ/applications", { cache: "no-store" });
        const d = await r.json();
        if (cancelled) return;
        if (r.ok) setApps(Array.isArray(d.applications) ? d.applications : []);
        else setErr(typeof d.error === "string" ? d.error : "Couldn't load your applications.");
      } catch {
        if (!cancelled) setErr("Couldn't load your applications.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function add() {
    const c = company.trim();
    if (!c || adding) return;
    setAdding(true); setErr("");
    try {
      const r = await fetch("/api/occ/applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: c, role: role.trim(), status: "saved" }),
      });
      const d = await r.json();
      if (r.ok && d.application) { setApps((a) => [d.application as App, ...a]); setCompany(""); setRole(""); }
      else setErr(typeof d.error === "string" ? d.error : "Couldn't add that application.");
    } catch {
      setErr("Couldn't add that application.");
    } finally {
      setAdding(false);
    }
  }
  async function move(app: App, dir: 1 | -1) {
    const i = APPLICATION_STATUSES.indexOf(app.status) + dir;
    if (i < 0 || i >= APPLICATION_STATUSES.length) return;
    const status = APPLICATION_STATUSES[i];
    setApps((a) => a.map((x) => (x.id === app.id ? { ...x, status } : x)));
    try { await fetch(`/api/occ/applications/${encodeURIComponent(app.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); }
    catch { /* optimistic — a reload reconciles */ }
  }
  async function remove(app: App) {
    setApps((a) => a.filter((x) => x.id !== app.id));
    try { await fetch(`/api/occ/applications/${encodeURIComponent(app.id)}`, { method: "DELETE" }); }
    catch { /* optimistic */ }
  }

  return (
    <CopilotCard title="Applications" icon={<Spark />}>
      <div className="occ4-apps-add">
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" aria-label="Company" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (optional)" aria-label="Role" />
        <Button variant="gold" size="sm" disabled={!company.trim() || adding} onClick={() => void add()}>
          {adding ? "Adding…" : "Add"}
        </Button>
      </div>
      {!loaded ? (
        <p className="occ4-pv-empty">Loading your applications…</p>
      ) : (
        <div className="occ4-apps-board">
          {APPLICATION_STATUSES.map((s) => {
            const inCol = apps.filter((a) => a.status === s);
            return (
              <div className="occ4-apps-col" key={s}>
                <div className="occ4-apps-col-head">{APPLICATION_STATUS_LABELS[s]}<span>{inCol.length}</span></div>
                {inCol.map((a) => (
                  <div className="occ4-apps-card" key={a.id}>
                    <b>{a.company}</b>
                    {a.role && <span className="occ4-apps-role">{a.role}</span>}
                    <div className="occ4-apps-ctl">
                      <button type="button" onClick={() => void move(a, -1)} disabled={s === "saved"} aria-label="Move back">‹</button>
                      <button type="button" onClick={() => void move(a, 1)} disabled={s === "offer"} aria-label="Move forward">›</button>
                      <button type="button" onClick={() => void remove(a)} aria-label="Remove">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {err && <p className="occ4-disclaimer" style={{ color: "var(--or-gap)" }}>{err}</p>}
      <p className="occ4-disclaimer">Tracks where each application stands, saved to your account. No CV or JD text is stored here.</p>
    </CopilotCard>
  );
}
