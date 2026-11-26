import { redirect } from "next/navigation";
import { V4_SIMULATE_HREF } from "@/lib/v4/nav";

export const dynamic = "force-dynamic";

/** Simulate moved into the CV Studio. */
export default function V4SimulateRedirect() {
  redirect(V4_SIMULATE_HREF);
}
