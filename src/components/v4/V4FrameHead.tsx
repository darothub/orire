import Link from "next/link";
import { V4_COPILOT_HREF, V4_STUDIO_HREF } from "@/lib/v4/nav";

/**
 * The CV Studio header, shared by the studio tools and the Copilot chat: the
 * title and a switch. Off shows the studio tools; on shows the Copilot chat.
 * The switch is a link, so each side is its own route.
 */
export function V4FrameHead({ subtitle, copilotOn }: { subtitle: string; copilotOn: boolean }) {
  return (
    <header className="v4-frame-head">
      <div>
        <h1>CV Studio</h1>
        <p>{subtitle}</p>
      </div>
      <Link href={copilotOn ? V4_STUDIO_HREF : V4_COPILOT_HREF} className={`v4-switch${copilotOn ? " on" : ""}`} role="switch" aria-checked={copilotOn} aria-label="Copilot">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        Copilot
        <span className="v4-switch-track" aria-hidden><i /></span>
        <small>{copilotOn ? "On" : "Off"}</small>
      </Link>
    </header>
  );
}
