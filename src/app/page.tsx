"use client";

import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { Landing } from "@/components/landing/Landing";

// Keep editor, AI and export dependencies out of anonymous landing requests.
// SSR stays enabled so a seeded authenticated session still receives its shell.
const WorkspaceApp = dynamic(() => import("@/components/WorkspaceApp"));

export default function Home() {
  const { status } = useSession();
  return (
    <>
      {status === "authenticated" ? <WorkspaceApp /> : <Landing />}
      <AuthOverlay />
    </>
  );
}
