"use client";

import { useTheme } from "@/components/theme/useTheme";

/** Sun/moon theme switch. Icon shows the theme you'll switch *to*. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggle}
      title={`Switch to ${next} theme`}
      aria-label={`Switch to ${next} theme`}
    >
      <span className="theme-toggle-ic" aria-hidden>
        {theme === "light" ? "☾" : "☀"}
      </span>
    </button>
  );
}
