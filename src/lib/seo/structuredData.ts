/**
 * schema.org JSON-LD for the public site. Built from real plan data so the
 * offers stay in sync with pricing. Deliberately emits NO aggregateRating or
 * review markup — the on-page testimonials are not verified, and fabricated
 * rating structured data is a rich-results policy violation.
 */
import { PLANS, PLAN_ORDER } from "@/lib/plan/plan";

const NAME = "Orire";
const DESCRIPTION =
  "Rebrand and refine your CV with elegant, animated templates. Upload a PDF or DOCX, tailor it to a job description, and download an ATS-ready PDF or Word (.docx).";

export function buildStructuredData(siteUrl: string) {
  const base = siteUrl.replace(/\/+$/, ""); // tolerate a stray trailing slash

  const organization = {
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: NAME,
    url: `${base}/`,
    logo: `${base}/icon.svg`,
  };

  const website = {
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: NAME,
    url: `${base}/`,
    publisher: { "@id": `${base}/#organization` },
  };

  const offers = PLAN_ORDER.map((id) => {
    const plan = PLANS[id];
    return {
      "@type": "Offer",
      name: plan.label,
      price: plan.price.toFixed(2),
      priceCurrency: "USD",
      category: "subscription",
      description: plan.blurb,
    };
  });

  const application = {
    "@type": "SoftwareApplication",
    "@id": `${base}/#app`,
    name: NAME,
    url: `${base}/`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: DESCRIPTION,
    offers,
    publisher: { "@id": `${base}/#organization` },
  };

  return {
    "@context": "https://schema.org",
    "@graph": [organization, website, application],
  };
}
