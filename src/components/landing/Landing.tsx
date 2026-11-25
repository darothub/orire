"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useConsent } from "@/lib/consent/consent";
import { funnel, type CtaPlacement } from "@/lib/analytics/funnel";
import { useUIStore } from "@/lib/store/uiStore";
import { BrandMark } from "@/components/BrandMark";
import { HeroMatchCard } from "@/components/landing/HeroMatchCard";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Reveal } from "@/components/landing/Reveal";
import { PlanCards } from "@/components/landing/PlanCards";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ArrowIcon, CheckIcon, ChatIcon, CrossIcon, LockIcon, PlusIcon, ShieldIcon } from "@/components/landing/icons";
import "./landing.css";

// Teasers show the first few perks; /pricing carries the complete list.
const TEASER_PERKS = 3;

const Mark = ({ size = 15 }: { size?: number }) => <BrandMark size={size} badge={false} />;
const Tick = () => <span className="lp-tick"><CheckIcon /></span>;

/**
 * Public, pre-auth landing page (Ink + Fortune). Three product moves — Simulate,
 * Copilot, Studio — then plans and a final call to action. Plans come from the
 * live plan policy so the page cannot drift from what the product charges; the
 * sample cards are labelled as illustrative.
 */
export function Landing() {
  const openAuth = useUIStore((s) => s.openAuth);
  const setExplored = useUIStore((s) => s.setExplored);
  const { consent, ready } = useConsent();
  useEffect(() => {
    if (consent === "granted") funnel.landingViewed();
  }, [consent]);
  const startSignup = (placement: CtaPlacement, plan?: Parameters<typeof openAuth>[1]) => {
    funnel.landingCta(placement);
    openAuth("signup", plan);
  };

  return (
    <div className="lp">
      <div className="lp-ambient" aria-hidden="true"><i /><i /></div>
      <a className="skip-to-main" href="#main-content">Skip to main content</a>

      <header className="lp-nav">
        <div className="lp-nav-in">
          <a className="lp-brand" href="#" aria-label="Orire home">
            <BrandMark size={28} badge={false} />
            <b>Orire</b>
          </a>
          <nav className="lp-links" aria-label="Sections">
            <a href="#simulate">Simulate</a>
            <a href="#copilot">Copilot</a>
            <a href="#studio">Studio</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="lp-actions">
            <button className="lp-btn lp-btn--ghost lp-btn--sm lp-signin" disabled={!ready} onClick={() => openAuth("signin")}>
              Sign in
            </button>
            <button className="lp-btn lp-btn--gold lp-btn--sm lp-header-cta" disabled={!ready} aria-label="Start free" onClick={() => startSignup("header")}>
              <span className="lp-cta-long">Start free</span>
              <span className="lp-cta-short" aria-hidden="true">Start</span>
            </button>
            <LandingMobileNav interactiveReady={ready} />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            {/* Primary message stays in server HTML; actions enable after hydration. */}
            <div className="lp-hero-copy">
              <span className="lp-kicker"><Mark />ìre — good fortune, engineered</span>
              <h1 className="lp-title">
                Meet the ideal candidate.<br />Then <em>close the gap.</em>
              </h1>
              <p className="lp-sub">
                Orire builds the CV a recruiter would call a perfect match for the exact job you want — then
                shows you precisely what to fix. Tailor, simulate, and apply, all guided by your career copilot.
              </p>
              <div className="lp-cta-row">
                <button className="lp-btn lp-btn--gold lp-btn--lg" disabled={!ready} onClick={() => startSignup("hero")}>
                  Start free — no card<ArrowIcon />
                </button>
                <a className="lp-btn lp-btn--ghost lp-btn--lg" href="#simulate">See how it works</a>
              </div>
              <p className="lp-note"><ShieldIcon />Fact-grounded AI — it never invents experience you don&apos;t have.</p>
              <button className="lp-guest-link lp-guest" disabled={!ready} onClick={() => setExplored(true)}>
                Or try it as a guest
              </button>
            </div>
            <HeroMatchCard />
          </div>
        </section>

        <div className="lp-trust">
          <ul className="lp-wrap lp-trust-in">
            <li><CheckIcon w={2} />ATS-safe PDF &amp; Word</li>
            <li><ShieldIcon />Fact-grounded AI</li>
            <li><LockIcon />GDPR-ready, EU-built</li>
            <li><ChatIcon />Your copilot, on tap</li>
          </ul>
        </div>

        <section id="simulate" className="lp-feat" aria-label="Simulate">
          <div className="lp-wrap lp-feat-grid">
            <Reveal className="lp-ftext">
              <div className="lp-eyebrow"><Mark />The hero move</div>
              <h2 className="lp-h2">See the ideal candidate for the exact role.</h2>
              <p>
                Paste a job description and Orire models the perfect-fit candidate for it — then maps it against
                your experience, so you know your real match and precisely what&apos;s missing before you apply.
              </p>
              <ul className="lp-flist">
                <li><Tick />A live match score for every role, not a vague &quot;looks good&quot;</li>
                <li><Tick />The exact gaps, ranked — with one tap to fix each in Studio</li>
                <li><Tick />Grounded in what you&apos;ve actually done — nothing invented</li>
              </ul>
              <button className="lp-flink" disabled={!ready} onClick={() => startSignup("hero")}>
                Try a simulation<ArrowIcon />
              </button>
            </Reveal>
            <Reveal className="lp-vcard">
              <div className="lp-mcard-h">
                <div className="lp-co" aria-hidden="true">P</div>
                <div><b>Product Engineer</b><span>Dublin</span></div>
                <div className="lp-live is-match">91% match</div>
              </div>
              <div className="lp-box">
                <div className="lp-box-h">The ideal candidate wants…</div>
                <ul className="lp-box-b">
                  <li><span className="lp-d ok"><CheckIcon /></span>5 yrs React, TypeScript, Next.js</li>
                  <li><span className="lp-d part"><PlusIcon /></span>Led a design system (you contributed to one)</li>
                  <li><span className="lp-d miss"><CrossIcon /></span>Core Web Vitals ownership</li>
                </ul>
              </div>
              <span className="lp-ill">Illustrative example</span>
            </Reveal>
          </div>
        </section>

        <section id="copilot" className="lp-feat lp-feat--tight" aria-label="Orire Career Copilot">
          <div className="lp-wrap lp-feat-grid is-rev">
            <Reveal className="lp-ftext">
              <div className="lp-eyebrow"><Mark />Orire Career Copilot</div>
              <h2 className="lp-h2">Your whole job search, by conversation.</h2>
              <p>
                Ask for what you need and the copilot runs it — tailoring, matching, templates, cover letters — and
                hands you the result inline, ready to open in full. The studio, in plain language.
              </p>
              <ul className="lp-flist">
                <li><Tick />&quot;Tailor my CV for this role&quot; → a fact-grounded refine, done</li>
                <li><Tick />Every answer links straight to the full tool</li>
              </ul>
            </Reveal>
            <Reveal className="lp-vcard">
              <div className="lp-chat" role="img" aria-label="Example conversation: a user asks the copilot to tailor their CV and it returns three fact-grounded changes, raising the match from 70% to 93%.">
                <div className="lp-msg user"><div className="lp-av">A</div><div className="lp-bub">Tailor my CV for the Stripe role</div></div>
                <div className="lp-msg bot"><div className="lp-av">✦</div><div className="lp-bub">Done — three fact-grounded changes, each tied to something you&apos;ve shipped.</div></div>
                <div className="lp-msg bot is-wide">
                  <div className="lp-av">✦</div>
                  <div className="lp-chat-card">
                    <div className="lp-cch"><span style={{ color: "var(--or-gold)" }}>✦</span>CV tailored for Stripe<span className="lp-tag">70% → 93%</span></div>
                    <ul className="lp-ccb">
                      <li><CheckIcon w={3} />Reframed the component-library bullet around ownership</li>
                      <li><CheckIcon w={3} />Added a Core Web Vitals result (LCP ↓ 1.4s)</li>
                      <li><CheckIcon w={3} />Added WCAG 2.1 to skills</li>
                    </ul>
                  </div>
                </div>
              </div>
              <span className="lp-ill">Illustrative example</span>
            </Reveal>
          </div>
        </section>

        <section id="studio" className="lp-feat lp-feat--tight" aria-label="CV Studio">
          <div className="lp-wrap lp-feat-grid">
            <Reveal className="lp-ftext">
              <div className="lp-eyebrow"><Mark />CV Studio</div>
              <h2 className="lp-h2">Refine with AI — and see what changed.</h2>
              <p>
                Every AI edit is shown before and after, with the reason, so you accept it on purpose. Edit any line
                live, compose from building blocks, and switch between ATS-safe and designed templates in a click.
              </p>
              <ul className="lp-flist">
                <li><Tick />Transparent edits — accept or reject each change</li>
                <li><Tick />Live inline editing + a version library per company</li>
                <li><Tick />ATS-safe and Design templates, clearly labelled</li>
              </ul>
            </Reveal>
            <Reveal className="lp-vcard">
              <div className="lp-diff">
                <div className="lp-diff-h"><span>Suggested edit</span><span>fact-grounded</span></div>
                <div className="lp-old">Responsible for the component library used across the product.</div>
                <div className="lp-new">Owned the company-wide component library, cutting new-feature build time ~30% across 6 product teams.</div>
                <div className="lp-act" aria-hidden="true"><span className="rej">Reject</span><span className="acc">Accept change</span></div>
              </div>
              <ul className="lp-tpls">
                <li className="lp-tpl"><div className="lp-mini" />Modern <span className="lp-tb ats">ATS</span></li>
                <li className="lp-tpl"><div className="lp-mini" />Classic <span className="lp-tb ats">ATS</span></li>
                <li className="lp-tpl"><div className="lp-mini" />Editorial <span className="lp-tb des">Design</span></li>
              </ul>
              <span className="lp-ill">Illustrative example</span>
            </Reveal>
          </div>
        </section>

        <section id="pricing" className="lp-pricing" aria-label="Plans">
          <div className="lp-wrap">
            <Reveal>
              <div className="lp-eyebrow"><Mark />Pricing</div>
              <h2 className="lp-h2">Start free. Upgrade when it lands you interviews.</h2>
              <p className="lp-psub">No card to try it. Tailor a CV, run your first simulation, and export today.</p>
            </Reveal>
            <PlanCards perkLimit={TEASER_PERKS} disabled={!ready} onChoose={(p) => startSignup("pricing", p.id)} />
            <p className="lp-plans-more">
              Prices in USD; paid plans renew monthly and free quotas are lifetime totals.{" "}
              <Link href="/pricing">See every feature and the full terms</Link>
            </p>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap">
            <Reveal className="lp-final-card">
              <span className="lp-mk"><BrandMark size={52} badge={false} /></span>
              <h2>Send the right CV for this job.</h2>
              <p>See your match, close the gap, and apply with a copilot in your corner. Free to start.</p>
              <button className="lp-btn lp-btn--gold lp-btn--lg" disabled={!ready} onClick={() => startSignup("footer")}>
                Start free — no card<ArrowIcon />
              </button>
            </Reveal>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
