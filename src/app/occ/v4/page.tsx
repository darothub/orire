import { notFound } from "next/navigation";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { Occ4Workspace } from "@/components/occ4/Occ4Workspace";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Career Copilot (occ4) | Orire",
  robots: { index: false, follow: false },
};

/**
 * occ4 preview route. Same authorization as /occ; renders the design-system
 * rebuild of the conversational surface alongside the existing occ2/occ3.
 */
export default async function Occ4Page() {
  if (!(await requireOccAccess())) notFound();
  return <Occ4Workspace />;
}
