"use client";

import { useMemo, useState } from "react";
import { funnel } from "@/lib/analytics/funnel";
import { useCVStore } from "@/lib/store/cvStore";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { useWriteGate } from "@/lib/store/accountStore";
import { exportCVtoPDF } from "@/lib/export/pdf";
import { exportCVtoDocx } from "@/lib/export/docx";
import { cvToPlainText } from "@/lib/export/plaintext";
import { recordExport, authorizeExport } from "@/app/actions/activity";
import { remainingNote } from "@/lib/plan/plan";
import type { PageMode } from "@/lib/cv/page";

export type ExportFormat = "pdf" | "docx" | "txt";
export type ExportMessage = { kind: "ok" | "err"; text: string };

/** Trigger a client-side download of plain text as a .txt file. Returns true. */
function downloadTextFile(fileName: string, text: string): boolean {
  const safe = fileName.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ") || "cv";
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

const BUILD_FAILURE: Record<ExportFormat, string> = {
  pdf: "Couldn’t find the live CV to export. Try again.",
  docx: "Couldn’t build the Word file. Try again.",
  txt: "Couldn’t build the text file. Try again.",
};

/**
 * Everything an export screen needs besides its layout: file name and company,
 * PDF options, the download gate, and the copy / download actions. Shared by
 * the workspace Export view and the v4 Export page so the gating, credit
 * accounting and library filing stay in one place. PDF export rasterises the
 * element with id "cv-paper", so the screen must render one.
 */
export function useCvExport() {
  const cv = useCVStore((s) => s.cv);
  const baseline = useCVStore((s) => s.baseline);
  const active = useCVStore((s) => s.activeTemplate);
  const fileExport = useLibraryStore((s) => s.recordExport);
  const lastCompany = useLibraryStore((s) => s.lastCompany);

  const person = cv.basics.fullName.trim();
  const defaultName = useMemo(() => (person ? `${person} · CV` : "Orire: CV"), [person]);

  const [fileName, setFileName] = useState(defaultName);
  const [company, setCompany] = useState(lastCompany);
  const [mode, setMode] = useState<PageMode>("paged");
  // Defaults on: lets this exact PDF be re-imported later with zero drift
  // (see orireEmbed.ts). Off before sending somewhere the recipient shouldn't
  // silently receive your full structured CV embedded in the file metadata.
  const [embedData, setEmbedData] = useState(true);
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null);
  const [msg, setMsg] = useState<ExportMessage | null>(null);
  const gate = useWriteGate("download your CV");

  // Copy the CV as plain text for pasting into an application form. Free and
  // ungated: the content is already on screen, so this is a convenience, not a
  // new export — it never spends a download credit.
  const copyPlainText = async () => {
    try {
      await navigator.clipboard.writeText(cvToPlainText(cv));
      setMsg({ kind: "ok", text: "Plain text copied, paste it into any application form." });
    } catch {
      setMsg({ kind: "err", text: "Couldn’t copy. Your browser may be blocking clipboard access." });
    }
  };

  const doExport = async (format: ExportFormat) => {
    if (!gate.guard()) {
      setMsg({ kind: "err", text: gate.reason ?? "Verify your email to download." });
      return;
    }
    // PDF rasterises the live DOM, so pre-check it exists before spending a
    // download. DOCX is built from data, so it has no such dependency.
    if (format === "pdf" && typeof document !== "undefined" && !document.getElementById("cv-paper")) {
      setMsg({ kind: "err", text: BUILD_FAILURE.pdf });
      return;
    }
    setBusyFormat(format);
    setMsg(null);
    try {
      // Server-authorized download gate (Free is capped; paid unlimited). This
      // consumes the credit atomically before we build, so the cap can't be
      // bypassed; over the limit returns an upgrade prompt.
      const authz = await authorizeExport();
      if (!authz.ok) {
        setMsg({
          kind: "err",
          text: authz.block ? `${authz.block.title}, ${authz.block.body}` : "Downloads aren’t available right now.",
        });
        return;
      }
      const name = fileName.trim() || defaultName;
      const ok =
        format === "pdf"
          ? await exportCVtoPDF(mode, name, cv, { embedData })
          : format === "docx"
            ? await exportCVtoDocx(name, cv)
            : downloadTextFile(name, cvToPlainText(cv));
      if (!ok) {
        setMsg({ kind: "err", text: BUILD_FAILURE[format] });
        return;
      }
      funnel.firstExport(format);
      // File the export in the library: stamps the active version exported, or
      // snapshots a new one if nothing is active yet — so nothing downloaded is
      // ever lost and the user can reopen exactly what they saved.
      void fileExport({ name, company: company.trim(), person, template: active, cv, baseline });
      void recordExport({ format, template: active, company: company.trim() || null });
      const left = remainingNote("download", authz.cap, authz.used);
      setMsg({
        kind: "ok",
        text: `Saved “${name}.${format}” · filed under ${company.trim() || "Unfiled"} in History.${left ? ` ${left}` : ""}`,
      });
      // Keep the ambient usage mirror current so Export greys out on the last one.
      void useUsageStore.getState().refresh();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyFormat(null);
    }
  };

  return {
    defaultName, fileName, setFileName, company, setCompany, mode, setMode, embedData, setEmbedData,
    busyFormat, busy: busyFormat !== null, msg, gate, copyPlainText, doExport,
  };
}
