/**
 * Parse plain text formats: TXT, HTML, RTF, MD
 */
export async function parseText(file, onProgress) {
  const text = await file.text();
  onProgress(1);

  const ext = '.' + file.name.split('.').pop().toLowerCase();

  if (ext === '.html' || ext === '.htm') {
    return stripHtml(text);
  }

  if (ext === '.rtf') {
    return stripRtf(text);
  }

  // .txt and .md: return as-is
  return text;
}

function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style').forEach((el) => el.remove());
  return doc.body.textContent || '';
}

function stripRtf(rtf) {
  // Minimal RTF stripping — remove control words and braces
  return rtf
    .replace(/\\'[0-9a-fA-F]{2}/g, (match) => {
      return String.fromCharCode(parseInt(match.slice(2), 16));
    })
    .replace(/\\[^\\{}\s]+(\s?)/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
