import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { CookiePreferencesLink } from "@/components/analytics/CookiePreferencesLink";

/** Public footer shared by the landing page and /pricing. */
export function LandingFooter({ home = "" }: { home?: string }) {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap">
        <div className="lp-foot-in">
          <div className="lp-foot-brand">
            <div className="lp-brand"><BrandMark size={28} badge={false} /><b>Orire</b></div>
            <p>An AI CV studio and career copilot. Ink and fortune — built in Porto for the whole of Europe.</p>
          </div>
          <div className="lp-foot-cols">
            <nav className="lp-foot-col" aria-label="Product">
              <h4>Product</h4>
              <Link href={`/${home}#simulate`}>Simulate the gap</Link>
              <Link href={`/${home}#copilot`}>Career Copilot</Link>
              <Link href={`/${home}#studio`}>CV Studio</Link>
              <Link href="/pricing">Pricing</Link>
            </nav>
            <nav className="lp-foot-col" aria-label="Legal and help">
              <h4>Trust</h4>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/support">Support</Link>
              <CookiePreferencesLink />
            </nav>
            <nav className="lp-foot-col" aria-label="Explore">
              <h4>Explore</h4>
              <Link href="/templates">Templates</Link>
              <Link href="/guides">CV guides</Link>
            </nav>
          </div>
        </div>
        <div className="lp-foot-base">
          <span>© {new Date().getFullYear()} Orire. Made in Porto.</span>
          <span>ìre — good fortune, engineered.</span>
        </div>
      </div>
    </footer>
  );
}
