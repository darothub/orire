import Link from "next/link";
import { TEMPLATE_COUNT, getTemplateInfo } from "@/lib/templates/catalog";
import { TemplateGuidePreview } from "@/components/guides/TemplateGuidePreview";

const COMPARISONS = [
  {
    id: "meridian",
    category: "Minimal",
    structure: "Linear single-column reading",
    advice:
      "A calm starting point when work history should do most of the talking.",
    consideration:
      "Keep enough space between roles so similar-looking entries remain easy to scan.",
  },
  {
    id: "oxford",
    category: "Classic",
    structure: "Traditional single-column structure",
    advice:
      "For structured, restrained presentation without losing personality.",
    consideration:
      "Check that its distinctive headings still leave enough room for your strongest results.",
  },
  {
    id: "vertex",
    category: "Expressive",
    structure: "Sidebar with a visual accent",
    advice:
      "A more expressive approach where a design-led layout suits the role.",
    consideration:
      "Inspect the exported text order if you submit this sidebar design through an application system.",
  },
] as const;

/** Editorial page for /guides/choose-the-right-cv-template only.
 * Other guide scaffolds remain untouched until their own content review. */
export function ChooseTemplateGuide() {
  return (
    <main id="main-content" className="content ux107">
      <Link href="/guides" className="content-back">
        ← All guides
      </Link>

      <header className="ux107-hero">
        <span className="ux107-overline">Orire field guide / Template choice</span>
        <h1>Pick a CV template that puts your experience first.</h1>
        <p>
          The right layout helps someone find your strongest work quickly.
          Start with readability, the experience you need to fit, and the expectations
          of the role—then choose a style that feels like you.
        </p>
        <div className="ux107-actions">
          <Link href="/templates" className="ux107-primary">
            Explore all {TEMPLATE_COUNT} templates <span aria-hidden="true">↗</span>
          </Link>
          <a href="#compare-designs" className="ux107-secondary">
            Compare 3 real designs <span aria-hidden="true">↓</span>
          </a>
        </div>
        <p className="ux107-caption">
          Every example below uses the same fictional CV. The design changes;
          the person&apos;s experience does not.
        </p>
      </header>

      <aside className="ux107-three" aria-label="Three considerations for choosing a CV layout">
        <div className="ux107-mini">
          <strong>01 · Clarity</strong>
          <p>Can someone find your role, employers and accomplishments at a glance?</p>
        </div>
        <div className="ux107-mini">
          <strong>02 · Fit</strong>
          <p>Is there enough room for relevant experience without cramped text?</p>
        </div>
        <div className="ux107-mini">
          <strong>03 · Tone</strong>
          <p>Does the design suit the role and organization you&apos;re applying to?</p>
        </div>
      </aside>

      <section className="ux107-section" aria-labelledby="start-heading">
        <span className="ux107-overline">Start with the content</span>
        <h2 id="start-heading">Choose the frame, not the facts.</h2>
        <p className="ux107-lede">
          A template should support your evidence rather than compete with it.
          Ask yourself three questions before deciding on a color or layout.
        </p>
        <ol className="ux107-steps">
          <li>
            <b aria-hidden="true">01</b>
            <strong>What must stand out?</strong>
            <p>
              Prioritize the roles, outcomes and projects most relevant to this
              application. Keep the substance honest—layout cannot replace evidence.
            </p>
          </li>
          <li>
            <b aria-hidden="true">02</b>
            <strong>How much must fit?</strong>
            <p>
              Dense experience needs clear spacing, descriptive headings and a
              sensible reading order, not progressively smaller type.
            </p>
          </li>
          <li>
            <b aria-hidden="true">03</b>
            <strong>Who will read it?</strong>
            <p>
              A restrained design often suits conventional settings. More expressive
              layouts can work where visual communication is relevant.
            </p>
          </li>
        </ol>
      </section>

      <section className="ux107-section" id="compare-designs" aria-labelledby="compare-heading">
        <span className="ux107-overline">Actual Orire CV templates</span>
        <h2 id="compare-heading">One CV. Three different first impressions.</h2>
        <p className="ux107-lede">
          These are live renders of real Orire templates, each using the same
          fictional Ada Okonkwo CV. Compare their hierarchy, structure and tone—not
          unsupported promises about ATS scores or interview outcomes.
        </p>
        <div className="ux107-grid">
          {COMPARISONS.map(({ id, category, structure, advice, consideration }, i) => {
            const info = getTemplateInfo(id);
            if (!info) return null;
            return (
              <article className="ux107-card" key={id}>
                <div className="ux107-card-top">
                  <strong>{category}</strong>
                  <span>{String(i + 1).padStart(2, "0")} / 03</span>
                </div>
                <TemplateGuidePreview id={id} name={info.name} />
                <div className="ux107-card-text">
                  <h3>{info.name}</h3>
                  <p>{info.blurb}</p>
                  <p className="ux107-feature">{structure}</p>
                  <p>{advice}</p>
                  <p className="ux107-consideration"><strong>Check:</strong> {consideration}</p>
                  <Link href={`/templates/${id}`} aria-label={`Preview ${info.name} CV template`}>
                    Preview {info.name} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        <p className="ux107-footnote">
          Illustrative CV details are fictional. Open each public template page
          to inspect its complete layout; the examples above are miniature previews.
        </p>
      </section>

      <section className="ux107-section" aria-labelledby="columns-heading">
        <span className="ux107-overline">Readability and parsing</span>
        <h2 id="columns-heading">One column or a sidebar?</h2>
        <p className="ux107-lede">
          Both can look professional. Evaluate the actual reading order and the
          application requirements rather than assuming any layout automatically
          passes an applicant tracking system.
        </p>
        <div className="ux107-columns">
          <article className="ux107-col">
            <h3>Single-column layouts</h3>
            <p>
              Usually offer a straightforward path through employment history
              and are a sensible starting point for text-rich applications.
              Good spacing and clear section names still matter.
            </p>
            <p>
              <strong>Real Orire examples:</strong>{" "}
              <Link href="/templates/meridian">Meridian</Link> and{" "}
              <Link href="/templates/oxford">Oxford</Link>.
            </p>
          </article>
          <article className="ux107-col">
            <h3>Layouts with sidebars</h3>
            <p>
              Visually separate compact details from the main experience, but
              do not assume the export will be interpreted in that visual order.
              Check small-text readability and selectability.
            </p>
            <p>
              <strong>Real Orire example:</strong>{" "}
              <Link href="/templates/vertex">Vertex</Link>.
            </p>
          </article>
        </div>
      </section>

      <section className="ux107-section ux107-finish" aria-labelledby="finish-heading">
        <span className="ux107-overline">The final check</span>
        <h2 id="finish-heading">Try your actual content before committing.</h2>
        <ol>
          <li>Check that the most relevant experience appears early.</li>
          <li>Review spacing, section headings and font size on mobile and desktop.</li>
          <li>
            After exporting, verify the PDF has selectable text, a sensible
            reading order and no missing details.
          </li>
          <li>
            Follow any file-type instructions in the job posting; no template
            can guarantee how every employer&apos;s software will interpret a CV.
          </li>
        </ol>
        <div className="ux107-actions">
          <Link href="/templates" className="ux107-primary">
            Browse all CV templates <span aria-hidden="true">→</span>
          </Link>
          <Link href="/" className="ux107-secondary">
            Start building your CV
          </Link>
        </div>
      </section>
    </main>
  );
}
