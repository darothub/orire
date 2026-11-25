import { notFound } from "next/navigation";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { V4Home } from "@/components/v4/V4Home";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Home (v4) | Orire",
  robots: { index: false, follow: false },
};

/**
 * Orire v4 Home preview. A standalone route, separate from /occ/v4 (the
 * conversation), with the same authorization: its pipeline reads the OCC
 * account routes, so it is available to the same accounts.
 */
export default async function V4HomePage() {
  if (!(await requireOccAccess())) notFound();
  return <V4Home />;
}
