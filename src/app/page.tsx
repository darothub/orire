"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useUIStore, readGuestFlag } from "@/lib/store/uiStore";
import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { Landing } from "@/components/landing/Landing";

// Keep editor, AI and export dependencies out of anonymous landing requests.
// SSR stays enabled so a seeded authenticated session still receives its shell.
const WorkspaceApp = dynamic(() => import("@/components/WorkspaceApp"));

export default function Home() {
  const { status } = useSession();
  const explored = useUIStore((s) => s.explored);
  const setExplored = useUIStore((s) => s.setExplored);
  // Restore a returning guest after hydration (SSR always renders the landing).
  useEffect(() => {
    if (readGuestFlag()) setExplored(true);
  }, [setExplored]);
  const showWorkspace = status === "authenticated" || (status === "unauthenticated" && explored);
  return (
    <>
      {showWorkspace ? <WorkspaceApp /> : <Landing />}
      <AuthOverlay />
    </>
  );
}
