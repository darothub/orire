"use client";

import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import { memo } from "react";
import { getTemplate } from "@/components/templates/registry";
import { sampleVariants } from "@/lib/cv/samples";
import type { CVData } from "@/lib/cv/schema";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Curated, visually distinct templates distributed across parallax columns. */
const SHOWCASE_COLUMNS: { ids: string[]; dur: number; dir: 1 | -1 }[] = [
  { ids: ["aurora", "imperial", "carbon", "sapphire"], dur: 52, dir: 1 },
  { ids: ["noir", "oxford", "marigold", "plum"], dur: 66, dir: -1 },
  { ids: ["vertex", "bordeaux", "crimson", "consul"], dur: 58, dir: 1 },
];

/**
 * Living template showcase — orire's own CVs drift upward/downward in parallax
 * columns behind a card or hero. Shared by the auth gate and the landing hero
 * so there is one source of truth for the signature backdrop.
 */
export function CvShowcase() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="auth-showcase"
      aria-hidden
      inert
      initial={false}
      animate={{ opacity: 0.5 }}
      exit={{ opacity: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.9, ease: EASE }}
    >
      <MotionConfig reducedMotion="always">
        {SHOWCASE_COLUMNS.map((col, i) => (
          <div
            key={i}
            className={`sc-col ${reducedMotion ? "" : col.dir > 0 ? "sc-up" : "sc-down"}`}
            style={{ ["--dur" as string]: `${col.dur}s` }}
          >
            {(reducedMotion ? col.ids : [...col.ids, ...col.ids]).map((id, j) => (
              <ShowcaseCard key={`${id}-${j}`} id={id} cv={sampleVariants[(i * 3 + j) % sampleVariants.length]} />
            ))}
          </div>
        ))}
      </MotionConfig>
    </motion.div>
  );
}

const ShowcaseCard = memo(function ShowcaseCard({ id, cv }: { id: string; cv: CVData }) {
  const t = getTemplate(id);
  const Component = t.Component;
  return (
    <div className="sc-card">
      <div className="sc-scale">
        <div className="paper sc-paper">
          <Component cv={cv} />
        </div>
      </div>
    </div>
  );
});
