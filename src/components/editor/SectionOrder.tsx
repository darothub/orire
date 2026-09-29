"use client";

import { Reorder } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { SECTION_LABELS, type SectionKey } from "@/lib/cv/schema";

/** Drag the chips to reorder CV sections; the preview updates live (req 17). */
export function SectionOrder() {
  const order = useCVStore((s) => s.cv.order);
  const setOrder = useCVStore((s) => s.setOrder);

  return (
    <div className="order-bar">
      <span className="ed-label">Section order — drag to rearrange</span>
      <Reorder.Group axis="x" values={order} onReorder={(v) => setOrder(v as SectionKey[])} className="order-chips">
        {order.map((key) => (
          <Reorder.Item key={key} value={key} className="order-chip" whileDrag={{ scale: 1.06 }}>
            <span className="order-grip" aria-hidden>⋮⋮</span>
            {SECTION_LABELS[key]}
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}
