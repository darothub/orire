import { publicMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import "../legal.css";
import { COMPANY } from "@/lib/legal/company";

export const metadata = publicMetadata(
  "Privacy Policy — Orire",
  "How Orire collects, uses and protects your personal data.",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <main className="legal">
      <Link href="/" className="legal-back">← Back to Orire</Link>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: {COMPANY.lastUpdated}</p>

      <h2>1. Who we are</h2>
      <p>
        Orire (&ldquo;Orire&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;,
        &ldquo;our&rdquo;) is an AI CV studio
        {COMPANY.legalEntity ? ` operated by ${COMPANY.legalEntity}` : ""}
        {COMPANY.legalEntity && COMPANY.registrationNumber ? `, registered in ${COMPANY.jurisdiction} under number ${COMPANY.registrationNumber}` : ""}
        {COMPANY.legalEntity && COMPANY.address ? `, based in ${COMPANY.address}` : ""}.
        We are the <strong>data controller</strong> for the personal data
        processed through this website (the &ldquo;Service&rdquo;). For any
        privacy question or to exercise your rights, start an enquiry through Instagram at{" "}
        <a href={COMPANY.contactUrl}>{COMPANY.contactLabel}</a>. Do not send CVs,
        passwords, identity documents or payment details through Instagram.
      </p>

      <h2>2. Scope</h2>
      <p>
        This policy explains what personal data we collect, why we process it,
        our legal bases, who we share it with, how long we keep it, and the
        rights you have under the EU General Data Protection Regulation (GDPR)
        and Portuguese data-protection law.
      </p>

      <h2>3. The personal data we collect</h2>
      <ul>
        <li><strong>Account data</strong> — your name, email address, a hashed password, and your plan / subscription status.</li>
        <li><strong>CV content you upload or create</strong> — the full contents of any CV you upload (PDF or DOCX) or edit: name, contact details, employment history, education, skills and anything else you choose to include.</li>
        <li><strong>Special-category and third-party data</strong> — a CV can contain special categories of data (e.g. references to health, religion or trade-union membership) and personal data about other people (e.g. referees). You decide what to include; we process it solely on your instruction to provide the Service to you.</li>
        <li><strong>Job descriptions</strong> you paste in to tailor or score a CV.</li>
        <li><strong>Payment data</strong> — processed by {COMPANY.paymentProvider}. We receive confirmation of payment and limited billing details; we do not store full card numbers.</li>
        <li><strong>Usage and device data</strong> — log data, IP address, browser and device type, pages viewed and actions taken, used for security and to improve the Service.</li>
        <li><strong>Cookies and similar technologies</strong> — see section 10.</li>
      </ul>

      <h2>4. Why we process your data, and our legal bases</h2>
      <ul>
        <li><strong>To provide the Service</strong> — manage your account, read your CV into structured sections, re-brand, tailor, score and export it. <em>Legal basis: performance of a contract (Art. 6(1)(b)).</em></li>
        <li><strong>To process CV content through AI.</strong> <em>Legal basis: performance of a contract. Where your CV contains special-category data, we rely on your explicit consent and the fact that you have manifestly chosen to include that information yourself (Art. 9(2)(a)/(e)).</em></li>
        <li><strong>Billing, accounting and fraud prevention.</strong> <em>Legal basis: contract and compliance with a legal obligation.</em></li>
        <li><strong>Security, debugging and abuse prevention.</strong> <em>Legal basis: legitimate interests.</em></li>
        <li><strong>Product analytics and improvement.</strong> <em>Legal basis: consent, where required.</em></li>
        <li><strong>Marketing emails</strong>, if any. <em>Legal basis: consent — withdrawable at any time.</em></li>
      </ul>

      <h2>5. How your CV is processed by AI</h2>
      <p>
        To re-brand, tailor, compare and score your CV, we send your CV content
        and any job description you provide to AI model providers. We currently use {COMPANY.aiProviders};
        a request may be routed to
        either provider, including when the other provider is unavailable. The
        deterministic rating runs on our own systems and involves no AI model
        call.
      </p>

      <p>
        Uploaded PDF, DOCX and LinkedIn ZIP files are read on our server to extract
        their text or CV fields. The parsing step does not save the original file.
        Extracted content can become a draft; AI features may send that content
        to the providers above. Drafts can be stored in your browser; while
        signed in, edits can also be saved automatically to your account.
        Library saves retain versions. AI responses may also be temporarily
        cached to avoid repeating a request.
      </p>
      <p>
        The providers describe their API data handling in their own policies:
        {" "}<a href="https://openai.com/business-data/">OpenAI business data</a> and
        {" "}<a href="https://privacy.anthropic.com/">Anthropic Privacy Center</a>.
        Their published commercial defaults do not use API inputs and outputs
        for model training. This is not a promise of zero retention; provider
        retention, safety processing and any applicable exceptions are governed
        by the relevant service terms.
      </p>

      <h2>6. Who we share data with</h2>
      <p>
        Service providers involved in operating Orire include hosting/infrastructure,
        our AI model providers ({COMPANY.aiProviders}), payment processing
        ({COMPANY.paymentProvider}), authentication and email delivery, and
        analytics. If you contact us through Instagram, your message is also
        processed by Instagram under its own privacy policy. Use it for an
        initial enquiry, not for sending sensitive documents. We do
        <strong> not</strong> sell your personal data.
      </p>

      <h2>7. International transfers</h2>
      <p>
        Providers may process data outside the European Economic Area. For
        information about the providers involved in your request and applicable
        transfer safeguards, start a privacy enquiry at{" "}
        <a href={COMPANY.contactUrl}>{COMPANY.contactLabel}</a>.
      </p>

      <h2>8. How long we keep your data</h2>
      <ul>
        <li><strong>Account data:</strong> while your account is active, then deleted within {COMPANY.retention.account} of account closure.</li>
        <li><strong>CV content:</strong> kept so you can access your drafts; deleted when you delete it, or within {COMPANY.retention.account} of account closure.</li>
        <li><strong>Billing records:</strong> our policy is to retain these for {COMPANY.retention.billingYears} for accounting purposes.</li>
        <li><strong>Logs:</strong> kept for {COMPANY.retention.logs}.</li>
      </ul>

      <p>
        These are our retention periods, not a claim that account deletion
        immediately removes every copy. Backups, provider records and support
        messages are separate from the active account database; ask us about
        their retention and deletion when making a privacy request.
      </p>

      <h2>9. Your rights</h2>
      <p>
        Under the GDPR you have the right to access, rectification, erasure,
        restriction, data portability, and to object to certain processing, as
        well as to withdraw consent at any time. For an initial privacy
        enquiry, contact <a href={COMPANY.contactUrl}>{COMPANY.contactLabel}</a>
        {" "}on Instagram without sending sensitive documents. You may also lodge a
        complaint with the Portuguese supervisory authority, the Comissão
        Nacional de Proteção de Dados (CNPD) —{" "}
        <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">www.cnpd.pt</a>.
      </p>

      <ul>
        <li><strong>Export my data:</strong> sign in with a verified account and
          open the account menu. This downloads a JSON file containing your
          account profile, saved CVs, refinement records, plan and usage records,
          and export history. It excludes passwords and authentication secrets,
          and does not include external billing records or service logs.</li>
        <li><strong>Delete account:</strong> open the account menu and choose
          Delete account. After confirmation, the app removes your account and
          associated records from its active database. It also attempts to cancel
          an active subscription. If cancellation fails or you see a later charge,
          contact support; account deletion is not itself a refund.</li>
        <li><strong>Browser copies:</strong> drafts in browser storage and downloaded files
          are separate. Signing out or deleting your account does not erase all
          local copies. Clear Orire&rsquo;s site data in your browser settings
          and remove downloaded files if you want to remove those copies.</li>
      </ul>

      <h2>10. Cookies</h2>
      <p>
        We use strictly necessary cookies to run the Service (for example, to
        keep you signed in). We load analytics and advertising technologies only
        after you consent through our cookie banner; you can change your choice
        at any time.
      </p>

      <h2>11. Children</h2>
      <p>
        The Service is not intended for anyone under {COMPANY.minimumAge}, and we
        do not knowingly collect their data.
      </p>

      <h2>12. Security</h2>
      <p>
        We use industry-standard measures — encryption in transit, hashed
        passwords, and access controls — to protect your data. No method of
        transmission or storage is completely secure.
      </p>

      <h2>13. Changes to this policy</h2>
      <p>
        We may update this policy. We will post the updated version here, change
        the &ldquo;Last updated&rdquo; date, and notify you of material changes.
      </p>

      <p className="legal-foot">
        {COMPANY.legalEntity || "Orire"} · <a href={COMPANY.contactUrl}>{COMPANY.contactLabel}</a>
        {COMPANY.address ? ` · ${COMPANY.address}` : ""}
      </p>
    </main>
  );
}
