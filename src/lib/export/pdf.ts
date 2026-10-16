"use client";

import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";
import type { PageMode } from "@/lib/cv/page";
import type { CVData } from "@/lib/cv/schema";
import { cvToReadableText, encodeOrireKeywords } from "@/lib/export/orireEmbed";

/** A4 in PostScript points (72 pt / inch). */
const A4_W = 595.28;
const A4_H = 841.89;

/** The CV paper's intrinsic CSS width (see #cv-paper); used to scale px -> pt. */
const PAPER_CSS_W = 794;

function safeName(name: string): string {
  const n = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  return n || "cv";
}

export interface PaperCapture {
  canvas: HTMLCanvasElement;
  /** Vertical positions (in PDF points) where a page may break without cutting
   *  through a block of content — the top edges of the paper's block elements. */
  breaksPt: number[];
  /** Full content height in PDF points, at A4 width. */
  contentHeightPt: number;
}

/** A page slice: the vertical span [start, end) of content (pts) on one page. */
export interface PageSlice {
  start: number;
  end: number;
}

/**
 * Pure pagination: split a tall content column into page slices that never cut
 * through a block. Within each page we take the LAST allowed breakpoint that
 * still fits `pageHeight`; if a single block is taller than a page we fall back
 * to a hard cut (unavoidable). Deterministic and unit-tested — the DOM
 * measurement that produces `breakpoints` lives in the browser capture.
 */
export function computePageSlices(
  contentHeight: number,
  pageHeight: number,
  breakpoints: number[],
): PageSlice[] {
  if (!(contentHeight > 0) || !(pageHeight > 0)) {
    return [{ start: 0, end: Math.max(0, contentHeight) }];
  }

  const bps = [...new Set(breakpoints)].filter((b) => b > 0 && b < contentHeight).sort((a, b) => a - b);
  const slices: PageSlice[] = [];
  let start = 0;
  let guard = 0;

  while (start < contentHeight - 0.5 && guard++ < 2000) {
    const maxEnd = start + pageHeight;
    if (maxEnd >= contentHeight) {
      slices.push({ start, end: contentHeight });
      break;
    }
    // Largest breakpoint strictly after `start` and within this page.
    let end = -1;
    for (const b of bps) {
      if (b > start + 1 && b <= maxEnd) end = b;
      else if (b > maxEnd) break;
    }
    if (end < 0) end = maxEnd; // a block taller than one page — hard cut
    slices.push({ start, end });
    start = end;
  }
  if (slices.length === 0) slices.push({ start: 0, end: contentHeight });
  return slices;
}

/** Render the live CV paper to a high-res canvas (excluding decorative sweeps)
 *  and measure safe page-break positions while the node is pinned to its true
 *  layout.
 *
 * The paper is `width:794px; max-width:100%`, so in a narrow preview pane it
 * shrinks — and it also carries a live framer-motion `transform`/`filter` plus
 * an optional CSS `zoom`. All of those make html-to-image mismeasure. We pin
 * the node to 794px, strip the transient transforms, force a reflow, capture at
 * the painted size, measure block tops, then always restore the styles. */
async function paperCanvas(el: HTMLElement): Promise<PaperCapture> {
  const saved = el.getAttribute("style");
  el.style.transform = "none";
  el.style.filter = "none";
  el.style.setProperty("zoom", "1");
  el.style.maxWidth = "none";
  el.style.width = `${PAPER_CSS_W}px`;
  el.style.borderRadius = "0";
  el.style.boxShadow = "none";
  el.style.overflow = "visible";
  // Force layout so the measurements below reflect the overrides.
  void el.offsetWidth;
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const scaleCssToPt = A4_W / width;

  // Collect safe break positions: the top edge of every block-level element
  // with real height. Breaking *before* a block never cuts a line of text.
  const paperTop = el.getBoundingClientRect().top;
  const breakSet = new Set<number>();
  el.querySelectorAll<HTMLElement>("*").forEach((node) => {
    const cs = getComputedStyle(node);
    if (cs.display === "inline" || cs.position === "absolute" || cs.position === "fixed") return;
    if (node.classList.contains("tpl-sweep")) return;
    const r = node.getBoundingClientRect();
    if (r.height < 4) return;
    const topCss = r.top - paperTop;
    if (topCss > 4) breakSet.add(Math.round(topCss * scaleCssToPt));
  });
  const breaksPt = [...breakSet].sort((a, b) => a - b);
  const contentHeightPt = height * scaleCssToPt;

  try {
    const canvas = await toCanvas(el, {
      pixelRatio: 2,
      width,
      height,
      backgroundColor: "#ffffff",
      cacheBust: true,
      filter: (node) =>
        !(node instanceof HTMLElement && node.classList.contains("tpl-sweep")),
      style: {
        transform: "none",
        filter: "none",
        zoom: "1",
        margin: "0",
        borderRadius: "0",
        boxShadow: "none",
      },
    });
    return { canvas, breaksPt, contentHeightPt };
  } finally {
    if (saved === null) el.removeAttribute("style");
    else el.setAttribute("style", saved);
    void el.offsetWidth;
  }
}

/** All wrapped lines of the CV's readable serialisation, at the text-layer size. */
function readableLines(pdf: jsPDF, cv: CVData): string[] {
  pdf.setFontSize(6);
  return pdf.splitTextToSize(cvToReadableText(cv), A4_W - 8) as string[];
}

/**
 * Write an invisible (render-mode 3) text layer of `lines` at the top of the
 * current page, so the exported PDF has extractable text (ATS, Ctrl-F,
 * re-import). The bitmap drawn on top stays the visible artefact.
 */
function writeInvisibleLines(pdf: jsPDF, lines: string[]): void {
  if (lines.length === 0) return;
  const prevSize = pdf.getFontSize();
  pdf.setFontSize(6);
  pdf.text(lines, 4, 4, { renderingMode: "invisible" as const, baseline: "top" as const });
  pdf.setFontSize(prevSize);
}

/**
 * Store the exact CVData (base64) in the PDF's Keywords metadata so an exported
 * orire PDF re-imports losslessly regardless of length. Metadata is free of
 * page-geometry limits, unlike the on-page text layer.
 */
function embedCVData(pdf: jsPDF, cv: CVData): void {
  pdf.setProperties({ keywords: encodeOrireKeywords(cv) });
}

/**
 * Export the live CV (#cv-paper) straight to a downloaded PDF — no browser
 * print dialog. The page mode controls pagination:
 *  - continuous: a single page exactly as tall as the CV (never breaks);
 *  - paged: the CV flows across A4 pages, breaking between entries (never
 *    through a line) and carrying an extractable text layer on every page;
 *  - fit: the CV is scaled to sit on one A4 page.
 * The exact CV data is also embedded in metadata so the PDF re-imports
 * losslessly. Returns false when the paper isn't mounted.
 */
export async function exportCVtoPDF(
  mode: PageMode,
  fileName: string,
  cv: CVData,
): Promise<boolean> {
  const el = document.getElementById("cv-paper");
  if (!el) return false;

  const { canvas, breaksPt } = await paperCanvas(el);
  const imgW = canvas.width;
  const imgH = canvas.height;
  if (!imgW || !imgH) return false;
  const file = `${safeName(fileName)}.pdf`;
  const ratio = imgH / imgW;

  if (mode === "continuous") {
    // One page whose height matches the content — nothing is pushed to a second
    // page, so the single text layer holds the whole CV.
    const pageW = A4_W;
    const pageH = A4_W * ratio;
    const pdf = new jsPDF({
      unit: "pt",
      format: [pageW, pageH],
      orientation: pageH >= pageW ? "portrait" : "landscape",
    });
    writeInvisibleLines(pdf, readableLines(pdf, cv));
    embedCVData(pdf, cv);
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH, undefined, "FAST");
    pdf.save(file);
    return true;
  }

  if (mode === "fit") {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    writeInvisibleLines(pdf, readableLines(pdf, cv));
    embedCVData(pdf, cv);
    const margin = 22;
    const availW = A4_W - margin * 2;
    const availH = A4_H - margin * 2;
    const scale = Math.min(availW / imgW, availH / imgH);
    const w = imgW * scale;
    const h = imgH * scale;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", (A4_W - w) / 2, margin, w, h, undefined, "FAST");
    pdf.save(file);
    return true;
  }

  // paged — break at block boundaries so no entry is cut, crop each page's
  // slice so pages never overlap, and give every page its own text layer.
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  embedCVData(pdf, cv);

  const renderH = A4_W * ratio; // full CV height in points, at A4 width
  const slices = computePageSlices(renderH, A4_H, breaksPt);
  const pxPerPt = imgH / renderH;

  // Distribute the readable text across pages so the whole CV is extractable
  // exactly once (not duplicated, not clipped to page 1).
  const allLines = readableLines(pdf, cv);
  const perPage = Math.max(1, Math.ceil(allLines.length / slices.length));

  slices.forEach((slice, page) => {
    if (page > 0) pdf.addPage();
    writeInvisibleLines(pdf, allLines.slice(page * perPage, (page + 1) * perPage));

    const syPx = Math.round(slice.start * pxPerPt);
    const shPx = Math.max(1, Math.round((slice.end - slice.start) * pxPerPt));
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = imgW;
    pageCanvas.height = shPx;
    const ctx = pageCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(canvas, 0, syPx, imgW, shPx, 0, 0, imgW, shPx);
      const drawHpt = slice.end - slice.start;
      pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 0, 0, A4_W, drawHpt, undefined, "FAST");
    }
  });

  pdf.save(file);
  return true;
}
