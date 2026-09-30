"use client";

import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";
import type { PageMode } from "@/lib/store/historyStore";

/** A4 in PostScript points (72 pt / inch). */
const A4_W = 595.28;
const A4_H = 841.89;

function safeName(name: string): string {
  const n = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  return n || "cv";
}

/** Render the live CV paper to a high-res canvas, excluding decorative sweeps. */
async function paperCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  return toCanvas(el, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
    filter: (node) =>
      !(node instanceof HTMLElement && node.classList.contains("tpl-sweep")),
    style: { boxShadow: "none", borderRadius: "0", margin: "0" },
  });
}

/**
 * Export the live CV (#cv-paper) straight to a downloaded PDF — no browser
 * print dialog. The page mode controls pagination:
 *  - continuous: a single page exactly as tall as the CV (never breaks);
 *  - paged: the CV flows across A4 pages;
 *  - fit: the CV is scaled to sit on one A4 page.
 * Returns false when the paper isn't mounted (e.g. mid-compare).
 */
export async function exportCVtoPDF(mode: PageMode, fileName: string): Promise<boolean> {
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
    pdf.addImage(img, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
    pdf.save(file);
    return true;
  }

  if (mode === "fit") {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
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
