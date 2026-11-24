import type { HTMLAttributes } from "react";
import "./surfaces.css";

type Template = "modern" | "classic" | "editorial";

interface CvPaperProps extends HTMLAttributes<HTMLDivElement> {
  /** Template variant. `modern`/`classic` are ATS-safe; `editorial` is Design. */
  template?: Template;
}

/**
 * The CV paper surface used in the editor and previews. Keeps its own
 * high-contrast ink regardless of app theme, and exposes a `--cv-accent` the
 * template variants set. Compose content with the `or-paper__*` helper classes
 * (`__name`, `__role`, `__section`).
 */
export function CvPaper({ template = "modern", className = "", children, ...rest }: CvPaperProps) {
  const cls = ["or-paper", template !== "modern" && `or-paper--${template}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
