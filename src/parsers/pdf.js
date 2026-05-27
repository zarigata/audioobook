import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/**
 * Parse PDF to text, batching 10 pages at a time
 */
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

  return pages.filter(Boolean).join('\n\n');
}

async function extractPage(pdf, num) {
  const page = await pdf.getPage(num);
  const content = await page.getTextContent();
  return content.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
}
