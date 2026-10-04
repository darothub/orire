"use client";

import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";
import type { PageMode } from "@/lib/store/historyStore";
import type { CVData } from "@/lib/cv/schema";
import { cvToReadableText, encodeOrireKeywords } from "@/lib/export/orireEmbed";

/** A4 in PostScript points (72 pt / inch). */
const A4_W = 595.28;
const A4_H = 841.89;

function safeName(name: string): string {
  const n = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  return n || "cv";
}

/** Render the live CV paper to a high-res canvas, excluding decorative sweeps.
 *
 * The paper is `width:794px; max-width:100%`, so in a narrow preview pane it
 * shrinks — and it also carries a live framer-motion `transform`/`filter` plus
 * an optional CSS `zoom` (Text size). All of those make html-to-image mismeasure
 * (white gutter on the right, skill pills reflowing onto each other). We pin the
 * node to its true 794px, strip the transient transforms, force a reflow, then
 * capture at the exact painted size — and always restore the original styles. */
async function paperCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  const saved = el.getAttribute("style");
  el.style.transform = "none";
  el.style.filter = "none";
  el.style.setProperty("zoom", "1");
  el.style.maxWidth = "none";
  el.style.width = "794px";
  el.style.borderRadius = "0";
  el.style.boxShadow = "none";
  el.style.overflow = "visible";
  // Force layout so the measurements below reflect the overrides.
  void el.offsetWidth;
  const width = el.offsetWidth;
  const height = el.offsetHeight;

  try {
    return await toCanvas(el, {
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
  } finally {
    if (saved === null) el.removeAttribute("style");
    else el.setAttribute("style", saved);
    void el.offsetWidth;
  }
}

/**
 * Write an invisible (render-mode 3) text layer holding a readable
 * serialisation of the CV, so the exported PDF has extractable text (fixing
 * re-import, ATS, Ctrl-F). The bitmap drawn on top stays the visible artefact.
 *
 * The exact CVData for a lossless orire round-trip is NOT stored here — a text
 * layer only holds what fits on the page, and extractors drop anything past the
 * page edge. It lives in the PDF metadata instead (see embedCVData).
 */
function embedTextLayer(pdf: jsPDF, cv: CVData): void {
  const prevSize = pdf.getFontSize();
  const opts = { renderingMode: "invisible" as const, baseline: "top" as const };
  pdf.setFontSize(6);
  const lines = pdf.splitTextToSize(cvToReadableText(cv), A4_W - 8) as string[];
  pdf.text(lines, 4, 4, opts);
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
 *  - paged: the CV flows across A4 pages;
 *  - fit: the CV is scaled to sit on one A4 page.
 * The CV data is embedded as an invisible text layer so the PDF stays
 * extractable and re-importable. Returns false when the paper isn't mounted.
 */
export async function exportCVtoPDF(
  mode: PageMode,
  fileName: string,
  cv: CVData,
): Promise<boolean> {
  const el = document.getElementById("cv-paper");
  if (!el) return false;

  const canvas = await paperCanvas(el);
  const imgW = canvas.width;
  const imgH = canvas.height;
  if (!imgW || !imgH) return false;
  const img = canvas.toDataURL("image/png");
  const file = `${safeName(fileName)}.pdf`;
  const ratio = imgH / imgW;

  if (mode === "continuous") {
    // One page whose height matches the content — nothing is ever pushed to a
    // second page.
    const pageW = A4_W;
    const pageH = A4_W * ratio;
    const pdf = new jsPDF({
      unit: "pt",
      format: [pageW, pageH],
      orientation: pageH >= pageW ? "portrait" : "landscape",
    });
    embedTextLayer(pdf, cv);
    embedCVData(pdf, cv);
    pdf.addImage(img, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
    pdf.save(file);
    return true;
  }

  if (mode === "fit") {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    embedTextLayer(pdf, cv);
    embedCVData(pdf, cv);
    const margin = 22;
    const availW = A4_W - margin * 2;
    const availH = A4_H - margin * 2;
    const scale = Math.min(availW / imgW, availH / imgH);
    const w = imgW * scale;
    const h = imgH * scale;
    pdf.addImage(img, "PNG", (A4_W - w) / 2, margin, w, h, undefined, "FAST");
    pdf.save(file);
    return true;
  }

  // paged — slice the full-width image across as many A4 pages as needed.
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  embedTextLayer(pdf, cv);
  embedCVData(pdf, cv);
  const renderW = A4_W;
  const renderH = A4_W * ratio; // full CV height, scaled to A4 width
  let y = 0;
  let page = 0;
  while (y < renderH - 1) {
    if (page > 0) pdf.addPage();
    // Draw the whole image shifted up; the page bounds clip the overflow.
    pdf.addImage(img, "PNG", 0, -y, renderW, renderH, undefined, "FAST");
    y += A4_H;
    page += 1;
    if (page > 40) break; // safety valve
  }
  pdf.save(file);
  return true;
}
