import type { Variants } from "framer-motion";

export const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.12 },
  },
};

export const item: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(3px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 210, damping: 24 },
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
