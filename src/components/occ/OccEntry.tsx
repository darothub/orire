"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Visible only when BOTH the server kill switch and Career entitlement pass. */
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
  return <Link href="/occ" className="btn-primary" aria-label="Open Orire Career Copilot">✦ Career Copilot</Link>;
}
