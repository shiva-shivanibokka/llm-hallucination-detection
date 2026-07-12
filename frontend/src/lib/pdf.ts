// Client-side PDF text extraction. Runs entirely in the browser so the
// document body never has to be uploaded anywhere just to pull its text out.
"use client";

// pdfjs-dist probes for browser-only globals (DOMMatrix, etc.) at module
// load time, which breaks Next's server-side prerender pass. Importing it
// dynamically, only when this function actually runs in the browser, avoids
// that entirely instead of reaching for a client-only wrapper component.
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(text);
  }
  return pages.join("\n\n").replace(/\s+\n/g, "\n").trim();
}
