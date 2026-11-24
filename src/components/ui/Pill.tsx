import type { HTMLAttributes } from "react";
import "./ui.css";

type Tone = "saved" | "applied" | "interview" | "offer" | "neutral";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  /** The application state this pill represents. */
  tone?: Tone;
  /** Show the leading status dot (status is never carried by colour alone). */
  dot?: boolean;
}

/**
 * Status pill for the outcome loop: Saved / Applied / Interview / Offer, plus a
 * neutral variant. Pair with `dot` so the state reads without relying on colour.
 */
export function Pill({ tone = "neutral", dot = true, className = "", children, ...rest }: PillProps) {
  const cls = ["or-pill", `or-pill--${tone}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {dot && <span className="or-pill__dot" aria-hidden />}
      {children}
    </span>
  );
}
