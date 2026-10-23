import type { Metadata } from "next";
import { publicMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import "../../content.css";
import { TEMPLATE_CATALOG, getTemplateInfo } from "@/lib/templates/catalog";
import { getTemplateCopy } from "@/lib/seo/templatesContent";
import { TemplateDetailPreview } from "@/components/templates/TemplateDetailPreview";

export function generateStaticParams() {
  return TEMPLATE_CATALOG.map((t) => ({ id: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const info = getTemplateInfo(id);
  if (!info) return {};
  const copy = getTemplateCopy(id);
  return publicMetadata(
    `${info.name} — CV template | Orire`,
    copy?.summary ?? info.blurb,
    `/templates/${id}`,
  );
}

export default async function TemplateDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const info = getTemplateInfo(id);
  if (!info) notFound();
  const copy = getTemplateCopy(id);

  return (
    <main className="content content-narrow">
      <Link href="/templates" className="content-back">← All templates</Link>
      <TemplateDetailPreview id={id} name={info.name} />
      <h1>{info.name} CV template</h1>
      <p className="content-lede">{copy?.summary ?? info.blurb}</p>

      {copy?.bestFor && (
        <p><strong>Best for:</strong> {copy.bestFor}</p>
      )}

      <ul className="tpl-traits">
        {info.blurb.split("·").map((trait, i) => (
          <li key={i}>{trait.trim()}</li>
        ))}
      </ul>

      <p style={{ marginTop: 28 }}>
        Orire offers PDF exports and editable CV designs. Orire re-frames
        your real experience into the design — it never invents anything that
        is not already in your CV.
      </p>

      <Link href="/" className="content-cta">Create your CV with {info.name} →</Link>

      <p style={{ marginTop: 36 }}>
        See <Link href="/templates">all {TEMPLATE_CATALOG.length} templates</Link>{" "}
        or learn <Link href="/guides/choose-the-right-cv-template">how to choose a CV template</Link>.
      </p>
    </main>
  );
}
