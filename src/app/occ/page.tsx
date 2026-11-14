import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { OccWorkspace } from "@/components/occ/OccWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Career Copilot | Orire", robots: { index: false, follow: false } };

export default async function OccPage() {
  if (!(await requireOccAccess())) notFound();
  return (
    <main style={{ maxWidth: 1050, margin: "0 auto", padding: "clamp(16px, 4vw, 48px)" }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 24 }}>
        <Link href="/">← Back to Orire workspace</Link>
      </nav>
      <OccWorkspace />
    </main>
  );
}
