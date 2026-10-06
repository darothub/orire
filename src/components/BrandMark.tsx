"use client";

import { useId } from "react";

/**
 * orire brand mark — a "rising-O": an open ring with an ascending arrow,
 * signalling a CV lifted and re-branded upward. Distinct from the generic
 * sparkle/star patterns common to AI apps.
 */
export function BrandMark({
  size = 24,
  badge = true,
  className,
}: {
  size?: number;
  /** Draw the rounded-square badge behind the glyph. */
  badge?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="10" y1="56" x2="54" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6ee7d0" />
          <stop offset="0.55" stopColor="#8b7cff" />
          <stop offset="1" stopColor="#f5a3c7" />
        </linearGradient>
      </defs>
      {badge && (
        <>
          <rect width="64" height="64" rx="16" fill="#0b0d12" />
          <rect
            x="1.25"
            y="1.25"
            width="61.5"
            height="61.5"
            rx="14.75"
            fill="none"
            stroke={`url(#${id}-g)`}
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
        </>
      )}
      <path
        d="M36.8 22.84 A14 14 0 1 1 27.2 22.84"
        fill="none"
        stroke={`url(#${id}-g)`}
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      <path d="M32 27 L32 11" stroke={`url(#${id}-g)`} strokeWidth="5.2" strokeLinecap="round" />
      <path
        d="M24.8 18.2 L32 10.4 L39.2 18.2"
        fill="none"
        stroke={`url(#${id}-g)`}
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
