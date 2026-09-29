"use client";

import { useRef, type CSSProperties } from "react";
import { useUIStore } from "@/lib/store/uiStore";

type Tag = "h1" | "h2" | "p" | "span" | "li" | "div";

interface EditableTextProps {
  value: string;
  onCommit: (next: string) => void;
  as?: Tag;
  className?: string;
  placeholder?: string;
  /** Allow line breaks (summary, details). Single-line commits on Enter. */
  multiline?: boolean;
  style?: CSSProperties;
}

/**
 * Click-to-edit text on the live preview (req 10/11).
 *
 * When preview-edit mode is OFF it renders a plain element (zero behavioural
 * change, so templates/animations/print stay identical). When ON, the element
 * becomes contentEditable with a subtle affordance and commits on blur / Enter;
 * Escape cancels. We deliberately do NOT commit on every keystroke — the store
 * value stays stable during typing, so React never re-renders the node and the
 * caret never jumps.
 */
export function EditableText({
  value,
  onCommit,
  as = "span",
  className,
  placeholder,
  multiline = false,
  style,
}: EditableTextProps) {
  const previewEdit = useUIStore((s) => s.previewEdit);
  const ref = useRef<HTMLElement>(null);
  const Tag = as as React.ElementType;

  if (!previewEdit) {
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next = (el.innerText ?? "").replace(/\u00a0/g, " ").replace(/\n+$/g, "");
    const clean = multiline ? next.replace(/\n{3,}/g, "\n\n") : next.replace(/\s*\n\s*/g, " ");
    if (clean !== value) onCommit(clean.trim());
  };

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      className={`${className ?? ""} oe-editable${value ? "" : " oe-empty"}`.trim()}
      style={style}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-ph={placeholder ?? ""}
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          const el = ref.current;
          if (el) el.innerText = value;
          (e.currentTarget as HTMLElement).blur();
        }
      }}
    >
      {value}
    </Tag>
  );
}
