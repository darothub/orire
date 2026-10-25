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
        This is a browser preview using fictional CV details, not a downloadable
        sample file. In the Studio, Orire supports PDF and editable Word
        (.docx) exports, subject to your plan&apos;s download allowance.
        You can review and edit the CV before exporting; Orire should not
        invent experience that is not your own.
      </p>

      <section aria-labelledby="template-export-formats">
        <h2 id="template-export-formats">What you can export</h2>
        <p>
          <strong>PDF:</strong> a fixed-layout document for applications and sharing.
          <strong> Word (.docx):</strong> an editable document for further adjustments.
          This on-page fictional preview is not a downloadable sample file.
          Downloads are available from the Studio, subject to your plan allowance.
        </p>
      </section>

      <Link href="/" className="content-cta">Create your CV with {info.name} →</Link>

      <p style={{ marginTop: 36 }}>
        See <Link href="/templates">all {TEMPLATE_CATALOG.length} templates</Link>{" "}
        or learn <Link href="/guides/choose-the-right-cv-template">how to choose a CV template</Link>.
      </p>
    </main>
  );
}
