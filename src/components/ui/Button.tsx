"use client";

import type { ButtonHTMLAttributes } from "react";
import "./ui.css";

type Variant = "primary" | "gold" | "ghost";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual intent. `gold` is reserved for the match/refine payoff action. */
  variant?: Variant;
  size?: Size;
  /** Stretch to the full width of the container. */
  block?: boolean;
}

/**
 * Design-system button. Three variants carry intent: `primary` (violet) for the
 * main action, `gold` for the match/refine payoff (at most one per view), and
 * `ghost` for secondary choices. Styled from the --or-* tokens.
 */
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    "or-btn",
    `or-btn--${variant}`,
    size === "sm" && "or-btn--sm",
    block && "or-btn--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
