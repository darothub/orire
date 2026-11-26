import { notFound } from "next/navigation";
import { requireOccAccess } from "@/lib/occ/requireAccess";

/**
 * Every v4 page is available to the same accounts as the Copilot (/occ/v4):
 * the pages read the OCC account routes. Anyone else gets a plain 404.
 */
export async function requireV4Access(): Promise<void> {
  if (!(await requireOccAccess())) notFound();
}

/** Shared page options for v4 routes: dynamic and never indexed. */
export const V4_DYNAMIC = "force-dynamic" as const;
export const v4Metadata = (title: string) => ({
  title: `${title} (v4) | Orire`,
  robots: { index: false, follow: false },
});
