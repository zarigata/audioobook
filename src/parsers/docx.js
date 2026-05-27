import mammoth from 'mammoth';

/**
 * Parse DOCX file to plain text using mammoth.js
 */
export async function parseDocx(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  onProgress(0.3);

  const result = await mammoth.extractRawText({ arrayBuffer });
  onProgress(1);

  return result.value;
}
