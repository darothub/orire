"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { V4_HOME_HREF } from "@/lib/v4/nav";

/** Visible only when BOTH the server kill switch and Career entitlement pass.
 *  Also links the /app Home preview, which uses the same access rule. */
export function OccEntry() {
  const [permitted, setPermitted] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/occ/access", { cache: "no-store", signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!controller.signal.aborted) setPermitted(data?.permitted === true); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!permitted) return null;
  return (
    <>
      <Link href={V4_HOME_HREF} className="btn-ghost" aria-label="Open the Orire v4 Home preview">Home v4</Link>
      <Link href="/occ" className="btn-primary" aria-label="Open Orire Career Copilot">✦ Career Copilot</Link>
    </>
  );
}
