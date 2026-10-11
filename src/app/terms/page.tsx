import type { Metadata } from "next";
import Link from "next/link";
import "../legal.css";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Terms of Service — Orire",
  description: "The terms that govern your use of Orire.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="legal">
      <Link href="/" className="legal-back">← Back to Orire</Link>
      <h1>Terms of Service</h1>
      <p className="legal-updated">Last updated: {COMPANY.lastUpdated}</p>

      <h2>1. Agreement to these terms</h2>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of Orire
        {COMPANY.legalEntity ? ` operated by ${COMPANY.legalEntity}` : ""}
        (&ldquo;Orire&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an
        account or using the Service, you agree to these Terms. If you do not
        agree, do not use the Service.
      </p>

      <h2>2. Who can use Orire</h2>
      <p>
        You must be at least {COMPANY.minimumAge} years old and able to enter
        into a binding contract.
      </p>

      <h2>3. Your account</h2>
      <p>
        You are responsible for the accuracy of your account details, for keeping
        your password secure, and for all activity under your account. Tell us
        promptly at {COMPANY.supportEmail} if you suspect unauthorised use.
      </p>

      <h2>4. Plans, pricing and billing</h2>
      <ul>
        <li>The Service offers a Free plan and paid Pro and Career subscriptions at the prices shown on our pricing page. Prices are stated inclusive or exclusive of applicable VAT as shown at checkout.</li>
        <li>Paid subscriptions renew automatically each billing period until cancelled. You can cancel anytime; cancellation takes effect at the end of the current period, and you keep access until then.</li>
        <li>Payments are processed by {COMPANY.paymentProvider}. By subscribing you authorise us to charge your chosen payment method on each renewal.</li>
        <li>We may change prices or plan features with reasonable notice; changes take effect at your next renewal.</li>
      </ul>

      <h2>5. Right of withdrawal and refunds (EU consumers)</h2>
      <p>
        As an EU consumer you normally have 14 days to withdraw from a purchase of
        digital services. Because the Service is supplied immediately, by starting
        to use a paid feature you expressly request that we begin at once and
        acknowledge that you lose the 14-day right of withdrawal once the service
        has been fully performed. Nothing here limits mandatory rights you have
        under Portuguese or EU consumer law.
      </p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>upload content you do not have the right to use, or that is unlawful, infringing or harmful;</li>
        <li>upload another person&rsquo;s CV or personal data without a lawful basis to do so;</li>
        <li>attempt to disrupt, reverse-engineer, scrape or overload the Service;</li>
        <li>resell or redistribute the Service or its templates except as expressly permitted;</li>
        <li>misuse the AI features to generate false or misleading claims about yourself or others.</li>
      </ul>

      <h2>7. Your content</h2>
      <p>
        You keep all ownership of the CVs, text and job descriptions you upload or
        create (&ldquo;Your Content&rdquo;). You grant us a limited, non-exclusive
        licence to host, process and transmit Your Content solely to operate and
        provide the Service to you — including sending it to our AI processors to
        re-brand, tailor and score it. We do not claim ownership of your CV, and
        we do not use Your Content to train AI models. You are responsible for the
        accuracy of Your Content and for reviewing every output before you use it.
      </p>

      <h2>8. AI-generated output</h2>
      <ul>
        <li>AI output may contain errors and must be reviewed and verified by you before you rely on or submit it;</li>
        <li>Orire is designed to re-frame your real experience and not to invent it, but you remain solely responsible for ensuring every statement in your final CV is truthful and accurate;</li>
        <li>the deterministic score, match simulation and compare &amp; judge features are guidance tools only;</li>
        <li>we make no guarantee of any interview, job offer or other outcome.</li>
      </ul>

      <h2>9. Our intellectual property</h2>
      <p>
        The Service, including its templates, design, branding and software,
        belongs to Orire or its licensors. We grant you a limited, revocable,
        non-transferable licence to use the Service and to export CVs you create
        for your own personal job-seeking use. The &ldquo;Orire&rdquo; name and
        logo may not be used without our permission.
      </p>

      <h2>10. Third-party services</h2>
      <p>
        The Service relies on third parties (for example payment, hosting and AI
        providers). We are not responsible for their services, and your use of
        them may be subject to their own terms.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;.
        To the extent permitted by law, we disclaim all implied warranties,
        including fitness for a particular purpose. This does not exclude any
        warranty that cannot be excluded under Portuguese or EU law.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        To the extent permitted by law, Orire will not be liable for indirect,
        incidental or consequential loss, or for lost opportunities, jobs or
        profits. Our total liability for any claim relating to the Service is
        limited to the amount you paid us in the 12 months before the claim.
        Nothing limits liability for death or personal injury caused by
        negligence, for fraud, or for any liability that cannot be limited under
        applicable law.
      </p>

      <h2>13. Indemnity</h2>
      <p>
        You agree to indemnify Orire against claims and costs arising from your
        misuse of the Service or your breach of these Terms, including from
        content you had no right to upload.
      </p>

      <h2>14. Suspension and termination</h2>
      <p>
        You may stop using the Service and close your account at any time. We may
        suspend or terminate your access if you breach these Terms or use the
        Service unlawfully. Sections that by their nature should survive (for
        example ownership, disclaimers and liability) continue to apply.
      </p>

      <h2>15. Changes to the Service and these Terms</h2>
      <p>
        We may update the Service and these Terms. If we make material changes we
        will post the updated Terms here, update the date above, and where
        required give you notice. Continued use after changes take effect means
        you accept them.
      </p>

      <h2>16. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of {COMPANY.jurisdiction}, and the
        courts of {COMPANY.jurisdiction} have jurisdiction, without affecting any
        mandatory consumer protections in your country of residence. EU consumers
        may also use the European Commission&rsquo;s Online Dispute Resolution
        platform at{" "}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.
      </p>

      <p className="legal-foot">
        {COMPANY.legalEntity || "Orire"} · {COMPANY.supportEmail}
        {COMPANY.address ? ` · ${COMPANY.address}` : ""}
      </p>
    </main>
  );
}
