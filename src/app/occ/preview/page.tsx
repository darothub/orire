import { notFound } from "next/navigation";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { OccChatPreview } from "@/components/occ/OccChatPreview";

export const dynamic = "force-dynamic";
export const metadata = { title: "OCC 3.0 Preview | Orire", robots: { index: false, follow: false } };

export default async function OccChatPreviewPage() {
  if (!(await requireOccAccess())) notFound();
  return <OccChatPreview />;
}
