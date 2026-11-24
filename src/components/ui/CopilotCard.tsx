import type { ReactNode } from "react";
import "./surfaces.css";

interface CopilotCardProps {
  /** Card title shown in the header. */
  title: string;
  /** Optional leading icon (e.g. a small glyph or SVG). */
  icon?: ReactNode;
  /** Optional trailing tag, e.g. a match delta ("70% → 93%"). */
  tag?: ReactNode;
  /** Card body. */
  children: ReactNode;
  /** Optional footer — typically handoff actions (Buttons). */
  footer?: ReactNode;
  className?: string;
}

/**
 * The shell OCC uses to render a feature result inside the conversation: header
 * (icon + title + optional tag), body, and an optional footer of handoff
 * actions. Keep it ≤ ~420px so it sits naturally in a chat bubble.
 */
export function CopilotCard({ title, icon, tag, children, footer, className = "" }: CopilotCardProps) {
  return (
    <div className={["or-rcard", className].filter(Boolean).join(" ")}>
      <div className="or-rcard__head">
        {icon}
        {title}
        {tag && <span className="or-rcard__tag">{tag}</span>}
      </div>
      <div className="or-rcard__body">{children}</div>
      {footer && <div className="or-rcard__foot">{footer}</div>}
    </div>
  );
}
