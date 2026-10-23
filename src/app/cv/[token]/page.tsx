import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedCV } from "@/lib/share/shared";
import { getTemplate } from "@/components/templates/registry";

// A shared CV is private-by-link and must never be indexed by search engines.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const shared = await getSharedCV(token);
  const title = shared ? `${shared.name} — CV` : "Shared CV";
  return privateMetadata(title);
}

export default async function SharedCVPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedCV(token);
  if (!shared) notFound();

  const Template = getTemplate(shared.template).Component;

  return (
    <main className="share-page">
      <div className="share-paper-wrap">
        <div className="share-paper">
          <Template cv={shared.data} />
        </div>
      </div>
      <footer className="share-foot">
        <span>Shared via</span>
        <Link href="/" className="share-foot-link">Orire · AI CV Studio</Link>
      </footer>
    </main>
  );
}
