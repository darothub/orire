import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Simulate moved into the CV Studio. */
export default function V4SimulateRedirect() {
  redirect("/v4/studio/simulate");
}
