import type { Metadata } from "next";
import Link from "next/link";
import "../content.css";
import { TEMPLATE_CATALOG } from "@/lib/templates/catalog";

export const metadata: Metadata = {
  title: "CV templates — 25 ATS-ready designs | Orire",
  description:
    "Browse Orire's 25 CV templates — from minimal and corporate to bold and executive. Pick one, upload your CV, and export an ATS-ready PDF.",
  alternates: { canonical: "/templates" },
};

export default function TemplatesIndex() {
  return (
    <main className="content">
      <Link href="/" className="content-back">← Back to Orire</Link>
      <h1>CV templates</h1>
      <p className="content-lede">
        {TEMPLATE_CATALOG.length} professionally designed, ATS-ready templates —
        from calm and minimal to bold and executive. Pick one, upload the CV you
        already have, and Orire re-lays it into the design, then exports a clean
        PDF. Your facts stay yours; only the presentation changes.
      </p>
      <div className="tpl-grid">
        {TEMPLATE_CATALOG.map((t) => (
          <Link key={t.id} href={`/templates/${t.id}`} className="tpl-card">
            <span className="tpl-swatch" style={{ background: t.swatch }} aria-hidden />
            <span className="tpl-card-body">
              <span className="tpl-card-name">{t.name}</span>
              <span className="tpl-card-blurb">{t.blurb}</span>
            </span>
          </Link>
        ))}
      </div>
      <p style={{ marginTop: 40 }}>
        Not sure which to pick? Read{" "}
        <Link href="/guides/choose-the-right-cv-template">how to choose a CV template</Link>.
      </p>
    </main>
  );
}
