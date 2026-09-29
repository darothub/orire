import type { Variants } from "framer-motion";

export const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 220, damping: 26 },
  },
};

export function dateRange(start?: string, end?: string, current?: boolean) {
  const e = current ? "Present" : end || "";
  if (start && e) return `${start} — ${e}`;
  return start || e || "";
}

export function normalizedHref(url: string) {
  return `https://${url.replace(/^https?:\/\//, "")}`;
}
