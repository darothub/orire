"use client";

import { Reorder, AnimatePresence, motion } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { SECTION_LABELS, ALL_SECTIONS, type SectionKey } from "@/lib/cv/schema";

/**
 * Drag the chips to reorder CV sections (req 17); toggle sections on/off.
 * A section renders only while present in `order`, so removing a chip hides it
 * from every template. Hidden sections keep their data — re-adding restores it.
 */
export function SectionOrder() {
  const order = useCVStore((s) => s.cv.order);
  const setOrder = useCVStore((s) => s.setOrder);
  const toggleSection = useCVStore((s) => s.toggleSection);

  const hidden = ALL_SECTIONS.filter((k) => !order.includes(k));

  return (
    <div className="order-bar">
      <span className="ed-label">Sections — drag to rearrange, ✕ to hide</span>
      <Reorder.Group axis="x" values={order} onReorder={(v) => setOrder(v as SectionKey[])} className="order-chips">
        {order.map((key) => (
          <Reorder.Item key={key} value={key} className="order-chip" whileDrag={{ scale: 1.06 }}>
            <span className="order-grip" aria-hidden>⋮⋮</span>
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
