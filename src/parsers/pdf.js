import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export async function parsePdf(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const totalPages = pdf.numPages;
  const pages = [];
  const BATCH = 10;

  for (let start = 1; start <= totalPages; start += BATCH) {
    const end = Math.min(start + BATCH - 1, totalPages);
    const results = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, i) =>
        extractPage(pdf, start + i),
      ),
    );
    pages.push(...results);
    onProgress(Math.min(end / totalPages, 1));
  }

  return cleanPdfText(pages);
}

async function extractPage(pdf, num) {
  const page = await pdf.getPage(num);
  const content = await page.getTextContent();
  return content.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Clean PDF-extracted text:
 * - Remove standalone page numbers (e.g. "42", "— 42 —", "pág. 42")
 * - Remove repeated headers/footers that appear on most pages
 * - Collapse excessive whitespace
 */
function cleanPdfText(pages) {
  if (pages.length === 0) return '';

  // Detect repeated lines across pages (headers/footers)
  const lineCounts = new Map();
  const pageLines = pages.map((p) => p.split('\n'));

  for (const lines of pageLines) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 2 || trimmed.length > 120) continue;
      lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1);
    }
  }

  // Lines appearing on >40% of pages are likely headers/footers
  const threshold = Math.max(2, Math.ceil(pages.length * 0.4));
  const repeatedLines = new Set();
  for (const [line, count] of lineCounts) {
    if (count >= threshold) repeatedLines.add(line);
  }

  const cleaned = pages
    .map((pageText) => {
      return pageText
        .split('\n')
        .filter((line) => {
          const t = line.trim();
          if (!t) return true; // keep blank lines as paragraph separators

          // Skip standalone page numbers
          if (/^\d{1,4}$/.test(t)) return false;
          if (/^[—–-]+\s*\d{1,4}\s*[—–-]+$/.test(t)) return false;
          if (/^p[aá]g\.?\s*\d{1,4}$/i.test(t)) return false;
          if (/^\d{1,4}\s*\/\s*\d{1,4}$/.test(t)) return false;

          // Skip detected repeated headers/footers
          if (repeatedLines.has(t)) return false;

          return true;
        })
        .join('\n');
    })
    .filter(Boolean);

  return cleaned.join('\n\n');
}
