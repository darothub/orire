import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { parseCVText, type ParsedCV } from "@/lib/ingest/parse";
import { parseLinkedInZip } from "@/lib/ingest/linkedin";
import { decodeOrireKeywords, parsedFromCVData } from "@/lib/export/orireEmbed";
import type { CVData } from "@/lib/cv/schema";
import { requireVerifiedUser } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ParsedFileResult {
  name: string;
  size: number;
  kind: "pdf" | "docx" | "unsupported";
  /** Verbatim extracted text (trimmed). */
  text: string;
  parsed: ParsedCV | null;
  /** Verbatim error string, surfaced to the user unaltered. */
  error: string | null;
}

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB per file

function detectKind(name: string, type: string): ParsedFileResult["kind"] {
  const lower = name.toLowerCase();
  if (type.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (
    type.includes("word") ||
    type.includes("officedocument.wordprocessing") ||
    lower.endsWith(".docx")
  )
    return "docx";
  if (lower.endsWith(".zip") || lower.includes("linkedin") || type.includes("zip")) return "pdf";
  return "unsupported";
}

async function extractPdf(buf: ArrayBuffer): Promise<{ text: string; embedded: CVData | null }> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  let embedded: CVData | null = null;
  try {
    const meta = await pdf.getMetadata();
    const keywords = (meta?.info as { Keywords?: string } | undefined)?.Keywords;
    embedded = decodeOrireKeywords(keywords);
  } catch {
    /* metadata is optional — fall back to text */
  }
  return { text: Array.isArray(text) ? text.join("\n") : text, embedded };
}

async function extractDocx(buf: ArrayBuffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
  return value;
}

export async function POST(req: Request) {
  // Upload is a product feature: browse-only until the account email is verified.
  const gate = await requireVerifiedUser("upload a CV");
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.message, code: gate.code },
      { status: gate.status },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files were uploaded." }, { status: 400 });
  }

  const results: ParsedFileResult[] = [];
  for (const file of files) {
    const kind = detectKind(file.name, file.type);
    const base: ParsedFileResult = {
      name: file.name,
      size: file.size,
      kind,
      text: "",
      parsed: null,
      error: null,
    };

    if (kind === "unsupported") {
      base.error = `Unsupported file type "${file.type || "unknown"}". Only PDF, DOCX, and LinkedIn ZIP exports are supported.`;
      results.push(base);
      continue;
    }
    if (file.size > MAX_BYTES) {
      base.error = `File is ${(file.size / 1024 / 1024).toFixed(1)} MB, which exceeds the 15 MB limit.`;
      results.push(base);
      continue;
    }

    try {
      const buf = await file.arrayBuffer();
      // orire-exported PDFs carry an exact, lossless copy of the CV in their
      // metadata — prefer it for a perfect round-trip; otherwise parse the text.
      let embedded: CVData | null = null;
      let raw: string;
      if (file.name.toLowerCase().endsWith(".zip") || /linkedin/i.test(file.name) || file.type.includes("zip")) {
        const parsed = await parseLinkedInZip(buf);
        if (!parsed) {
          base.error = "No readable LinkedIn export data was found in the ZIP.";
        } else {
          base.parsed = parsed;
          base.text = JSON.stringify(parsed, null, 2);
        }
      } else if (kind === "pdf") {
        const out = await extractPdf(buf);
        raw = out.text;
        embedded = out.embedded;
        const text = raw.trim();
        base.text = text;
        if (embedded) {
          base.parsed = parsedFromCVData(embedded);
        } else if (!text) {
          base.error =
            "No text could be extracted. The file may be a scanned image or contain no selectable text.";
        } else {
          base.parsed = parseCVText(text);
        }
      } else {
        raw = await extractDocx(buf);
        const text = raw.trim();
        base.text = text;
        if (!text) {
          base.error =
            "No text could be extracted. The file may be a scanned image or contain no selectable text.";
        } else {
          base.parsed = parseCVText(text);
        }
      }
    } catch (e) {
      // Capture the underlying extractor error verbatim for the user.
      base.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
    results.push(base);
  }

  return NextResponse.json({ files: results });
}
