"use client";

import { useEffect, useRef, useState } from "react";
import type { CVData } from "@/lib/cv/schema";
import { getTemplate } from "@/components/templates/registry";
import { paperStyleVars, useStyleStore } from "@/lib/store/styleStore";

/** The CV paper's intrinsic CSS width; the template layouts are built for it. */
const PAPER_W = 794;

interface Props {
  cv: CVData;
  templateId: string;
  /** Set to "cv-paper" on the one paper the PDF export captures. */
  id?: string;
  /** Apply the user's font, size and alignment choices (not for thumbnails). */
  styled?: boolean;
  /** Dashed affordance on editable text (see EditableText). */
  editing?: boolean;
  /** Crop the scaled paper to this many CSS px (thumbnails). */
  maxHeight?: number;
  /** Disable pointer input (thumbnails). */
  inert?: boolean;
}

/**
 * The CV rendered at its true A4 width and scaled to fit its container, so the
 * same template output serves a card thumbnail, the studio and the export
 * preview.
 */
export function V4Paper({ cv, templateId, id, styled = false, editing = false, maxHeight, inert = false }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; height: number } | null>(null);
  const fontId = useStyleStore((s) => s.fontId);
  const size = useStyleStore((s) => s.size);
  const align = useStyleStore((s) => s.align);
  const Template = getTemplate(templateId).Component;

  useEffect(() => {
    const frame = frameRef.current;
    const paper = paperRef.current;
    if (!frame || !paper) return;
    // The observer reports the initial size too, so state is only set from its callback.
    const measure = () => setFit({ scale: frame.clientWidth / PAPER_W, height: paper.offsetHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    ro.observe(paper);
    return () => ro.disconnect();
  }, [templateId, cv]);

  const scale = fit?.scale ?? 0;
  const natural = fit ? fit.height * scale : 0;
  const height = maxHeight ? Math.min(natural, maxHeight) : natural;
  const vars = styled ? paperStyleVars({ fontId, size, align }) : {};

  return (
    <div ref={frameRef} className="v4-paper-frame">
      <div
        className="v4-paper-crop"
        style={{ width: PAPER_W * scale, height: fit ? height : undefined, visibility: fit ? "visible" : "hidden" }}
        inert={inert || undefined}
      >
        <div
          ref={paperRef}
          id={id}
          className={`paper${editing ? " is-editing" : ""}`}
          style={{ ...vars, width: PAPER_W, maxWidth: "none", transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <Template cv={cv} />
        </div>
      </div>
    </div>
  );
}
