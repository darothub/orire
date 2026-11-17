import { notFound } from "next/navigation";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { Occ3Preview } from "@/components/occ3/Occ3Preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "OCC 3.0 Preview | Orire", robots: { index: false, follow: false } };

export default async function Occ3PreviewPage() {
  if (!(await requireOccAccess())) notFound();
  return <Occ3Preview />;
}
