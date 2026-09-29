"use client";

import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Textarea that grows to fit its content instead of scrolling (req 18).
 * Height is recomputed on every value change and on mount.
 */
export function AutoTextarea({ value, className = "", ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(resize, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onInput={resize}
      rows={1}
      className={`resize-none overflow-hidden ${className}`}
      {...rest}
    />
  );
}
