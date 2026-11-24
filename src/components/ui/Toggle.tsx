"use client";

import "./ui.css";

interface ToggleProps {
  /** Current on/off state (controlled). */
  checked: boolean;
  /** Called with the next state when the user flips the toggle. */
  onChange: (next: boolean) => void;
  /** Visible label beside the track. Also used as the accessible name. */
  label?: string;
  /** Accessible name when no visible label is shown. */
  ariaLabel?: string;
  /** Use the match-green "on" colour instead of violet (e.g. Live edit). */
  tone?: "violet" | "match";
  disabled?: boolean;
  className?: string;
}

/**
 * Controlled switch, styled from the --or-* tokens. Renders as a real
 * `aria-pressed` button so it is keyboard- and screen-reader-operable.
 */
export function Toggle({
  checked,
  onChange,
  label,
  ariaLabel,
  tone = "violet",
  disabled = false,
  className = "",
}: ToggleProps) {
  const cls = ["or-toggle", tone === "match" && "or-toggle--match", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      role="switch"
      aria-pressed={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="or-toggle__track" aria-hidden />
      {label && <span>{label}</span>}
    </button>
  );
}
