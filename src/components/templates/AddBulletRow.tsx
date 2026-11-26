"use client";

import { useRef } from "react";
import { useUIStore } from "@/lib/store/uiStore";

/**
 * "+ Add bullet" under a list of highlights. Renders only in live edit, and is
 * visible only on the editing paper (`.paper.is-editing`), so exports and
 * thumbnails never show it. Focuses the new bullet once it mounts.
 */
export function AddBulletRow({ onAdd }: { onAdd: () => void }) {
  const previewEdit = useUIStore((s) => s.previewEdit);
  const ref = useRef<HTMLDivElement>(null);
  if (!previewEdit) return null;
  return (
    <div ref={ref} className="oe-add-row">
      <button
        type="button"
        className="oe-add"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          onAdd();
          requestAnimationFrame(() => {
            const list = ref.current?.previousElementSibling;
            (list?.lastElementChild as HTMLElement | null)?.focus();
          });
        }}
      >
        + Add bullet
      </button>
    </div>
  );
}
