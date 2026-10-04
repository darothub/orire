"use client";

import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";
import { type CoverLetter, coverLetterToText } from "@/lib/cv/coverLetter";

/** A4 in PostScript points (72 pt / inch). */
const A4_W = 595.28;
const A4_H = 841.89;

function safeName(name: string): string {
  const n = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  return n || "cover-letter";
}

/**
 * Rasterise the live letter sheet (#cl-paper) at its true A4 width, stripping
 * transient transforms/shadows so html-to-image measures cleanly (same guard
 * as the CV export).
 */
async function sheetCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  const saved = el.getAttribute("style");
  el.style.transform = "none";
  el.style.filter = "none";
  el.style.setProperty("zoom", "1");
  el.style.maxWidth = "none";
  el.style.width = "794px";
  el.style.borderRadius = "0";
  el.style.boxShadow = "none";
  el.style.overflow = "visible";
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
      style: { transform: "none", filter: "none", zoom: "1", margin: "0", borderRadius: "0", boxShadow: "none" },
    });
  } finally {
    if (saved === null) el.removeAttribute("style");
    else el.setAttribute("style", saved);
    void el.offsetWidth;
  }
}

/**
 * Write an invisible (render-mode 3) text layer so the exported cover letter
 * PDF has extractable, selectable text (ATS, Ctrl-F, re-use). The bitmap drawn
 * on top stays the visible artefact.
 */
function embedTextLayer(pdf: jsPDF, text: string, pageW: number): void {
  const prevSize = pdf.getFontSize();
  pdf.setFontSize(9);
  const lines = pdf.splitTextToSize(text, pageW - 8) as string[];
  pdf.text(lines, 4, 4, { renderingMode: "invisible", baseline: "top" });
  pdf.setFontSize(prevSize);
}

/**
 * Export the live cover letter (#cl-paper) to a downloaded, text-extractable
 * PDF. The letter is short, so it is placed on a single A4 page, scaled to fit
 * when taller than the page. Returns false when the sheet isn't mounted.
 */
export async function exportCoverLetterToPDF(
  fileName: string,
  letter: CoverLetter,
  sender: string,
  title = "",
  contact = "",
): Promise<boolean> {
  const el = document.getElementById("cl-paper");
  if (!el) return false;

  const canvas = await sheetCanvas(el);
  const imgW = canvas.width;
  const imgH = canvas.height;
  if (!imgW || !imgH) return false;
  const img = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  embedTextLayer(pdf, coverLetterToText(letter, sender, title, contact), A4_W);

  const margin = 22;
  const availW = A4_W - margin * 2;
  const availH = A4_H - margin * 2;
  const scale = Math.min(availW / imgW, availH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  pdf.addImage(img, "PNG", (A4_W - w) / 2, margin, w, h, undefined, "FAST");
  pdf.save(`${safeName(fileName)}.pdf`);
  return true;
}
