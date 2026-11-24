import type { HTMLAttributes } from "react";
import "./ui.css";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Drop the resting shadow (for cards sitting inside other surfaces). */
  flat?: boolean;
  /** Apply the standard card padding. */
  pad?: boolean;
}

/**
 * Design-system surface card: --or-surface with a hairline border and the soft
 * resting shadow. Use `flat` for nested cards, `pad` for the default padding.
 */
export function Card({ flat = false, pad = false, className = "", children, ...rest }: CardProps) {
  const cls = ["or-card", flat && "or-card--flat", pad && "or-card--pad", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
