"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUIStore, readGuestFlag } from "@/lib/store/uiStore";
import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { Landing } from "@/components/landing/Landing";
import { clearResumeOverlay, RESUME_SCRIPT } from "@/lib/resume";
import { classicChosen, setClassicChosen, v4Landing, wantsClassic } from "@/lib/v4/classic";

// Keep editor, AI and export dependencies out of anonymous landing requests.
// SSR stays enabled so a seeded authenticated session still receives its shell.
const WorkspaceApp = dynamic(() => import("@/components/WorkspaceApp"));

export default function Home() {
  const { status } = useSession();
  const router = useRouter();
  const explored = useUIStore((s) => s.explored);
  const setExplored = useUIStore((s) => s.setExplored);
  // Restore a returning guest after hydration (SSR always renders the landing).
  useEffect(() => {
    if (readGuestFlag()) setExplored(true);
  }, [setExplored]);
  // A visitor with nothing to resume sees the landing right away.
  useEffect(() => {
    if (status === "unauthenticated" && !readGuestFlag()) clearResumeOverlay();
  }, [status]);
  useEffect(() => {
    const t = setTimeout(clearResumeOverlay, 8000);
    return () => clearTimeout(t);
  }, []);
  // Signed-in people who can use v4 land in /app, unless they chose to stay on classic (/?classic=1).
  useEffect(() => {
    if (status !== "authenticated") return;
    if (wantsClassic(window.location.search)) {
      setClassicChosen(true);
      window.history.replaceState(null, "", "/");
      return;
    }
    if (classicChosen()) return;
    let live = true;
    fetch("/api/v4/access", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enabled?: boolean } | null) => {
        if (live && d?.enabled) router.replace(v4Landing(window.location.search));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [status, router]);
  const showWorkspace = status === "authenticated" || (status === "unauthenticated" && explored);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: RESUME_SCRIPT }} />
      <div className="resume-overlay" role="status" aria-live="polite">
        <span className="resume-spin" aria-hidden="true" />
        Refreshing your workspace…
      </div>
      {showWorkspace ? <WorkspaceApp /> : <Landing />}
      <AuthOverlay />
    </>
  );
}
