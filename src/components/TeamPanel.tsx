"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { usePooledStore } from "@/lib/store/pooledStore";
import {
  acceptInviteAction,
  createTeamAction,
  deleteTeamAction,
  inviteMemberAction,
  leaveTeamAction,
  removeMemberAction,
  renameTeamAction,
  revokeInviteAction,
  setMemberRoleAction,
  teamAuditAction,
  teamOverview,
  teamUsageAction,
  transferOwnershipAction,
  type TeamOverview,
} from "@/app/actions/team";
import type { TeamAuditDTO } from "@/lib/team/audit";
import { formatMonthLabel, usageDelta, usageToCsv, type TeamUsage } from "@/lib/team/usage";
import { seatStatus } from "@/lib/team/seats";
import {
  listTeamKeysAction,
  removeTeamKeyAction,
  setTeamKeyAction,
} from "@/app/actions/teamKeys";
import type { PooledKeyDTO } from "@/lib/team/keys";

/** Providers that can hold a pooled team key (CLI logins are excluded). */
const POOLABLE: ProviderId[] = ["openai", "anthropic"];

/** Compact relative time, e.g. "just now", "4m ago", "3d ago". */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Teams panel (Phase B3). Lets a Teams-plan owner create a shared workspace,
 * invite up to the seat limit by email, and manage seats. Seated members see
 * their team and can leave. Invite links are `?invite=<token>` and are redeemed
 * here on load once the invitee is signed in.
 */
export function TeamPanel() {
  const { status } = useSession();
  const signedIn = status === "authenticated";

  const [data, setData] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [poolKeys, setPoolKeys] = useState<PooledKeyDTO[]>([]);
  const [poolDraft, setPoolDraft] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [audit, setAudit] = useState<TeamAuditDTO[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [usage, setUsage] = useState<TeamUsage | null>(null);
  const [showUsage, setShowUsage] = useState(false);
  const [openMember, setOpenMember] = useState<string | null>(null);
  const refreshPooled = usePooledStore((s) => s.refresh);

  const loadAudit = useCallback(async () => {
    setAudit(await teamAuditAction());
  }, []);

  const loadUsage = useCallback(async () => {
    setUsage(await teamUsageAction());
  }, []);

  const exportUsageCsv = useCallback(() => {
    if (!usage) return;
    const blob = new Blob([usageToCsv(usage)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orire-usage-${usage.month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [usage]);

  const loadKeys = useCallback(async () => {
    setPoolKeys(await listTeamKeysAction());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const o = await teamOverview();
    setData(o);
    setLoading(false);
    return o;
  }, []);

  // Load overview + redeem an ?invite=token link when present and signed in.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!signedIn) {
        if (!cancelled) setData(null);
        return;
      }
      const token =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("invite") : null;
      if (token) {
        const r = await acceptInviteAction(token);
        if (cancelled) return;
        if (r.ok) setNotice("You've joined the team.");
        else setError(r.error ?? "Could not accept that invite.");
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          params.delete("invite");
          const qs = params.toString();
          window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
        }
      }
      if (!cancelled) {
        await load();
        await loadKeys();
        await loadAudit();
        await loadUsage();
        await refreshPooled();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, load, loadKeys, loadAudit, loadUsage, refreshPooled]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await fn();
    if (r.ok) {
      if (ok) setNotice(ok);
      await load();
      await loadAudit();
    } else {
      setError(r.error ?? "Something went wrong.");
    }
    setBusy(false);
    return r.ok;
  };

  const runKey = async (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await fn();
    if (r.ok) {
      if (ok) setNotice(ok);
      await loadKeys();
      await refreshPooled();
    } else {
      setError(r.error ?? "Something went wrong.");
    }
    setBusy(false);
    return r.ok;
  };

  const inviteLink = (token: string) => {    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/?invite=${token}`;
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      setCopied(token);
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 1600);
    } catch {
      setError("Couldn't copy — select and copy the link manually.");
    }
  };

  // Only signed-in users who have (or can have) a team see this panel at all.
  if (!signedIn) return null;
  if (loading && !data) {
    return (
      <div className="team-panel">
        <span className="ed-label">Team</span>
        <p className="conn-hint">Loading team…</p>
      </div>
    );
  }
  if (!data) return null;
  const showCreate = data.canCreate;
  const team = data.team;
  if (!showCreate && !team) return null; // not on a team and not eligible — hide

  return (
    <motion.div
      className="team-panel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="team-head">
        <span className="ed-label">Team</span>
        {team && (() => {
          const seats = seatStatus(team.team.seatLimit - team.seatsLeft, team.team.seatLimit);
          return (
            <span
              className={`team-seats${seats.level !== "ok" ? ` is-${seats.level}` : ""}`}
              title={seats.message ?? undefined}
            >
              {team.members.length}/{team.team.seatLimit} seats
            </span>
          );
        })()}
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            key="notice"
            className="team-notice"
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {notice}
          </motion.div>
        )}
        {error && (
          <motion.div
            key="error"
            className="team-error"
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {showCreate && (
        <div className="team-create">
          <p className="conn-hint">
            Your Teams plan includes {5} seats. Create a shared workspace and invite your cohort —
            members run premium models on the team’s capability, no personal key needed.
          </p>
          <div className="team-row">
            <input
              className="team-input"
              placeholder="Team name (e.g. Acme Coaching)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
            <button
              className="team-btn team-btn-primary"
              disabled={busy || name.trim().length < 2}
              onClick={() => void run(() => createTeamAction(name), "Team created.").then((ok) => ok && setName(""))}
            >
              {busy ? "Creating…" : "Create team"}
            </button>
          </div>
        </div>
      )}

      {team && (
        <div className="team-body">
          <div className="team-title">
            {renaming ? (
              <div className="team-row team-rename">
                <input
                  className="team-input"
                  value={renameDraft}
                  placeholder="Team name"
                  maxLength={60}
                  autoFocus
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setRenaming(false);
                  }}
                />
                <button
                  className="team-btn team-btn-primary"
                  disabled={busy || renameDraft.trim().length < 2}
                  onClick={() =>
                    void run(() => renameTeamAction(renameDraft), "Team renamed.").then(
                      (ok) => ok && setRenaming(false),
                    )
                  }
                >
                  {busy ? "…" : "Save"}
                </button>
                <button className="team-link" disabled={busy} onClick={() => setRenaming(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <strong>{team.team.name}</strong>
                <span className="team-plan-badge">{team.team.plan}</span>
                {team.canManage && (
                  <button
                    className="team-link team-rename-link"
                    title="Rename team"
                    onClick={() => {
                      setRenameDraft(team.team.name);
                      setRenaming(true);
                    }}
                  >
                    Rename
                  </button>
                )}
              </>
            )}
          </div>

          <ul className="team-members">
            {team.members.map((m) => (
              <li key={m.userId} className="team-member">
                <span className="team-member-main">
                  <span className="team-member-name">{m.name || m.email || "Member"}</span>
                  <span className="team-member-role">{m.role}</span>
                </span>
                {team.role === "owner" && m.role !== "owner" && (
                  <div className="team-member-actions">
                    {m.role === "member" ? (
                      <button
                        className="team-role-btn"
                        title="Promote to admin"
                        disabled={busy}
                        onClick={() => void run(() => setMemberRoleAction(m.userId, "admin"), "Promoted to admin.")}
                      >
                        Make admin
                      </button>
                    ) : (
                      <button
                        className="team-role-btn"
                        title="Demote to member"
                        disabled={busy}
                        onClick={() => void run(() => setMemberRoleAction(m.userId, "member"), "Changed to member.")}
                      >
                        Make member
                      </button>
                    )}
                    <button
                      className="team-role-btn team-owner-btn"
                      title="Transfer ownership to this member"
                      disabled={busy}
                      onClick={() => {
                        const who = m.name || m.email || "this member";
                        if (
                          typeof window !== "undefined" &&
                          !window.confirm(`Make ${who} the owner? You'll step down to admin.`)
                        )
                          return;
                        void run(() => transferOwnershipAction(m.userId), "Ownership transferred.");
                      }}
                    >
                      Make owner
                    </button>
                    <button
                      className="team-x"
                      title="Remove member"
                      disabled={busy}
                      onClick={() => void run(() => removeMemberAction(m.userId), "Member removed.")}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {team.canManage && team.role !== "owner" && m.role !== "owner" && (
                  <button
                    className="team-x"
                    title="Remove member"
                    disabled={busy}
                    onClick={() => void run(() => removeMemberAction(m.userId), "Member removed.")}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          {team.canManage && (
            <div className="team-invite">
              <div className="team-row">
                <input
                  className="team-input"
                  type="email"
                  placeholder="teammate@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={team.seatsLeft <= 0}
                />
                <button
                  className="team-btn team-btn-primary"
                  disabled={busy || team.seatsLeft <= 0 || !email.trim()}
                  onClick={() => void run(() => inviteMemberAction(email), "Invite created.").then((ok) => ok && setEmail(""))}
                >
                  {busy ? "…" : "Invite"}
                </button>
              </div>
              <div className="team-seatmeter">
                {(() => {
                  const seats = seatStatus(team.team.seatLimit - team.seatsLeft, team.team.seatLimit);
                  return (
                    <>
                      <span className={`team-seatmeter-bar is-${seats.level}`} aria-hidden>
                        <span
                          className="team-seatmeter-fill"
                          style={{ width: `${Math.round(seats.ratio * 100)}%` }}
                        />
                      </span>
                      <span className={`team-seatsleft is-${seats.level}`}>
                        {seats.message ??
                          `${team.seatsLeft} seat${team.seatsLeft === 1 ? "" : "s"} left`}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {team.canManage && (
            <div className="team-keys">
              <span className="ed-label team-sub">Pooled provider keys</span>
              <p className="conn-hint team-keys-hint">
                Store a key once so seated members run premium models on it — no personal key needed.
                Keys are encrypted at rest and never shown again.
              </p>
              {POOLABLE.map((p) => {
                const existing = poolKeys.find((k) => k.provider === p);
                const draft = poolDraft[p] ?? "";
                return (
                  <div key={p} className="team-key-row">
                    <div className="team-key-main">
                      <span className="team-key-name">{PROVIDERS[p].label}</span>
                      {existing ? (
                        <span className="team-key-label">{existing.label}</span>
                      ) : (
                        <span className="team-key-label team-key-empty">Not set</span>
                      )}
                    </div>
                    {existing && (
                      <span className="team-key-audit">
                        {existing.setByName ? `Set by ${existing.setByName}` : "Set by a teammate"}
                        {" · updated "}
                        {new Date(existing.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                    <div className="team-row team-key-controls">
                      <input
                        className="team-input"
                        type="password"
                        placeholder={existing ? "Replace key…" : `${PROVIDERS[p].label} API key`}
                        value={draft}
                        onChange={(e) => setPoolDraft((d) => ({ ...d, [p]: e.target.value }))}
                        disabled={busy}
                      />
                      <button
                        className="team-btn team-btn-primary"
                        disabled={busy || draft.trim().length < 8}
                        onClick={() =>
                          void runKey(() => setTeamKeyAction(p, draft), `${PROVIDERS[p].label} key saved.`).then(
                            (ok) => ok && setPoolDraft((d) => ({ ...d, [p]: "" }))
                          )
                        }
                      >
                        {busy ? "…" : "Save"}
                      </button>
                      {existing && (
                        <button
                          className="team-x"
                          disabled={busy}
                          onClick={() => void runKey(() => removeTeamKeyAction(p), `${PROVIDERS[p].label} key removed.`)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {team.pendingInvites.length > 0 && (
            <div className="team-pending">
              <span className="ed-label team-sub">Pending invites</span>
              <ul className="team-invites">
                {team.pendingInvites.map((inv) => (
                  <li key={inv.id} className="team-invite-row">
                    <span className="team-invite-email">{inv.email}</span>
                    <span className="team-invite-actions">
                      <button className="team-link" onClick={() => void copy(inv.token)}>
                        {copied === inv.token ? "Copied!" : "Copy link"}
                      </button>
                      {team.canManage && (
                        <button
                          className="team-x"
                          disabled={busy}
                          onClick={() => void run(() => revokeInviteAction(inv.id), "Invite revoked.")}
                        >
                          Revoke
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {team.canManage && usage && (
            <div className="team-usage">
              <button
                type="button"
                className="team-activity-toggle"
                onClick={() => setShowUsage((v) => !v)}
                aria-expanded={showUsage}
              >
                {showUsage ? "▾" : "▸"} Usage · {usage.totalThisMonth} refine
                {usage.totalThisMonth === 1 ? "" : "s"} this month
              </button>
              {showUsage && (
                <div className="team-usage-body">
                  <div className="team-usage-summary">
                    <span>
                      {formatMonthLabel(usage.month)}:{" "}
                      <strong>{usage.totalThisMonth}</strong>
                    </span>
                    <span className="team-usage-delta">
                      {usageDelta(usage.totalThisMonth, usage.totalPrevMonth)} vs{" "}
                      {formatMonthLabel(usage.prevMonth)}
                    </span>
                  </div>

                  {(() => {
                    const trendMax = Math.max(1, ...usage.monthlyTotals.map((t) => t.total));
                    return (
                      <div className="team-usage-trend" role="img" aria-label="Team refine trend">
                        {usage.monthlyTotals.map((t) => (
                          <span key={t.month} className="team-usage-trend-col">
                            <span className="team-usage-trend-bar">
                              <span
                                className="team-usage-trend-fill"
                                style={{ height: `${Math.round((t.total / trendMax) * 100)}%` }}
                              />
                            </span>
                            <span className="team-usage-trend-val">{t.total}</span>
                            <span className="team-usage-trend-label">
                              {formatMonthLabel(t.month).split(" ")[0]}
                            </span>
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {usage.members.length === 0 ? (
                    <p className="team-activity-empty">No members yet.</p>
                  ) : (
                    (() => {
                      const barMax = usage.members[0]?.thisMonth || 1;
                      const sparkMax = Math.max(
                        1,
                        ...usage.members.flatMap((m) => m.monthly),
                      );
                      return (
                        <ul className="team-usage-list">
                          {usage.members.map((m) => {
                            const open = openMember === m.userId;
                            const share =
                              usage.totalThisMonth > 0
                                ? Math.round((m.thisMonth / usage.totalThisMonth) * 100)
                                : 0;
                            const mMax = Math.max(1, ...m.monthly);
                            return (
                              <li
                                key={m.userId}
                                className={`team-usage-li${open ? " is-open" : ""}`}
                              >
                                <button
                                  type="button"
                                  className="team-usage-item"
                                  aria-expanded={open}
                                  onClick={() =>
                                    setOpenMember((cur) => (cur === m.userId ? null : m.userId))
                                  }
                                >
                                  <span className="team-usage-name" title={m.email ?? undefined}>
                                    {m.name || m.email || "Member"}
                                  </span>
                                  <span className="team-usage-count">{m.thisMonth}</span>
                                  <span className="team-usage-bar" aria-hidden>
                                    <span
                                      className="team-usage-bar-fill"
                                      style={{
                                        width: `${Math.round((m.thisMonth / barMax) * 100)}%`,
                                      }}
                                    />
                                  </span>
                                  <span
                                    className="team-usage-spark"
                                    aria-hidden
                                    title={`3-month total: ${m.windowTotal}`}
                                  >
                                    {m.monthly.map((n, i) => (
                                      <span key={i} className="team-usage-spark-col">
                                        <span
                                          className="team-usage-spark-fill"
                                          style={{ height: `${Math.round((n / sparkMax) * 100)}%` }}
                                        />
                                      </span>
                                    ))}
                                  </span>
                                  <span className="team-usage-window">{m.windowTotal}</span>
                                </button>
                                {open && (
                                  <div className="team-usage-detail">
                                    <div className="team-usage-detail-head">
                                      <span className="team-usage-detail-email">
                                        {m.email || "No email on file"}
                                      </span>
                                      <span className="team-usage-detail-share">
                                        {share}% of team this month
                                      </span>
                                    </div>
                                    <ul className="team-usage-months">
                                      {usage.months.map((mo, i) => (
                                        <li key={mo} className="team-usage-month">
                                          <span className="team-usage-month-label">
                                            {formatMonthLabel(mo)}
                                          </span>
                                          <span className="team-usage-month-bar" aria-hidden>
                                            <span
                                              className="team-usage-month-fill"
                                              style={{
                                                width: `${Math.round((m.monthly[i] / mMax) * 100)}%`,
                                              }}
                                            />
                                          </span>
                                          <span className="team-usage-month-val">
                                            {m.monthly[i]}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                    <div className="team-usage-detail-foot">
                                      {usageDelta(m.thisMonth, m.prevMonth)} vs{" "}
                                      {formatMonthLabel(usage.prevMonth)} · {m.windowTotal} in 3 mo
                                    </div>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      );
                    })()
                  )}

                  {usage.members.length > 0 && (
                    <button
                      type="button"
                      className="team-usage-export"
                      onClick={exportUsageCsv}
                    >
                      ↓ Export CSV
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {team.canManage && (
            <div className="team-activity">
              <button
                type="button"
                className="team-activity-toggle"
                onClick={() => setShowAudit((v) => !v)}
                aria-expanded={showAudit}
              >
                {showAudit ? "▾" : "▸"} Activity{audit.length ? ` (${audit.length})` : ""}
              </button>
              {showAudit && (
                audit.length === 0 ? (
                  <p className="team-activity-empty">No activity yet.</p>
                ) : (
                  <ul className="team-activity-list">
                    {audit.map((e) => (
                      <li key={e.id} className="team-activity-item">
                        <span className="team-activity-text">{e.summary}</span>
                        <time className="team-activity-time" dateTime={e.at}>
                          {timeAgo(e.at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          )}

          <div className="team-foot">
            {team.role === "owner" ? (
              <button
                className="team-btn team-btn-danger"
                disabled={busy}
                onClick={() => {
                  if (typeof window !== "undefined" && !window.confirm("Delete this team and release all seats?")) return;
                  void run(() => deleteTeamAction(), "Team deleted.");
                }}
              >
                Delete team
              </button>
            ) : (
              <button
                className="team-btn"
                disabled={busy}
                onClick={() => void run(() => leaveTeamAction(), "You left the team.")}
              >
                Leave team
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
