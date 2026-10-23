import type { Metadata } from "next";
import { publicMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import "../../content.css";
import "../template-choice.css";
import { ChooseTemplateGuide } from "@/components/guides/ChooseTemplateGuide";
import { GUIDES, getGuide, isPublishedGuide } from "@/lib/content/guides";

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
  const metadata = publicMetadata(
    `${guide.title} | Orire`,
    guide.description,
    `/guides/${slug}`,
  );
  if (!isPublishedGuide(slug)) {
    metadata.robots = { index: false, follow: false };
    metadata.alternates = { canonical: null };
  }
  return metadata;
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

  const articles: Record<string, { lead: string; steps: { title: string; body: string }[]; before: string; after: string; note: string }> = {
    "tailor-cv-to-job-description": {
      lead: "A stronger application starts with what you have genuinely done. Use the job description to bring your most relevant evidence forward.",
      steps: [
        { title: "Extract the requirements", body: "Read the advert and group its responsibilities, technologies, and qualifications into must-have and desirable requirements. Make a note of which ones you can demonstrate with real examples." },
        { title: "Match each requirement to evidence", body: "For each skill you have, find a project, achievement, or responsibility that demonstrates it. Leave unsupported requirements out rather than claiming experience you do not have." },
        { title: "Reorder for relevance", body: "Put the most relevant accomplishments near the top of your summary and within each role. Keep job titles, employment dates and qualifications accurate." },
        { title: "Use the employer’s terminology naturally", body: "If you have used PostgreSQL and the job asks for PostgreSQL, name it specifically. Do not copy keywords into unrelated bullets or add skills you cannot explain." },
        { title: "Review and export", body: "Read your CV as a recruiter would. Is the relevant evidence easy to find? Check spelling, dates, selectable text and the employer’s preferred file format before submitting." },
      ],
      before: "Responsible for deployment processes.",
      after: "Automated a release checklist for the payments service, reducing manual deployment steps from 12 to 4.",
      note: "Illustrative rewrite only. Use numbers like these only when you can verify them from your own work.",
    },
    "quantify-achievements-on-your-cv": {
      lead: "Numbers make scope and outcomes easier to understand, but only if they reflect work you actually did.",
      steps: [
        { title: "Start with your action", body: "Describe the change you personally made: built, improved, coordinated, automated, delivered or resolved. Avoid vague phrases like 'responsible for' when you can name the work." },
        { title: "Find evidence you can verify", body: "Look in project reports, dashboards or notes for volume, time, quality, reliability, team size or delivery frequency. Use an agreed baseline rather than guessing." },
        { title: "Explain the outcome", body: "Combine action, scope and impact in a short bullet. Clearly distinguish your own contribution from a result achieved by the wider team." },
        { title: "If numbers are unavailable, use honest scope", body: "Specific non-numeric evidence still helps: 'Coordinated weekly releases across three teams' tells more than 'Supported releases'. Never manufacture percentages." },
        { title: "Check every figure", body: "Confirm the unit, timeframe and calculation. Mark reasonable approximations as approximate and do not present estimates as audited results." },
      ],
      before: "Worked on customer service performance.",
      after: "Redesigned triage for a six-person support team, reducing median first response from 10 hours to 6.",
      note: "Illustrative figures, not verified results. Replace with evidence from your own projects.",
    },
    "beat-applicant-tracking-systems-ats": {
      lead: "There is no universal trick or guaranteed ATS score. Make your CV readable to software and compelling to the people who evaluate it.",
      steps: [
        { title: "Use familiar section headings", body: "Label sections Experience, Education and Skills so readers and parsing systems can recognize them. Keep essential contact details as real, selectable text." },
        { title: "Prefer a clear reading order", body: "Avoid turning your CV into an image. Complex tables, columns and decorative elements may parse inconsistently across different systems; check your exported document." },
        { title: "Use relevant language, not keyword stuffing", body: "Include exact tools and qualifications you actually have, naturally within skills and accomplishments. Hidden text and pasted job descriptions are not useful evidence." },
        { title: "Verify the submitted file", body: "Follow the employer's PDF or DOCX instructions. Open the export, copy text to a plain-text editor and check that titles, dates and bullets appear in a sensible order." },
        { title: "Optimize for the human reader too", body: "Make the first page clear about your relevant experience. Different employers use different systems, so accurate, concise content matters more than trying to game a filter." },
      ],
      before: "Image-only CV with decorative section labels and repeated keywords.",
      after: "Text-selectable CV using Experience, Education and Skills headings, with relevant tools shown in genuine work examples.",
      note: "No template can guarantee an interview or ranking. Always check the actual export.",
    },
  };
  const article = articles[slug];
  if (!article) notFound();
  return (
    <main className="content ux107 ux150">
      <Link href="/guides" className="content-back">← All guides</Link>
      <header className="ux107-hero">
        <span className="ux107-overline">Orire career guides · Practical advice</span>
        <h1>{guide.title}</h1>
        <p>{article.lead}</p>
        <div className="ux107-actions">
          <Link className="ux107-primary" href="/">Create your CV →</Link>
          <Link className="ux107-secondary" href="/templates">Explore templates</Link>
        </div>
      </header>
      <section className="ux107-section" aria-labelledby="guide-method">
        <span className="ux107-overline">Your action plan</span>
        <h2 id="guide-method">Five steps you can apply today</h2>
        <ol className="ux150-steps">
          {article.steps.map((step, index) => (
            <li key={step.title} className="ux107-mini">
              <span className="ux107-overline">Step {String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="ux107-section" aria-labelledby="guide-example">
        <span className="ux107-overline">See the difference</span>
        <h2 id="guide-example">An illustrative before and after</h2>
        <div className="ux107-columns">
          <div className="ux107-col"><h3>Before</h3><p>{article.before}</p></div>
          <div className="ux107-col"><h3>After</h3><p>{article.after}</p></div>
        </div>
        <p className="ux107-footnote">{article.note}</p>
      </section>
      <section className="ux107-section ux107-finish" aria-labelledby="guide-next">
        <span className="ux107-overline">Put it into practice</span>
        <h2 id="guide-next">Make your next CV clearer, not less honest.</h2>
        <p>Apply the steps to your own experience, review every claim, and choose a design that keeps the result readable.</p>
        <div className="ux107-actions">
          <Link className="ux107-primary" href="/">Open Orire Studio →</Link>
          <Link className="ux107-secondary" href="/guides">Read another guide</Link>
        </div>
      </section>
    </main>
  );
}
