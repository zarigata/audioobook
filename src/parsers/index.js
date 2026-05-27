import { parsePdf } from './pdf.js';
import { parseEpub } from './epub.js';
import { parseDocx } from './docx.js';
import { parseText } from './text.js';

const FORMAT_PARSERS = {
  '.pdf': parsePdf,
  '.epub': parseEpub,
  '.docx': parseDocx,
  '.txt': parseText,
  '.html': parseText,
  '.htm': parseText,
  '.rtf': parseText,
  '.md': parseText,
};

/**
 * Parse a document file into plain text
 * @param {File} file - The uploaded file
 * @param {string} format - Detected format (e.g. '.pdf')
 * @param {(progress: number) => void} onProgress - 0-1 progress
 * @returns {Promise<string>} Extracted plain text
 */
export async function parseDocument(file, format, onProgress = () => {}) {
  const parser = FORMAT_PARSERS[format];
  if (!parser) {
    throw new Error(`Formato não suportado: ${format}`);
  }

  const text = await parser(file, onProgress);

  if (!text || !text.trim()) {
    throw new Error('Não foi possível extrair texto do arquivo.');
  }

  return text.trim();
}
