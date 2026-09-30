"use client";

import { motion } from "framer-motion";
import { usePreviewStore, PREVIEW_ZOOM } from "@/lib/store/previewStore";

/** Floating viewport toolbar for the live preview: zoom out / % / zoom in,
 *  fit-to-width, and a toggle for the A4 page-break guides. */
export function PreviewToolbar() {
  const zoom = usePreviewStore((s) => s.zoom);
  const showGuides = usePreviewStore((s) => s.showGuides);
  const zoomIn = usePreviewStore((s) => s.zoomIn);
  const zoomOut = usePreviewStore((s) => s.zoomOut);
  const resetZoom = usePreviewStore((s) => s.resetZoom);
  const fit = usePreviewStore((s) => s.fit);
  const toggleGuides = usePreviewStore((s) => s.toggleGuides);

  const pct = Math.round(zoom * 100);

  return (
    <motion.div
      className="pv-toolbar"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
    >
      <button
        className="pv-btn"
        onClick={zoomOut}
        disabled={zoom <= PREVIEW_ZOOM.MIN}
        title="Zoom out"
        aria-label="Zoom out"
      >
        −
      </button>
      <button className="pv-pct" onClick={resetZoom} title="Reset to 100%" aria-label="Reset zoom to 100 percent">
        {pct}%
      </button>
      <button
        className="pv-btn"
        onClick={zoomIn}
        disabled={zoom >= PREVIEW_ZOOM.MAX}
        title="Zoom in"
        aria-label="Zoom in"
      >
        +
      </button>
      <span className="pv-div" aria-hidden />
      <button className="pv-chip" onClick={fit} title="Fit to width" aria-label="Fit to width">
        Fit
      </button>
      <button
        className={`pv-chip${showGuides ? " is-on" : ""}`}
        onClick={toggleGuides}
        title="Toggle A4 page-break guides"
        aria-pressed={showGuides}
      >
        Guides
      </button>
    </motion.div>
  );
}
