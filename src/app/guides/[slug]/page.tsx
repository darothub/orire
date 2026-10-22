import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "../../content.css";
import "../template-choice.css";
import { ChooseTemplateGuide } from "@/components/guides/ChooseTemplateGuide";
import { GUIDES, getGuide } from "@/lib/content/guides";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: `${guide.title} | Orire`,
    description: guide.description,
    alternates: { canonical: `/guides/${slug}` },
  };
}

export default async function GuideArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  if (slug === "choose-the-right-cv-template") return <ChooseTemplateGuide />;

  return (
    <main className="content content-narrow">
      <Link href="/guides" className="content-back">← All guides</Link>
      <h1>{guide.title}</h1>
      <p className="content-lede">{guide.description}</p>

      <p className="guide-draft">
        Outline — section headings and notes are in place; the prose is still to
        be written.
      </p>

      {guide.sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          <p className="guide-outline">{s.outline}</p>
        </section>
      ))}

      <p style={{ marginTop: 36 }}>
        Ready to apply this? <Link href="/">Open Orire</Link> or browse{" "}
        <Link href="/templates">CV templates</Link>.
      </p>
    </main>
  );
}
