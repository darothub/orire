"use client";

import { useState } from "react";
import { Reorder, AnimatePresence, motion } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { SECTION_LABELS, ALL_SECTIONS, type SectionKey } from "@/lib/cv/schema";
import { moveAt } from "@/lib/cv/reorder";

/**
 * Drag the chips to reorder CV sections (req 17); toggle sections on/off.
 * A section renders only while present in `order`, so removing a chip hides it
 * from every template. Hidden sections keep their data — re-adding restores it.
 *
 * Drag has no keyboard equivalent, so every chip also gets explicit
 * move-earlier/move-later buttons — same pattern as the editor's card lists
 * and the composable rail, just horizontal (◀ ▶) since this list reorders
 * on the x axis.
 */
export function SectionOrder() {
  const order = useCVStore((s) => s.cv.order);
  const setOrder = useCVStore((s) => s.setOrder);
  const toggleSection = useCVStore((s) => s.toggleSection);
  const [announcement, setAnnouncement] = useState("");

  const hidden = ALL_SECTIONS.filter((k) => !order.includes(k));

  const move = (index: number, dir: -1 | 1) => {
    const next = moveAt(order, index, dir);
    if (next !== order) {
      setOrder(next);
      setAnnouncement(`${SECTION_LABELS[order[index]]} moved to position ${index + 1 + dir} of ${next.length}.`);
    }
  };

  return (
    <div className="order-bar">
      <span className="ed-label">Sections — drag to rearrange, or use ◀▶, ✕ to hide</span>
      <div className="sr-only" aria-live="polite">{announcement}</div>
      <Reorder.Group
        axis="x"
        values={order}
        onReorder={(v) => setOrder(v as SectionKey[])}
        className="order-chips"
        role="list"
      >
        {order.map((key, i) => (
          <Reorder.Item
            key={key}
            value={key}
            className="order-chip"
            whileDrag={{ scale: 1.06 }}
            role="listitem"
            aria-roledescription="reorderable section"
          >
            <span className="order-grip" aria-hidden>⋮⋮</span>
            <div className="order-move">
              <button
                type="button"
                className="order-move-btn"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${SECTION_LABELS[key]} section earlier`}
                title="Move earlier"
              >
                ◀
              </button>
              <button
                type="button"
                className="order-move-btn"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label={`Move ${SECTION_LABELS[key]} section later`}
                title="Move later"
              >
                ▶
              </button>
            </div>
            {SECTION_LABELS[key]}
            <button
              className="order-x"
              onClick={() => toggleSection(key)}
              aria-label={`Hide ${SECTION_LABELS[key]} section`}
              title="Hide section"
            >
              ✕
            </button>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <AnimatePresence initial={false}>
        {hidden.length > 0 && (
          <motion.div
            className="order-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className="order-hidden-label">Hidden</span>
            {hidden.map((key) => (
              <button
                key={key}
                className="order-add"
                onClick={() => toggleSection(key)}
                aria-label={`Show ${SECTION_LABELS[key]} section`}
              >
                + {SECTION_LABELS[key]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
