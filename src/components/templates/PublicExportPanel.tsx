import Link from "next/link";
import { meterFor, PLANS } from "@/lib/plan/plan";
import { PUBLIC_PDF_SAMPLE_URL } from "@/lib/cv/publicSample";
import { PublicWordSample } from "./PublicWordSample";

function allowance(plan: "free" | "pro" | "career") {
  const { cap, scope } = meterFor(plan, "download");
  if (cap === null) return "unlimited downloads";
  return `${cap} ${scope === "lifetime" ? "lifetime" : "monthly"} downloads`;
}

/** Examples are public; visitors' own exports retain Studio authorization. */
export function PublicExportPanel() {
  return (
    <section className="public-export-panel" aria-labelledby="public-export-heading">
      <h2 id="public-export-heading">See what you&apos;ll export</h2>
      <p>PDF preserves the selected design. Word uses a clean, single-column layout. TXT is plain text.</p>
      <p>
        {PLANS.free.label}: {allowance("free")}.{" "}
        {allowance("pro") === allowance("career")
          ? `${PLANS.pro.label} and ${PLANS.career.label}: ${allowance("pro")}.`
          : `${PLANS.pro.label}: ${allowance("pro")}. ${PLANS.career.label}: ${allowance("career")}.`}
      </p>
      <div className="public-export-actions">
        <Link className="public-export-button public-export-preview" href="/templates/aurora">View fictional CV</Link>
        <a className="public-export-button" href={PUBLIC_PDF_SAMPLE_URL} download="Orire-fictional-Aurora-CV.pdf">Sample PDF</a>
        <PublicWordSample compact />
      </div>
      <p className="public-export-note">Fictional Aurora sample. No account needed to inspect the example; sample downloads do not use your allowance.</p>
    </section>
  );
}
