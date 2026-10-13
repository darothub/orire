"use client";

import { useId } from "react";

/**
 * orire brand mark — a four-leaf clover, the universal emblem of good luck
 * (fitting, since "orire" means good fortune). Four heart-shaped leaves meet at
 * the centre, filled with orire's signature gradient. Distinct from the generic
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
  const leaf =
    "M32 32 C 31 27 26.5 26 24 23 C 21 19.5 22.5 14.5 27 15 C 29.5 15.3 31 17.3 32 19.5 C 33 17.3 34.5 15.3 37 15 C 41.5 14.5 43 19.5 40 23 C 37.5 26 33 27 32 32 Z";
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
          <stop stopColor="#17b892" />
          <stop offset="0.55" stopColor="#3ad9b4" />
          <stop offset="1" stopColor="#17b892" />
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
      <g fill={`url(#${id}-g)`}>
        <path d={leaf} />
        <path d={leaf} transform="rotate(90 32 32)" />
        <path d={leaf} transform="rotate(180 32 32)" />
        <path d={leaf} transform="rotate(270 32 32)" />
      </g>
      {/* Stem — a slim sprig trailing from the clover. */}
      <path
        d="M32 32 C 34 40 37 45 41 49"
        fill="none"
        stroke={`url(#${id}-g)`}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
