import type { ReactNode } from "react";
import type { WorkspaceView } from "@/lib/store/viewStore";

const PATHS: Record<WorkspaceView, ReactNode> = {
  spotlight: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
  create: <path d="M12 5v14M5 12h14" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  rebrand: <path d="M20 12a8 8 0 10-2.3 5.7M20 5v5h-5" />,
  coach: <path d="M12 3a6 6 0 00-3.5 10.9V17h7v-3.1A6 6 0 0012 3zM9.5 20h5" />,
  refine: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8L18 16z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
    </>
  ),
  cover: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6.5L20.5 7" />
    </>
  ),
  export: <path d="M12 3v12M7 11l5 5 5-5M5 20h14" />,
  history: <path d="M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />,
  rate: <path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.4 6.6 20.3l1.1-6.1L3.2 9.9l6.1-.8L12 3.5z" />,
  plans: <path d="M12 3l9 9-9 9-9-9 9-9z" />,
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  connect: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
};

/** Line icon for a workspace view — one consistent set instead of mixed emoji. */
export function ViewIcon({ view, size = 20 }: { view: WorkspaceView; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[view]}
    </svg>
  );
}
