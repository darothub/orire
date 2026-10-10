import type { Metadata } from "next";
import Link from "next/link";
import "../content.css";
import { GUIDES } from "@/lib/content/guides";

export const metadata: Metadata = {
  title: "CV guides — practical advice for a stronger CV | Orire",
  description:
    "Practical, honest guides on tailoring your CV, quantifying achievements, getting past ATS, and choosing a template.",
  alternates: { canonical: "/guides" },
};

export default function GuidesIndex() {
  return (
    <main className="content content-narrow">
      <Link href="/" className="content-back">← Back to Orire</Link>
      <h1>CV guides</h1>
      <p className="content-lede">
        Short, practical guides on building a stronger CV — tailoring to a role,
        quantifying impact, getting read correctly by applicant tracking systems,
        and choosing a template. Honest advice: re-frame what you have, never
        invent it.
      </p>
      <ul className="guide-list">
        {GUIDES.map((g) => (
          <li key={g.slug} className="guide-item">
            <Link href={`/guides/${g.slug}`}>
              <h2>{g.title}</h2>
              <p>{g.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
