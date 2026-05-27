import ePub from 'epubjs';

/**
 * Parse EPUB file to plain text using epubjs
 * Reads sections sequentially to manage memory
 */
export async function parseEpub(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  const spine = await book.loaded.spine;
  const sections = spine.items;
  const texts = [];

  for (let i = 0; i < sections.length; i++) {
    try {
      const section = sections[i];
      const contents = await book.load(section.href);
      const text = stripHtml(typeof contents === 'string' ? contents : '');

      if (text.trim()) {
        texts.push(text.trim());
      }

      onProgress((i + 1) / sections.length);

      // Unload to free memory
      if (section.unload) section.unload();
    } catch {
      // Skip unreadable sections
    }
  }

  await book.destroy();
  return texts.join('\n\n');
}

function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Remove scripts and styles
  doc.querySelectorAll('script, style').forEach((el) => el.remove());
  return doc.body.textContent || '';
}
