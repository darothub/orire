/**
 * Orire brand mark — the "Burst": four long gold points on the axes (fortune,
 * ìre) and four short violet points on the diagonals (the copilot). Built from
 * two clean intersecting blades so the points stay sharp at any size.
 *
 * API is unchanged from the previous mark (size / badge / className) so every
 * call site keeps working.
 */
export function BrandMark({
  size = 24,
  badge = true,
  className,
}: {
  size?: number;
  /** Draw the rounded-square ink tile behind the glyph (app-icon style). */
  badge?: boolean;
  className?: string;
}) {
  const GOLD = "#F5C56B";
  const VIOLET = "#8273F6";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {badge && <rect width="120" height="120" rx="30" fill="#171320" />}
      <g transform="rotate(45 60 60)">
        <path
          fill={VIOLET}
          d="M60 32 C57.5 46 57.5 74 60 88 C62.5 74 62.5 46 60 32 Z M32 60 C46 57.5 74 57.5 88 60 C74 62.5 46 62.5 32 60 Z"
        />
      </g>
      <path
        fill={GOLD}
        d="M60 10 C56 42 56 78 60 110 C64 78 64 42 60 10 Z M10 60 C42 56 78 56 110 60 C78 64 42 64 10 60 Z"
      />
    </svg>
  );
}
