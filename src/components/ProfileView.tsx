"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useViewStore } from "@/lib/store/viewStore";
import { useUIStore } from "@/lib/store/uiStore";
import { getProfile, type ProfileData } from "@/app/actions/activity";
import { subscriptionLine, formatBillingDate } from "@/lib/billing/summary";

function initialsOf(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface StatCardProps {
  icon: string;
  value: string;
  label: string;
  sub?: string | null;
  delay: number;
}

function StatCard({ icon, value, label, sub, delay }: StatCardProps) {
  return (
    <motion.div
      className="prof-stat"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="prof-stat-icon" aria-hidden>{icon}</span>
      <span className="prof-stat-value">{value}</span>
      <span className="prof-stat-label">{label}</span>
      {sub && <span className="prof-stat-sub">{sub}</span>}
    </motion.div>
  );
}

/** Profile workspace — identity, lifetime activity and live subscription. */
export function ProfileView() {
  const { status } = useSession();
  const setView = useViewStore((s) => s.setView);
  const openAuth = useUIStore((s) => s.openAuth);
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await getProfile();
    setError(res.error ?? null);
    setData(res.data ?? null);
    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void (async () => {
      const res = await getProfile();
      if (cancelled) return;
      setError(res.error ?? null);
      setData(res.data ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [status]);

  // Re-sync the plan/activity when the user returns to the tab (e.g. after a
  // Stripe portal change or an export in another view).
  useEffect(() => {
    if (status !== "authenticated") return;
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status, load]);


  if (status === "unauthenticated") {
    return (
      <motion.div
        className="ws-view prof-view"
        initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="ws-head">
          <div>
            <h2>Your profile</h2>
            <p>Sign in to see your activity, best CV rating and subscription.</p>
          </div>
        </div>
        <div className="prof-empty">
          <button className="flow-btn primary" onClick={() => openAuth()}>Sign in</button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="ws-view prof-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>Your profile</h2>
          <p>Your activity, best CV rating and current plan — synced to your account.</p>
        </div>
        <button className="exp-reset" onClick={refresh} disabled={loading} type="button">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <div className="prof-error">{error}</div>}

      {loading && !data && <div className="prof-empty"><span className="prof-skeleton" aria-hidden /></div>}

      {data && (
        <>
          <motion.section
            className="prof-id"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {data.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.user.image} alt="" className="prof-avatar" />
            ) : (
              <span className="prof-avatar prof-avatar-fallback">
                {initialsOf(data.user.name || data.user.email || "?")}
              </span>
            )}
            <div className="prof-id-main">
              <strong className="prof-name">{data.user.name || "Unnamed"}</strong>
              <span className="prof-email">
                {data.user.email ?? "No email on file"}
                {data.user.email && (
                  <span className={`prof-verify ${data.user.emailVerified ? "ok" : "warn"}`}>
                    {data.user.emailVerified ? "✓ verified" : "unverified"}
                  </span>
                )}
              </span>
              {formatBillingDate(data.user.memberSince) && (
                <span className="prof-since">Member since {formatBillingDate(data.user.memberSince)}</span>
              )}
            </div>
          </motion.section>

          <div className="prof-stats">
            <StatCard
              icon="✦"
              value={String(data.activity.totalRefines)}
              label="Refinements"
              sub={data.activity.lastRefineAt ? `last ${formatBillingDate(data.activity.lastRefineAt)}` : "none yet"}
              delay={0.05}
            />
            <StatCard
              icon="⭳"
              value={String(data.activity.exportCount)}
              label="Exports"
              sub={data.activity.lastExportAt ? `last ${formatBillingDate(data.activity.lastExportAt)}` : "none yet"}
              delay={0.1}
            />
            <StatCard
              icon="★"
              value={data.activity.bestRating != null ? String(data.activity.bestRating) : "—"}
              label="Best CV rating"
              sub={
                data.activity.bestImprovement != null && data.activity.bestImprovement > 0
                  ? `+${data.activity.bestImprovement} best gain`
                  : data.activity.bestRating != null
                    ? "out of 100"
                    : "refine to score"
              }
              delay={0.15}
            />
          </div>

          <motion.section
            className="prof-plan"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="prof-plan-head">
              <span className="prof-plan-eyebrow">Current plan</span>
              <strong className="prof-plan-name">{data.plan.label}</strong>
              <PlanLine data={data} />
            </div>
            <div className="prof-plan-usage">
              <span className="prof-usage-figure">
                {data.plan.usedThisMonth}
                <span className="prof-usage-cap">/{data.plan.cap == null ? "∞" : data.plan.cap}</span>
              </span>
              <span className="prof-usage-label">refines this month</span>
              {data.plan.cap != null && (
                <span className="prof-usage-bar" aria-hidden>
                  <span
                    className="prof-usage-fill"
                    style={{ width: `${Math.min(100, Math.round((data.plan.usedThisMonth / Math.max(1, data.plan.cap)) * 100))}%` }}
                  />
                </span>
              )}
            </div>
            <div className="prof-plan-actions">
              <button className="flow-btn primary sm" onClick={() => setView("plans")}>Change plan</button>
              {data.plan.canManage && (
                <button className="flow-btn ghost sm" onClick={() => setView("plans")}>
                  Manage or cancel
                </button>
              )}
            </div>
            {data.plan.canManage && (
              <p className="prof-plan-cancelnote">Cancel any time — no lock-in.</p>
            )}
          </motion.section>
        </>
      )}
    </motion.div>
  );
}

function PlanLine({ data }: { data: ProfileData }) {
  const line = subscriptionLine({
    status: data.plan.status,
    renewsAt: data.plan.renewsAt,
    hasSubscription: data.plan.id !== "free",
  });
  if (!line) {
    return <span className="prof-plan-sub">{data.plan.id === "free" ? "Free forever — upgrade anytime." : "Active"}</span>;
  }
  return <span className={`prof-plan-sub ${line.tone}`}>{line.text}</span>;
}
