"use client";

import type { PageMode } from "@/lib/store/historyStore";

/** A4 in millimetres. */
const A4_W_MM = 210;
const A4_H_MM = 297;
/** Reference on-screen paper width (matches `.paper { width: 794px }` = A4). */
const REF_W_PX = 794;

const STYLE_ID = "orire-print-dyn";

/**
 * Measure the live CV paper's aspect ratio (height ÷ width) at A4 width, so we
 * can size the print page without depending on the current preview-pane width.
 * Returns null when the paper isn't mounted (e.g. mid-compare).
 */
function measurePaperRatio(): number | null {
  const el = document.getElementById("cv-paper");
  if (!el) return null;
  const prev = el.style.width;
  el.style.width = `${REF_W_PX}px`;
  const w = el.offsetWidth || REF_W_PX;
  const h = el.offsetHeight;
  el.style.width = prev;
  if (!h) return null;
  return h / w;
}

/** Build the @page + paper rules for the chosen page mode. */
function buildPrintCSS(mode: PageMode, ratio: number): string {
  if (mode === "continuous") {
    // One page exactly as tall as the content — nothing is ever split.
    const heightMM = Math.max(A4_H_MM, Math.ceil(A4_W_MM * ratio) + 2);
    return `
      @page { size: ${A4_W_MM}mm ${heightMM}mm; margin: 0; }
      @media print {
        .paper { width: ${A4_W_MM}mm !important; min-height: auto !important; }
        .paper, .paper * { break-inside: auto !important; page-break-inside: auto !important; }
      }
    `;
  }
  if (mode === "fit") {
    // Scale the whole paper down so it lands on a single A4 page. `zoom` reflows
    // layout (unlike transform) so no trailing blank page is emitted.
    const marginMM = 10;
    const contentW = A4_W_MM - marginMM * 2;
    const contentH = A4_H_MM - marginMM * 2;
    const printH = contentW * ratio; // paper height once it fills the content width
    const k = Math.min(1, contentH / printH);
    return `
      @page { size: A4; margin: ${marginMM}mm; }
      @media print {
        .paper { width: 100% !important; min-height: auto !important; zoom: ${k.toFixed(4)}; }
        .paper, .paper * { break-inside: avoid !important; page-break-inside: avoid !important; }
      }
    `;
  }
  // "paged": A4 flow — keep entries whole across page breaks (handled by the
  // existing @media print rules in globals.css).
  return `@page { size: A4; margin: 12mm; }`;
}

function cleanup(prevTitle: string): void {
  document.getElementById(STYLE_ID)?.remove();
  delete document.body.dataset.printMode;
  document.title = prevTitle;
}

/**
 * Print/export the live CV paper with a page-size mode and a chosen file name.
 * The browser's Save-as-PDF dialog uses `document.title` as the default name.
 * Returns false when there's no paper to print.
 */
export function printCV(mode: PageMode, fileName: string): boolean {
  const ratio = measurePaperRatio();
  if (ratio == null) return false;

  const prevTitle = document.title;
  const name = fileName.trim();
  document.title = name || "Orire — CV";
  document.body.dataset.printMode = mode;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = buildPrintCSS(mode, ratio);
  document.head.appendChild(style);

  const restore = () => {
    cleanup(prevTitle);
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);

  // Let the injected styles apply before the print dialog snapshots the page.
  window.setTimeout(() => {
    window.print();
    window.setTimeout(restore, 1200);
  }, 60);

  return true;
}
