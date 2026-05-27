// Portuguese text segmentation with abbreviation awareness

// Portuguese abbreviations that end with "." but don't end sentences
const ABBREVIATIONS = new Set([
  'sr', 'sra', 'srta', 'dr', 'dra', 'prof', 'profa',
  'eng', 'arq', 'adv', 'med', 'padre', 'pe',
  'corp', 'ltda', 's/a', 'me', 'etc', 'ex',
  'gov', 'pres', 'sec', 'min', 'dep', 'sen',
  'gen', 'cap', 'maj', 'cel', 'ten', 'sgt',
  'vol', 'pág', 'p', 'no', 'tel', 'av',
]);

/**
 * Split raw text into sentences, respecting Portuguese abbreviations,
 * number formats (1.000, 1.234,56), and dialogue markers (—).
 */
export function segmentText(text) {
  if (!text || !text.trim()) return [];

  // Normalize line breaks: treat multiple newlines as paragraph breaks
  const paragraphs = text.split(/\n{2,}/);

  const sentences = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const paraSentences = splitParagraphIntoSentences(trimmed);
    sentences.push(...paraSentences);
  }

  // Filter out empty/whitespace-only
  return sentences.filter((s) => s.trim().length > 1);
}

/**
 * Split a single paragraph into sentences
 */
function splitParagraphIntoSentences(text) {
  // Strategy: walk through text character by character, tracking state
  // to handle abbreviations, numbers, quotes, and dialogue markers
  const results = [];
  let current = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    current += char;

    // Check if this is a sentence-ending punctuation
    if (char === '.' || char === '!' || char === '?') {
      // Look ahead to decide if this truly ends a sentence
      if (isSentenceEnd(text, i)) {
        // Consume any trailing whitespace and add to results
        let j = i + 1;
        while (j < text.length && text[j] === ' ') j++;

        results.push(current.trim());
        current = '';
        i = j;
        continue;
      }
    }

    // Line break within paragraph → preserve as potential sentence boundary
    if (char === '\n') {
      const trimmed = current.trim();
      if (trimmed.length > 1) {
        results.push(trimmed);
        current = '';
      }
    }

    i++;
  }

  // Don't forget the last segment
  const last = current.trim();
  if (last.length > 1) {
    results.push(last);
  }

  return results;
}

/**
 * Determine if punctuation at position `pos` truly ends a sentence
 */
function isSentenceEnd(text, pos) {
  const char = text[pos];

  // ! and ? always end sentences (unless inside quotes, handled by next char check)
  if (char === '!' || char === '?') {
    return true;
  }

  // For periods: check if it's an abbreviation or number
  if (char === '.') {
    // Check: abbreviation before the period
    if (isAbbreviation(text, pos)) return false;

    // Check: number before the period (1.000, R$ 1.234)
    if (isDecimalSeparator(text, pos)) return false;

    // Check: ellipsis (...)
    if (pos > 0 && text[pos - 1] === '.') return false;
    if (pos + 1 < text.length && text[pos + 1] === '.') return false;

    return true;
  }

  return false;
}

/**
 * Check if the period at `pos` follows a Portuguese abbreviation
 */
function isAbbreviation(text, pos) {
  // Walk backwards to extract the word before the period
  let end = pos - 1;
  while (end >= 0 && text[end] === ' ') end--; // skip spaces

  let start = end;
  while (start >= 0 && /[a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\/]/.test(text[start])) {
    start--;
  }
  start++;

  if (start > end) return false;

  const word = text.slice(start, end + 1).toLowerCase().replace(/[./]/g, '');
  return ABBREVIATIONS.has(word);
}

/**
 * Check if the period at `pos` is a thousands decimal (1.000, 1.234)
 */
function isDecimalSeparator(text, pos) {
  // Period between digits: 1.000
  const before = pos > 0 ? text[pos - 1] : '';
  const after = pos + 1 < text.length ? text[pos + 1] : '';

  if (/\d/.test(before) && /\d/.test(after)) return true;

  return false;
}

/**
 * Split sentences into chunks of maxChars for TTS processing
 * Groups sentences greedily up to maxChars
 */
export function splitIntoChunks(sentences, maxChars = 500) {
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    // If a single sentence exceeds maxChars, it goes in its own chunk
    if (sentence.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(sentence);
      continue;
    }

    // Check if adding this sentence would exceed the limit
    const separator = current ? ' ' : '';
    if (current.length + separator.length + sentence.length > maxChars) {
      chunks.push(current);
      current = sentence;
    } else {
      current += separator + sentence;
    }
  }

  if (current) chunks.push(current);

  return chunks;
}
