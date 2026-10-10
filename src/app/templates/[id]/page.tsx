import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "../../content.css";
import { TEMPLATE_CATALOG, getTemplateInfo } from "@/lib/templates/catalog";
import { getTemplateCopy } from "@/lib/seo/templatesContent";

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
  return {
    title: `${info.name} — CV template | Orire`,
    description: copy?.summary ?? info.blurb,
    alternates: { canonical: `/templates/${id}` },
  };
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
      <span className="tpl-hero" style={{ display: "block", background: info.swatch }} aria-hidden />
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
        Every template is ATS-ready and exports to a clean PDF. Orire re-frames
        your real experience into the design — it never invents anything that
        is not already in your CV.
      </p>

      <Link href="/" className="content-cta">Use the {info.name} template →</Link>

      <p style={{ marginTop: 36 }}>
        See <Link href="/templates">all {TEMPLATE_CATALOG.length} templates</Link>{" "}
        or learn <Link href="/guides/choose-the-right-cv-template">how to choose a CV template</Link>.
      </p>
    </main>
  );
}
